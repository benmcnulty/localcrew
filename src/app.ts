import { compactConversation } from "./compact.ts";
import {
  ensureEndpointAlias,
  getDefaultConfig,
  isValidAlias,
  loadConfig,
  saveConfig,
  setEndpointInstructions,
  setEndpointVoicePreset
} from "./config.ts";
import {
  appendChangelogEntry,
  createAgent,
  isValidPreferredResource,
  listAgents,
  loadAgentMemory,
  loadAgentMeta,
  loadAgentSpec,
  loadSystemDocuments,
  loadSystemState,
  resetAgentMemory,
  saveAgentMemory,
  saveAgentSpec,
  saveFocusTodo,
  saveSystemState,
  clearSystemState,
  updateOrchestratorIndex,
  getAgentWorkflowLines
} from "./orchestrator-store.ts";
import {
  getInternalFileDetails,
  getInternalFileTree,
  readInternalFile
} from "./internal-files.ts";
import {
  buildAgentChatMessages,
  buildAutoTaskMessages,
  buildChatMessages,
  buildQueueFillMessages
} from "./messages.ts";
import { chatWithOllamaDetailed, type FetchFn } from "./ollama.ts";
import {
  getResourceEndpoint,
  getResourceProfilesByTier,
  chooseResourceForTask
} from "./resources.ts";
import {
  appendConversationMessages,
  getConversationCompactedUntil,
  getConversationMessages,
  getConversationSummary,
  getEmptySessions,
  loadSessions,
  renameConversationAlias,
  resetConversation,
  saveSessions,
  setConversationCompaction
} from "./session-store.ts";
import { speakText, type WarnFn } from "./speech.ts";
import { getStoragePaths } from "./storage.ts";
import { appendAuditEvent, loadTelemetrySummary, readRecentAuditEvents } from "./telemetry.ts";
import type {
  AgentCreateAnswers,
  AuditEvent,
  AgentMeta,
  AppConfig,
  AssistantConversationMessage,
  AutoQueueTask,
  EndpointConfig,
  Command,
  EditRequest,
  FollowUpRequest,
  ReplMode,
  RuntimeState,
  SessionsFile,
  SystemState,
  TaskPriority,
  TelemetrySummary,
  ViewerRequest,
  WorkflowQuestion,
  WorkflowRequest,
  ChatMessage,
  OllamaChatResult
} from "./types.ts";
import { getVoicePreset, VOICE_PRESETS } from "./voices.ts";
import { searchWikipedia } from "./wikipedia.ts";

const AUTO_COMPACT_MESSAGE_LIMIT = 12;
const AUTO_COMPLETED_TASK_LIMIT = 50;
const AGENT_COMPACT_MESSAGE_LIMIT = 10;
const AUTO_PULSE_INTERVAL_MS = 1500;

function titleCase(value: string): string {
  if (!value) {
    return value;
  }

  return value.slice(0, 1).toUpperCase() + value.slice(1).toLowerCase();
}

function replaceAliasReferences(text: string, oldAlias: string, newAlias: string): string {
  return text
    .replaceAll(`@${oldAlias}`, `@${newAlias}`)
    .replaceAll(titleCase(oldAlias), titleCase(newAlias));
}

function parseAssistantResponse(
  content: string,
  config: AppConfig,
  currentAlias: string
): { replyText: string; followUpRequest?: FollowUpRequest } {
  const trimmedContent = content.trim();
  const match = trimmedContent.match(/(?:^|\n)NEXT:\s*@([a-z0-9_-]+)\s*:\s*(.+)\s*$/is);

  if (!match) {
    return {
      replyText: trimmedContent
    };
  }

  let toAlias: string;
  try {
    toAlias = ensureEndpointAlias(config, match[1].toLowerCase());
  } catch {
    return {
      replyText: trimmedContent
    };
  }

  const suggestedMessage = match[2].trim().replace(/^["“]|["”]$/g, "");
  const replyText = trimmedContent.slice(0, match.index).trimEnd();

  if (toAlias === currentAlias || suggestedMessage === "") {
    return {
      replyText: trimmedContent
    };
  }

  return {
    replyText,
    followUpRequest: {
      fromAlias: currentAlias,
      toAlias,
      message: suggestedMessage
    }
  };
}

function parseWikipediaRequest(content: string): { replyText: string; query?: string } {
  const trimmedContent = content.trim();
  const match = trimmedContent.match(/(?:^|\n)WIKIPEDIA:\s*(.+)\s*$/is);

  if (!match) {
    return {
      replyText: trimmedContent
    };
  }

  const query = match[1].trim().replace(/^["“]|["”]$/g, "");
  const replyText = trimmedContent.slice(0, match.index).trimEnd();

  if (!query) {
    return {
      replyText: trimmedContent
    };
  }

  return {
    replyText,
    query
  };
}

function parseQueuedTasks(content: string): {
  replyText: string;
  queuedTasks: Array<{
    priority: TaskPriority;
    content: string;
    requestedResource?: string;
    requestedModel?: string;
  }>;
} {
  const replyLines: string[] = [];
  const queuedTasks: Array<{
    priority: TaskPriority;
    content: string;
    requestedResource?: string;
    requestedModel?: string;
  }> = [];

  for (const line of content.split("\n")) {
    const match = line
      .trim()
      .match(/^QUEUE\[(high|medium|low)\](?:\[(air|vic|min|pav)\])?(?:\[([^\]]+)\])?:\s*(.+)$/i);
    if (match) {
      queuedTasks.push({
        priority: match[1].toLowerCase() as TaskPriority,
        ...(match[2] ? { requestedResource: match[2].toLowerCase() } : {}),
        ...(match[3] ? { requestedModel: match[3].trim() } : {}),
        content: match[4].trim()
      });
      continue;
    }

    replyLines.push(line);
  }

  return {
    replyText: replyLines.join("\n").trim(),
    queuedTasks
  };
}

function formatTelemetryBucket(summary: TelemetrySummary, key: string): string {
  const bucket = summary.models[key];
  const averageDurationMs =
    bucket && bucket.calls > 0 ? Math.round(bucket.totalDurationMs / bucket.calls) : 0;
  return `${key} ${bucket?.calls ?? 0} call(s), avg ${averageDurationMs}ms, ${bucket?.evalCount ?? 0} eval tokens`;
}

function formatAuditEventLines(event: AuditEvent): string[] {
  const lines = [
    `#${event.id} ${event.timestamp} ${event.kind} ${event.success ? "ok" : "error"}`,
    `scope: ${event.scope}`,
    `summary: ${event.summary}`
  ];

  if (event.resourceAlias || event.model) {
    lines.push(
      `resource: ${event.resourceAlias ?? "(n/a)"}${event.model ? ` / ${event.model}` : ""}`
    );
  }

  if (event.durationMs !== undefined) {
    lines.push(`duration: ${event.durationMs}ms`);
  }

  if (event.requestMessages && event.requestMessages.length > 0) {
    lines.push("");
    lines.push("request:");
    for (const message of event.requestMessages) {
      lines.push(`[${message.role}] ${message.content}`);
    }
  }

  if (event.responseText) {
    lines.push("");
    lines.push("response:");
    lines.push(event.responseText);
  }

  if (event.error) {
    lines.push("");
    lines.push(`error: ${event.error}`);
  }

  return lines;
}

function parseQueueFillOutput(content: string): Array<{ priority: TaskPriority; content: string }> {
  return content
    .split("\n")
    .map((line) => line.trim())
    .map((line) => {
      const match = line.match(/^\[(high|medium|low)\]\s+(.+)$/i);
      if (!match) {
        return null;
      }

      return {
        priority: match[1].toLowerCase() as TaskPriority,
        content: match[2].trim()
      };
    })
    .filter((task): task is { priority: TaskPriority; content: string } => task !== null);
}

