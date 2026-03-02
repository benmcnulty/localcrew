import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { compactConversation } from "./compact.ts";
import {
  addEndpoint,
  ensureEndpointAlias,
  getDefaultConfig,
  isValidAlias,
  loadConfig,
  removeEndpoint,
  resolveEndpointConfig,
  saveConfig,
  setEndpointModel,
  setEndpointModelPolicy,
  setEndpointNickname,
  setEndpointPurposeModel,
  setEndpointResourceAlias,
  setEndpointInstructions,
  setOrchestratorName,
  setEndpointVoicePreset,
  setPreference
} from "./config.ts";
import { getEnvNumber } from "./env.ts";
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
  getAgentWorkflowLines,
  startDailySession,
  recordDailyTaskCompletion,
  completeDailySession,
  buildDailyDigest
} from "./orchestrator-store.ts";
import {
  getInternalFileDetails,
  getInternalFileTree,
  readInternalFile
} from "./internal-files.ts";
import {
  clearDropboxState,
  ensureDropboxLayout,
  getDropboxPaths,
  getDropboxSnapshot,
  ingestNextInboxDocument,
  moveActiveDocumentToOutbox,
  readActiveDropboxDocument,
  writeInboxDocument,
  writeGeneratedDropboxDocument
} from "./dropbox.ts";
import {
  buildAgentChatMessages,
  buildAutoTaskMessages,
  buildChatMessages,
  buildQueueFillFinalizeMessages,
  buildQueueFillMessages,
  buildQueueFillReviewMessages,
  buildTaskPreflightMessages
} from "./messages.ts";
import { chatWithOllamaDetailed, listOllamaModels, type FetchFn } from "./ollama.ts";
import { probeResourceModels } from "./resource-discovery.ts";
import {
  addResource,
  chooseResourceForTask,
  detectTaskPurpose,
  getResourceCapacitySummary,
  getOrchestratorResourceAlias,
  getResourceEndpoint,
  getResourceProfile,
  getResourceProfilesByTier,
  listResources,
  removeResource,
  renderResourceInventory,
  selectModelForEndpoint,
  updateResource
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
import { isSpeechSupported, speakText, type WarnFn } from "./speech.ts";
import { getStoragePaths, type StoragePaths } from "./storage.ts";
import { appendAuditEvent, loadTelemetrySummary, readRecentAuditEvents } from "./telemetry.ts";
import type {
  AgentCreateAnswers,
  AuditEvent,
  AgentMeta,
  AppConfig,
  AssistantConversationMessage,
  AutoQueueTask,
  DailyWorkSession,
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
  OllamaChatResult,
  ResourceSyncReport
} from "./types.ts";
import { getVoicePreset, VOICE_PRESETS } from "./voices.ts";
import { searchWikipedia } from "./wikipedia.ts";
import { searchReddit } from "./reddit.ts";
import { searchWeb, isAllowedSearchTopic } from "./web-search.ts";
import { fetchPageText } from "./page-fetcher.ts";
import { fetchWeather } from "./weather.ts";
import { fetchBenLive } from "./benlive.ts";
import { fetchWebsite } from "./website.ts";
import { formatCurrentDateTime, titleCase } from "./utils.ts";

const AUTO_COMPACT_MESSAGE_LIMIT = 12;
const AUTO_COMPLETED_TASK_LIMIT = 50;
const AGENT_COMPACT_MESSAGE_LIMIT = 10;
const AUTONOMOUS_EXTERNAL_CHANGE_PATTERN =
  /\b(deploy|restart|reboot|reconfigure|install|uninstall|upgrade|downgrade|open\s+firewall|allow\s+inbound|allowlist|pf\s+anchor|registry|service\b|daemon\b|kill\s+process|terminate\s+process|pull\s+model|delete\s+model|remove\s+model)\b/i;
const AUTONOMOUS_EXTERNAL_FEATURE_PATTERN =
  /\b(build|implement|create|add|expose|integrate|refactor|run|start|write|review|finalize|plan|design|specify)\b[\s\S]{0,120}\b(api|endpoint|ui|gui|browser|server|script|collector|service|daemon|python|javascript|typescript|node\b|bun\b|package|test|hud|auth|firebase|stripe|portal|web)\b/i;
const AUTONOMOUS_DISALLOWED_FILE_PATH_PATTERN =
  /(?:^|\/)(?:scripts?|bin|src|app|api|server|client|public|dist|build|test|tests|__tests__)\//i;
const AUTONOMOUS_DISALLOWED_FILE_EXTENSION_PATTERN =
  /\.(?:py|js|mjs|cjs|ts|tsx|jsx|sh|bash|zsh|ps1|bat|cmd|rb|php|pl|lua|java|go|rs|swift|kt|scala|cs|cpp|c|h|hpp|sql)$/i;
const LOW_INFORMATION_AUTONOMOUS_TASK_PATTERN =
  /^(?:implement|review|compare|evaluate|check|analyze|analysis|fix|optimize|improve|research|plan|draft|refine|update|test|verify|document|write|summarize|summarise|create|build|design|explore|investigate|audit)$/i;
const INTERNAL_MEMORY_PATH_HINT_PATTERN =
  /(?:^|\/)(?:internal|internal-memory|memory|index|indexes|summary|summaries|heuristics|routing|telemetry|diagnostics|notes|verification|plans)(?:\/|[-_])/i;
const INTERNAL_WIKIPEDIA_QUERY_PATTERN =
  /\b(crusty|ollama|orchestrator|safe mode|safe-mode|queue|routing|model(?:\s+is\s+required)?|telemetry|hud|prompt|resource alias|erin|zora|min|pav)\b/i;
const INTERNAL_REDDIT_QUERY_PATTERN =
  /\b(crusty|orchestrator|safe mode|safe-mode|queue|routing|telemetry|hud|resource alias|erin|zora|min|pav)\b/i;
const INTERNAL_SEARCH_QUERY_PATTERN =
  /\b(crusty|orchestrator|safe mode|safe-mode|queue|routing|telemetry|hud|resource alias|erin|zora|min|pav)\b/i;
const DEFAULT_AUTO_PULSE_INTERVAL_MS = 1500;
const DEFAULT_AUTO_SOURCE_DOCUMENT_CHAR_LIMIT = 12_000;

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

function parseRedditRequest(content: string): { replyText: string; query?: string } {
  const trimmedContent = content.trim();
  const match = trimmedContent.match(/(?:^|\n)REDDIT:\s*(.+)\s*$/is);

  if (!match) {
    return {
      replyText: trimmedContent
    };
  }

  const query = match[1].trim().replace(/^[""]|[""]$/g, "");
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

function parseSearchRequest(content: string): { replyText: string; query?: string; topic?: string } {
  const trimmedContent = content.trim();
  const match = trimmedContent.match(/(?:^|\n)SEARCH\[([^\]]+)\]:\s*(.+)\s*$/is);

  if (!match) {
    return { replyText: trimmedContent };
  }

  const topic = match[1].trim().toLowerCase();
  const query = match[2].trim().replace(/^[""]|[""]$/g, "");
  const replyText = trimmedContent.slice(0, match.index).trimEnd();

  if (!query || !topic) {
    return { replyText: trimmedContent };
  }

  return { replyText, query, topic };
}

function parseSearchSelectResponse(content: string): { replyText: string; indices?: number[] } {
  const trimmedContent = content.trim();
  const match = trimmedContent.match(/(?:^|\n)SEARCH_SELECT:\s*(.+)\s*$/is);

  if (!match) {
    return { replyText: trimmedContent };
  }

  const raw = match[1].trim();
  const replyText = trimmedContent.slice(0, match.index).trimEnd();
  const indices = raw
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n >= 1);

  if (indices.length === 0) {
    return { replyText: trimmedContent };
  }

  return { replyText, indices };
}

function parseWeatherRequest(content: string): { replyText: string; location?: string } {
  const trimmedContent = content.trim();
  const match = trimmedContent.match(/(?:^|\n)WEATHER:\s*(.*)\s*$/is);

  if (!match) {
    return { replyText: trimmedContent };
  }

  const location = match[1].trim().replace(/^[""]|[""]$/g, "");
  const replyText = trimmedContent.slice(0, match.index).trimEnd();

  return { replyText, location: location || undefined };
}

function parseBenLiveRequest(content: string): { replyText: string; topicOrPath?: string } {
  const trimmedContent = content.trim();
  const match = trimmedContent.match(/(?:^|\n)BENLIVE:\s*(.+)\s*$/is);

  if (!match) {
    return { replyText: trimmedContent };
  }

  const topicOrPath = match[1].trim().replace(/^[""]|[""]$/g, "");
  const replyText = trimmedContent.slice(0, match.index).trimEnd();

  if (!topicOrPath) {
    return { replyText: trimmedContent };
  }

  return { replyText, topicOrPath };
}

function parseWebsiteRequest(content: string): { replyText: string; topicOrPath?: string } {
  const trimmedContent = content.trim();
  const match = trimmedContent.match(/(?:^|\n)WEBSITE:\s*(.+)\s*$/is);

  if (!match) {
    return { replyText: trimmedContent };
  }

  const topicOrPath = match[1].trim().replace(/^[""]|[""]$/g, "");
  const replyText = trimmedContent.slice(0, match.index).trimEnd();

  if (!topicOrPath) {
    return { replyText: trimmedContent };
  }

  return { replyText, topicOrPath };
}

function parseQueuedTasks(content: string): {
  replyText: string;
  queuedTasks: Array<{
    priority: TaskPriority;
    content: string;
    delegationRole?: string;
    requestedResource?: string;
    requestedModel?: string;
  }>;
  fileWrites: Array<{
    stage: "active" | "outbox" | "internal";
    filename: string;
    content: string;
  }>;
} {
  const replyLines: string[] = [];
  const queuedTasks: Array<{
    priority: TaskPriority;
    content: string;
    delegationRole?: string;
    requestedResource?: string;
    requestedModel?: string;
  }> = [];
  const fileWrites: Array<{
    stage: "active" | "outbox" | "internal";
    filename: string;
    content: string;
  }> = [];

  const writePattern =
    /(?:^|\n)WRITE\[(active|outbox|internal)\]\[([^\]\n]+)\]\n([\s\S]*?)\nENDWRITE(?=\n|$)/gi;
  let workingContent = content;
  let writeMatch: RegExpExecArray | null;
  while ((writeMatch = writePattern.exec(content)) !== null) {
    fileWrites.push({
      stage: writeMatch[1].toLowerCase() as "active" | "outbox" | "internal",
      filename: writeMatch[2].trim(),
      content: writeMatch[3].trimEnd()
    });
    workingContent = workingContent.replace(writeMatch[0], "\n");
  }

  for (const line of workingContent.split("\n")) {
    const match = line
      .trim()
      .match(
        /^QUEUE\[(high|medium|low)\](?:\[([a-z][a-z0-9_-]*)\])?(?:\[([^\]]+)\])?(?:\{([^}\n]+)\})?:\s*(.+)$/i
      );
    if (match) {
      queuedTasks.push({
        priority: match[1].toLowerCase() as TaskPriority,
        ...(match[2] ? { requestedResource: match[2].toLowerCase() } : {}),
        ...(match[3] ? { requestedModel: match[3].trim() } : {}),
        ...(match[4] ? { delegationRole: match[4].trim() } : {}),
        content: match[5].trim()
      });
      continue;
    }

    // Strip the DAILY_COMPLETE signal from visible reply text.
    if (/^DAILY_COMPLETE\s*$/i.test(line.trim())) {
      continue;
    }

    replyLines.push(line);
  }

  return {
    replyText: replyLines.join("\n").trim(),
    queuedTasks,
    fileWrites
  };
}

function isLoopbackHost(value: string): boolean {
  return ["127.0.0.1", "localhost", "::1"].includes(value.toLowerCase());
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

function parseQueueReviewVerdict(content: string): "approve" | "revise" {
  const match = content.trim().match(/(?:^|\n)VERDICT:\s*(approve|revise)\s*$/i);
  return match && match[1].toLowerCase() === "approve" ? "approve" : "revise";
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

function truncateForPrompt(content: string, limit: number): { text: string; truncated: boolean } {
  if (content.length <= limit) {
    return { text: content, truncated: false };
  }

  return {
    text: `${content.slice(0, limit)}\n\n[truncated by Crusty after ${limit} characters]`,
    truncated: true
  };
}

function ensureSafeGeneratedRelativePath(value: string): string {
  const trimmed = value.replaceAll("\\", "/").trim().replace(/^\/+/, "");
  if (!trimmed) {
    throw new Error("A relative path is required.");
  }

  const segments = trimmed.split("/").filter(Boolean);
  if (segments.length === 0) {
    throw new Error("A relative path is required.");
  }

  for (const segment of segments) {
    if (segment === "." || segment === "..") {
      throw new Error("Relative paths may not escape the workspace.");
    }

    if (segment.startsWith(".")) {
      throw new Error("Hidden file names are reserved.");
    }
  }

  return segments.join("/");
}

function toKebabSlug(value: string, fallback = "ticket"): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return slug || fallback;
}

function formatAuditEventLine(event: AuditEvent): string {
  return `- ${event.timestamp} [${event.kind}] ${event.scope}: ${event.summary}${event.success ? "" : " (failed)"}`;
}

function isLowInformationAutonomousTask(content: string): boolean {
  const normalized = content.trim().replace(/[“”"]/g, "");
  if (!normalized) {
    return true;
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length >= 5) {
    return false;
  }

  if (LOW_INFORMATION_AUTONOMOUS_TASK_PATTERN.test(normalized)) {
    return true;
  }

  return words.length <= 2;
}

function summarizeRecentAutoTasks(
  completed: AutoQueueTask[],
  limit = 100
): {
  completedCount: number;
  failureCount: number;
  modelUsage: Array<{ key: string; count: number }>;
  failureReasons: Array<{ reason: string; count: number }>;
} {
  const recent = completed.slice(-limit);
  const modelCounts = new Map<string, number>();
  const failureCounts = new Map<string, number>();

  for (const task of recent) {
    const modelKey =
      task.assignedResource && task.assignedModel
        ? `${task.assignedResource}/${task.assignedModel}`
        : task.assignedResource
          ? `${task.assignedResource}/(default)`
          : "(unassigned)";
    modelCounts.set(modelKey, (modelCounts.get(modelKey) ?? 0) + 1);

    if (typeof task.result === "string" && task.result.startsWith("FAILED:")) {
      const reason = task.result.slice("FAILED:".length).trim().replace(/\s+/g, " ");
      failureCounts.set(reason, (failureCounts.get(reason) ?? 0) + 1);
    }
  }

  return {
    completedCount: recent.length,
    failureCount: [...failureCounts.values()].reduce((sum, count) => sum + count, 0),
    modelUsage: [...modelCounts.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key))
      .slice(0, 5),
    failureReasons: [...failureCounts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason))
      .slice(0, 5)
  };
}

function getAgentCreationQuestions(resourceAliases: string[]): WorkflowQuestion[] {
  const label =
    resourceAliases.length > 0 ? `${resourceAliases.join("|")}|auto` : "resource-alias|auto";
  return [
    { key: "name", prompt: "Agent name> " },
    { key: "summary", prompt: "One-line summary> " },
    { key: "mission", prompt: "Mission and responsibility> " },
    { key: "style", prompt: "Personality and response style> " },
    { key: "skills", prompt: "Tool-use and skills guidance> " },
    { key: "preferredResource", prompt: `Preferred resource (${label})> ` }
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
    platform?: NodeJS.Platform;
  }
) => void;

export interface ExecuteOptions {
  fetchFn?: FetchFn;
  rootDir?: string;
  speakFn?: SpeakFn;
  warn?: WarnFn;
  platform?: NodeJS.Platform;
}

function defaultSpeakFn(
  text: string,
  options: {
    enabled: boolean;
    voice?: string;
    warn: WarnFn;
    platform?: NodeJS.Platform;
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
  private readonly platform: NodeJS.Platform;
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
    this.platform = options.platform ?? process.platform;
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
    await ensureDropboxLayout(rootDir);
    await app.sanitizeAutoQueueState();
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
    return getEnvNumber("CRUSTY_AUTO_PULSE_INTERVAL_MS", DEFAULT_AUTO_PULSE_INTERVAL_MS);
  }

  getAutoSourceDocumentCharLimit(): number {
    return getEnvNumber(
      "CRUSTY_AUTO_SOURCE_DOC_CHAR_LIMIT",
      DEFAULT_AUTO_SOURCE_DOCUMENT_CHAR_LIMIT
    );
  }

  async getStatusLines(): Promise<string[]> {
    const [agents, internalFiles, telemetry, dropbox, resources] = await Promise.all([
      listAgents(this.rootDir),
      getInternalFileDetails(this.rootDir),
      loadTelemetrySummary(this.rootDir),
      getDropboxSnapshot(this.rootDir),
      this.getResourcesSnapshot()
    ]);
    const capacity = getResourceCapacitySummary(this.rootDir);
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
      `Orchestrator profile: ${this.config.orchestratorName}`,
      `Mode: /${this.runtime.mode}`,
      `Auto pulse: ${this.isAutoMode() ? `active every ${this.getAutoPulseIntervalMs()}ms` : "stopped"}`,
      `Orchestrator state: ${this.isAutoBusy() ? "busy" : "idle"}`,
      `Queue: ${this.systemState.auto.pending.length} pending / ${this.systemState.auto.completed.length} completed`,
      `Cluster capacity: ${[
        `${capacity.resourceCount} resource${capacity.resourceCount === 1 ? "" : "s"}`,
        capacity.knownCpuLogicalCores > 0 ? `${capacity.knownCpuLogicalCores} CPU threads` : "",
        capacity.knownRamGb > 0 ? `${capacity.knownRamGb} GB RAM` : "",
        capacity.knownGpuCount > 0
          ? `${capacity.knownGpuCount} GPU${capacity.knownGpuCount === 1 ? "" : "s"}`
          : "",
        capacity.knownTotalVramGb > 0 ? `${capacity.knownTotalVramGb} GB VRAM` : "",
        capacity.highestKnownContextTokens > 0
          ? `max context ${capacity.highestKnownContextTokens} tokens`
          : ""
      ]
        .filter(Boolean)
        .join(" | ")}`,
      `Default auto priority: ${this.systemState.auto.defaultPriority}`,
      `Next task: ${
        nextTask
          ? `#${nextTask.id} [${nextTask.priority}]${nextTask.delegationRole ? ` {${nextTask.delegationRole}}` : ""}${
              nextTask.requestedResource ? ` -> ${nextTask.requestedResource}` : ""
            }${nextTask.requestedModel ? `/${nextTask.requestedModel}` : ""} ${nextTask.content}`
          : "(none queued)"
      }`,
      `Last completed: ${
        lastCompleted
          ? `#${lastCompleted.id}${lastCompleted.delegationRole ? ` {${lastCompleted.delegationRole}}` : ""} via ${lastCompleted.assignedResource ?? "?"}/${lastCompleted.assignedModel ?? "?"}`
          : "(none yet)"
      }`,
      `Top tier: ${tiers.top.map((profile) => `@${profile.alias}`).join(", ") || "(none)"}`,
      `Mid tier: ${tiers.mid.map((profile) => `@${profile.alias}`).join(", ") || "(none)"}`,
      `Low tier: ${tiers.low.map((profile) => `@${profile.alias}`).join(", ") || "(none)"}`,
      `Resources: ${resources.length}`,
      ...(resources.length <= 1
        ? [
            'Onboarding: run `node scripts/setup-agent.js` on the next agent device. It will prefill the first three IP numbers from the local network, you confirm or enter the final number of the orchestrator IP, then it will prompt for a device nickname and sync it here automatically.'
          ]
        : []),
      `Agents: ${agents.length > 0 ? agents.map((agent) => `@${agent.slug}`).join(", ") : "(none)"}`,
      `Dropbox: ${dropbox.inbox.length} inbox / ${dropbox.active.length} active / ${dropbox.outbox.length} outbox`,
      `Telemetry: ${telemetry.totalEvents} events, ${telemetry.byKind["ollama.chat"] ?? 0} model calls, ${telemetry.wikipedia.calls} wiki searches`,
      `Recent model metrics: ${topModels.length > 0 ? topModels.map((key) => formatTelemetryBucket(telemetry, key)).join(" | ") : "(none yet)"}`,
      `Last audit: ${lastAudit ? `#${lastAudit.id} ${lastAudit.summary}` : "(none yet)"}`,
      `Docs: focus ${internalFiles.focusTodo.modifiedAt} | roadmap ${internalFiles.roadmap.modifiedAt}`,
      `Docs: changelog ${internalFiles.changelog.modifiedAt} | directives ${internalFiles.directives.modifiedAt}`,
      `Explorer roots: ${getStoragePaths(this.rootDir).systemDir} | ${getDropboxPaths(this.rootDir).externalMemoryDir}`,
      "",
      "Press Esc to return."
    ];
  }

  async getStatusSnapshot(): Promise<{
    orchestratorName: string;
    mode: ReplMode;
    prompt: string;
    currentEndpoint: string;
    defaultEndpoint: string;
    auto: {
      enabled: boolean;
      busy: boolean;
      intervalMs: number;
      defaultPriority: TaskPriority;
      pendingCount: number;
      completedCount: number;
    };
    nextTask?: AutoQueueTask;
    lastCompleted?: AutoQueueTask;
    tiers: ReturnType<typeof getResourceProfilesByTier>;
    capacity: ReturnType<typeof getResourceCapacitySummary>;
    agents: AgentMeta[];
    docs: Awaited<ReturnType<typeof getInternalFileDetails>>;
    telemetry: TelemetrySummary;
    dropbox: Awaited<ReturnType<typeof getDropboxSnapshot>>;
  }> {
    const [agents, docs, telemetry, dropbox] = await Promise.all([
      listAgents(this.rootDir),
      getInternalFileDetails(this.rootDir),
      loadTelemetrySummary(this.rootDir),
      getDropboxSnapshot(this.rootDir)
    ]);

    return {
      orchestratorName: this.config.orchestratorName,
      mode: this.runtime.mode,
      prompt: this.getPrompt(),
      currentEndpoint: this.runtime.currentEndpoint,
      defaultEndpoint: this.config.defaultEndpoint,
      auto: {
        enabled: this.isAutoMode(),
        busy: this.isAutoBusy(),
        intervalMs: this.getAutoPulseIntervalMs(),
        defaultPriority: this.systemState.auto.defaultPriority,
        pendingCount: this.systemState.auto.pending.length,
        completedCount: this.systemState.auto.completed.length
      },
      nextTask: this.sortPendingTasks(this.systemState.auto.pending)[0],
      lastCompleted: this.systemState.auto.completed.at(-1),
      tiers: getResourceProfilesByTier(this.rootDir),
      capacity: getResourceCapacitySummary(this.rootDir),
      agents,
      docs,
      telemetry,
      dropbox
    };
  }

  async getQueueSnapshot(): Promise<{
    enabled: boolean;
    busy: boolean;
    defaultPriority: TaskPriority;
    pending: AutoQueueTask[];
    completed: AutoQueueTask[];
  }> {
    return {
      enabled: this.isAutoMode(),
      busy: this.isAutoBusy(),
      defaultPriority: this.systemState.auto.defaultPriority,
      pending: this.sortPendingTasks(this.systemState.auto.pending),
      completed: [...this.systemState.auto.completed].reverse()
    };
  }

  async getTelemetrySnapshot(): Promise<TelemetrySummary> {
    return loadTelemetrySummary(this.rootDir);
  }

  async getAuditSnapshot(limit = 20): Promise<AuditEvent[]> {
    return readRecentAuditEvents(limit, this.rootDir);
  }

  async getAgentsSnapshot(): Promise<AgentMeta[]> {
    return listAgents(this.rootDir);
  }

  async getDropboxSnapshot() {
    return getDropboxSnapshot(this.rootDir);
  }

  async getResourcesSnapshot() {
    return listResources(this.rootDir);
  }

  private speechUnavailableLine(): string {
    return "Speech controls are available only on macOS. Chat text output still works everywhere.";
  }

  async getParticipantsSnapshot() {
    return Object.entries(this.config.endpoints)
      .map(([alias, endpoint]) => ({
        alias,
        ...endpoint
      }))
      .sort((left, right) => left.alias.localeCompare(right.alias));
  }

  async getChatConfigSnapshot() {
    return {
      orchestratorName: this.config.orchestratorName,
      defaultEndpoint: this.config.defaultEndpoint,
      currentEndpoint: this.runtime.currentEndpoint,
      participants: await this.getParticipantsSnapshot()
    };
  }

  async getModelsSnapshot(target?: string) {
    const normalizedTarget = target?.trim();
    const endpointAlias =
      normalizedTarget && normalizedTarget.startsWith("@")
        ? this.getResolvedAlias(normalizedTarget)
        : normalizedTarget && this.config.endpoints[normalizedTarget.toLowerCase()]
          ? normalizedTarget.toLowerCase()
          : undefined;
    const resourceAlias = endpointAlias
      ? this.config.endpoints[endpointAlias].resourceAlias
      : normalizedTarget
        ? normalizedTarget.replace(/^@/, "").toLowerCase()
        : this.config.endpoints[this.runtime.currentEndpoint]?.resourceAlias;
    const resource = getResourceProfile(resourceAlias ?? this.resolveOrchestratorAlias(), this.rootDir);
    const models = await listOllamaModels(
      resource.baseUrl,
      this.fetchFn,
      resource.apiStyle ?? "ollama",
      resource.apiKeyEnv
    );
    return {
      resourceAlias: resource.alias,
      baseUrl: resource.baseUrl,
      apiStyle: resource.apiStyle ?? "ollama",
      models
    };
  }

  async createInboxDocument(filename: string, content: string): Promise<CommandResult> {
    const entry = await writeInboxDocument(filename, content, this.rootDir);
    await appendAuditEvent(
      {
        timestamp: new Date().toISOString(),
        kind: "system",
        scope: "dropbox.inbox.write",
        summary: `Wrote inbox document ${entry.relativePath}.`,
        success: true,
        actor: "user",
        target: entry.relativePath,
        metadata: {
          stage: "inbox",
          path: entry.path
        }
      },
      this.rootDir
    );
    await appendChangelogEntry(`Wrote inbox document ${entry.relativePath}.`, this.rootDir);
    return {
      lines: [`Wrote inbox document: ${entry.path}`],
      errors: [],
      shouldExit: false
    };
  }

  async addResourceFromInput(
    alias: string,
    label: string,
    baseUrl: string,
    tier: "top" | "mid" | "low" = "mid",
    apiStyle: "ollama" | "openai" | "anthropic" = "ollama"
  ): Promise<CommandResult> {
    let discovered:
      | Awaited<ReturnType<typeof probeResourceModels>>
      | undefined;

    try {
      discovered = await probeResourceModels(baseUrl, apiStyle, this.fetchFn, undefined);
    } catch (error) {
      this.warn?.(`Resource discovery for ${baseUrl} failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    const resource = await addResource(
      {
        alias,
        label,
        tier,
        baseUrl,
        apiStyle,
        defaultModel: discovered?.defaultModel ?? "llama3.1:8b",
        ...(discovered?.reasoningModel ? { reasoningModel: discovered.reasoningModel } : {}),
        ...(discovered?.codingModel ? { codingModel: discovered.codingModel } : {}),
        ...(discovered?.toolsModel ? { toolsModel: discovered.toolsModel } : {}),
        ...(discovered?.embeddingModel ? { embeddingModel: discovered.embeddingModel } : {}),
        ...(discovered?.availableModels?.length
          ? { availableModels: discovered.availableModels }
          : {}),
        ...(discovered?.endpointVersion ? { endpointVersion: discovered.endpointVersion } : {}),
        ...(discovered ? { lastRefreshedAt: new Date().toISOString() } : {}),
        role: "User-added inference resource.",
        capabilities: [],
        notes: [
          "Review and edit this resource after adding it to set its models and capabilities.",
          discovered
            ? "Initial models were discovered from the endpoint during resource setup."
            : "Discovery did not run during setup. Use /resource refresh <alias> after the endpoint is reachable."
        ]
      },
      this.rootDir
    );
    if (!this.config.endpoints[resource.alias]) {
      this.config = addEndpoint(this.config, resource.alias, resource.alias, label, this.rootDir);
      await this.persistConfig();
    }
    await this.syncSystemFiles();
    await appendChangelogEntry(`Added resource ${resource.alias}.`, this.rootDir);
    return {
      lines: [
        `Added resource @${resource.alias} (${resource.apiStyle ?? "ollama"}).`,
        discovered
          ? `Discovered ${resource.availableModels?.length ?? 0} model(s) on the endpoint.`
          : `Edit it with /resource edit ${resource.alias} to set models, notes, and capabilities.`
      ],
      errors: [],
      shouldExit: false
    };
  }

  async refreshResourceFromEndpoint(alias: string): Promise<CommandResult> {
    const current = getResourceProfile(alias, this.rootDir);
    const discovered = await probeResourceModels(
      current.baseUrl,
      current.apiStyle ?? "ollama",
      this.fetchFn,
      current.apiKeyEnv
    );
    const availableModels = discovered.availableModels;
    const keepIfPresent = (value?: string): string | undefined =>
      value && availableModels.includes(value) ? value : undefined;
    const next = await updateResource(
      alias,
      {
        ...current,
        defaultModel:
          keepIfPresent(current.defaultModel) ??
          discovered.defaultModel ??
          current.defaultModel,
        reasoningModel:
          keepIfPresent(current.reasoningModel) ?? discovered.reasoningModel ?? undefined,
        codingModel: keepIfPresent(current.codingModel) ?? discovered.codingModel ?? undefined,
        toolsModel: keepIfPresent(current.toolsModel) ?? discovered.toolsModel ?? undefined,
        embeddingModel:
          keepIfPresent(current.embeddingModel) ?? discovered.embeddingModel ?? undefined,
        availableModels,
        ...(discovered.endpointVersion ? { endpointVersion: discovered.endpointVersion } : {}),
        lastRefreshedAt: new Date().toISOString()
      },
      this.rootDir
    );
    await this.syncSystemFiles();
    await appendChangelogEntry(`Refreshed resource ${next.alias} from its live endpoint.`, this.rootDir);
    return {
      lines: [
        `Refreshed @${next.alias} from ${next.baseUrl}.`,
        `API style: ${next.apiStyle ?? "ollama"} | models discovered: ${next.availableModels?.length ?? 0}`
      ],
      errors: [],
      shouldExit: false
    };
  }

  async syncResourceReport(report: ResourceSyncReport): Promise<CommandResult> {
    const alias = report.alias.trim().toLowerCase();
    let reportHost = "";
    try {
      reportHost = new URL(report.baseUrl).hostname;
    } catch {
      throw new Error(`Invalid base URL for synced resource @${alias}.`);
    }
    if (alias !== this.resolveOrchestratorAlias() && isLoopbackHost(reportHost)) {
      throw new Error(
        `Refusing to sync non-orchestrator resource @${alias} with loopback base URL ${report.baseUrl}. Re-run setup-agent on that device so it advertises its LAN-reachable endpoint instead.`
      );
    }
    const resources = listResources(this.rootDir);
    const existing = resources.find((resource) => resource.alias === alias);
    const duplicate = report.deviceId
      ? resources.find(
          (resource) =>
            resource.alias !== alias &&
            resource.deviceId &&
            resource.deviceId === report.deviceId
        )
      : resources.find(
          (resource) =>
            resource.alias !== alias &&
            resource.hostName &&
            report.hostName &&
            resource.hostName === report.hostName &&
            resource.platform === report.platform
        );
    const nextResource = {
      ...(existing ?? {
        alias,
        label: report.label,
        tier: report.tier ?? "mid",
        baseUrl: report.baseUrl,
        defaultModel: report.defaultModel ?? "llama3.1:8b",
        role: "Synced from an agent setup report.",
        capabilities: [],
        notes: []
      }),
      alias,
      label: report.label.trim(),
      baseUrl: report.baseUrl.trim(),
      apiStyle: report.apiStyle ?? existing?.apiStyle ?? "ollama",
      ...(report.apiKeyEnv ? { apiKeyEnv: report.apiKeyEnv.trim() } : {}),
      ...(report.deviceId ? { deviceId: report.deviceId.trim() } : {}),
      ...(report.hostName ? { hostName: report.hostName.trim() } : {}),
      ...(report.platform ? { platform: report.platform.trim() } : {}),
      tier: report.tier ?? existing?.tier ?? "mid",
      ...(typeof report.cpuLogicalCores === "number" ? { cpuLogicalCores: report.cpuLogicalCores } : {}),
      ...(typeof report.ramGb === "number" ? { ramGb: report.ramGb } : {}),
      ...(typeof report.gpuModel === "string" ? { gpuModel: report.gpuModel.trim() } : {}),
      ...(typeof report.gpuCount === "number" ? { gpuCount: report.gpuCount } : {}),
      ...(typeof report.totalVramGb === "number" ? { totalVramGb: report.totalVramGb } : {}),
      ...(typeof report.maxContextTokens === "number"
        ? { maxContextTokens: report.maxContextTokens }
        : {}),
      defaultModel: report.defaultModel ?? existing?.defaultModel ?? "llama3.1:8b",
      ...(report.reasoningModel ? { reasoningModel: report.reasoningModel } : {}),
      ...(report.codingModel ? { codingModel: report.codingModel } : {}),
      ...(report.toolsModel ? { toolsModel: report.toolsModel } : {}),
      ...(report.embeddingModel ? { embeddingModel: report.embeddingModel } : {}),
      availableModels: report.availableModels ?? existing?.availableModels ?? [],
      ...(report.endpointVersion ? { endpointVersion: report.endpointVersion } : {}),
      lastRefreshedAt: new Date().toISOString(),
      role:
        existing?.role ??
        "Network-connected inference resource discovered and synced from an agent setup report.",
      capabilities: report.capabilities ?? existing?.capabilities ?? [],
      notes: report.notes ?? existing?.notes ?? []
    };

    if (duplicate) {
      await removeResource(duplicate.alias, this.rootDir);
    }

    if (existing) {
      await updateResource(alias, nextResource, this.rootDir);
    } else {
      await addResource(nextResource, this.rootDir);
    }

    await this.syncSystemFiles();
    await appendChangelogEntry(`Synced resource report for ${alias}.`, this.rootDir);
    return {
      lines: [
        `${existing || duplicate ? "Updated" : "Added"} resource @${alias} from agent sync.`,
        `Models: ${(report.availableModels ?? []).length} | tier: ${nextResource.tier} | API: ${nextResource.apiStyle ?? "ollama"}`
      ],
      errors: [],
      shouldExit: false
    };
  }

  async updateResourceSpec(alias: string, text: string): Promise<CommandResult> {
    const parsed = JSON.parse(text) as {
      label?: unknown;
      tier?: unknown;
      baseUrl?: unknown;
      apiStyle?: unknown;
      apiKeyEnv?: unknown;
      hostName?: unknown;
      platform?: unknown;
      defaultModel?: unknown;
      reasoningModel?: unknown;
      codingModel?: unknown;
      toolsModel?: unknown;
      embeddingModel?: unknown;
      role?: unknown;
      capabilities?: unknown;
      notes?: unknown;
      cpuLogicalCores?: unknown;
      ramGb?: unknown;
      gpuModel?: unknown;
      gpuCount?: unknown;
      totalVramGb?: unknown;
      maxContextTokens?: unknown;
      availableModels?: unknown;
      lastRefreshedAt?: unknown;
      endpointVersion?: unknown;
    };
    const current = getResourceProfile(alias, this.rootDir);
    const resource = await updateResource(
      alias,
      {
        ...current,
        ...(typeof parsed.label === "string" ? { label: parsed.label } : {}),
        ...(parsed.tier === "top" || parsed.tier === "mid" || parsed.tier === "low"
          ? { tier: parsed.tier }
          : {}),
        ...(typeof parsed.baseUrl === "string" ? { baseUrl: parsed.baseUrl } : {}),
        ...(parsed.apiStyle === "ollama" ||
        parsed.apiStyle === "openai" ||
        parsed.apiStyle === "anthropic"
          ? { apiStyle: parsed.apiStyle }
          : {}),
        ...(typeof parsed.apiKeyEnv === "string" || parsed.apiKeyEnv === null
          ? { apiKeyEnv: parsed.apiKeyEnv ?? undefined }
          : {}),
        ...(typeof parsed.hostName === "string" || parsed.hostName === null
          ? { hostName: parsed.hostName ?? undefined }
          : {}),
        ...(typeof parsed.platform === "string" || parsed.platform === null
          ? { platform: parsed.platform ?? undefined }
          : {}),
        ...(typeof parsed.defaultModel === "string" ? { defaultModel: parsed.defaultModel } : {}),
        ...(typeof parsed.reasoningModel === "string" || parsed.reasoningModel === null
          ? { reasoningModel: parsed.reasoningModel ?? undefined }
          : {}),
        ...(typeof parsed.codingModel === "string" || parsed.codingModel === null
          ? { codingModel: parsed.codingModel ?? undefined }
          : {}),
        ...(typeof parsed.toolsModel === "string" || parsed.toolsModel === null
          ? { toolsModel: parsed.toolsModel ?? undefined }
          : {}),
        ...(typeof parsed.embeddingModel === "string" || parsed.embeddingModel === null
          ? { embeddingModel: parsed.embeddingModel ?? undefined }
          : {}),
        ...(typeof parsed.role === "string" ? { role: parsed.role } : {}),
        ...(Array.isArray(parsed.capabilities)
          ? {
              capabilities: parsed.capabilities.filter(
                (entry): entry is string => typeof entry === "string" && entry.trim() !== ""
              )
            }
          : {}),
        ...(Array.isArray(parsed.notes)
          ? {
              notes: parsed.notes.filter(
                (entry): entry is string => typeof entry === "string" && entry.trim() !== ""
              )
            }
          : {}),
        ...(typeof parsed.cpuLogicalCores === "number" ? { cpuLogicalCores: parsed.cpuLogicalCores } : {}),
        ...(typeof parsed.ramGb === "number" ? { ramGb: parsed.ramGb } : {}),
        ...(typeof parsed.gpuModel === "string" || parsed.gpuModel === null
          ? { gpuModel: parsed.gpuModel ?? undefined }
          : {}),
        ...(typeof parsed.gpuCount === "number" ? { gpuCount: parsed.gpuCount } : {}),
        ...(typeof parsed.totalVramGb === "number" ? { totalVramGb: parsed.totalVramGb } : {}),
        ...(typeof parsed.maxContextTokens === "number"
          ? { maxContextTokens: parsed.maxContextTokens }
          : {}),
        ...(Array.isArray(parsed.availableModels)
          ? {
              availableModels: parsed.availableModels.filter(
                (entry): entry is string => typeof entry === "string" && entry.trim() !== ""
              )
            }
          : {}),
        ...(typeof parsed.lastRefreshedAt === "string" || parsed.lastRefreshedAt === null
          ? { lastRefreshedAt: parsed.lastRefreshedAt ?? undefined }
          : {}),
        ...(typeof parsed.endpointVersion === "string" || parsed.endpointVersion === null
          ? { endpointVersion: parsed.endpointVersion ?? undefined }
          : {})
      },
      this.rootDir
    );
    await this.syncSystemFiles();
    await appendChangelogEntry(`Updated resource ${resource.alias}.`, this.rootDir);
    return {
      lines: [`Updated resource @${resource.alias}.`],
      errors: [],
      shouldExit: false
    };
  }

  async removeResourceConfig(alias: string): Promise<CommandResult> {
    const boundParticipants = Object.entries(this.config.endpoints)
      .filter(([, endpoint]) => endpoint.resourceAlias === alias)
      .map(([participantAlias]) => participantAlias);
    if (boundParticipants.some((participantAlias) => participantAlias !== alias)) {
      throw new Error(
        `Resource "@${alias}" is still bound to participant(s): ${boundParticipants
          .map((participantAlias) => `@${participantAlias}`)
          .join(", ")}. Rebind or remove those participants first.`
      );
    }

    await removeResource(alias, this.rootDir);
    if (this.config.endpoints[alias]) {
      this.config = removeEndpoint(this.config, alias);
      await this.persistConfig();
    }
    await this.syncSystemFiles();
    await appendChangelogEntry(`Removed resource ${alias}.`, this.rootDir);
    return {
      lines: [`Removed resource @${alias}.`],
      errors: [],
      shouldExit: false
    };
  }

  async addParticipantFromInput(
    alias: string,
    resourceAlias: string,
    nickname?: string
  ): Promise<CommandResult> {
    this.config = addEndpoint(this.config, alias, resourceAlias, nickname, this.rootDir);
    await this.persistConfig();
    return {
      lines: [
        `Added participant @${alias} bound to @${resourceAlias}.`,
        `Edit it with /participant edit ${alias} or adjust its model with /model ${alias} <model>.`
      ],
      errors: [],
      shouldExit: false
    };
  }

  async updateParticipantSpec(alias: string, text: string): Promise<CommandResult> {
    const parsed = JSON.parse(text) as {
      nickname?: unknown;
      resourceAlias?: unknown;
      model?: unknown;
      instructions?: unknown;
      voicePreset?: unknown;
    };
    let next = this.config;
    if (typeof parsed.resourceAlias === "string" && parsed.resourceAlias.trim() !== "") {
      next = setEndpointResourceAlias(next, alias, parsed.resourceAlias.trim().toLowerCase(), this.rootDir);
    }
    if (typeof parsed.nickname === "string" && parsed.nickname.trim() !== "") {
      next = setEndpointNickname(next, alias, parsed.nickname);
    }
    if (typeof parsed.model === "string" && parsed.model.trim() !== "") {
      next = setEndpointModel(next, alias, parsed.model);
    }
    if (typeof parsed.instructions === "string") {
      next = setEndpointInstructions(next, alias, parsed.instructions);
    }
    if (typeof parsed.voicePreset === "string" && parsed.voicePreset.trim() !== "") {
      next = setEndpointVoicePreset(next, alias, parsed.voicePreset);
    }
    this.config = next;
    await this.persistConfig();
    return {
      lines: [`Updated participant @${alias}.`],
      errors: [],
      shouldExit: false
    };
  }

  async removeParticipantConfig(alias: string): Promise<CommandResult> {
    this.config = removeEndpoint(this.config, alias);
    await this.persistConfig();
    return {
      lines: [`Removed participant @${alias}.`],
      errors: [],
      shouldExit: false
    };
  }

  private async syncOrchestratorNameInLocalDocs(): Promise<void> {
    const directivesPath = getStoragePaths(this.rootDir).directivesPath;

    try {
      const current = await readFile(directivesPath, "utf8");
      const orchestratorName = this.getOrchestratorName();
      const next = current
        .replace(/^# .* Directives$/m, `# ${orchestratorName} Directives`)
        .replace(
          /^You are .*?, the orchestrator and conscience of this local agent swarm\.$/m,
          `You are ${orchestratorName}, the orchestrator and conscience of this local agent swarm.`
        )
        .replace(
          /^- In `\/auto`, self-aware self-improvement is .*?'s default operating stance whenever the user has not given a more urgent direct task\.$/m,
          `- In \`/auto\`, self-aware self-improvement is ${orchestratorName}'s default operating stance whenever the user has not given a more urgent direct task.`
        );

      if (next !== current) {
        await writeFile(directivesPath, next, "utf8");
      }
    } catch (error) {
      this.warn?.(`Failed to sync orchestrator name in directives: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
  }

  async updateOrchestratorProfileName(name: string): Promise<CommandResult> {
    this.config = setOrchestratorName(this.config, name);
    await this.persistConfig();
    await this.syncOrchestratorNameInLocalDocs();
    await this.syncSystemFiles();
    return {
      lines: [`Orchestrator profile name is now ${this.config.orchestratorName}.`],
      errors: [],
      shouldExit: false
    };
  }

  async runDirectResourceChat(
    resourceAlias: string,
    message: string,
    model?: string
  ): Promise<CommandResult> {
    const resource = getResourceProfile(resourceAlias, this.rootDir);
    const endpoint: EndpointConfig = {
      resourceAlias: resource.alias,
      nickname: resource.label,
      baseUrl: resource.baseUrl,
      apiStyle: resource.apiStyle ?? "ollama",
      ...(resource.apiKeyEnv ? { apiKeyEnv: resource.apiKeyEnv } : {}),
      model: model?.trim() || resource.defaultModel,
      instructions: "",
      voicePreset: ""
    };
    const reply = await this.callModel({
      scope: "chat.direct",
      actor: "user",
      endpoint,
      resourceAlias: resource.alias,
      target: resource.alias,
      messages: [{ role: "user", content: message }],
      summary: `Direct test chat against @${resource.alias}.`
    });

    return {
      lines: [`@${resource.alias}/${endpoint.model}: ${reply.text}`],
      errors: [],
      shouldExit: false
    };
  }

  async getHudLines(tab: "status" | "queue" | "metrics" | "detail"): Promise<string[]> {
    const [statusLines, telemetry, auditEvents, dropbox] = await Promise.all([
      this.getStatusLines(),
      loadTelemetrySummary(this.rootDir),
      readRecentAuditEvents(tab === "detail" ? 6 : 3, this.rootDir),
      getDropboxSnapshot(this.rootDir)
    ]);
    const pending = this.sortPendingTasks(this.systemState.auto.pending);
    const completed = [...this.systemState.auto.completed].slice(-8).reverse();
    const modelLines = Object.entries(telemetry.models)
      .sort((left, right) => right[1].calls - left[1].calls)
      .map(([key, bucket]) => {
        const averageDuration = bucket.calls > 0 ? Math.round(bucket.totalDurationMs / bucket.calls) : 0;
        return `${key} | calls ${bucket.calls} | errors ${bucket.errors} | avg ${averageDuration}ms | eval ${bucket.evalCount}`;
      });
    const resourceLines = Object.entries(telemetry.resources)
      .sort((left, right) => right[1].calls - left[1].calls)
      .map(([key, bucket]) => {
        const averageDuration = bucket.calls > 0 ? Math.round(bucket.totalDurationMs / bucket.calls) : 0;
        return `@${key} | calls ${bucket.calls} | errors ${bucket.errors} | avg ${averageDuration}ms | eval ${bucket.evalCount}`;
      });

    const tabs = [
      tab === "status" ? "[status]" : " status ",
      tab === "queue" ? "[queue]" : " queue ",
      tab === "metrics" ? "[metrics]" : " metrics ",
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

    if (tab === "queue") {
      return [
        `HUD ${tabs}`,
        "",
        `Dropbox: ${dropbox.inbox.length} inbox / ${dropbox.active.length} active / ${dropbox.outbox.length} outbox`,
        "",
        `Pending tasks: ${pending.length}`,
        ...(pending.length > 0
          ? pending.map(
              (task) =>
                `#${task.id} [${task.priority}]${task.delegationRole ? ` {${task.delegationRole}}` : ""}${task.requestedResource ? ` -> ${task.requestedResource}` : ""}${task.requestedModel ? `/${task.requestedModel}` : ""} ${task.content}`
            )
          : ["(none pending)"]),
        "",
        `Recent completed: ${completed.length}`,
        ...(completed.length > 0
          ? completed.map(
              (task) =>
                `#${task.id}${task.delegationRole ? ` {${task.delegationRole}}` : ""} via ${task.assignedResource ?? "?"}/${task.assignedModel ?? "?"} ${task.content}`
            )
          : ["(none completed yet)"]),
        "",
        "Left/Right switches tabs. Esc returns to the prompt."
      ];
    }

    if (tab === "metrics") {
      return [
        `HUD ${tabs}`,
        "",
        `Total events: ${telemetry.totalEvents}`,
        `Model calls: ${telemetry.byKind["ollama.chat"] ?? 0}`,
        `Wikipedia: ${telemetry.wikipedia.calls} call(s), ${telemetry.wikipedia.errors} error(s), recent ${telemetry.wikipedia.recentQueries.join(" | ") || "(none)"}`,
        "",
        "Models:",
        ...(modelLines.length > 0 ? modelLines : ["(none yet)"]),
        "",
        "Resources:",
        ...(resourceLines.length > 0 ? resourceLines : ["(none yet)"]),
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

  private async getAgentExtraContext(agent: AgentMeta): Promise<string[]> {
    if (agent.slug !== "data-analyst") {
      return [];
    }

    const telemetry = await loadTelemetrySummary(this.rootDir);
    const recentAudit = await readRecentAuditEvents(5, this.rootDir);
    const pending = this.sortPendingTasks(this.systemState.auto.pending).slice(0, 8);
    const completed = [...this.systemState.auto.completed].slice(-5).reverse();
    const topModels = Object.entries(telemetry.models)
      .sort((left, right) => right[1].calls - left[1].calls)
      .slice(0, 5)
      .map(
        ([key, bucket]) =>
          `${key}: ${bucket.calls} call(s), ${bucket.errors} error(s), avg ${bucket.calls > 0 ? Math.round(bucket.totalDurationMs / bucket.calls) : 0}ms`
      );
    const topResources = Object.entries(telemetry.resources)
      .sort((left, right) => right[1].calls - left[1].calls)
      .map(
        ([key, bucket]) =>
          `@${key}: ${bucket.calls} call(s), ${bucket.errors} error(s), avg ${bucket.calls > 0 ? Math.round(bucket.totalDurationMs / bucket.calls) : 0}ms`
      );
    const capacity = getResourceCapacitySummary(this.rootDir);

    return [
      [
        "Telemetry summary:",
        `- Total events: ${telemetry.totalEvents}`,
        `- Model calls: ${telemetry.byKind["ollama.chat"] ?? 0}`,
        `- Wikipedia searches: ${telemetry.wikipedia.calls}`,
        `- Recent queries: ${telemetry.wikipedia.recentQueries.join(" | ") || "(none)"}`,
        ...(topModels.length > 0 ? ["- Top models:", ...topModels.map((line) => `  ${line}`)] : [])
      ].join("\n"),
      [
        "Queue snapshot:",
        `- Pending: ${this.systemState.auto.pending.length}`,
        `- Completed: ${this.systemState.auto.completed.length}`,
        ...(pending.length > 0
          ? pending.map(
              (task) =>
                `- Pending #${task.id} [${task.priority}]${task.delegationRole ? ` {${task.delegationRole}}` : ""}${task.requestedResource ? ` -> ${task.requestedResource}` : ""}${task.requestedModel ? `/${task.requestedModel}` : ""}: ${task.content}`
            )
          : ["- Pending: (none)"]),
        ...(completed.length > 0
          ? completed.map(
              (task) =>
                `- Completed #${task.id}${task.delegationRole ? ` {${task.delegationRole}}` : ""} via ${task.assignedResource ?? "?"}/${task.assignedModel ?? "?"}: ${task.content}`
            )
          : ["- Completed: (none recent)"])
      ].join("\n"),
      [
        "Resource capacity:",
        `- Resources: ${capacity.resourceCount}`,
        `- Known CPU threads: ${capacity.knownCpuLogicalCores || "(unknown)"}`,
        `- Known RAM (GB): ${capacity.knownRamGb || "(unknown)"}`,
        `- Known GPUs: ${capacity.knownGpuCount || "(unknown)"}`,
        `- Known VRAM (GB): ${capacity.knownTotalVramGb || "(unknown)"}`,
        `- Highest known context tokens: ${capacity.highestKnownContextTokens || "(unknown)"}`,
        "",
        "Recent audit events:",
        ...(recentAudit.length > 0
          ? recentAudit.map(
              (event) =>
                `- #${event.id} ${event.kind} ${event.success ? "ok" : "error"} ${event.summary}`
            )
          : ["- (none)"]),
        ...(topResources.length > 0 ? ["", "Resource summary:", ...topResources.map((line) => `- ${line}`)] : [])
      ].join("\n")
    ];
  }

  async getExploreTree(): Promise<{ rootPath: string; lines: string[] }> {
    const tree = await getInternalFileTree(this.rootDir);
    return {
      rootPath: tree.rootPath,
      lines: [
        "Explorer",
        "",
        ...tree.lines,
        "",
        "Type a full path from .crusty/system or external-memory and press Enter to open it. Press Esc to return."
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

  /**
   * Finish the daily work session: generate a Daily Digest document, write
   * it to the outbox, and mark the daily session as complete. Returns a
   * status line for the REPL or `null` if no session is active.
   */
  private async finishDailyWork(): Promise<string | null> {
    const session = this.systemState.auto.dailySession;
    if (!session || session.completedAt) {
      return null;
    }

    const documents = await loadSystemDocuments(this.rootDir);
    // Gather tasks completed during *this* session.
    const sessionStart = new Date(session.startedAt).getTime();
    const sessionTasks = this.systemState.auto.completed.filter(
      (t) => t.completedAt && new Date(t.completedAt).getTime() >= sessionStart
    );

    const digestContent = buildDailyDigest({
      session,
      completedTasks: sessionTasks,
      orchestratorName: this.getOrchestratorName(),
      orchestratorSummary: documents.orchestratorSummary,
      focusTodo: documents.focusTodo,
      customDirective: this.config.preferences?.dailyDigestDirective
    });

    const dateSlug = new Date().toISOString().slice(0, 10);
    const entry = await writeGeneratedDropboxDocument(
      "outbox",
      `daily-digest/daily-digest-${dateSlug}.md`,
      digestContent,
      this.rootDir
    );

    this.systemState = {
      ...this.systemState,
      auto: {
        ...this.systemState.auto,
        dailySession: completeDailySession(session, entry.path)
      }
    };
    await this.persistSystemState();
    await appendChangelogEntry(
      `Daily work session completed. Digest written to ${entry.path}. ${session.tasksCompleted} tasks completed, ${session.tasksErrored} errored.`,
      this.rootDir
    );
    return `Daily Digest written to ${entry.path}. Session completed: ${session.tasksCompleted} tasks completed, ${session.tasksErrored} errored.`;
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
    await writeFile(
      getStoragePaths(this.rootDir).deviceInventoryPath,
      `${renderResourceInventory(this.rootDir).trimEnd()}\n`,
      "utf8"
    );
    const agents = await listAgents(this.rootDir);
    const recentAutoSummary = summarizeRecentAutoTasks(this.systemState.auto.completed);
    await updateOrchestratorIndex({
      rootDir: this.rootDir,
      queueDepth: this.systemState.auto.pending.length,
      activeAgents: agents.map((agent) => agent.slug),
      connectedResources: listResources(this.rootDir).map((resource) => resource.alias),
      recentAutoSummary
    });
  }

  getHelpLines(): string[] {
    const orchestratorName = this.getOrchestratorName();
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
        ? `${modeSummary} Plain messages are queued for ${orchestratorName} at ${this.systemState.auto.defaultPriority} priority, and the background pulse keeps the queue moving until /stop.`
        : this.runtime.mode === "agent"
          ? `${modeSummary} Plain messages go to the active agent identity.`
          : `${modeSummary} Plain messages go to @${this.config.defaultEndpoint}, and @alias messages go directly to that participant.`;

    return [
      firstLine,
      `Current participant: @${this.runtime.currentEndpoint} for alias-free /instructions and /voice.`,
      `Auto queue: ${this.systemState.auto.pending.length} pending, ${this.systemState.auto.completed.length} completed.`,
      `Direct message: @alias message`,
      `Crosstalk: @from to @to: "message"`,
      `Commands: /help, /status, /hud, /explore, /login, /chat, /group, /auto, /stop, /agent list, /agent new, /agent edit <name>, /agent <name>, /end`,
      `Commands: /priority [high|medium|low], /model [alias|alias model], /models [resource|@participant], /direct <resource> "message" [model]`,
      `Commands: /participant list|add|edit|remove, /nickname [@alias] ["name"], /bind [@alias] [resource], /default [alias], /rename <old> <new>`,
      `Commands: /orchestrator ["name"], /resource list|add|edit|refresh|remove, /instructions [@alias] ["text"], /voice list, /voice [@alias] [preset] (macOS only), /sound [on|off] (macOS only)`,
      "Commands: /daily [start|finish], /promote <resource>, /preferences [set <key> <value>], /compact, /reset, /clear, /exit"
    ];
  }

  private getResolvedAlias(alias?: string): string {
    return ensureEndpointAlias(
      this.config,
      (alias ?? this.runtime.currentEndpoint).replace(/^@/, "")
    );
  }

  private getOrchestratorName(): string {
    return this.config.orchestratorName;
  }

  /**
   * Build a short context block describing the current daily work session
   * state for injection into auto task and queue fill messages.
   */
  private getDailySessionContext(): string | undefined {
    const session = this.systemState.auto.dailySession;
    if (!session) {
      return undefined;
    }
    if (session.completedAt) {
      return `Daily work session completed at ${session.completedAt}. ${session.tasksCompleted} tasks completed, ${session.tasksErrored} errored.${session.digestPath ? ` Digest written to ${session.digestPath}.` : ""}`;
    }
    const startedAt = new Date(session.startedAt);
    const elapsed = Math.round((Date.now() - startedAt.getTime()) / 60_000);
    return `Active daily work session started at ${session.startedAt} (${elapsed} minutes ago). ${session.tasksCompleted} tasks completed so far, ${session.tasksErrored} errored. When the queue is empty and no more productive self-improvement work remains for this session, emit exactly one line: DAILY_COMPLETE to signal daily work is finished and trigger digest generation.`;
  }

  private getEndpoint(alias: string): EndpointConfig {
    return resolveEndpointConfig(this.config, alias, this.rootDir);
  }

  private getMessageTarget(alias?: string): string {
    if (alias) {
      return this.getResolvedAlias(alias);
    }

    return this.config.defaultEndpoint;
  }

  private resolveOrchestratorAlias(): string {
    return this.config.orchestratorResourceAlias ?? getOrchestratorResourceAlias(this.rootDir);
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
    await clearDropboxState(this.rootDir);
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

    if (
      (options.scope.startsWith("auto.") || options.scope.startsWith("agent.")) &&
      INTERNAL_WIKIPEDIA_QUERY_PATTERN.test(parsedToolRequest.query)
    ) {
      return parsedToolRequest.replyText || options.rawReply;
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

  private async requestRedditSearch(
    query: string,
    scope: string,
    actor: string
  ): Promise<import("./types.ts").RedditSearchResult> {
    try {
      const result = await searchReddit(query, this.fetchFn);
      await appendAuditEvent(
        {
          timestamp: new Date().toISOString(),
          kind: "reddit.search",
          scope,
          summary: `Reddit search "${query}" returned ${result.posts.length} post(s).`,
          success: true,
          actor,
          durationMs: result.durationMs,
          responseChars: result.chunks.join("\n\n").length,
          responseText: result.chunks.join("\n\n"),
          metadata: {
            query,
            subreddits: [...new Set(result.posts.map((post) => post.subreddit))]
          }
        },
        this.rootDir
      );
      return result;
    } catch (error) {
      await appendAuditEvent(
        {
          timestamp: new Date().toISOString(),
          kind: "reddit.search",
          scope,
          summary: `Reddit search "${query}" failed.`,
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

  private async resolveRedditTool(options: {
    scope: string;
    actor: string;
    endpoint: EndpointConfig;
    resourceAlias: string;
    messages: ChatMessage[];
    rawReply: string;
    target?: string;
  }): Promise<string> {
    const parsedToolRequest = parseRedditRequest(options.rawReply);
    if (!parsedToolRequest.query) {
      return options.rawReply;
    }

    if (
      (options.scope.startsWith("auto.") || options.scope.startsWith("agent.")) &&
      INTERNAL_REDDIT_QUERY_PATTERN.test(parsedToolRequest.query)
    ) {
      return parsedToolRequest.replyText || options.rawReply;
    }

    try {
      const reddit = await this.requestRedditSearch(
        parsedToolRequest.query,
        `${options.scope}.reddit`,
        options.actor
      );
      const followUp = await this.callModel({
        scope: `${options.scope}.reddit-followup`,
        actor: options.actor,
        endpoint: options.endpoint,
        resourceAlias: options.resourceAlias,
        target: options.target,
        summary: `Follow-up after Reddit search "${parsedToolRequest.query}".`,
        messages: [
          ...options.messages,
          {
            role: "assistant",
            content: options.rawReply
          },
          ...reddit.chunks.map((chunk) => ({
            role: "system" as const,
            content: chunk
          })),
          {
            role: "user",
            content:
              "Use the Reddit discussion results above to continue the same task. Produce the final answer now. Only emit another REDDIT line if the first results were clearly insufficient."
          }
        ]
      });

      return parseRedditRequest(followUp.text).replyText || followUp.text;
    } catch (error) {
      this.warn(`Reddit search failed: ${(error as Error).message}`);
      return parsedToolRequest.replyText || options.rawReply;
    }
  }

  /* ---- Web Search Tool ---- */

  private async requestWebSearch(
    query: string,
    topic: string,
    scope: string,
    actor: string
  ): Promise<import("./types.ts").WebSearchResult> {
    try {
      const result = await searchWeb(query, topic, this.fetchFn);
      await appendAuditEvent(
        {
          timestamp: new Date().toISOString(),
          kind: "search.web",
          scope,
          summary: `Web search "${query}" (${topic}) returned ${result.entries.length} result(s).`,
          success: true,
          actor,
          durationMs: result.durationMs,
          responseChars: result.chunks.join("\n\n").length,
          responseText: result.chunks.join("\n\n"),
          metadata: { query, topic }
        },
        this.rootDir
      );
      return result;
    } catch (error) {
      await appendAuditEvent(
        {
          timestamp: new Date().toISOString(),
          kind: "search.web",
          scope,
          summary: `Web search "${query}" (${topic}) failed.`,
          success: false,
          actor,
          error: (error as Error).message,
          metadata: { query, topic }
        },
        this.rootDir
      );
      throw error;
    }
  }

  private async resolveSearchTool(options: {
    scope: string;
    actor: string;
    endpoint: EndpointConfig;
    resourceAlias: string;
    messages: ChatMessage[];
    rawReply: string;
    target?: string;
  }): Promise<string> {
    const parsedRequest = parseSearchRequest(options.rawReply);
    if (!parsedRequest.query || !parsedRequest.topic) {
      return options.rawReply;
    }

    if (
      (options.scope.startsWith("auto.") || options.scope.startsWith("agent.")) &&
      INTERNAL_SEARCH_QUERY_PATTERN.test(parsedRequest.query)
    ) {
      return parsedRequest.replyText || options.rawReply;
    }

    if (!isAllowedSearchTopic(parsedRequest.topic)) {
      this.warn(`Web search topic "${parsedRequest.topic}" not allowed, stripping.`);
      return parsedRequest.replyText || options.rawReply;
    }

    try {
      const searchResult = await this.requestWebSearch(
        parsedRequest.query,
        parsedRequest.topic,
        `${options.scope}.search`,
        options.actor
      );

      // Multi-turn: present results, ask model to select, then fetch pages
      const selectionMessages: ChatMessage[] = [
        ...options.messages,
        { role: "assistant", content: options.rawReply },
        ...searchResult.chunks.map((chunk) => ({
          role: "system" as const,
          content: chunk
        })),
        {
          role: "user",
          content:
            "Review the search results above. Select the most relevant results by ending with a line in the format: SEARCH_SELECT: 1,3 (comma-separated result numbers). If none are relevant, just provide your answer without a SEARCH_SELECT line."
        }
      ];

      const selectionReply = await this.callModel({
        scope: `${options.scope}.search-select`,
        actor: options.actor,
        endpoint: options.endpoint,
        resourceAlias: options.resourceAlias,
        target: options.target,
        summary: `Selecting search results for "${parsedRequest.query}".`,
        messages: selectionMessages
      });

      const selection = parseSearchSelectResponse(selectionReply.text);
      if (!selection.indices || selection.indices.length === 0) {
        // Model declined to select — use search summary as final
        return parseSearchRequest(selectionReply.text).replyText || selectionReply.text;
      }

      // Fetch selected pages
      const selectedEntries = selection.indices
        .filter((i) => i <= searchResult.entries.length)
        .map((i) => searchResult.entries[i - 1]);

      const pageTexts: string[] = [];
      for (const entry of selectedEntries) {
        try {
          const page = await fetchPageText(entry.url, this.fetchFn);
          pageTexts.push(`Page: ${entry.title}\nURL: ${entry.url}\n\n${page.text}`);
        } catch {
          pageTexts.push(`Page: ${entry.title}\nURL: ${entry.url}\n\n(Failed to fetch)`);
        }
      }

      // Final follow-up with fetched pages
      const followUp = await this.callModel({
        scope: `${options.scope}.search-followup`,
        actor: options.actor,
        endpoint: options.endpoint,
        resourceAlias: options.resourceAlias,
        target: options.target,
        summary: `Follow-up after web search "${parsedRequest.query}".`,
        messages: [
          ...options.messages,
          { role: "assistant", content: options.rawReply },
          ...pageTexts.map((text) => ({
            role: "system" as const,
            content: text.slice(0, 4000)
          })),
          {
            role: "user",
            content:
              "Use the fetched web page content above to answer the original question. Produce the final answer now. Do not emit another SEARCH line."
          }
        ]
      });

      return parseSearchRequest(followUp.text).replyText || followUp.text;
    } catch (error) {
      this.warn(`Web search failed: ${(error as Error).message}`);
      return parsedRequest.replyText || options.rawReply;
    }
  }

  /* ---- Weather Tool ---- */

  private async resolveWeatherTool(options: {
    scope: string;
    actor: string;
    endpoint: EndpointConfig;
    resourceAlias: string;
    messages: ChatMessage[];
    rawReply: string;
    target?: string;
  }): Promise<string> {
    const parsed = parseWeatherRequest(options.rawReply);
    if (parsed.location === undefined && !options.rawReply.match(/(?:^|\n)WEATHER:\s*$/im)) {
      return options.rawReply;
    }

    // Resolve location: explicit > preferences city > preferences zip
    let location = parsed.location;
    if (!location) {
      const prefs = this.config.preferences;
      location = prefs?.city || prefs?.zipCode;
    }
    if (!location) {
      this.warn("Weather requested but no location provided and no default configured.");
      return parsed.replyText || options.rawReply;
    }

    try {
      const weather = await fetchWeather(location, this.fetchFn);
      await appendAuditEvent(
        {
          timestamp: new Date().toISOString(),
          kind: "weather.fetch",
          scope: `${options.scope}.weather`,
          summary: `Weather for "${location}" fetched.`,
          success: true,
          actor: options.actor,
          durationMs: weather.durationMs,
          responseChars: weather.summary.length,
          responseText: weather.summary,
          metadata: { location }
        },
        this.rootDir
      );

      const followUp = await this.callModel({
        scope: `${options.scope}.weather-followup`,
        actor: options.actor,
        endpoint: options.endpoint,
        resourceAlias: options.resourceAlias,
        target: options.target,
        summary: `Follow-up after weather fetch for "${location}".`,
        messages: [
          ...options.messages,
          { role: "assistant", content: options.rawReply },
          ...weather.chunks.map((chunk) => ({
            role: "system" as const,
            content: chunk
          })),
          {
            role: "user",
            content:
              "Use the weather data above to continue. Produce the final answer now. Do not emit another WEATHER line."
          }
        ]
      });

      return parseWeatherRequest(followUp.text).replyText || followUp.text;
    } catch (error) {
      await appendAuditEvent(
        {
          timestamp: new Date().toISOString(),
          kind: "weather.fetch",
          scope: `${options.scope}.weather`,
          summary: `Weather for "${location}" failed.`,
          success: false,
          actor: options.actor,
          error: (error as Error).message,
          metadata: { location }
        },
        this.rootDir
      );
      this.warn(`Weather fetch failed: ${(error as Error).message}`);
      return parsed.replyText || options.rawReply;
    }
  }

  /* ---- Ben Live Tool ---- */

  private async resolveBenLiveTool(options: {
    scope: string;
    actor: string;
    endpoint: EndpointConfig;
    resourceAlias: string;
    messages: ChatMessage[];
    rawReply: string;
    target?: string;
  }): Promise<string> {
    const parsed = parseBenLiveRequest(options.rawReply);
    if (!parsed.topicOrPath) {
      return options.rawReply;
    }

    try {
      const result = await fetchBenLive(parsed.topicOrPath, this.fetchFn);
      await appendAuditEvent(
        {
          timestamp: new Date().toISOString(),
          kind: "benlive.fetch",
          scope: `${options.scope}.benlive`,
          summary: `Ben Live fetch "${parsed.topicOrPath}" completed.`,
          success: true,
          actor: options.actor,
          durationMs: result.durationMs,
          responseChars: result.text.length,
          responseText: result.text.slice(0, 500),
          metadata: { path: result.path, url: result.url }
        },
        this.rootDir
      );

      const followUp = await this.callModel({
        scope: `${options.scope}.benlive-followup`,
        actor: options.actor,
        endpoint: options.endpoint,
        resourceAlias: options.resourceAlias,
        target: options.target,
        summary: `Follow-up after Ben Live fetch "${parsed.topicOrPath}".`,
        messages: [
          ...options.messages,
          { role: "assistant", content: options.rawReply },
          ...result.chunks.map((chunk) => ({
            role: "system" as const,
            content: chunk
          })),
          {
            role: "user",
            content:
              "Use the Ben Live content above to continue. Produce the final answer now. Do not emit another BENLIVE line."
          }
        ]
      });

      return parseBenLiveRequest(followUp.text).replyText || followUp.text;
    } catch (error) {
      await appendAuditEvent(
        {
          timestamp: new Date().toISOString(),
          kind: "benlive.fetch",
          scope: `${options.scope}.benlive`,
          summary: `Ben Live fetch "${parsed.topicOrPath}" failed.`,
          success: false,
          actor: options.actor,
          error: (error as Error).message,
          metadata: { topicOrPath: parsed.topicOrPath }
        },
        this.rootDir
      );
      this.warn(`Ben Live fetch failed: ${(error as Error).message}`);
      return parsed.replyText || options.rawReply;
    }
  }

  /* ---- Website Tool ---- */

  private async resolveWebsiteTool(options: {
    scope: string;
    actor: string;
    endpoint: EndpointConfig;
    resourceAlias: string;
    messages: ChatMessage[];
    rawReply: string;
    target?: string;
  }): Promise<string> {
    const parsed = parseWebsiteRequest(options.rawReply);
    if (!parsed.topicOrPath) {
      return options.rawReply;
    }

    const baseUrl = this.config.preferences?.personalWebsiteUrl;
    if (!baseUrl) {
      this.warn("WEBSITE tool used but personalWebsiteUrl not configured.");
      return parsed.replyText || options.rawReply;
    }

    try {
      const result = await fetchWebsite(baseUrl, parsed.topicOrPath, this.fetchFn);
      await appendAuditEvent(
        {
          timestamp: new Date().toISOString(),
          kind: "website.fetch",
          scope: `${options.scope}.website`,
          summary: `Website fetch "${parsed.topicOrPath}" completed.`,
          success: true,
          actor: options.actor,
          durationMs: result.durationMs,
          responseChars: result.text.length,
          responseText: result.text.slice(0, 500),
          metadata: { path: result.path, url: result.url }
        },
        this.rootDir
      );

      const followUp = await this.callModel({
        scope: `${options.scope}.website-followup`,
        actor: options.actor,
        endpoint: options.endpoint,
        resourceAlias: options.resourceAlias,
        target: options.target,
        summary: `Follow-up after website fetch "${parsed.topicOrPath}".`,
        messages: [
          ...options.messages,
          { role: "assistant", content: options.rawReply },
          ...result.chunks.map((chunk) => ({
            role: "system" as const,
            content: chunk
          })),
          {
            role: "user",
            content:
              "Use the website content above to continue. Produce the final answer now. Do not emit another WEBSITE line."
          }
        ]
      });

      return parseWebsiteRequest(followUp.text).replyText || followUp.text;
    } catch (error) {
      await appendAuditEvent(
        {
          timestamp: new Date().toISOString(),
          kind: "website.fetch",
          scope: `${options.scope}.website`,
          summary: `Website fetch "${parsed.topicOrPath}" failed.`,
          success: false,
          actor: options.actor,
          error: (error as Error).message,
          metadata: { topicOrPath: parsed.topicOrPath }
        },
        this.rootDir
      );
      this.warn(`Website fetch failed: ${(error as Error).message}`);
      return parsed.replyText || options.rawReply;
    }
  }

  /* ---- Unified External Tools Resolution ---- */

  private async resolveExternalTools(options: {
    scope: string;
    actor: string;
    endpoint: EndpointConfig;
    resourceAlias: string;
    messages: ChatMessage[];
    rawReply: string;
    target?: string;
  }): Promise<string> {
    let reply = options.rawReply;
    reply = await this.resolveWikipediaTool({ ...options, rawReply: reply });
    reply = await this.resolveRedditTool({ ...options, rawReply: reply });
    reply = await this.resolveSearchTool({ ...options, rawReply: reply });
    reply = await this.resolveWeatherTool({ ...options, rawReply: reply });
    reply = await this.resolveBenLiveTool({ ...options, rawReply: reply });
    reply = await this.resolveWebsiteTool({ ...options, rawReply: reply });
    return reply;
  }

  private async compactIfNeeded(force = false): Promise<boolean> {
    const summaryAlias = this.config.defaultEndpoint;
    const endpoint = this.getEndpoint(summaryAlias);
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
            actor: "orchestrator",
            endpoint: selectedEndpoint,
            resourceAlias: endpoint.resourceAlias,
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

    const endpoint = this.getEndpoint(normalizedAlias);

    if (endpoint.modelPolicy === "auto") {
      const purpose = detectTaskPurpose(options.taskPrompt);
      if (purpose !== "default") {
        endpoint.model = selectModelForEndpoint(endpoint, purpose, this.rootDir);
      }
    }

    const recentMessages = getConversationMessages(this.sessions).slice(
      getConversationCompactedUntil(this.sessions)
    );
    const outgoingMessages = buildChatMessages({
      alias: normalizedAlias,
      participants: Object.entries(this.config.endpoints).map(([alias, endpointConfig]) => ({
        alias,
        nickname: endpointConfig.nickname
      })),
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
          resourceAlias: endpoint.resourceAlias,
          target: normalizedAlias,
          messages: outgoingMessages,
          summary: `Participant reply requested from @${normalizedAlias}.`
        })
      ).text;
      rawAssistantReply = await this.resolveExternalTools({
        scope: "chat.participant",
        actor: `participant:${normalizedAlias}`,
        endpoint,
        resourceAlias: endpoint.resourceAlias,
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
        warn: this.warn,
        platform: this.platform
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
      delegationRole?: string;
      requestedResource?: string;
      requestedModel?: string;
      sourceDocumentRelativePath?: string;
      sourceDocumentName?: string;
    } = {}
  ): Promise<AutoQueueTask> {
    const task: AutoQueueTask = {
      id: this.nextTaskId(),
      content,
      priority,
      createdAt: new Date().toISOString(),
      createdBy,
      status: "queued",
      ...(options.delegationRole ? { delegationRole: options.delegationRole } : {}),
      ...(options.requestedResource ? { requestedResource: options.requestedResource } : {}),
      ...(options.requestedModel ? { requestedModel: options.requestedModel } : {}),
      ...(options.agentName ? { agentName: options.agentName } : {}),
      ...(options.sourceDocumentRelativePath
        ? { sourceDocumentRelativePath: options.sourceDocumentRelativePath }
        : {}),
      ...(options.sourceDocumentName ? { sourceDocumentName: options.sourceDocumentName } : {})
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

  private getKnownRoutingAliases(): Set<string> {
    return new Set([
      ...Object.keys(this.config.endpoints).map((alias) => alias.toLowerCase()),
      ...listResources(this.rootDir).map((resource) => resource.alias.toLowerCase())
    ]);
  }

  private isAutonomousTaskSource(createdBy: string): boolean {
    return createdBy.startsWith("orchestrator:") || createdBy.startsWith("agent:");
  }

  private shouldConvertAutonomousTaskToFeatureRequest(content: string, createdBy: string): boolean {
    if (!this.isAutonomousTaskSource(createdBy)) {
      return false;
    }

    if (createdBy.startsWith("orchestrator:safe-mode")) {
      return false;
    }

    const normalized = content.toLowerCase();
    if (
      normalized.includes("feature request ticket") ||
      normalized.includes("outbox feature request")
    ) {
      return false;
    }

    return (
      AUTONOMOUS_EXTERNAL_CHANGE_PATTERN.test(content) ||
      AUTONOMOUS_EXTERNAL_FEATURE_PATTERN.test(content)
    );
  }

  private shouldRejectAutonomousTask(content: string, createdBy: string): boolean {
    if (createdBy.startsWith("orchestrator:safe-mode")) {
      return false;
    }

    if (!this.isAutonomousTaskSource(createdBy)) {
      return false;
    }

    return (
      AUTONOMOUS_EXTERNAL_CHANGE_PATTERN.test(content) ||
      isLowInformationAutonomousTask(content)
    );
  }

  private getResourceRosterText(): string {
    const resources = listResources(this.rootDir);
    return resources.length > 0
      ? resources.map((resource) => `@${resource.alias} (${resource.label})`).join(", ")
      : "(none)";
  }

  private isSafeModeRecoveryTask(task: Pick<AutoQueueTask, "createdBy">): boolean {
    return task.createdBy.startsWith("orchestrator:safe-mode");
  }

  private async getRecentAuditContext(limit = 8): Promise<string> {
    const events = await readRecentAuditEvents(limit, this.rootDir);
    if (events.length === 0) {
      return "Recent audit context:\n- (none)";
    }

    return ["Recent audit context:", ...events.map(formatAuditEventLine)].join("\n");
  }

  private async queueSafeModeRecoveryTask(options: {
    failedTaskId?: number;
    reason: string;
    failedTaskSummary?: string;
  }): Promise<AutoQueueTask> {
    const recentAuditContext = await this.getRecentAuditContext(8);
    const content = [
      "Safe mode recovery.",
      "Review the recent failure context, identify the most likely contained internal cause, and realign the autonomous plan.",
      "Correct only internal memory, prompt guidance, queue hygiene, or routing assumptions through approved application capabilities.",
      "Do not retry the failed assumption blindly and do not propose external implementation work.",
      options.failedTaskId ? `Failed task ID: ${options.failedTaskId}.` : "",
      `Failure reason: ${options.reason}`,
      options.failedTaskSummary ? `Failed task summary: ${options.failedTaskSummary}` : "",
      "",
      recentAuditContext
    ]
      .filter(Boolean)
      .join("\n");

    return this.enqueueAutoTask(content, "high", "orchestrator:safe-mode", {
      requestedResource: this.resolveOrchestratorAlias()
    });
  }

  private async quarantineFailedAutoTask(options: {
    task: AutoQueueTask;
    remaining: AutoQueueTask[];
    assignedResource?: string;
    assignedModel?: string;
    errorMessage: string;
    createRecoveryTask: boolean;
    startedAt?: string;
    taskStartMs?: number;
  }): Promise<{ recoveryTask?: AutoQueueTask }> {
    const completedAt = new Date().toISOString();
    const failedTask: AutoQueueTask = {
      ...options.task,
      status: "completed",
      ...(options.startedAt ? { startedAt: options.startedAt } : {}),
      completedAt,
      ...(options.taskStartMs !== undefined ? { durationMs: Date.now() - options.taskStartMs } : {}),
      ...(options.assignedResource ? { assignedResource: options.assignedResource } : {}),
      ...(options.assignedModel ? { assignedModel: options.assignedModel } : {}),
      result: `FAILED: ${options.errorMessage}`,
      errorMessage: options.errorMessage
    };

    this.systemState = {
      ...this.systemState,
      auto: {
        ...this.systemState.auto,
        pending: this.sortPendingTasks(options.remaining),
        completed: [...this.systemState.auto.completed, failedTask].slice(-AUTO_COMPLETED_TASK_LIMIT)
      }
    };
    await this.persistSystemState();
    await appendChangelogEntry(
      `Quarantined failed auto task #${options.task.id}. Error: ${options.errorMessage}`,
      this.rootDir
    );

    let recoveryTask: AutoQueueTask | undefined;
    if (options.createRecoveryTask) {
      recoveryTask = await this.queueSafeModeRecoveryTask({
        failedTaskId: options.task.id,
        reason: options.errorMessage,
        failedTaskSummary: options.task.content
      });
      await appendChangelogEntry(
        `Queued safe mode recovery task #${recoveryTask.id} after auto task #${options.task.id} failed.`,
        this.rootDir
      );
    }

    return { ...(recoveryTask ? { recoveryTask } : {}) };
  }

  private async writeFeatureRequestTicket(options: {
    title: string;
    detail: string;
    createdBy: string;
    taskId?: number;
    requestedResource?: string;
    requestedModel?: string;
    relatedPath?: string;
    reason: string;
  }): Promise<string> {
    const slugBase = toKebabSlug(
      options.title,
      options.taskId ? `task-${options.taskId}` : "feature-request"
    );
    const filename = `feature-requests/${options.taskId ? `task-${options.taskId}-` : ""}${slugBase}.md`;
    const detail = truncateForPrompt(options.detail.trim(), 8000).text;
    const entry = await writeGeneratedDropboxDocument(
      "outbox",
      filename,
      [
        `# Feature Request: ${options.title.trim() || "Untitled request"}`,
        "",
        `- Requested by: ${options.createdBy}`,
        `- Reason redirected by Crusty: ${options.reason}`,
        ...(options.taskId ? [`- Source task ID: ${options.taskId}`] : []),
        ...(options.requestedResource ? [`- Suggested resource: @${options.requestedResource}`] : []),
        ...(options.requestedModel ? [`- Suggested model: ${options.requestedModel}`] : []),
        ...(options.relatedPath ? [`- Related requested path: ${options.relatedPath}`] : []),
        "",
        "## Requested change",
        "",
        detail
      ].join("\n"),
      this.rootDir
    );
    await appendAuditEvent(
      {
        timestamp: new Date().toISOString(),
        kind: "system",
        scope: "feature-request.redirect",
        summary: `Redirected autonomous external change request into outbox ticket ${entry.relativePath}.`,
        success: true,
        actor: "orchestrator",
        target: entry.relativePath,
        metadata: {
          createdBy: options.createdBy,
          taskId: options.taskId,
          requestedResource: options.requestedResource,
          requestedModel: options.requestedModel,
          relatedPath: options.relatedPath
        }
      },
      this.rootDir
    );
    return entry.path;
  }

  /**
   * Map of canonical orchestrator memory filenames to their storage paths.
   * When a WRITE[internal] targets one of these, the content is written to
   * the canonical location instead of `generated/`.
   */
  private readonly CANONICAL_MEMORY_FILES: Record<string, (paths: StoragePaths) => string> = {
    "summary.md": (paths) => paths.orchestratorMemorySummaryPath,
    "memory/summary.md": (paths) => paths.orchestratorMemorySummaryPath,
    "orchestrator-summary.md": (paths) => paths.orchestratorMemorySummaryPath,
    "focus-todo.md": (paths) => paths.focusTodoPath,
    "roadmap.md": (paths) => paths.roadmapPath,
  };

  /**
   * Attempt to write content to a canonical orchestrator memory file
   * (summary, focus-todo, roadmap). Returns null if the filename does not
   * match a known canonical path.
   */
  private async writeCanonicalMemoryFile(
    filename: string,
    content: string
  ): Promise<{ path: string; relativePath: string } | null> {
    const normalized = filename.replace(/^\/+/, "").toLowerCase();
    const resolver = this.CANONICAL_MEMORY_FILES[normalized];
    if (!resolver) {
      return null;
    }
    const paths = getStoragePaths(this.rootDir);
    const targetPath = resolver(paths);
    await writeFile(targetPath, `${content.trimEnd()}\n`, "utf8");
    return {
      path: targetPath,
      relativePath: normalized
    };
  }

  private async writeInternalGeneratedDocument(filename: string, content: string): Promise<{
    path: string;
    relativePath: string;
  }> {
    const paths = getStoragePaths(this.rootDir);
    const safeRelativePath = ensureSafeGeneratedRelativePath(filename);
    const targetPath = resolve(join(paths.orchestratorGeneratedDir, safeRelativePath));
    const allowedRoot = resolve(paths.orchestratorGeneratedDir);
    if (!targetPath.startsWith(`${allowedRoot}/`) && targetPath !== allowedRoot) {
      throw new Error("Internal write path must stay inside the orchestrator generated directory.");
    }

    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, `${content.trimEnd()}\n`, "utf8");
    return {
      path: targetPath,
      relativePath: safeRelativePath
    };
  }

  private shouldPreferInternalWrite(options: {
    stage: "active" | "outbox" | "internal";
    filename: string;
    createdBy?: string;
    sourceDocumentRelativePath?: string;
  }): boolean {
    if (options.stage === "internal") {
      return true;
    }

    if (!options.createdBy || !this.isAutonomousTaskSource(options.createdBy)) {
      return false;
    }

    if (options.sourceDocumentRelativePath) {
      return false;
    }

    if (options.stage === "active") {
      return true;
    }

    return INTERNAL_MEMORY_PATH_HINT_PATTERN.test(options.filename);
  }

  private normalizeQueuedTaskRouting(task: {
    priority: TaskPriority;
    content: string;
    delegationRole?: string;
    requestedResource?: string;
    requestedModel?: string;
  }): {
    priority: TaskPriority;
    content: string;
    delegationRole?: string;
    requestedResource?: string;
    requestedModel?: string;
  } {
    const normalizedTask = {
      ...task,
      ...(task.requestedResource ? { requestedResource: task.requestedResource.trim().toLowerCase() } : {}),
      ...(task.requestedModel ? { requestedModel: task.requestedModel.trim() } : {})
    };

    if (normalizedTask.requestedResource) {
      try {
        const resource = getResourceProfile(normalizedTask.requestedResource, this.rootDir);
        normalizedTask.requestedResource = resource.alias;
        if (!normalizedTask.requestedModel && resource.defaultModel) {
          return {
            ...normalizedTask,
            requestedModel: resource.defaultModel
          };
        }
      } catch {
        return {
          ...normalizedTask,
          requestedResource: undefined,
          requestedModel: undefined
        };
      }
    }

    if (!normalizedTask.requestedModel) {
      return normalizedTask;
    }

    const knownAliases = this.getKnownRoutingAliases();
    if (knownAliases.has(normalizedTask.requestedModel.toLowerCase())) {
      if (normalizedTask.requestedResource) {
        try {
          const resource = getResourceProfile(normalizedTask.requestedResource, this.rootDir);
          return {
            ...normalizedTask,
            requestedModel: resource.defaultModel || undefined
          };
        } catch {
          // Fall through to clearing the alias-like model name.
        }
      }
      return {
        ...normalizedTask,
        requestedModel: undefined
      };
    }

    if (!normalizedTask.requestedResource) {
      return normalizedTask;
    }

    try {
      const resource = getResourceProfile(normalizedTask.requestedResource, this.rootDir);
      if (!resource.availableModels || resource.availableModels.length === 0) {
        return normalizedTask;
      }

      const matchedModel = resource.availableModels.find(
        (model) => model.toLowerCase() === normalizedTask.requestedModel?.toLowerCase()
      );
      if (matchedModel) {
        return {
          ...normalizedTask,
          requestedModel: matchedModel
        };
      }

      return {
        ...normalizedTask,
        requestedModel: resource.defaultModel || undefined
      };
    } catch {
      return {
        ...normalizedTask,
        requestedModel: undefined
      };
    }
  }

  private normalizeAutoQueueTask(task: AutoQueueTask): AutoQueueTask {
    return {
      ...task,
      ...this.normalizeQueuedTaskRouting(task)
    };
  }

  private async sanitizeAutoQueueState(): Promise<void> {
    const nextPending: AutoQueueTask[] = [];
    let changed = false;
    for (const task of this.systemState.auto.pending) {
      const normalizedTask = this.normalizeAutoQueueTask(task);
      if (JSON.stringify(normalizedTask) !== JSON.stringify(task)) {
        changed = true;
      }

      if (
        this.shouldConvertAutonomousTaskToFeatureRequest(
          normalizedTask.content,
          normalizedTask.createdBy
        )
      ) {
        await this.writeFeatureRequestTicket({
          title: normalizedTask.content,
          detail: normalizedTask.content,
          createdBy: normalizedTask.createdBy,
          taskId: normalizedTask.id,
          requestedResource: normalizedTask.requestedResource,
          requestedModel: normalizedTask.requestedModel,
          reason:
            "Autonomous work may improve only internal memory and process artifacts directly. External implementation requests are redirected into outbox feature tickets."
        });
        changed = true;
        continue;
      }

      if (this.shouldRejectAutonomousTask(normalizedTask.content, normalizedTask.createdBy)) {
        changed = true;
        continue;
      }

      nextPending.push(normalizedTask);
    }
    const nextCompleted = this.systemState.auto.completed.map((task) => this.normalizeAutoQueueTask(task));
    if (JSON.stringify(nextCompleted) !== JSON.stringify(this.systemState.auto.completed)) {
      changed = true;
    }

    if (!changed) {
      return;
    }

    this.systemState = {
      ...this.systemState,
      auto: {
        ...this.systemState.auto,
        pending: nextPending,
        completed: nextCompleted
      }
    };
    await this.persistSystemState();
  }

  private getAutoTaskEndpoint(selection: {
    alias: string;
    tier: "top" | "mid" | "low";
    purpose: "default" | "reasoning" | "coding" | "tools";
  }): EndpointConfig {
    const purpose =
      selection.purpose === "tools" && selection.tier === "top" ? "default" : selection.purpose;
    return getResourceEndpoint(selection.alias, purpose, this.rootDir);
  }

  private async queueParsedTasks(
    queuedTasks: Array<{
      priority: TaskPriority;
      content: string;
      delegationRole?: string;
      requestedResource?: string;
      requestedModel?: string;
    }>,
    createdBy: string,
    options: {
      agentName?: string;
      sourceDocumentRelativePath?: string;
      sourceDocumentName?: string;
    } = {}
  ): Promise<{ tasks: AutoQueueTask[]; notes: string[] }> {
    const addedTasks: AutoQueueTask[] = [];
    const notes: string[] = [];

    for (const task of queuedTasks) {
      if (!task.content.trim()) {
        continue;
      }

      const normalizedTask = this.normalizeQueuedTaskRouting(task);
      if (this.shouldConvertAutonomousTaskToFeatureRequest(normalizedTask.content, createdBy)) {
        const ticketPath = await this.writeFeatureRequestTicket({
          title: normalizedTask.content,
          detail: normalizedTask.content,
          createdBy,
          requestedResource: normalizedTask.requestedResource,
          requestedModel: normalizedTask.requestedModel,
          reason:
            "Autonomous work may improve only internal memory and process artifacts directly. External implementation requests are redirected into outbox feature tickets."
        });
        notes.push(`Redirected external feature request to outbox ticket: ${ticketPath}`);
        continue;
      }

      if (this.shouldRejectAutonomousTask(normalizedTask.content, createdBy)) {
        if (isLowInformationAutonomousTask(normalizedTask.content)) {
          notes.push(`Skipped vague autonomous task: ${normalizedTask.content}`);
        }
        continue;
      }

      addedTasks.push(
        await this.enqueueAutoTask(normalizedTask.content, normalizedTask.priority, createdBy, {
          ...options,
          delegationRole: normalizedTask.delegationRole,
          requestedResource: normalizedTask.requestedResource,
          requestedModel: normalizedTask.requestedModel
        })
      );
    }

    return {
      tasks: addedTasks,
      notes
    };
  }

  private async handleGeneratedFileWrites(
    fileWrites: Array<{
      stage: "active" | "outbox" | "internal";
      filename: string;
      content: string;
    }>,
    options: {
      createdBy?: string;
      taskId?: number;
      sourceDocumentRelativePath?: string;
    } = {}
  ): Promise<string[]> {
    const writtenLines: string[] = [];

    for (const fileWrite of fileWrites) {
      if (!fileWrite.filename.trim()) {
        continue;
      }

      const isAutonomousWrite = Boolean(
        options.createdBy && this.isAutonomousTaskSource(options.createdBy)
      );
      const safeFilename = fileWrite.filename.replaceAll("\\", "/").trim();
      if (
        isAutonomousWrite &&
        (AUTONOMOUS_DISALLOWED_FILE_PATH_PATTERN.test(safeFilename) ||
          AUTONOMOUS_DISALLOWED_FILE_EXTENSION_PATTERN.test(safeFilename))
      ) {
        const ticketPath = await this.writeFeatureRequestTicket({
          title: `External implementation requested for ${safeFilename}`,
          detail: [
            `The autonomous system requested a generated file at ${safeFilename}.`,
            "",
            "Requested content:",
            "",
            fileWrite.content.trim() || "(none)"
          ].join("\n"),
          createdBy: options.createdBy ?? "orchestrator",
          taskId: options.taskId,
          relatedPath: safeFilename,
          reason:
            "Autonomous file writes are limited to internal text artifacts. Executable scripts, source files, and app-level implementation requests are redirected into outbox feature tickets."
        });
        writtenLines.push(`Redirected external file request to outbox ticket: ${ticketPath}`);
        continue;
      }

      if (
        this.shouldPreferInternalWrite({
          stage: fileWrite.stage,
          filename: safeFilename,
          createdBy: options.createdBy,
          sourceDocumentRelativePath: options.sourceDocumentRelativePath
        })
      ) {
        // Check if this targets a canonical memory file (summary, focus-todo, roadmap).
        const canonicalEntry = await this.writeCanonicalMemoryFile(safeFilename, fileWrite.content);
        if (canonicalEntry) {
          await appendAuditEvent(
            {
              timestamp: new Date().toISOString(),
              kind: "system",
              scope: "memory.update",
              summary: `Updated canonical orchestrator memory file ${canonicalEntry.relativePath}.`,
              success: true,
              actor: "orchestrator",
              target: canonicalEntry.relativePath,
              metadata: {
                path: canonicalEntry.path
              }
            },
            this.rootDir
          );
          writtenLines.push(`Updated memory: ${canonicalEntry.relativePath}`);
          continue;
        }

        const entry = await this.writeInternalGeneratedDocument(safeFilename, fileWrite.content);
        await appendAuditEvent(
          {
            timestamp: new Date().toISOString(),
            kind: "system",
            scope: "internal.write",
            summary: `Wrote internal orchestration file ${entry.relativePath}.`,
            success: true,
            actor: "orchestrator",
            target: entry.relativePath,
            metadata: {
              path: entry.path
            }
          },
          this.rootDir
        );
        writtenLines.push(`Wrote internal file: ${entry.path}`);
        continue;
      }

      const entry = await writeGeneratedDropboxDocument(
        fileWrite.stage as "active" | "outbox",
        fileWrite.filename,
        fileWrite.content,
        this.rootDir
      );
      await appendAuditEvent(
        {
          timestamp: new Date().toISOString(),
          kind: "system",
          scope: "dropbox.write",
          summary: `Wrote ${fileWrite.stage} dropbox file ${entry.relativePath}.`,
          success: true,
          actor: "orchestrator",
          target: entry.relativePath,
          metadata: {
            stage: fileWrite.stage,
            path: entry.path
          }
        },
        this.rootDir
      );
      writtenLines.push(`Wrote ${fileWrite.stage} file: ${entry.path}`);
    }

    return writtenLines;
  }

  private async getAutoTaskExtraContext(task: AutoQueueTask): Promise<string[]> {
    const resources = listResources(this.rootDir);
    const capacity = getResourceCapacitySummary(this.rootDir);
    const recentAutoSummary = summarizeRecentAutoTasks(this.systemState.auto.completed);
    const pendingByResource = resources.map((resource) => {
      const pendingCount = this.systemState.auto.pending.filter(
        (pendingTask) => pendingTask.requestedResource === resource.alias
      ).length;
      return `- @${resource.alias}: ${pendingCount} explicitly queued task(s), tier=${resource.tier}, default=${resource.defaultModel}${
        resource.maxContextTokens ? `, maxContext=${resource.maxContextTokens}` : ""
      }`;
    });
    const canonicalRoster =
      resources.length > 0
        ? resources.map((resource) => `@${resource.alias} (${resource.label})`).join(", ")
        : "(none)";

    const blocks: string[] = [
      [
        "Routing context:",
        "- The highest-value self-improvement work is better configuration, context budgeting, delegation, and task decomposition for this specific local network.",
        "- Prefer queueing precise subtasks for currently lighter resources when a stronger node is better reserved for a later reasoning or drafting step.",
        "- For collaborative work, decompose into multiple QUEUE lines with resource aliases and optional role tags so different nodes can contribute complementary outputs.",
        `- Canonical resource roster: ${canonicalRoster}. Use only these exact aliases. If unsure, omit the alias and let Crusty route the task automatically.`,
        "- Contributor chat participants are a separate concept from connected inference resources. Never infer a resource alias from a participant nickname.",
        `- Known cluster capacity: ${capacity.resourceCount} resource(s), ${capacity.knownCpuLogicalCores || "(unknown)"} CPU threads, ${capacity.knownRamGb || "(unknown)"} GB RAM, ${capacity.knownGpuCount || "(unknown)"} GPU(s), ${capacity.knownTotalVramGb || "(unknown)"} GB VRAM, max context ${capacity.highestKnownContextTokens || "(unknown)"}.`,
        "- Current explicit queue pressure by resource:",
        ...(pendingByResource.length > 0 ? pendingByResource : ["- (none)"])
      ].join("\n")
    ];

    if (recentAutoSummary.completedCount > 0) {
      blocks.push(
        [
          "Recent auto evidence:",
          `- Reviewed ${recentAutoSummary.completedCount} recent completed auto task(s); ${recentAutoSummary.failureCount} failure(s).`,
          `- Most-used models: ${
            recentAutoSummary.modelUsage.length > 0
              ? recentAutoSummary.modelUsage.map((entry) => `${entry.key} x${entry.count}`).join(", ")
              : "(none)"
          }`,
          `- Most common failure reasons: ${
            recentAutoSummary.failureReasons.length > 0
              ? recentAutoSummary.failureReasons
                  .map((entry) => `${entry.reason} x${entry.count}`)
                  .join(" | ")
              : "(none)"
          }`
        ].join("\n")
      );
    }

    if (this.isSafeModeRecoveryTask(task)) {
      blocks.push(
        [
          "Safe mode recovery context:",
          "- This task exists because Crusty observed an unexpected failure or derailment during autonomous work.",
          "- First diagnose the contained internal cause from the recent audit context and failed task summary.",
          "- Then realign only internal memory, prompt guidance, queue hygiene, routing assumptions, or documentation.",
          "- If any durable improvement would require external application or source-code work, write an outbox feature request ticket instead of queueing executable implementation work.",
          await this.getRecentAuditContext(8)
        ].join("\n")
      );
    }

    if (!task.sourceDocumentRelativePath) {
      return blocks;
    }

    const source = await readActiveDropboxDocument(task.sourceDocumentRelativePath, this.rootDir);
    const truncated = truncateForPrompt(source.content, this.getAutoSourceDocumentCharLimit());

    blocks.push(
      [
        "External dropbox document:",
        `- Source document: ${task.sourceDocumentName ?? task.sourceDocumentRelativePath}`,
        `- Active path: ${source.path}`,
        "- This document came from external-memory/inbox and is the source of truth for this task.",
        "- If you produce an in-progress draft, use WRITE[active][relative/path.ext] ... ENDWRITE.",
        "- If you produce a final deliverable, use WRITE[outbox][relative/path.ext] ... ENDWRITE.",
        truncated.truncated ? "- The document body below was truncated for context efficiency." : ""
      ]
        .filter(Boolean)
        .join("\n"),
      `External document body:\n${truncated.text}`
    );

    return blocks;
  }

  private async runTaskPreflight(options: {
    task: AutoQueueTask;
    documents: { directives: string; inventory: string };
    endpoint: EndpointConfig;
    resourceAlias: string;
  }): Promise<string | null> {
    const messages = buildTaskPreflightMessages({
      orchestratorName: this.getOrchestratorName(),
      task: options.task.content,
      priority: options.task.priority,
      directives: options.documents.directives,
      inventory: options.documents.inventory,
      currentDateTime: formatCurrentDateTime()
    });

    try {
      const result = await this.callModel({
        scope: "auto.task.preflight",
        actor: "orchestrator",
        endpoint: options.endpoint,
        resourceAlias: options.resourceAlias,
        target: `task:${options.task.id}`,
        messages,
        summary: `Pre-flight reasoning for auto task #${options.task.id}.`
      });
      const preflightText = result.text.trim();
      if (!preflightText) {
        return null;
      }
      return `Pre-flight analysis:\n${preflightText}`;
    } catch {
      // Pre-flight is advisory — proceed with the task even if it fails.
      return null;
    }
  }

  private async ingestNextInboxDocumentTask(): Promise<{
    documentName: string;
    relativePath: string;
    task: AutoQueueTask;
  } | null> {
    const ingested = await ingestNextInboxDocument(this.rootDir);
    if (!ingested) {
      return null;
    }

    const task = await this.enqueueAutoTask(
      `Review the active external document "${ingested.name}", extract the requested work, produce the best next artifact for it, and queue any follow-up tasks that are needed.`,
      "high",
      "external-memory:inbox",
      {
        sourceDocumentRelativePath: ingested.relativePath,
        sourceDocumentName: ingested.name
      }
    );

    await appendAuditEvent(
      {
        timestamp: new Date().toISOString(),
        kind: "system",
        scope: "dropbox.ingest",
        summary: `Moved external document ${ingested.relativePath} from inbox to active and queued task #${task.id}.`,
        success: true,
        actor: "orchestrator",
        target: ingested.relativePath,
        metadata: {
          sourceStage: ingested.sourceStage,
          destinationStage: ingested.stage,
          taskId: task.id
        }
      },
      this.rootDir
    );
    await appendChangelogEntry(
      `Moved external document ${ingested.relativePath} from inbox to active and queued auto task #${task.id}.`,
      this.rootDir
    );

    return {
      documentName: ingested.name,
      relativePath: ingested.relativePath,
      task
    };
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
    const extraContextBlocks = await this.getAgentExtraContext(agent);
    const selection = chooseResourceForTask(userMessage, agent.preferredResource, this.rootDir);
    const endpoint = getResourceEndpoint(selection.alias, selection.purpose, this.rootDir);
    const outgoingMessages = buildAgentChatMessages({
      agentName: agent.name,
      agentSlug: agent.slug,
      preferredResource: agent.preferredResource,
      orchestratorName: this.getOrchestratorName(),
      spec,
      summary: memory.conversation.summary,
      recentMessages: memory.conversation.messages.slice(memory.conversation.compactedUntil),
      taskPrompt: `USER -> @${agent.slug}: ${userMessage}`,
      resourceRoster: this.getResourceRosterText(),
      extraContextBlocks,
      currentDateTime: formatCurrentDateTime()
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
      rawReply = await this.resolveExternalTools({
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

    const queuedResult = await this.queueParsedTasks(parsed.queuedTasks, `agent:${agent.slug}`, {
      agentName: agent.slug
    });
    const queued = queuedResult.tasks;
    let writtenFiles: string[] = [];
    const postProcessErrors: string[] = [];
    try {
      writtenFiles = await this.handleGeneratedFileWrites(parsed.fileWrites, {
        createdBy: `agent:${agent.slug}`
      });
    } catch (error) {
      postProcessErrors.push(`Dropbox write warning: ${(error as Error).message}`);
    }
    await appendChangelogEntry(
      `Agent @${agent.slug} replied via ${selection.alias}/${endpoint.model}. Queued ${queued.length} follow-up task${queued.length === 1 ? "" : "s"} and wrote ${writtenFiles.length} file${writtenFiles.length === 1 ? "" : "s"}.`,
      this.rootDir
    );

    return {
      lines: [
        `@${agent.slug}: ${replyText}`,
        ...writtenFiles,
        ...queuedResult.notes,
        ...queued.map(
          (task) =>
            `Queued #${task.id} [${task.priority}]${task.delegationRole ? ` {${task.delegationRole}}` : ""}${
              task.requestedResource ? ` -> ${task.requestedResource}` : ""
            }${task.requestedModel ? `/${task.requestedModel}` : ""} from @${agent.slug}: ${task.content}`
        )
      ],
      errors: postProcessErrors,
      shouldExit: false
    };
  }

  private async fillAutoQueue(): Promise<{ queued: AutoQueueTask[]; notes: string[] }> {
    if (this.systemState.auto.pending.length > 0) {
      return {
        queued: [],
        notes: []
      };
    }

    const [documents, agents] = await Promise.all([
      loadSystemDocuments(this.rootDir),
      listAgents(this.rootDir)
    ]);
    const orchestratorAlias = this.resolveOrchestratorAlias();
    const resourceRoster = this.getResourceRosterText();
    const draftEndpoint = getResourceEndpoint(orchestratorAlias, "reasoning", this.rootDir);
    const fillDateTime = formatCurrentDateTime();
    const draftMessages = buildQueueFillMessages({
      directives: documents.directives,
      inventory: documents.inventory,
      roadmap: documents.roadmap,
      focusTodo: documents.focusTodo,
      changelog: documents.changelog,
      orchestratorSummary: documents.orchestratorSummary,
      orchestratorName: this.getOrchestratorName(),
      agents: agents.map((agent) => `@${agent.slug}`),
      resourceRoster,
      currentDateTime: fillDateTime
    });

    let draftReply: string;
    try {
      draftReply = (
        await this.callModel({
          scope: "auto.queue-fill.draft",
          actor: "orchestrator",
          endpoint: draftEndpoint,
          resourceAlias: orchestratorAlias,
          target: this.getOrchestratorName(),
          messages: draftMessages,
          summary: "Drafting the auto queue backlog."
        })
      ).text;
      draftReply = await this.resolveExternalTools({
        scope: "auto.queue-fill.draft",
        actor: "orchestrator",
        endpoint: draftEndpoint,
        resourceAlias: orchestratorAlias,
        target: this.getOrchestratorName(),
        messages: draftMessages,
        rawReply: draftReply
      });
    } catch (error) {
      return {
        queued: [
          await this.enqueueAutoTask(
            "Review the orchestrator prompts and tighten queue fill guidance after the failed auto-fill attempt.",
            "medium",
            "orchestrator:auto-fill-fallback"
          ),
          await this.enqueueAutoTask(
            `Inspect the last auto-fill failure and capture it in the changelog. Error: ${(error as Error).message}`,
            "low",
            "orchestrator:auto-fill-fallback"
          )
        ],
        notes: []
      };
    }

    const draftTasks = parseQueueFillOutput(draftReply);
    const draftTaskText =
      draftTasks.length > 0
        ? draftTasks.map((task) => `[${task.priority}] ${task.content}`).join("\n")
        : draftReply.trim();
    const reviewerResource =
      listResources(this.rootDir).find(
        (resource) => resource.alias === "zora" && resource.alias !== orchestratorAlias
      ) ??
      listResources(this.rootDir).find(
        (resource) => resource.tier === "top" && resource.alias !== orchestratorAlias
      );

    let reviewFeedback = "VERDICT: revise";
    if (reviewerResource) {
      const reviewEndpoint = getResourceEndpoint(reviewerResource.alias, "default", this.rootDir);
      const reviewMessages = buildQueueFillReviewMessages({
        orchestratorName: this.getOrchestratorName(),
        reviewerAlias: reviewerResource.alias,
        draftTasks: draftTaskText,
        inventory: documents.inventory,
        roadmap: documents.roadmap,
        focusTodo: documents.focusTodo,
        changelog: documents.changelog,
        resourceRoster,
        currentDateTime: fillDateTime
      });

      try {
        reviewFeedback = (
          await this.callModel({
            scope: "auto.queue-fill.review",
            actor: "orchestrator",
            endpoint: reviewEndpoint,
            resourceAlias: reviewerResource.alias,
            target: reviewerResource.alias,
            messages: reviewMessages,
            summary: `Reviewing the drafted auto queue backlog with @${reviewerResource.alias}.`
          })
        ).text;
        reviewFeedback = await this.resolveExternalTools({
          scope: "auto.queue-fill.review",
          actor: "orchestrator",
          endpoint: reviewEndpoint,
          resourceAlias: reviewerResource.alias,
          target: reviewerResource.alias,
          messages: reviewMessages,
          rawReply: reviewFeedback
        });
      } catch (error) {
        reviewFeedback = `Critique unavailable because the reviewer step failed: ${(error as Error).message}\nVERDICT: revise`;
      }
    }

    const finalizeMessages = buildQueueFillFinalizeMessages({
      directives: documents.directives,
      inventory: documents.inventory,
      roadmap: documents.roadmap,
      focusTodo: documents.focusTodo,
      changelog: documents.changelog,
      orchestratorSummary: documents.orchestratorSummary,
      orchestratorName: this.getOrchestratorName(),
      agents: agents.map((agent) => `@${agent.slug}`),
      draftTasks: draftTaskText,
      reviewFeedback,
      resourceRoster,
      currentDateTime: fillDateTime
    });

    let finalReply: string;
    try {
      finalReply = (
        await this.callModel({
          scope: "auto.queue-fill.finalize",
          actor: "orchestrator",
          endpoint: draftEndpoint,
          resourceAlias: orchestratorAlias,
          target: this.getOrchestratorName(),
          messages: finalizeMessages,
          summary: reviewerResource
            ? `Finalizing the auto queue backlog after critique from @${reviewerResource.alias}.`
            : "Finalizing the auto queue backlog without a secondary reviewer."
        })
      ).text;
      finalReply = await this.resolveExternalTools({
        scope: "auto.queue-fill.finalize",
        actor: "orchestrator",
        endpoint: draftEndpoint,
        resourceAlias: orchestratorAlias,
        target: this.getOrchestratorName(),
        messages: finalizeMessages,
        rawReply: finalReply
      });
    } catch (error) {
      return {
        queued: [
          await this.enqueueAutoTask(
            "Review the orchestrator planning consensus flow and tighten queue finalization after the failed queue-fill finalize attempt.",
            "medium",
            "orchestrator:auto-fill-fallback"
          ),
          await this.enqueueAutoTask(
            `Inspect the last queue-fill finalize failure and capture it in the changelog. Error: ${(error as Error).message}`,
            "low",
            "orchestrator:auto-fill-fallback"
          )
        ],
        notes: []
      };
    }

    const parsedTasks = parseQueueFillOutput(finalReply);
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

    const queuedResult = await this.queueParsedTasks(tasks, "orchestrator:auto-fill");
    if (queuedResult.tasks.length > 0 || queuedResult.notes.length > 0) {
      await appendChangelogEntry(
        reviewerResource
          ? `Auto queue filled after draft/review/finalize consensus between ${this.getOrchestratorName()} and @${reviewerResource.alias}. Verdict: ${parseQueueReviewVerdict(reviewFeedback)}.`
          : `Auto queue filled after orchestrator-only planning because no secondary reviewer resource was available.`,
        this.rootDir
      );
    }
    return {
      queued: queuedResult.tasks,
      notes: queuedResult.notes
    };
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
    const taskStartedAt = new Date().toISOString();
    const taskStartMs = Date.now();
    const [documents, agents] = await Promise.all([
      loadSystemDocuments(this.rootDir),
      listAgents(this.rootDir)
    ]);
    const resourceLoad = this.systemState.auto.pending.reduce<Record<string, number>>(
      (accumulator, pendingTask) => {
        if (pendingTask.requestedResource) {
          accumulator[pendingTask.requestedResource] =
            (accumulator[pendingTask.requestedResource] ?? 0) + 1;
        }
        return accumulator;
      },
      {}
    );
    let selection;
    let routingFallbackWarning: string | null = null;
    try {
      selection = chooseResourceForTask(task.content, task.requestedResource ?? "auto", this.rootDir, {
        resourceLoad
      });
    } catch (error) {
      const invalidRequestedResource = task.requestedResource;
      selection = chooseResourceForTask(task.content, "auto", this.rootDir, { resourceLoad });
      task.requestedResource = undefined;
      routingFallbackWarning = `Ignored unknown requested resource "${invalidRequestedResource}" and fell back to automatic routing on @${selection.alias}.`;
      await appendAuditEvent(
        {
          timestamp: new Date().toISOString(),
          kind: "system",
          scope: "auto.route.fallback",
          summary: `Fell back to automatic routing for task #${task.id} after invalid requested resource selection.`,
          success: true,
          actor: "orchestrator",
          target: `task:${task.id}`,
          metadata: {
            invalidRequestedResource,
            error: (error as Error).message,
            fallbackResource: selection.alias
          }
        },
        this.rootDir
      );
    }
    const endpoint = this.getAutoTaskEndpoint(selection);
    if (task.requestedModel) {
      endpoint.model = task.requestedModel;
    }
    if (!endpoint.model?.trim()) {
      const recovery = await this.quarantineFailedAutoTask({
        task,
        remaining,
        assignedResource: selection.alias,
        errorMessage: `No default model configured for resource "${selection.alias}".`,
        createRecoveryTask: !this.isSafeModeRecoveryTask(task),
        startedAt: taskStartedAt,
        taskStartMs
      });
      return {
        lines: recovery.recoveryTask
          ? [
              `Quarantined failed auto task #${task.id} and queued safe mode recovery task #${recovery.recoveryTask.id}.`
            ]
          : [`Quarantined failed safe mode recovery task #${task.id}.`],
        errors: [
          `Auto task #${task.id} could not resolve a model for ${selection.alias} (${endpoint.baseUrl}).`
        ],
        shouldExit: false
      };
    }
    const extraContextBlocks = await this.getAutoTaskExtraContext(task);

    // Pre-flight: ask the model to reason briefly about the task before executing.
    // Failure is non-fatal — we log it and proceed without the context block.
    const preflightContext = await this.runTaskPreflight({
      task,
      documents,
      endpoint,
      resourceAlias: selection.alias
    });
    if (preflightContext) {
      extraContextBlocks.push(preflightContext);
    }

    const resourceProfile = getResourceProfile(selection.alias, this.rootDir);
    const outgoingMessages = buildAutoTaskMessages({
      directives: documents.directives,
      inventory: documents.inventory,
      roadmap: documents.roadmap,
      focusTodo: documents.focusTodo,
      changelog: documents.changelog,
      orchestratorSummary: documents.orchestratorSummary,
      orchestratorName: this.getOrchestratorName(),
      agents: agents.map((agent) => `@${agent.slug}`),
      task: task.content,
      priority: task.priority,
      createdBy: task.createdBy,
      resourceAlias: selection.alias,
      resourceRationale: selection.rationale,
      resourceRoster: this.getResourceRosterText(),
      extraContextBlocks,
      currentDateTime: formatCurrentDateTime(),
      maxContextTokens: resourceProfile.maxContextTokens,
      dailySessionContext: this.getDailySessionContext()
    });

    let rawReply: string;
    try {
      rawReply = (
        await this.callModel({
          scope: "auto.task",
          actor: "orchestrator",
          endpoint,
          resourceAlias: selection.alias,
          target: `task:${task.id}`,
          messages: outgoingMessages,
          summary: `Processing auto task #${task.id}.`
        })
      ).text;
      rawReply = await this.resolveExternalTools({
        scope: "auto.task",
        actor: "orchestrator",
        endpoint,
        resourceAlias: selection.alias,
        target: `task:${task.id}`,
        messages: outgoingMessages,
        rawReply
      });
    } catch (error) {
      const errorMessage = (error as Error).message;
      const recovery = await this.quarantineFailedAutoTask({
        task,
        remaining,
        assignedResource: selection.alias,
        assignedModel: endpoint.model,
        errorMessage,
        createRecoveryTask: !this.isSafeModeRecoveryTask(task),
        startedAt: taskStartedAt,
        taskStartMs
      });
      return {
        lines: recovery.recoveryTask
          ? [
              `Quarantined failed auto task #${task.id} and queued safe mode recovery task #${recovery.recoveryTask.id}.`
            ]
          : [`Quarantined failed safe mode recovery task #${task.id}.`],
        errors: [`Auto task #${task.id} failed on ${selection.alias} (${endpoint.baseUrl}): ${errorMessage}`],
        shouldExit: false
      };
    }

    const parsed = parseQueuedTasks(rawReply);
    const replyText = parsed.replyText || "(No direct result text.)";
    const postProcessErrors: string[] = [];
    let writtenFiles: string[] = [];
    try {
      writtenFiles = await this.handleGeneratedFileWrites(parsed.fileWrites, {
        createdBy: task.createdBy,
        taskId: task.id,
        sourceDocumentRelativePath: task.sourceDocumentRelativePath
      });
    } catch (error) {
      postProcessErrors.push(`Dropbox write warning: ${(error as Error).message}`);
    }
    const taskCompletedAt = new Date().toISOString();
    const completedTask: AutoQueueTask = {
      ...task,
      status: "completed",
      startedAt: taskStartedAt,
      completedAt: taskCompletedAt,
      durationMs: Date.now() - taskStartMs,
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

    // Track daily session progress if active.
    if (this.systemState.auto.dailySession && !this.systemState.auto.dailySession.completedAt) {
      this.systemState = {
        ...this.systemState,
        auto: {
          ...this.systemState.auto,
          dailySession: recordDailyTaskCompletion(
            this.systemState.auto.dailySession,
            !!completedTask.errorMessage
          )
        }
      };
    }

    await this.persistSystemState();
    const queuedResult = await this.queueParsedTasks(parsed.queuedTasks, "orchestrator:auto-processed");
    const queued = queuedResult.tasks;
    let movedSourceLine: string | null = null;
    if (task.sourceDocumentRelativePath) {
      try {
        const moved = await moveActiveDocumentToOutbox(task.sourceDocumentRelativePath, this.rootDir);
        movedSourceLine = `Moved source document to outbox: ${moved.path}`;
        await appendAuditEvent(
          {
            timestamp: new Date().toISOString(),
            kind: "system",
            scope: "dropbox.complete",
            summary: `Moved source document ${task.sourceDocumentRelativePath} from active to outbox after task #${task.id}.`,
            success: true,
            actor: "orchestrator",
            target: task.sourceDocumentRelativePath,
            metadata: {
              taskId: task.id,
              outboxPath: moved.path
            }
          },
          this.rootDir
        );
      } catch (error) {
        postProcessErrors.push(`Dropbox completion warning: ${(error as Error).message}`);
      }
    }
    await appendChangelogEntry(
      `Completed auto task #${task.id} on ${selection.alias}/${endpoint.model}. Queued ${queued.length} follow-up task${queued.length === 1 ? "" : "s"} and wrote ${writtenFiles.length} file${writtenFiles.length === 1 ? "" : "s"}.`,
      this.rootDir
    );

    // Check whether the model signaled daily work complete.
    let dailyDigestLine: string | null = null;
    if (/^DAILY_COMPLETE\s*$/m.test(rawReply)) {
      dailyDigestLine = await this.finishDailyWork();
    }

    return {
      lines: [
        `${this.getOrchestratorName()} completed #${task.id} [${task.priority}]${task.delegationRole ? ` {${task.delegationRole}}` : ""} via ${selection.alias}/${endpoint.model}.`,
        replyText,
        ...(routingFallbackWarning ? [routingFallbackWarning] : []),
        ...writtenFiles,
        ...queuedResult.notes,
        ...(movedSourceLine ? [movedSourceLine] : []),
        ...queued.map(
          (queuedTask) =>
            `Queued #${queuedTask.id} [${queuedTask.priority}]${queuedTask.delegationRole ? ` {${queuedTask.delegationRole}}` : ""}${
              queuedTask.requestedResource ? ` -> ${queuedTask.requestedResource}` : ""
            }${queuedTask.requestedModel ? `/${queuedTask.requestedModel}` : ""}: ${queuedTask.content}`
        ),
        ...(dailyDigestLine ? [dailyDigestLine] : [])
      ],
      errors: postProcessErrors,
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

    try {
      return await this.runAutoCycleLocked(async () => {
        if (this.systemState.auto.pending.length === 0) {
          const ingested = await this.ingestNextInboxDocumentTask();
          if (ingested) {
            const processed = await this.processNextAutoTask();
            return {
              lines: [
                `Ingested inbox document ${ingested.relativePath} and queued #${ingested.task.id}.`,
                ...processed.lines
              ],
              errors: processed.errors,
              shouldExit: false
            };
          }

          const filled = await this.fillAutoQueue();
          if (filled.queued.length > 0 || filled.notes.length > 0) {
            return {
              lines: [
                `${this.getOrchestratorName()} filled the queue with ${filled.queued.length} self-improvement task${filled.queued.length === 1 ? "" : "s"}.`,
                ...filled.notes,
                ...filled.queued.map((task) => `Queued #${task.id} [${task.priority}]: ${task.content}`)
              ],
              errors: [],
              shouldExit: false
            };
          }
        }

        return this.processNextAutoTask();
      });
    } catch (error) {
      let recoveryLine: string | undefined;
      if (this.systemState.auto.pending.length > 0) {
        const [task, ...remaining] = this.sortPendingTasks(this.systemState.auto.pending);
        const recovery = await this.quarantineFailedAutoTask({
          task,
          remaining,
          errorMessage: `Unexpected auto-cycle exception: ${(error as Error).message}`,
          createRecoveryTask: !this.isSafeModeRecoveryTask(task)
        });
        recoveryLine = recovery.recoveryTask
          ? `Quarantined task #${task.id} and queued safe mode recovery task #${recovery.recoveryTask.id}.`
          : `Quarantined failed safe mode recovery task #${task.id}.`;
      }
      return {
        lines: recoveryLine ? [recoveryLine] : [],
        errors: [`Auto cycle failed safely: ${(error as Error).message}`],
        shouldExit: false
      };
    }
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
        errors: [
          `Preferred resource must be one of ${[
            ...listResources(this.rootDir).map((resource) => `"${resource.alias}"`),
            '"auto"'
          ].join(", ")}.`
        ],
        shouldExit: false
      };
    }

    let generatedSpec: string | undefined;
    try {
      const documents = await loadSystemDocuments(this.rootDir);
      const orchestratorAlias = this.resolveOrchestratorAlias();
      const endpoint = getResourceEndpoint(orchestratorAlias, "reasoning", this.rootDir);
      const specMessages: ChatMessage[] = [
          {
            role: "system",
            content: [
              `You are ${this.getOrchestratorName()}, the orchestrator identity.`,
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
          actor: "orchestrator",
          endpoint,
          resourceAlias: orchestratorAlias,
          target: normalizedAnswers.name,
          messages: specMessages,
          summary: `Generating the initial specification for @${normalizedAnswers.name}.`
        })
      ).text;
    } catch (error) {
      this.warn?.(`Agent spec generation failed, using template: ${error instanceof Error ? error.message : String(error)}`);
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

      if (command.type === "login") {
        return {
          lines: [
            "Remote login is not implemented in local Crusty yet.",
            "See the remote portal docs and local handoff spec for the planned benlive.tv/crusty integration."
          ],
          errors: [],
          shouldExit: false
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
            `The background pulse will keep ${this.getOrchestratorName()} moving until /stop.`
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
            questions: getAgentCreationQuestions(listResources(this.rootDir).map((resource) => resource.alias))
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

      if (command.type === "participant.list") {
        const participants = await this.getParticipantsSnapshot();
        return {
          lines:
            participants.length === 0
              ? ["No participants configured."]
              : participants.map(
                  (participant) =>
                    `@${participant.alias}: nickname="${participant.nickname}" resource=@${participant.resourceAlias} model=${participant.model}`
                ),
          errors: [],
          shouldExit: false
        };
      }

      if (command.type === "participant.add") {
        try {
          return await this.addParticipantFromInput(
            command.alias,
            command.resourceAlias,
            command.nickname
          );
        } catch (error) {
          return {
            lines: [],
            errors: [(error as Error).message],
            shouldExit: false
          };
        }
      }

      if (command.type === "participant.edit") {
        const alias = this.getResolvedAlias(command.alias);
        return {
          lines: [],
          errors: [],
          shouldExit: false,
          editRequest: {
            kind: "participant",
            target: alias,
            prompt: `participant[@${alias}]> `,
            initialText: JSON.stringify(this.config.endpoints[alias], null, 2)
          }
        };
      }

      if (command.type === "participant.remove") {
        try {
          return await this.removeParticipantConfig(command.alias);
        } catch (error) {
          return {
            lines: [],
            errors: [(error as Error).message],
            shouldExit: false
          };
        }
      }

      if (command.type === "resource.list") {
        const resources = listResources(this.rootDir);
        return {
          lines:
            resources.length === 0
              ? ["No resources configured."]
              : resources.map(
                  (resource) =>
                    `@${resource.alias}: ${resource.label} (${resource.tier}, ${resource.apiStyle ?? "ollama"}) ${resource.baseUrl} model=${resource.defaultModel}${resource.lastRefreshedAt ? ` refreshed=${resource.lastRefreshedAt}` : ""}`
                ),
          errors: [],
          shouldExit: false
        };
      }

      if (command.type === "resource.add") {
        try {
          return await this.addResourceFromInput(
            command.alias,
            command.label,
            command.baseUrl,
            command.tier ?? "mid",
            command.apiStyle ?? "ollama"
          );
        } catch (error) {
          return {
            lines: [],
            errors: [(error as Error).message],
            shouldExit: false
          };
        }
      }

      if (command.type === "resource.refresh") {
        try {
          return await this.refreshResourceFromEndpoint(command.alias);
        } catch (error) {
          return {
            lines: [],
            errors: [(error as Error).message],
            shouldExit: false
          };
        }
      }

      if (command.type === "resource.edit") {
        const resource = getResourceProfile(command.alias, this.rootDir);
        return {
          lines: [],
          errors: [],
          shouldExit: false,
          editRequest: {
            kind: "resource",
            target: resource.alias,
            prompt: `resource[@${resource.alias}]> `,
            initialText: JSON.stringify(resource, null, 2)
          }
        };
      }

      if (command.type === "resource.remove") {
        try {
          return await this.removeResourceConfig(command.alias);
        } catch (error) {
          return {
            lines: [],
            errors: [(error as Error).message],
            shouldExit: false
          };
        }
      }

      if (command.type === "models.list") {
        try {
          const snapshot = await this.getModelsSnapshot(command.target);
          return {
            lines:
              snapshot.models.length === 0
                ? [`No models found on @${snapshot.resourceAlias}.`]
                : [
                    `Models on @${snapshot.resourceAlias} (${snapshot.baseUrl}):`,
                    ...snapshot.models.map(
                      (model) =>
                        `${model.name}${
                          model.parameterSize || model.quantizationLevel
                            ? ` (${[model.parameterSize, model.quantizationLevel].filter(Boolean).join(", ")})`
                            : ""
                        }`
                    )
                  ],
            errors: [],
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

      if (command.type === "directChat") {
        try {
          return await this.runDirectResourceChat(command.resourceAlias, command.text, command.model);
        } catch (error) {
          return {
            lines: [],
            errors: [(error as Error).message],
            shouldExit: false
          };
        }
      }

      if (command.type === "model.get") {
        const endpoint = this.config.endpoints[this.runtime.currentEndpoint];
        const policyLabel = endpoint.modelPolicy === "auto" ? "auto" : "fixed";
        const purposeModels = [
          endpoint.reasoningModel ? `reasoning=${endpoint.reasoningModel}` : null,
          endpoint.codingModel ? `coding=${endpoint.codingModel}` : null,
          endpoint.toolsModel ? `tools=${endpoint.toolsModel}` : null,
        ].filter(Boolean);
        const purposeSuffix = purposeModels.length > 0
          ? ` | ${purposeModels.join(", ")}`
          : "";
        return {
          lines: [
            `Current participant: @${this.runtime.currentEndpoint} (${endpoint.nickname}) using @${endpoint.resourceAlias}/${endpoint.model} [policy=${policyLabel}${purposeSuffix}]. Plain messages still go to @${this.config.defaultEndpoint}.`
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

      if (command.type === "model.assign") {
        try {
          this.config = setEndpointModel(this.config, command.alias, command.model);
          await this.persistConfig();
          return {
            lines: [`Model for @${command.alias} is now ${this.config.endpoints[command.alias].model}.`],
            errors: [],
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

      if (command.type === "model.policy") {
        try {
          this.config = setEndpointModelPolicy(this.config, command.alias, command.policy);
          await this.persistConfig();
          const endpoint = this.config.endpoints[command.alias];
          const policyLabel = command.policy === "auto"
            ? "auto (purpose-based model switching enabled)"
            : "fixed (static model)";
          return {
            lines: [`Model policy for @${command.alias} is now ${policyLabel}.`],
            errors: [],
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

      if (command.type === "model.purpose") {
        try {
          this.config = setEndpointPurposeModel(
            this.config,
            command.alias,
            command.purpose,
            command.model
          );
          await this.persistConfig();
          return {
            lines: [
              `${command.purpose} model for @${command.alias} is now ${command.model}. Set policy to "auto" to enable: /model ${command.alias} policy auto`
            ],
            errors: [],
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

      if (command.type === "nickname.get") {
        const alias = this.getResolvedAlias(command.alias);
        return {
          lines: [`Nickname for @${alias}: ${this.config.endpoints[alias].nickname}`],
          errors: [],
          shouldExit: false
        };
      }

      if (command.type === "nickname.set") {
        try {
          const alias = this.getResolvedAlias(command.alias);
          this.config = setEndpointNickname(this.config, alias, command.nickname);
          await this.persistConfig();
          return {
            lines: [`Nickname for @${alias} is now ${this.config.endpoints[alias].nickname}.`],
            errors: [],
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

      if (command.type === "bind.get") {
        const alias = this.getResolvedAlias(command.alias);
        return {
          lines: [`@${alias} is bound to resource @${this.config.endpoints[alias].resourceAlias}.`],
          errors: [],
          shouldExit: false
        };
      }

      if (command.type === "bind.set") {
        try {
          const alias = this.getResolvedAlias(command.alias);
          this.config = setEndpointResourceAlias(this.config, alias, command.resourceAlias, this.rootDir);
          await this.persistConfig();
          return {
            lines: [`@${alias} is now bound to resource @${this.config.endpoints[alias].resourceAlias}.`],
            errors: [],
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

      if (command.type === "preferences.get") {
        const prefs = this.config.preferences;
        if (!prefs || Object.keys(prefs).length === 0) {
          return {
            lines: ["No preferences configured. Use /preferences set <key> <value>"],
            errors: [],
            shouldExit: false
          };
        }
        const lines = ["User preferences:"];
        if (prefs.zipCode) lines.push(`  zipCode: ${prefs.zipCode}`);
        if (prefs.city) lines.push(`  city: ${prefs.city}`);
        if (prefs.personalWebsiteUrl) lines.push(`  personalWebsiteUrl: ${prefs.personalWebsiteUrl}`);
        if (prefs.dailyDigestDirective) lines.push(`  dailyDigestDirective: ${prefs.dailyDigestDirective}`);
        return { lines, errors: [], shouldExit: false };
      }

      if (command.type === "preferences.set") {
        try {
          this.config = setPreference(this.config, command.key, command.value);
          await saveConfig(this.config, this.rootDir);
          const display = command.value.trim() || "(cleared)";
          return {
            lines: [`Preference ${command.key} set to: ${display}`],
            errors: [],
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

      if (command.type === "daily.status") {
        const session = this.systemState.auto.dailySession;
        if (!session) {
          return {
            lines: ["No daily work session active. Use /daily start to begin one."],
            errors: [],
            shouldExit: false
          };
        }
        if (session.completedAt) {
          return {
            lines: [
              `Daily work session completed at ${session.completedAt}.`,
              `Tasks completed: ${session.tasksCompleted}, errored: ${session.tasksErrored}.`,
              ...(session.digestPath ? [`Digest: ${session.digestPath}`] : [])
            ],
            errors: [],
            shouldExit: false
          };
        }
        const elapsed = Math.round((Date.now() - new Date(session.startedAt).getTime()) / 60_000);
        return {
          lines: [
            `Daily work session in progress (started ${elapsed} minutes ago).`,
            `Tasks completed: ${session.tasksCompleted}, errored: ${session.tasksErrored}.`
          ],
          errors: [],
          shouldExit: false
        };
      }

      if (command.type === "daily.start") {
        if (this.systemState.auto.dailySession && !this.systemState.auto.dailySession.completedAt) {
          return {
            lines: [],
            errors: ["A daily work session is already active. Use /daily finish to complete it first."],
            shouldExit: false
          };
        }
        this.systemState = {
          ...this.systemState,
          auto: {
            ...this.systemState.auto,
            dailySession: startDailySession()
          }
        };
        await this.persistSystemState();
        await appendChangelogEntry("Daily work session started.", this.rootDir);
        return {
          lines: [`Daily work session started. Enter /auto to begin autonomous work. The orchestrator will generate a Daily Digest when the session concludes.`],
          errors: [],
          shouldExit: false
        };
      }

      if (command.type === "daily.finish") {
        const session = this.systemState.auto.dailySession;
        if (!session || session.completedAt) {
          return {
            lines: [],
            errors: ["No active daily work session to finish. Use /daily start to begin one."],
            shouldExit: false
          };
        }
        const digestLine = await this.finishDailyWork();
        return {
          lines: [digestLine ?? "Daily work session finished."],
          errors: [],
          shouldExit: false
        };
      }

      if (command.type === "promote") {
        try {
          const resource = getResourceProfile(command.alias, this.rootDir);
          if (resource.tier !== "top") {
            return {
              lines: [],
              errors: [
                `Resource @${resource.alias} is tier "${resource.tier}". Only top-tier resources can be promoted to orchestrator.`
              ],
              shouldExit: false
            };
          }
          this.config = { ...this.config, orchestratorResourceAlias: resource.alias };
          await this.persistConfig();
          return {
            lines: [
              `Orchestrator resource promoted to @${resource.alias}.`,
              `All orchestrator-routed tasks will now use this resource.`,
              `Use /promote with the original alias to revert, or remove orchestratorResourceAlias from config.json.`
            ],
            errors: [],
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

      if (command.type === "orchestrator.get") {
        return {
          lines: [`Orchestrator profile name: ${this.config.orchestratorName}`],
          errors: [],
          shouldExit: false
        };
      }

      if (command.type === "orchestrator.set") {
        try {
          return await this.updateOrchestratorProfileName(command.name);
        } catch (error) {
          return {
            lines: [],
            errors: [(error as Error).message],
            shouldExit: false
          };
        }
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
        const defaultOldNickname = titleCase(fromAlias);
        const defaultNewNickname = titleCase(toAlias);

        this.config = {
          ...this.config,
          defaultEndpoint:
            this.config.defaultEndpoint === fromAlias ? toAlias : this.config.defaultEndpoint,
          endpoints: Object.entries(this.config.endpoints).reduce<AppConfig["endpoints"]>(
            (accumulator, [alias, endpoint]) => {
              if (alias === fromAlias) {
                accumulator[toAlias] = {
                  ...endpoint,
                  nickname:
                    endpoint.nickname === defaultOldNickname
                      ? defaultNewNickname
                      : replaceAliasReferences(endpoint.nickname, fromAlias, toAlias),
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
        if (!isSpeechSupported(this.platform)) {
          return {
            lines: [this.speechUnavailableLine()],
            errors: [],
            shouldExit: false
          };
        }
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
        if (!isSpeechSupported(this.platform)) {
          return {
            lines: [this.speechUnavailableLine()],
            errors: [],
            shouldExit: false
          };
        }
        return {
          lines: VOICE_PRESETS.map(
            (preset) => `${preset.key}: ${preset.description} (${preset.voice})`
          ),
          errors: [],
          shouldExit: false
        };
      }

      if (command.type === "voice.get") {
        if (!isSpeechSupported(this.platform)) {
          return {
            lines: [this.speechUnavailableLine()],
            errors: [],
            shouldExit: false
          };
        }
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
        if (!isSpeechSupported(this.platform)) {
          return {
            lines: [this.speechUnavailableLine()],
            errors: [],
            shouldExit: false
          };
        }
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