function buildPrompt(
  mode: ReplMode,
  currentEndpoint: string,
  defaultEndpoint: string,
  options: {
    currentAgent?: string;
    queueDepth: number;
    priority: TaskPriority;
    autoBusy: boolean;
  }
): string {
  switch (mode) {
    case "chat":
      return `chat[default:@${defaultEndpoint} current:@${currentEndpoint}]> `;
    case "group":
      return `group[default:@${defaultEndpoint} current:@${currentEndpoint}]> `;
    case "auto":
      return `auto[${options.autoBusy ? "busy" : "idle"} priority:${options.priority} queue:${options.queueDepth}]> `;
    case "agent":
      return `agent[@${options.currentAgent ?? "unknown"}]> `;
    default:
      return "crusty> ";
  }
}

function getAgentCreationQuestions(): WorkflowQuestion[] {
  return [
    { key: "name", prompt: "Agent name> " },
    { key: "summary", prompt: "One-line summary> " },
    { key: "mission", prompt: "Mission and responsibility> " },
    { key: "style", prompt: "Personality and response style> " },
    { key: "skills", prompt: "Tool-use and skills guidance> " },
    { key: "preferredResource", prompt: "Preferred resource (air|vic|min|pav|auto)> " }
  ];
}

export interface CommandResult {
  lines: string[];
  errors: string[];
  shouldExit: boolean;
  editRequest?: EditRequest;
  workflowRequest?: WorkflowRequest;
  viewerRequest?: ViewerRequest;
  followUpRequest?: FollowUpRequest;
}

export type SpeakFn = (
  text: string,
  options: {
    enabled: boolean;
    voice?: string;
    warn: WarnFn;
  }
) => void;

export interface ExecuteOptions {
  fetchFn?: FetchFn;
  rootDir?: string;
  speakFn?: SpeakFn;
  warn?: WarnFn;
}

function defaultSpeakFn(
  text: string,
  options: {
    enabled: boolean;
    voice?: string;
    warn: WarnFn;
  }
): void {
  speakText(text, options);
}

export class CrustyApp {
  private config: AppConfig;
  private sessions: SessionsFile;
  private systemState: SystemState;
  private runtime: RuntimeState;
  private readonly rootDir: string;
  private readonly fetchFn?: FetchFn;
  private readonly speakFn: SpeakFn;
  private readonly warn: WarnFn;
  private autoCyclePromise: Promise<CommandResult> | null;

  private constructor(
    config: AppConfig,
    sessions: SessionsFile,
    systemState: SystemState,
    options: ExecuteOptions
  ) {
    this.config = config;
    this.sessions = sessions;
    this.systemState = systemState;
    this.rootDir = options.rootDir ?? process.cwd();
    this.fetchFn = options.fetchFn;
    this.speakFn = options.speakFn ?? defaultSpeakFn;
    this.warn = options.warn ?? (() => {});
    this.autoCyclePromise = null;
    this.runtime = {
      mode: "command",
      currentEndpoint: config.defaultEndpoint
    };
  }

  static async create(options: ExecuteOptions = {}): Promise<CrustyApp> {
    const rootDir = options.rootDir ?? process.cwd();
    const [config, sessions, systemState] = await Promise.all([
      loadConfig(rootDir),
      loadSessions(rootDir),
      loadSystemState(rootDir)
    ]);

    const app = new CrustyApp(config, sessions, systemState, { ...options, rootDir });
    await app.syncSystemFiles();
    return app;
  }

  getPrompt(): string {
    return buildPrompt(this.runtime.mode, this.runtime.currentEndpoint, this.config.defaultEndpoint, {
      currentAgent: this.runtime.currentAgent,
      queueDepth: this.systemState.auto.pending.length,
      priority: this.systemState.auto.defaultPriority,
      autoBusy: this.isAutoBusy()
    });
  }

  isAutoMode(): boolean {
    return this.runtime.mode === "auto" && this.systemState.auto.enabled;
  }

  isAutoBusy(): boolean {
    return this.autoCyclePromise !== null;
  }

  shouldAutoPulse(): boolean {
    return this.isAutoMode() && !this.isAutoBusy();
  }

  getAutoPulseIntervalMs(): number {
    return AUTO_PULSE_INTERVAL_MS;
  }

  async getStatusLines(): Promise<string[]> {
    const [agents, internalFiles, telemetry] = await Promise.all([
      listAgents(this.rootDir),
      getInternalFileDetails(this.rootDir),
      loadTelemetrySummary(this.rootDir)
    ]);
    const nextTask = this.sortPendingTasks(this.systemState.auto.pending)[0];
    const lastCompleted = this.systemState.auto.completed.at(-1);
    const tiers = getResourceProfilesByTier(this.rootDir);
    const topModels = Object.entries(telemetry.models)
      .sort((left, right) => right[1].calls - left[1].calls)
      .slice(0, 3)
      .map(([key]) => key);
    const lastAudit = telemetry.recent[0];

    return [
      "Crusty Status",
      "",
      `Mode: /${this.runtime.mode}`,
      `Auto pulse: ${this.isAutoMode() ? `active every ${AUTO_PULSE_INTERVAL_MS}ms` : "stopped"}`,
      `Orchestrator state: ${this.isAutoBusy() ? "busy" : "idle"}`,
      `Queue: ${this.systemState.auto.pending.length} pending / ${this.systemState.auto.completed.length} completed`,
      `Default auto priority: ${this.systemState.auto.defaultPriority}`,
      `Next task: ${
        nextTask
          ? `#${nextTask.id} [${nextTask.priority}]${
              nextTask.requestedResource ? ` -> ${nextTask.requestedResource}` : ""
            }${nextTask.requestedModel ? `/${nextTask.requestedModel}` : ""} ${nextTask.content}`
          : "(none queued)"
      }`,
      `Last completed: ${
        lastCompleted
          ? `#${lastCompleted.id} via ${lastCompleted.assignedResource ?? "?"}/${lastCompleted.assignedModel ?? "?"}`
          : "(none yet)"
      }`,
      `Top tier: ${tiers.top.map((profile) => `@${profile.alias}`).join(", ") || "(none)"}`,
      `Mid tier: ${tiers.mid.map((profile) => `@${profile.alias}`).join(", ") || "(none)"}`,
      `Low tier: ${tiers.low.map((profile) => `@${profile.alias}`).join(", ") || "(none)"}`,
      `Agents: ${agents.length > 0 ? agents.map((agent) => `@${agent.slug}`).join(", ") : "(none)"}`,
      `Telemetry: ${telemetry.totalEvents} events, ${telemetry.byKind["ollama.chat"] ?? 0} model calls, ${telemetry.wikipedia.calls} wiki searches`,
      `Recent model metrics: ${topModels.length > 0 ? topModels.map((key) => formatTelemetryBucket(telemetry, key)).join(" | ") : "(none yet)"}`,
      `Last audit: ${lastAudit ? `#${lastAudit.id} ${lastAudit.summary}` : "(none yet)"}`,
      `Docs: focus ${internalFiles.focusTodo.modifiedAt} | roadmap ${internalFiles.roadmap.modifiedAt}`,
      `Docs: changelog ${internalFiles.changelog.modifiedAt} | directives ${internalFiles.directives.modifiedAt}`,
      `Internal tree root: ${getStoragePaths(this.rootDir).systemDir}`,
      "",
      "Press Esc to return."
    ];
  }

  async getHudLines(tab: "status" | "detail"): Promise<string[]> {
    const [statusLines, telemetry, auditEvents] = await Promise.all([
      this.getStatusLines(),
      loadTelemetrySummary(this.rootDir),
      readRecentAuditEvents(tab === "detail" ? 6 : 3, this.rootDir)
    ]);

    const tabs = [
      tab === "status" ? "[status]" : " status ",
      tab === "detail" ? "[detail]" : " detail "
    ].join(" ");

    if (tab === "status") {
      const recent = telemetry.recent
        .slice(0, 5)
        .map(
          (event) =>
            `${event.success ? "ok" : "err"} #${event.id} ${event.kind} ${event.scope}: ${event.summary}`
        );

      return [
        `HUD ${tabs}`,
        "",
        ...statusLines.slice(0, -1),
        "",
        "Recent events:",
        ...(recent.length > 0 ? recent : ["(none yet)"]),
        "",
        "Left/Right switches tabs. Esc returns to the prompt."
      ];
    }

    return [
      `HUD ${tabs}`,
      "",
      ...(auditEvents.length > 0
        ? auditEvents.flatMap((event) => [...formatAuditEventLines(event), ""])
        : ["No audit events recorded yet.", ""]),
      "Left/Right switches tabs. Esc returns to the prompt."
    ];
  }

  async getExploreTree(): Promise<{ rootPath: string; lines: string[] }> {
    const tree = await getInternalFileTree(this.rootDir);
    return {
      rootPath: tree.rootPath,
      lines: [
        "Internal Explorer",
        "",
        ...tree.lines,
        "",
        "Type a full path and press Enter to open it. Press Esc to return."
      ]
    };
  }

  async readExploreFile(path: string): Promise<{ path: string; content: string }> {
    const file = await readInternalFile(path, this.rootDir);
    return {
      path: file.path,
      content: file.content
    };
  }

  private async setAutoEnabled(enabled: boolean): Promise<void> {
    this.systemState = {
      ...this.systemState,
      auto: {
        ...this.systemState.auto,
        enabled
      }
    };
    await this.persistSystemState();
  }

  private async stopAutoMode(): Promise<void> {
    await this.setAutoEnabled(false);
    if (this.runtime.mode === "auto") {
      this.runtime = {
        mode: "command",
        currentEndpoint: this.runtime.currentEndpoint,
        currentAgent: undefined
      };
    }
  }

  private async runAutoCycleLocked(run: () => Promise<CommandResult>): Promise<CommandResult> {
    if (this.autoCyclePromise) {
      return {
        lines: [],
        errors: [],
        shouldExit: false
      };
    }

    const cyclePromise = run().finally(() => {
      this.autoCyclePromise = null;
    });
    this.autoCyclePromise = cyclePromise;
    return cyclePromise;
  }

  private async syncSystemFiles(): Promise<void> {
    await saveFocusTodo(this.systemState.auto.pending, this.rootDir);
    const agents = await listAgents(this.rootDir);
    await updateOrchestratorIndex({
      rootDir: this.rootDir,
      queueDepth: this.systemState.auto.pending.length,
      activeAgents: agents.map((agent) => agent.slug)
    });
  }

  getHelpLines(): string[] {
    const modeSummary =
      this.runtime.mode === "chat"
        ? "Current mode: /chat."
        : this.runtime.mode === "group"
          ? "Current mode: /group."
          : this.runtime.mode === "auto"
            ? "Current mode: /auto."
            : this.runtime.mode === "agent"
              ? `Current mode: /agent @${this.runtime.currentAgent}.`
              : "Current mode: command.";

    const firstLine =
      this.runtime.mode === "auto"
        ? `${modeSummary} Plain messages are queued for Erin at ${this.systemState.auto.defaultPriority} priority, and the background pulse keeps the queue moving until /stop.`
        : this.runtime.mode === "agent"
          ? `${modeSummary} Plain messages go to the active agent identity.`
          : `${modeSummary} Plain messages go to @${this.config.defaultEndpoint}, and @alias messages go directly to that participant.`;

    return [
      firstLine,
      `Current participant: @${this.runtime.currentEndpoint} for alias-free /instructions and /voice.`,
      `Auto queue: ${this.systemState.auto.pending.length} pending, ${this.systemState.auto.completed.length} completed.`,
      `Direct message: @alias message`,
      `Crosstalk: @from to @to: "message"`,
      `Commands: /help, /status, /hud, /explore, /chat, /group, /auto, /stop, /agent list, /agent new, /agent edit <name>, /agent <name>, /end`,
      `Commands: /priority [high|medium|low], /model [alias], /default [alias], /rename <old> <new>`,
      `Commands: /instructions [@alias] ["text"], /voice list, /voice [@alias] [preset], /sound [on|off]`,
      "Commands: /compact, /reset, /clear, /exit"
    ];
  }

  private getResolvedAlias(alias?: string): string {
    return ensureEndpointAlias(this.config, alias ?? this.runtime.currentEndpoint);
  }

  private getMessageTarget(alias?: string): string {
    if (alias) {
      return this.getResolvedAlias(alias);
    }

    return this.config.defaultEndpoint;
  }

  private async persistConfig(): Promise<void> {
    await saveConfig(this.config, this.rootDir);
  }

  private async persistSessions(): Promise<void> {
    await saveSessions(this.sessions, this.rootDir);
  }

  private async persistSystemState(): Promise<void> {
    await saveSystemState(this.systemState, this.rootDir);
    await this.syncSystemFiles();
  }

  private async clearApplicationState(): Promise<void> {
    this.config = getDefaultConfig(this.rootDir);
    this.sessions = getEmptySessions();
    await clearSystemState(this.rootDir);
    this.systemState = await loadSystemState(this.rootDir);
    this.autoCyclePromise = null;
    this.runtime = {
      mode: "command",
      currentEndpoint: this.config.defaultEndpoint
    };
    await this.persistConfig();
    await this.persistSessions();
    await this.persistSystemState();
  }

  private async callModel(options: {
    scope: string;
    actor: string;
    endpoint: EndpointConfig;
    resourceAlias: string;
    messages: ChatMessage[];
    summary: string;
    target?: string;
  }): Promise<OllamaChatResult> {
    const started = Date.now();

    try {
      const result = await chatWithOllamaDetailed(options.endpoint, options.messages, this.fetchFn);
      const durationMs =
        typeof result.totalDuration === "number"
          ? Math.round(result.totalDuration / 1_000_000)
          : Date.now() - started;

      await appendAuditEvent(
        {
          timestamp: new Date().toISOString(),
          kind: "ollama.chat",
          scope: options.scope,
          summary: options.summary,
          success: true,
          actor: options.actor,
          resourceAlias: options.resourceAlias,
          target: options.target,
          model: options.endpoint.model,
          durationMs,
          promptMessageCount: options.messages.length,
          promptChars: options.messages.reduce((total, message) => total + message.content.length, 0),
          responseChars: result.text.length,
          promptEvalCount: result.promptEvalCount,
          evalCount: result.evalCount,
          requestMessages: options.messages,
          responseText: result.text
        },
        this.rootDir
      );

      return result;
    } catch (error) {
      await appendAuditEvent(
        {
          timestamp: new Date().toISOString(),
          kind: "ollama.chat",
          scope: options.scope,
          summary: options.summary,
          success: false,
          actor: options.actor,
          resourceAlias: options.resourceAlias,
          target: options.target,
          model: options.endpoint.model,
          durationMs: Date.now() - started,
          promptMessageCount: options.messages.length,
          promptChars: options.messages.reduce((total, message) => total + message.content.length, 0),
          requestMessages: options.messages,
          error: (error as Error).message
        },
        this.rootDir
      );
      throw error;
    }
  }

  private async requestWikipediaSearch(
    query: string,
    scope: string,
    actor: string
  ): Promise<import("./types.ts").WikipediaSearchResult> {
    try {
      const result = await searchWikipedia(query, this.fetchFn);
      await appendAuditEvent(
        {
          timestamp: new Date().toISOString(),
          kind: "wikipedia.search",
          scope,
          summary: `Wikipedia search "${query}" returned ${result.pages.length} page(s).`,
          success: true,
          actor,
          durationMs: result.durationMs,
          responseChars: result.chunks.join("\n\n").length,
          responseText: result.chunks.join("\n\n"),
          metadata: {
            query,
            titles: result.pages.map((page) => page.title)
          }
        },
        this.rootDir
      );
      return result;
    } catch (error) {
      await appendAuditEvent(
        {
          timestamp: new Date().toISOString(),
          kind: "wikipedia.search",
          scope,
          summary: `Wikipedia search "${query}" failed.`,
          success: false,
          actor,
          error: (error as Error).message,
          metadata: {
            query
          }
        },
        this.rootDir
      );
      throw error;
    }
  }

  private async resolveWikipediaTool(options: {
    scope: string;
    actor: string;
    endpoint: EndpointConfig;
    resourceAlias: string;
    messages: ChatMessage[];
    rawReply: string;
    target?: string;
  }): Promise<string> {
    const parsedToolRequest = parseWikipediaRequest(options.rawReply);
    if (!parsedToolRequest.query) {
      return options.rawReply;
    }

    try {
      const wiki = await this.requestWikipediaSearch(
        parsedToolRequest.query,
        `${options.scope}.wikipedia`,
        options.actor
      );
      const followUp = await this.callModel({
        scope: `${options.scope}.wikipedia-followup`,
        actor: options.actor,
        endpoint: options.endpoint,
        resourceAlias: options.resourceAlias,
        target: options.target,
        summary: `Follow-up after Wikipedia search "${parsedToolRequest.query}".`,
        messages: [
          ...options.messages,
          {
            role: "assistant",
            content: options.rawReply
          },
          ...wiki.chunks.map((chunk) => ({
            role: "system" as const,
            content: chunk
          })),
          {
            role: "user",
            content:
              "Use the Wikipedia results above to continue the same task. Produce the final answer now. Only emit another WIKIPEDIA line if the first results were clearly insufficient."
          }
        ]
      });

      return parseWikipediaRequest(followUp.text).replyText || followUp.text;
    } catch (error) {
      this.warn(`Wikipedia search failed: ${(error as Error).message}`);
      return parsedToolRequest.replyText || options.rawReply;
    }
  }

  private async compactIfNeeded(force = false): Promise<boolean> {
    const summaryAlias = this.config.defaultEndpoint;
    const endpoint = this.config.endpoints[summaryAlias];
    const conversationMessages = getConversationMessages(this.sessions);
    const unsummarizedMessages = conversationMessages.slice(
      getConversationCompactedUntil(this.sessions)
    );

    if (unsummarizedMessages.length === 0) {
      return false;
    }

    if (!force && unsummarizedMessages.length < AUTO_COMPACT_MESSAGE_LIMIT) {
      return false;
    }

    const summary = await compactConversation(
      endpoint,
      getConversationSummary(this.sessions),
      unsummarizedMessages,
      async (selectedEndpoint, messages) =>
        (
          await this.callModel({
            scope: "compact.shared",
            actor: "erin",
            endpoint: selectedEndpoint,
            resourceAlias: this.config.defaultEndpoint,
            target: this.config.defaultEndpoint,
            messages,
            summary: "Compacting the shared conversation summary."
          })
        ).text
    );

    this.sessions = setConversationCompaction(this.sessions, {
      compactedUntil: conversationMessages.length,
      summary
    });
    await this.persistSessions();
    return true;
  }

  private async compactAgentIfNeeded(agent: AgentMeta, force = false): Promise<boolean> {
    const memory = await loadAgentMemory(agent.slug, this.rootDir);
    const unsummarizedMessages = memory.conversation.messages.slice(
      memory.conversation.compactedUntil
    );

    if (unsummarizedMessages.length === 0) {
      return false;
    }

    if (!force && unsummarizedMessages.length < AGENT_COMPACT_MESSAGE_LIMIT) {
      return false;
    }

    const selection = chooseResourceForTask(
      "compact private agent memory",
      agent.preferredResource,
      this.rootDir
    );
    const endpoint = getResourceEndpoint(selection.alias, selection.purpose, this.rootDir);
    const summary = await compactConversation(
      endpoint,
      memory.conversation.summary,
      unsummarizedMessages,
      async (selectedEndpoint, messages) =>
        (
          await this.callModel({
            scope: "compact.agent",
            actor: `agent:${agent.slug}`,
            endpoint: selectedEndpoint,
            resourceAlias: selection.alias,
            target: agent.slug,
            messages,
            summary: `Compacting private memory for @${agent.slug}.`
          })
        ).text
    );

    await saveAgentMemory(
      agent.slug,
      {
        conversation: {
          ...memory.conversation,
          compactedUntil: memory.conversation.messages.length,
          summary
        }
      },
      this.rootDir
    );
    return true;
  }

  private async requestModelReply(options: {
    targetAlias: string;
    taskPrompt: string;
    pendingConversationMessage: import("./types.ts").ConversationMessage;
  }): Promise<CommandResult> {
    const normalizedAlias = this.getResolvedAlias(options.targetAlias);

    try {
      await this.compactIfNeeded();
    } catch (error) {
      this.warn(
        `Auto-compaction failed using @${this.config.defaultEndpoint}: ${(error as Error).message}`
      );
    }

    const endpoint = this.config.endpoints[normalizedAlias];
    const recentMessages = getConversationMessages(this.sessions).slice(
      getConversationCompactedUntil(this.sessions)
    );
    const outgoingMessages = buildChatMessages({
      alias: normalizedAlias,
      participants: Object.keys(this.config.endpoints),
      instructions: endpoint.instructions,
      summary: getConversationSummary(this.sessions),
      recentMessages,
      taskPrompt: options.taskPrompt
    });

    let rawAssistantReply: string;
    try {
      rawAssistantReply = (
        await this.callModel({
          scope: "chat.participant",
          actor: `participant:${normalizedAlias}`,
          endpoint,
          resourceAlias: normalizedAlias,
          target: normalizedAlias,
          messages: outgoingMessages,
          summary: `Participant reply requested from @${normalizedAlias}.`
        })
      ).text;
      rawAssistantReply = await this.resolveWikipediaTool({
        scope: "chat.participant",
        actor: `participant:${normalizedAlias}`,
        endpoint,
        resourceAlias: normalizedAlias,
        target: normalizedAlias,
        messages: outgoingMessages,
        rawReply: rawAssistantReply
      });
    } catch (error) {
      return {
        lines: [],
        errors: [
          `Chat failed for ${normalizedAlias} (${endpoint.baseUrl}): ${(error as Error).message}`
        ],
        shouldExit: false
      };
    }

    const parsedReply = parseAssistantResponse(rawAssistantReply, this.config, normalizedAlias);
    const assistantMessage: AssistantConversationMessage = {
      speaker: "assistant",
      endpoint: normalizedAlias,
      content: parsedReply.replyText
    };

    this.sessions = appendConversationMessages(this.sessions, [
      options.pendingConversationMessage,
      assistantMessage
    ]);
    await this.persistSessions();

    try {
      const preset = getVoicePreset(endpoint.voicePreset);
      this.speakFn(parsedReply.replyText, {
        enabled: this.config.soundEnabled,
        voice: preset?.voice,
        warn: this.warn
      });
    } catch (error) {
      this.warn(`Speech failed: ${(error as Error).message}`);
    }

    return {
      lines: [`@${normalizedAlias}: ${parsedReply.replyText}`],
      errors: [],
      shouldExit: false,
      followUpRequest: parsedReply.followUpRequest
    };
  }

  private nextTaskId(): number {
    this.systemState = {
      ...this.systemState,
      auto: {
        ...this.systemState.auto,
        lastTaskId: this.systemState.auto.lastTaskId + 1
      }
    };

    return this.systemState.auto.lastTaskId;
  }

  private sortPendingTasks(tasks: AutoQueueTask[]): AutoQueueTask[] {
    const rank: Record<TaskPriority, number> = {
      high: 0,
      medium: 1,
      low: 2
    };

    return [...tasks].sort((left, right) => {
      if (rank[left.priority] !== rank[right.priority]) {
        return rank[left.priority] - rank[right.priority];
      }

      return left.id - right.id;
    });
  }

  private async enqueueAutoTask(
    content: string,
    priority: TaskPriority,
    createdBy: string,
    options: {
      agentName?: string;
      requestedResource?: string;
      requestedModel?: string;
    } = {}
  ): Promise<AutoQueueTask> {
    const task: AutoQueueTask = {
      id: this.nextTaskId(),
      content,
      priority,
      createdAt: new Date().toISOString(),
      createdBy,
      status: "queued",
      ...(options.requestedResource ? { requestedResource: options.requestedResource } : {}),
      ...(options.requestedModel ? { requestedModel: options.requestedModel } : {}),
      ...(options.agentName ? { agentName: options.agentName } : {})
    };

    this.systemState = {
      ...this.systemState,
      auto: {
        ...this.systemState.auto,
        pending: this.sortPendingTasks([...this.systemState.auto.pending, task])
      }
    };
    await this.persistSystemState();
    return task;
  }

  private async queueParsedTasks(
    queuedTasks: Array<{
      priority: TaskPriority;
      content: string;
      requestedResource?: string;
      requestedModel?: string;
    }>,
    createdBy: string,
    options: {
      agentName?: string;
    } = {}
  ): Promise<AutoQueueTask[]> {
    const addedTasks: AutoQueueTask[] = [];

    for (const task of queuedTasks) {
      if (!task.content.trim()) {
        continue;
      }

      addedTasks.push(
        await this.enqueueAutoTask(task.content, task.priority, createdBy, {
          ...options,
          requestedResource: task.requestedResource,
          requestedModel: task.requestedModel
        })
      );
    }

    return addedTasks;
  }

  private async requestAgentReply(agent: AgentMeta, userMessage: string): Promise<CommandResult> {
    try {
      await this.compactAgentIfNeeded(agent);
    } catch (error) {
      this.warn(`Agent compaction failed for @${agent.slug}: ${(error as Error).message}`);
    }

    const [memory, spec] = await Promise.all([
      loadAgentMemory(agent.slug, this.rootDir),
      loadAgentSpec(agent.slug, this.rootDir)
    ]);
    const selection = chooseResourceForTask(userMessage, agent.preferredResource, this.rootDir);
    const endpoint = getResourceEndpoint(selection.alias, selection.purpose, this.rootDir);
    const outgoingMessages = buildAgentChatMessages({
      agentName: agent.name,
      agentSlug: agent.slug,
      preferredResource: agent.preferredResource,
      spec,
      summary: memory.conversation.summary,
      recentMessages: memory.conversation.messages.slice(memory.conversation.compactedUntil),
      taskPrompt: `USER -> @${agent.slug}: ${userMessage}`
    });

    let rawReply: string;
    try {
      rawReply = (
        await this.callModel({
          scope: "agent.chat",
          actor: `agent:${agent.slug}`,
          endpoint,
          resourceAlias: selection.alias,
          target: agent.slug,
          messages: outgoingMessages,
          summary: `Agent reply requested from @${agent.slug}.`
        })
      ).text;
      rawReply = await this.resolveWikipediaTool({
        scope: "agent.chat",
        actor: `agent:${agent.slug}`,
        endpoint,
        resourceAlias: selection.alias,
        target: agent.slug,
        messages: outgoingMessages,
        rawReply
      });
    } catch (error) {
      return {
        lines: [],
        errors: [
          `Agent chat failed for @${agent.slug} via ${selection.alias} (${endpoint.baseUrl}): ${(error as Error).message}`
        ],
        shouldExit: false
      };
    }

    const parsed = parseQueuedTasks(rawReply);
    const replyText = parsed.replyText || "(No direct reply.)";
    const nextMemory = {
      conversation: {
        ...memory.conversation,
        messages: [
          ...memory.conversation.messages,
          {
            speaker: "user" as const,
            target: agent.slug,
            content: userMessage
          },
          {
            speaker: "assistant" as const,
            endpoint: agent.slug,
            content: replyText
          }
        ]
      }
    };
    await saveAgentMemory(agent.slug, nextMemory, this.rootDir);

    const queued = await this.queueParsedTasks(parsed.queuedTasks, `agent:${agent.slug}`, {
      agentName: agent.slug
    });
    await appendChangelogEntry(
      `Agent @${agent.slug} replied via ${selection.alias}/${endpoint.model}. Queued ${queued.length} follow-up task${queued.length === 1 ? "" : "s"}.`,
      this.rootDir
    );

    return {
      lines: [
        `@${agent.slug}: ${replyText}`,
        ...queued.map(
          (task) =>
            `Queued #${task.id} [${task.priority}]${
              task.requestedResource ? ` -> ${task.requestedResource}` : ""
            }${task.requestedModel ? `/${task.requestedModel}` : ""} from @${agent.slug}: ${task.content}`
        )
      ],
      errors: [],
      shouldExit: false
    };
  }

  private async fillAutoQueue(): Promise<AutoQueueTask[]> {
    if (this.systemState.auto.pending.length > 0) {
      return [];
    }

    const [documents, agents] = await Promise.all([
      loadSystemDocuments(this.rootDir),
      listAgents(this.rootDir)
    ]);
    const endpoint = getResourceEndpoint("air", "reasoning", this.rootDir);
    const outgoingMessages = buildQueueFillMessages({
      directives: documents.directives,
      inventory: documents.inventory,
      roadmap: documents.roadmap,
      focusTodo: documents.focusTodo,
      changelog: documents.changelog,
      orchestratorSummary: documents.orchestratorSummary,
      agents: agents.map((agent) => `@${agent.slug}`)
    });

    let rawReply: string;
    try {
      rawReply = (
        await this.callModel({
          scope: "auto.queue-fill",
          actor: "erin",
          endpoint,
          resourceAlias: "air",
          target: "erin",
          messages: outgoingMessages,
          summary: "Filling the auto queue."
        })
      ).text;
      rawReply = await this.resolveWikipediaTool({
        scope: "auto.queue-fill",
        actor: "erin",
        endpoint,
        resourceAlias: "air",
        target: "erin",
        messages: outgoingMessages,
        rawReply
      });
    } catch (error) {
      return [
        await this.enqueueAutoTask(
          "Review the orchestrator prompts and tighten queue fill guidance after the failed auto-fill attempt.",
          "medium",
          "erin:auto-fill-fallback"
        ),
        await this.enqueueAutoTask(
          `Inspect the last auto-fill failure and capture it in the changelog. Error: ${(error as Error).message}`,
          "low",
          "erin:auto-fill-fallback"
        )
      ];
    }

    const parsedTasks = parseQueueFillOutput(rawReply);
    const tasks =
      parsedTasks.length > 0
        ? parsedTasks
        : [
            {
              priority: "medium" as const,
              content: "Review orchestrator guidance and tighten how resources are selected for queued tasks."
            },
            {
              priority: "low" as const,
              content: "Audit memory and index files for stale or redundant context."
            }
          ];

    return this.queueParsedTasks(tasks, "erin:auto-fill");
  }

  private async processNextAutoTask(): Promise<CommandResult> {
    if (this.systemState.auto.pending.length === 0) {
      return {
        lines: ["Auto queue is empty."],
        errors: [],
        shouldExit: false
      };
    }

    const [task, ...remaining] = this.sortPendingTasks(this.systemState.auto.pending);
    const [documents, agents] = await Promise.all([
      loadSystemDocuments(this.rootDir),
      listAgents(this.rootDir)
    ]);
    const selection = chooseResourceForTask(
      task.content,
      task.requestedResource ?? "auto",
      this.rootDir
    );
    const endpoint = getResourceEndpoint(selection.alias, selection.purpose, this.rootDir);
    if (task.requestedModel) {
      endpoint.model = task.requestedModel;
    }
    const outgoingMessages = buildAutoTaskMessages({
      directives: documents.directives,
      inventory: documents.inventory,
      roadmap: documents.roadmap,
      focusTodo: documents.focusTodo,
      changelog: documents.changelog,
      orchestratorSummary: documents.orchestratorSummary,
      agents: agents.map((agent) => `@${agent.slug}`),
      task: task.content,
      priority: task.priority,
      createdBy: task.createdBy,
      resourceAlias: selection.alias,
      resourceRationale: selection.rationale
    });

    let rawReply: string;
    try {
      rawReply = (
        await this.callModel({
          scope: "auto.task",
          actor: "erin",
          endpoint,
          resourceAlias: selection.alias,
          target: `task:${task.id}`,
          messages: outgoingMessages,
          summary: `Processing auto task #${task.id}.`
        })
      ).text;
      rawReply = await this.resolveWikipediaTool({
        scope: "auto.task",
        actor: "erin",
        endpoint,
        resourceAlias: selection.alias,
        target: `task:${task.id}`,
        messages: outgoingMessages,
        rawReply
      });
    } catch (error) {
      return {
        lines: [],
        errors: [
          `Auto task #${task.id} failed on ${selection.alias} (${endpoint.baseUrl}): ${(error as Error).message}`
        ],
        shouldExit: false
      };
    }

    const parsed = parseQueuedTasks(rawReply);
    const replyText = parsed.replyText || "(No direct result text.)";
    const completedTask: AutoQueueTask = {
      ...task,
      status: "completed",
      assignedResource: selection.alias,
      assignedModel: endpoint.model,
      result: replyText
    };

    this.systemState = {
      ...this.systemState,
      auto: {
        ...this.systemState.auto,
        pending: remaining,
        completed: [...this.systemState.auto.completed, completedTask].slice(
          -AUTO_COMPLETED_TASK_LIMIT
        )
      }
    };
    await this.persistSystemState();
    const queued = await this.queueParsedTasks(parsed.queuedTasks, "erin:auto-processed");
    await appendChangelogEntry(
      `Completed auto task #${task.id} on ${selection.alias}/${endpoint.model}. Queued ${queued.length} follow-up task${queued.length === 1 ? "" : "s"}.`,
      this.rootDir
    );

    return {
      lines: [
        `Erin completed #${task.id} [${task.priority}] via ${selection.alias}/${endpoint.model}.`,
        replyText,
        ...queued.map(
          (queuedTask) =>
            `Queued #${queuedTask.id} [${queuedTask.priority}]${
              queuedTask.requestedResource ? ` -> ${queuedTask.requestedResource}` : ""
            }${queuedTask.requestedModel ? `/${queuedTask.requestedModel}` : ""}: ${queuedTask.content}`
        )
      ],
      errors: [],
      shouldExit: false
    };
  }

  async runIdleCycle(): Promise<CommandResult> {
    if (!this.isAutoMode()) {
      return {
        lines: [],
        errors: [],
        shouldExit: false
      };
    }

    return this.runAutoCycleLocked(async () => {
      if (this.systemState.auto.pending.length === 0) {
        const filled = await this.fillAutoQueue();
        if (filled.length > 0) {
          return {
            lines: [
              `Erin filled the queue with ${filled.length} self-improvement task${filled.length === 1 ? "" : "s"}.`,
              ...filled.map((task) => `Queued #${task.id} [${task.priority}]: ${task.content}`)
            ],
            errors: [],
            shouldExit: false
          };
        }
      }

      return this.processNextAutoTask();
    });
  }

  async updateInstructions(alias: string, text: string): Promise<CommandResult> {
    const normalizedAlias = this.getResolvedAlias(alias);
    this.config = setEndpointInstructions(this.config, normalizedAlias, text);
    await this.persistConfig();

    return {
      lines: [`Updated instructions for @${normalizedAlias}.`],
      errors: [],
      shouldExit: false
    };
  }

  async createAgentFromWorkflow(answers: AgentCreateAnswers): Promise<CommandResult> {
    const normalizedAnswers: AgentCreateAnswers = {
      ...answers,
      name: answers.name.trim(),
      summary: answers.summary.trim(),
      mission: answers.mission.trim(),
      style: answers.style.trim(),
      skills: answers.skills.trim(),
      preferredResource: answers.preferredResource.trim().toLowerCase()
    };

    if (
      !normalizedAnswers.name ||
      !normalizedAnswers.summary ||
      !normalizedAnswers.mission ||
      !normalizedAnswers.style ||
      !normalizedAnswers.skills
    ) {
      return {
        lines: [],
        errors: ["Agent creation requires values for every workflow prompt."],
        shouldExit: false
      };
    }

    if (!isValidPreferredResource(normalizedAnswers.preferredResource, this.rootDir)) {
      return {
        lines: [],
        errors: ['Preferred resource must be one of "air", "vic", "min", "pav", or "auto".'],
        shouldExit: false
      };
    }

    let generatedSpec: string | undefined;
    try {
      const documents = await loadSystemDocuments(this.rootDir);
      const endpoint = getResourceEndpoint("air", "reasoning", this.rootDir);
      const specMessages: ChatMessage[] = [
          {
            role: "system",
            content: [
              "You are Erin, the orchestrator identity.",
              "Draft a concise markdown agent specification from the provided workflow answers.",
              "Preserve the exact agent name.",
              "Include sections for Summary, Mission, Personality And Response Guidance, Tool Use And Skills Training, Preferred Resource, and Queue Delegation Guidance.",
              "Output markdown only."
            ].join(" ")
          },
          {
            role: "system",
            content: `Workflow guidance:\n${documents.workflow.trim()}`
          },
          {
            role: "user",
            content: [
              `Name: ${normalizedAnswers.name}`,
              `Summary: ${normalizedAnswers.summary}`,
              `Mission: ${normalizedAnswers.mission}`,
              `Style: ${normalizedAnswers.style}`,
              `Skills: ${normalizedAnswers.skills}`,
              `Preferred resource: ${normalizedAnswers.preferredResource}`
            ].join("\n")
          }
        ];
      generatedSpec = (
        await this.callModel({
          scope: "agent.create",
          actor: "erin",
          endpoint,
          resourceAlias: "air",
          target: normalizedAnswers.name,
          messages: specMessages,
          summary: `Generating the initial specification for @${normalizedAnswers.name}.`
        })
      ).text;
    } catch {
      generatedSpec = undefined;
    }

    const agent = await createAgent(normalizedAnswers, this.rootDir, generatedSpec);
    await this.syncSystemFiles();
    await appendChangelogEntry(`Created agent @${agent.slug}.`, this.rootDir);

    return {
      lines: [
        `Created agent @${agent.slug}.`,
        `Preferred resource: ${agent.preferredResource}.`,
        `Summary: ${agent.summary}`
      ],
      errors: [],
      shouldExit: false
    };
  }

  async updateAgentSpec(name: string, text: string): Promise<CommandResult> {
    const agent = await saveAgentSpec(name, text, this.rootDir);
    await this.syncSystemFiles();
    await appendChangelogEntry(`Updated specification for @${agent.slug}.`, this.rootDir);

    return {
      lines: [`Updated specification for @${agent.slug}.`],
      errors: [],
      shouldExit: false
    };
  }

  async execute(command: Command): Promise<CommandResult> {
    try {
      if (command.type === "message") {
        const userMessage = command.text.trim();

        if (command.alias && !userMessage) {
          return {
            lines: [],
            errors: [`Enter a message after @${command.alias}.`],
            shouldExit: false
          };
        }

        if (!userMessage) {
          return {
            lines: [],
            errors: ["Enter a message."],
            shouldExit: false
          };
        }

        if (this.runtime.mode === "auto") {
          const task = await this.enqueueAutoTask(
            userMessage,
            this.systemState.auto.defaultPriority,
            "user"
          );
          const processed = await this.runIdleCycle();
          return {
            lines: [
              `Queued #${task.id} [${task.priority}]: ${task.content}`,
              ...processed.lines
            ],
            errors: processed.errors,
            shouldExit: false
          };
        }

        if (this.runtime.mode === "agent") {
          const currentAgent = this.runtime.currentAgent;
          if (!currentAgent) {
            return {
              lines: [],
              errors: ["No active agent."],
              shouldExit: false
            };
          }

          const agent = await loadAgentMeta(currentAgent, this.rootDir);
          return this.requestAgentReply(agent, userMessage);
        }

        const targetAlias = this.getMessageTarget(command.alias);
        return this.requestModelReply({
          targetAlias,
          taskPrompt: `USER -> @${targetAlias}: ${userMessage}`,
          pendingConversationMessage: {
            speaker: "user",
            target: targetAlias,
            content: userMessage
          }
        });
      }

      if (command.type === "crosstalk") {
        const fromAlias = this.getResolvedAlias(command.fromAlias);
        const toAlias = this.getResolvedAlias(command.toAlias);

        if (fromAlias === toAlias) {
          return {
            lines: [],
            errors: ["Crosstalk must target a different participant."],
            shouldExit: false
          };
        }

        const crosstalkMessage = command.text.trim();
        if (!crosstalkMessage) {
          return {
            lines: [],
            errors: ["Enter a crosstalk message."],
            shouldExit: false
          };
        }

        return this.requestModelReply({
          targetAlias: toAlias,
          taskPrompt: `@${fromAlias} to @${toAlias}: ${crosstalkMessage}`,
          pendingConversationMessage: {
            speaker: "assistant",
            endpoint: fromAlias,
            directedTo: toAlias,
            content: crosstalkMessage
          }
        });
      }

      if (command.type === "exit") {
        return {
          lines: ["Exiting."],
          errors: [],
          shouldExit: true
        };
      }

      if (command.type === "help") {
        return {
          lines: this.getHelpLines(),
          errors: [],
          shouldExit: false
        };
      }

      if (command.type === "status") {
        return {
          lines: [],
          errors: [],
          shouldExit: false,
          viewerRequest: {
            kind: "status"
          }
        };
      }

      if (command.type === "hud") {
        return {
          lines: [],
          errors: [],
          shouldExit: false,
          viewerRequest: {
            kind: "hud"
          }
        };
      }

      if (command.type === "explore") {
        return {
          lines: [],
          errors: [],
          shouldExit: false,
          viewerRequest: {
            kind: "explore"
          }
        };
      }

      if (command.type === "chatMode") {
        await this.setAutoEnabled(false);
        this.runtime = {
          ...this.runtime,
          mode: "chat",
          currentAgent: undefined
        };
        return {
          lines: [
            `Entered chat mode. Plain messages go to @${this.config.defaultEndpoint}; use @alias to target another participant.`
          ],
          errors: [],
          shouldExit: false
        };
      }

      if (command.type === "groupMode") {
        await this.setAutoEnabled(false);
        this.runtime = {
          ...this.runtime,
          mode: "group",
          currentAgent: undefined
        };
        return {
          lines: [
            `Entered group mode. Plain messages go to @${this.config.defaultEndpoint}; use @alias or @from to @to for directed turns.`
          ],
          errors: [],
          shouldExit: false
        };
      }

      if (command.type === "autoMode") {
        await this.setAutoEnabled(true);
        this.runtime = {
          ...this.runtime,
          mode: "auto",
          currentAgent: undefined
        };
        return {
          lines: [
            `Entered auto mode. Plain messages are queued at ${this.systemState.auto.defaultPriority} priority.`,
            "The background pulse will keep Erin moving until /stop."
          ],
          errors: [],
          shouldExit: false
        };
      }

      if (command.type === "stopAuto") {
        if (!this.isAutoMode()) {
          return {
            lines: ["Auto mode is not running."],
            errors: [],
            shouldExit: false
          };
        }

        await this.stopAutoMode();
        return {
          lines: ["Auto mode stopped."],
          errors: [],
          shouldExit: false
        };
      }

      if (command.type === "endMode") {
        await this.setAutoEnabled(false);
        this.runtime = {
          mode: "command",
          currentEndpoint: this.runtime.currentEndpoint,
          currentAgent: undefined
        };
        return {
          lines: ["Exited active mode."],
          errors: [],
          shouldExit: false
        };
      }

      if (command.type === "priority.get") {
        return {
          lines: [`Auto priority: ${this.systemState.auto.defaultPriority}`],
          errors: [],
          shouldExit: false
        };
      }

      if (command.type === "priority.set") {
        this.systemState = {
          ...this.systemState,
          auto: {
            ...this.systemState.auto,
            defaultPriority: command.priority
          }
        };
        await this.persistSystemState();
        return {
          lines: [`Auto priority is now ${command.priority}.`],
          errors: [],
          shouldExit: false
        };
      }

      if (command.type === "agent.list") {
        const agents = await listAgents(this.rootDir);
        return {
          lines:
            agents.length === 0
              ? ["No agents yet. Use /agent new."]
              : agents.map(
                  (agent) =>
                    `@${agent.slug}: ${agent.summary} (preferred resource: ${agent.preferredResource})`
                ),
          errors: [],
          shouldExit: false
        };
      }

      if (command.type === "agent.new") {
        const introLines = await getAgentWorkflowLines(this.rootDir);
        return {
          lines: [],
          errors: [],
          shouldExit: false,
          workflowRequest: {
            kind: "agent.create",
            introLines,
            questions: getAgentCreationQuestions()
          }
        };
      }

      if (command.type === "agent.chat") {
        const agent = await loadAgentMeta(command.name, this.rootDir);
        await this.setAutoEnabled(false);
        this.runtime = {
          ...this.runtime,
          mode: "agent",
          currentAgent: agent.slug
        };
        return {
          lines: [
            `Entered agent mode with @${agent.slug}. Plain messages now go to that agent identity.`
          ],
          errors: [],
          shouldExit: false
        };
      }

      if (command.type === "agent.edit") {
        const agent = await loadAgentMeta(command.name, this.rootDir);
        const spec = await loadAgentSpec(agent.slug, this.rootDir);
        return {
          lines: [],
          errors: [],
          shouldExit: false,
          editRequest: {
            kind: "agentSpec",
            target: agent.slug,
            prompt: `agent[@${agent.slug}]> `,
            initialText: spec
          }
        };
      }

      if (command.type === "model.get") {
        return {
          lines: [
            `Current participant: @${this.runtime.currentEndpoint}. Plain messages still go to @${this.config.defaultEndpoint}.`
          ],
          errors: [],
          shouldExit: false
        };
      }

      if (command.type === "model.set") {
        this.runtime.currentEndpoint = this.getResolvedAlias(command.alias);
        return {
          lines: [
            `Current participant is now @${this.runtime.currentEndpoint}. Plain messages still go to @${this.config.defaultEndpoint}.`
          ],
          errors: [],
          shouldExit: false
        };
      }

      if (command.type === "default.get") {
        return {
          lines: [`Default endpoint: @${this.config.defaultEndpoint}`],
          errors: [],
          shouldExit: false
        };
      }

      if (command.type === "default.set") {
        this.config = {
          ...this.config,
          defaultEndpoint: this.getResolvedAlias(command.alias)
        };
        await this.persistConfig();
        return {
          lines: [`Default endpoint is now @${this.config.defaultEndpoint}.`],
          errors: [],
          shouldExit: false
        };
      }

      if (command.type === "rename") {
        if (!isValidAlias(command.toAlias)) {
          return {
            lines: [],
            errors: [
              `Invalid alias "${command.toAlias}". Use lowercase letters, numbers, "_" or "-", starting with a letter.`
            ],
            shouldExit: false
          };
        }

        const fromAlias = this.getResolvedAlias(command.fromAlias);
        const toAlias = command.toAlias.toLowerCase();

        if (fromAlias === toAlias) {
          return {
            lines: [],
            errors: ["The new alias must be different from the current alias."],
            shouldExit: false
          };
        }

        if (this.config.endpoints[toAlias]) {
          return {
            lines: [],
            errors: [`Endpoint alias "${toAlias}" already exists.`],
            shouldExit: false
          };
        }

        const renamedEndpoint = this.config.endpoints[fromAlias];
        const renamedInstructions = replaceAliasReferences(
          renamedEndpoint.instructions,
          fromAlias,
          toAlias
        );

        this.config = {
          ...this.config,
          defaultEndpoint:
            this.config.defaultEndpoint === fromAlias ? toAlias : this.config.defaultEndpoint,
          endpoints: Object.entries(this.config.endpoints).reduce<AppConfig["endpoints"]>(
            (accumulator, [alias, endpoint]) => {
              if (alias === fromAlias) {
                accumulator[toAlias] = {
                  ...endpoint,
                  instructions: renamedInstructions
                };
                return accumulator;
              }

              accumulator[alias] = endpoint;
              return accumulator;
            },
            {}
          )
        };

        this.sessions = renameConversationAlias(this.sessions, fromAlias, toAlias);
        this.runtime = {
          ...this.runtime,
          currentEndpoint:
            this.runtime.currentEndpoint === fromAlias ? toAlias : this.runtime.currentEndpoint
        };

        await this.persistConfig();
        await this.persistSessions();

        return {
          lines: [`Renamed @${fromAlias} to @${toAlias}.`],
          errors: [],
          shouldExit: false
        };
      }

      if (command.type === "sound.toggle" || command.type === "sound.set") {
        this.config = {
          ...this.config,
          soundEnabled:
            command.type === "sound.toggle" ? !this.config.soundEnabled : command.enabled
        };
        await this.persistConfig();
        return {
          lines: [`Sound is now ${this.config.soundEnabled ? "on" : "off"}.`],
          errors: [],
          shouldExit: false
        };
      }

      if (command.type === "voice.list") {
        return {
          lines: VOICE_PRESETS.map(
            (preset) => `${preset.key}: ${preset.description} (${preset.voice})`
          ),
          errors: [],
          shouldExit: false
        };
      }

      if (command.type === "voice.get") {
        const alias = this.getResolvedAlias(command.alias);
        const preset = getVoicePreset(this.config.endpoints[alias].voicePreset);
        return {
          lines: [
            `Voice for @${alias}: ${this.config.endpoints[alias].voicePreset}${
              preset ? ` (${preset.voice})` : ""
            }`
          ],
          errors: [],
          shouldExit: false
        };
      }

      if (command.type === "voice.set") {
        const alias = this.getResolvedAlias(command.alias);
        try {
          this.config = setEndpointVoicePreset(this.config, alias, command.preset);
          await this.persistConfig();
        } catch (error) {
          return {
            lines: [],
            errors: [(error as Error).message],
            shouldExit: false
          };
        }

        const preset = getVoicePreset(this.config.endpoints[alias].voicePreset);

        return {
          lines: [
            `Voice for @${alias} is now ${this.config.endpoints[alias].voicePreset}${
              preset ? ` (${preset.voice})` : ""
            }.`
          ],
          errors: [],
          shouldExit: false
        };
      }

      if (command.type === "instructions.edit") {
        const alias = this.getResolvedAlias(command.alias);
        return {
          lines: [],
          errors: [],
          shouldExit: false,
          editRequest: {
            kind: "instructions",
            target: alias,
            prompt: `instructions[@${alias}]> `,
            initialText: this.config.endpoints[alias].instructions
          }
        };
      }

      if (command.type === "instructions.set") {
        const alias = this.getResolvedAlias(command.alias);
        return this.updateInstructions(alias, command.text);
      }

      if (command.type === "reset") {
        if (this.runtime.mode === "agent" && this.runtime.currentAgent) {
          await resetAgentMemory(this.runtime.currentAgent, this.rootDir);
          return {
            lines: [`Reset private memory for @${this.runtime.currentAgent}.`],
            errors: [],
            shouldExit: false
          };
        }

        if (this.runtime.mode === "auto") {
          this.systemState = {
            ...this.systemState,
            auto: {
              ...this.systemState.auto,
              pending: [],
              completed: []
            }
          };
          await this.persistSystemState();
          return {
            lines: ["Auto queue reset."],
            errors: [],
            shouldExit: false
          };
        }

        this.sessions = resetConversation(this.sessions);
        await this.persistSessions();
        return {
          lines: ["Conversation reset."],
          errors: [],
          shouldExit: false
        };
      }

      if (command.type === "clear") {
        await this.clearApplicationState();
        return {
          lines: ["Application state cleared."],
          errors: [],
          shouldExit: false
        };
      }

      if (command.type === "compact") {
        if (this.runtime.mode === "agent" && this.runtime.currentAgent) {
          const agent = await loadAgentMeta(this.runtime.currentAgent, this.rootDir);
          const compacted = await this.compactAgentIfNeeded(agent, true);
          return {
            lines: [compacted ? `Compacted private memory for @${agent.slug}.` : "Nothing to compact."],
            errors: [],
            shouldExit: false
          };
        }

        try {
          const compacted = await this.compactIfNeeded(true);
          return {
            lines: [
              compacted
                ? `Compacted shared conversation using @${this.config.defaultEndpoint}.`
                : "Nothing to compact."
            ],
            errors: [],
            shouldExit: false
          };
        } catch (error) {
          return {
            lines: [],
            errors: [
              `Compaction failed using @${this.config.defaultEndpoint}: ${(error as Error).message}`
            ],
            shouldExit: false
          };
        }
      }

      return {
        lines: [],
        errors: ["Unhandled command."],
        shouldExit: false
      };
    } catch (error) {
      return {
        lines: [],
        errors: [(error as Error).message],
        shouldExit: false
      };
    }
  }
}
