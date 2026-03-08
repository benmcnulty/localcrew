import { mkdir, readFile } from "node:fs/promises";
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
  PORTAL_BASE_URL,
  fetchPortLogs,
  loadPortalSession,
  publishPortLog,
  savePortalSession,
  validateDeviceToken,
  pushSnapshot,
} from "./portal.ts";
import type { PortFeedResult, PortalSession, PortalSnapshot, PortLogEntry } from "./portal.ts";
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
  readInternalFile,
  searchInternalFiles,
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
import { getHeadingSectionRange, isHeadingReference, syncDocumentNavigation } from "./document-outline.ts";
import {
  buildAgentChatMessages,
  buildAgentIdentityBlock,
  buildAutoTaskMessages,
  buildChatMessages,
  buildQueueFillFinalizeMessages,
  buildQueueFillMessages,
  buildQueueFillReviewMessages,
  buildTaskPreflightMessages,
  parseTaskDomain
} from "./messages.ts";
import { chatWithOllamaDetailed, listOllamaModels, type FetchFn } from "./ollama.ts";
import { pingResource, probeResourceModels } from "./resource-discovery.ts";
import type { ResourceHealthResult, ResourceHealthStatus } from "./resource-discovery.ts";
import {
  addResource,
  classifyTask,
  chooseResourceForTask,
  detectTaskPurpose,
  getModelProfile,
  getEffectiveResourceRole,
  getShipRoleLabel,
  getResourceCapacitySummary,
  getOrchestratorResourceAlias,
  getResourceEndpoint,
  getResourceProfile,
  getResourceProfilesByTier,
  isOrchestratorCapable,
  listResources,
  removeResource,
  renderNetworkTopology,
  renderResourceInventory,
  resolveResourcePurpose,
  setModelProfile,
  selectModelForEndpoint,
  checkContextBudget,
  findHighestContextResource,
  type ResourceTelemetry,
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
import { atomicWriteFile, getStoragePaths, type StoragePaths, withFileLock } from "./storage.ts";
import {
  appendAuditEvent,
  loadTelemetrySummary,
  readRecentAuditEvents,
  resetTelemetry
} from "./telemetry.ts";
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
  LiveDeviceMetrics,
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
  ResourceSyncReport,
  ResourceRole
} from "./types.ts";
import { getVoicePreset, VOICE_PRESETS } from "./voices.ts";
import { searchWikipedia } from "./wikipedia.ts";
import { searchReddit } from "./reddit.ts";
import { searchWeb, isAllowedSearchTopic } from "./web-search.ts";
import { fetchPageText } from "./page-fetcher.ts";
import { fetchWeather } from "./weather.ts";
import {
  getDailyWorkSnapshot,
  isDailyWorkStale,
  saveDailyWork,
  parseDailyWorkIntervalMs,
  buildDailyWorkTaskContent,
  type DailyWorkSnapshot,
} from "./daily-work.ts";
import { fetchBenLive } from "./benlive.ts";
import { fetchWebsite } from "./website.ts";
import { formatCurrentDateTime, isNetworkError, titleCase } from "./utils.ts";
import {
  parseScriptRequests,
  staticAnalyze,
  executeScript,
  ScriptSessionTracker,
  type ScriptRequest,
  type ScriptExecutionResult,
} from "./sandbox.ts";

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
const INTERNAL_WIKIPEDIA_SYSTEM_TERMS =
  "localcrew|crew|ollama|orchestrator|safe mode|safe-mode|queue|routing|model(?:\\s+is\\s+required)?|telemetry|hud|prompt|resource alias";
const INTERNAL_REDDIT_SYSTEM_TERMS =
  "localcrew|crew|orchestrator|safe mode|safe-mode|queue|routing|telemetry|hud|resource alias";
const INTERNAL_SEARCH_SYSTEM_TERMS =
  "localcrew|crew|orchestrator|safe mode|safe-mode|queue|routing|telemetry|hud|resource alias";

function buildInternalQueryPattern(systemTerms: string, dynamicAliases: string[]): RegExp {
  const escaped = dynamicAliases
    .filter((a) => a.length > 0)
    .map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const aliasPart = escaped.length > 0 ? `|${escaped.join("|")}` : "";
  return new RegExp(`\\b(${systemTerms}${aliasPart})\\b`, "i");
}
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

type GeneratedFileStage = "active" | "outbox" | "internal";
type GeneratedFileUpdateMode = "replace" | "replace-section" | "insert-after" | "insert-before" | "append" | "prepend";

type GeneratedFileDirective =
  | {
      kind: "write";
      stage: GeneratedFileStage;
      filename: string;
      content: string;
    }
  | {
      kind: "update";
      stage: GeneratedFileStage;
      filename: string;
      mode: GeneratedFileUpdateMode;
      content: string;
      anchor?: string;
    };

function extractDirectiveBlock(body: string, label: string): string | null {
  const pattern = new RegExp(
    `(?:^|\\n)${label}\\n([\\s\\S]*?)\\nEND${label}(?=\\n|$)`,
    "i"
  );
  const match = body.match(pattern);
  return match ? match[1].trimEnd() : null;
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) {
    return 0;
  }
  let count = 0;
  let index = 0;
  while (true) {
    const foundAt = haystack.indexOf(needle, index);
    if (foundAt === -1) {
      return count;
    }
    count += 1;
    index = foundAt + needle.length;
  }
}

function resolveGeneratedUpdateAnchor(
  currentContent: string,
  anchor: string,
  filename: string
): { index: number; length: number } {
  const normalizedAnchor = anchor.replaceAll("\r\n", "\n").trimEnd();
  if (!normalizedAnchor) {
    throw new Error(`UPDATE for ${filename} requires a non-empty anchor block.`);
  }

  if (isHeadingReference(normalizedAnchor)) {
    const { start, heading } = getHeadingSectionRange(currentContent, normalizedAnchor);
    return {
      index: start,
      length: heading.raw.length
    };
  }

  const occurrences = countOccurrences(currentContent, normalizedAnchor);
  if (occurrences === 0) {
    throw new Error(`UPDATE for ${filename} could not find the requested anchor.`);
  }
  if (occurrences > 1) {
    throw new Error(`UPDATE for ${filename} matched multiple anchors; refusing ambiguous edit.`);
  }

  return {
    index: currentContent.indexOf(normalizedAnchor),
    length: normalizedAnchor.length
  };
}

function joinDocumentParts(left: string, right: string): string {
  const normalizedLeft = left.trimEnd();
  const normalizedRight = right.trimStart();
  if (!normalizedLeft) {
    return normalizedRight;
  }
  if (!normalizedRight) {
    return normalizedLeft;
  }
  return `${normalizedLeft}\n${normalizedRight}`;
}

function applyGeneratedFileDirective(
  currentContent: string,
  directive: Extract<GeneratedFileDirective, { kind: "update" }>
): string {
  const normalizedCurrent = currentContent.replaceAll("\r\n", "\n");
  const normalizedDirectiveContent = directive.content.replaceAll("\r\n", "\n").trimEnd();
  if (!normalizedCurrent.trim()) {
    throw new Error(
      `Cannot apply UPDATE to ${directive.filename} because the target file does not exist or is empty.`
    );
  }

  if (directive.mode === "append") {
    return `${joinDocumentParts(normalizedCurrent, normalizedDirectiveContent)}\n`;
  }

  if (directive.mode === "prepend") {
    return `${joinDocumentParts(normalizedDirectiveContent, normalizedCurrent)}\n`;
  }

  const anchor = directive.anchor?.replaceAll("\r\n", "\n").trimEnd();
  if (!anchor) {
    throw new Error(`UPDATE for ${directive.filename} requires a non-empty anchor block.`);
  }

  if (directive.mode === "replace-section") {
    if (!isHeadingReference(anchor)) {
      throw new Error(
        `UPDATE for ${directive.filename} requires SEARCH to use HEADING: ... when mode is replace-section.`
      );
    }
    const { start, end } = getHeadingSectionRange(normalizedCurrent, anchor);
    return `${normalizedCurrent.slice(0, start)}${normalizedDirectiveContent}\n${normalizedCurrent.slice(end)}`.replace(
      /\s*$/,
      "\n"
    );
  }

  if (directive.mode === "replace" && isHeadingReference(anchor)) {
    throw new Error(
      `UPDATE for ${directive.filename} cannot use HEADING: ... with replace; use replace-section instead.`
    );
  }

  const resolvedAnchor = resolveGeneratedUpdateAnchor(normalizedCurrent, anchor, directive.filename);
  if (directive.mode === "replace") {
    return `${normalizedCurrent.slice(0, resolvedAnchor.index)}${normalizedDirectiveContent}${normalizedCurrent.slice(
      resolvedAnchor.index + resolvedAnchor.length
    )}`.replace(/\s*$/, "\n");
  }

  if (directive.mode === "insert-before") {
    return `${normalizedCurrent.slice(0, resolvedAnchor.index)}${normalizedDirectiveContent}\n${normalizedCurrent.slice(
      resolvedAnchor.index
    )}`.replace(/\s*$/, "\n");
  }

  return `${normalizedCurrent.slice(0, resolvedAnchor.index + resolvedAnchor.length)}\n${normalizedDirectiveContent}${normalizedCurrent.slice(
    resolvedAnchor.index + resolvedAnchor.length
  )}`.replace(/\s*$/, "\n");
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
  fileDirectives: GeneratedFileDirective[];
  scriptRequests: ScriptRequest[];
} {
  const replyLines: string[] = [];
  const queuedTasks: Array<{
    priority: TaskPriority;
    content: string;
    delegationRole?: string;
    requestedResource?: string;
    requestedModel?: string;
  }> = [];
  const fileDirectives: GeneratedFileDirective[] = [];

  // Extract SCRIPT_REQUEST blocks before other parsing
  const scriptRequests = parseScriptRequests(content);
  const scriptPattern =
    /(?:^|\n)SCRIPT_REQUEST\[[a-z0-9-]+\]\n[\s\S]*?\nENDSCRIPT(?=\n|$)/gi;
  let workingContent = content.replace(scriptPattern, "\n");

  const updatePattern =
    /(?:^|\n)UPDATE\[(active|outbox|internal)\]\[([^\]\n]+)\]\[(replace|replace-section|insert-after|insert-before|append|prepend)\]\n([\s\S]*?)\nENDUPDATE(?=\n|$)/gi;
  for (const updateMatch of workingContent.matchAll(updatePattern)) {
    const stage = updateMatch[1].toLowerCase() as GeneratedFileStage;
    const filename = updateMatch[2].trim();
    const mode = updateMatch[3].toLowerCase() as GeneratedFileUpdateMode;
    const body = updateMatch[4];
    const contentBlock = extractDirectiveBlock(body, "CONTENT");
    if (!contentBlock?.trim()) {
      continue;
    }
    if (mode === "append" || mode === "prepend") {
      fileDirectives.push({
        kind: "update",
        stage,
        filename,
        mode,
        content: contentBlock
      });
      continue;
    }

    const anchorLabel = mode === "replace" || mode === "replace-section" ? "SEARCH" : "ANCHOR";
    const anchorBlock = extractDirectiveBlock(body, anchorLabel);
    if (!anchorBlock?.trim()) {
      continue;
    }
    fileDirectives.push({
      kind: "update",
      stage,
      filename,
      mode,
      anchor: anchorBlock,
      content: contentBlock
    });
  }
  workingContent = workingContent.replace(updatePattern, "\n");

  const writePattern =
    /(?:^|\n)WRITE\[(active|outbox|internal)\]\[([^\]\n]+)\]\n([\s\S]*?)\nENDWRITE(?=\n|$)/gi;
  for (const writeMatch of workingContent.matchAll(writePattern)) {
    fileDirectives.push({
      kind: "write",
      stage: writeMatch[1].toLowerCase() as "active" | "outbox" | "internal",
      filename: writeMatch[2].trim(),
      content: writeMatch[3].trimEnd()
    });
  }
  workingContent = workingContent.replace(writePattern, "\n");

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
    fileDirectives,
    scriptRequests,
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

function parseQueueReviewVerdict(content: string): "approve" | "revise" | "reject" {
  const match = content.trim().match(/(?:^|\n)VERDICT:\s*(approve|revise|reject)\s*$/i);
  if (!match) {
    return "revise";
  }
  const verdict = match[1].toLowerCase();
  if (verdict === "approve" || verdict === "reject") {
    return verdict;
  }
  return "revise";
}

function summarizeForParentResult(text: string, maxChars = 1000): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, maxChars)}…`;
}

function extractPreflightGoal(preflightContext: string): string | null {
  const match = preflightContext.match(
    /(?:^|\n)GOAL:\s*([\s\S]*?)(?:\n(?:CONSTRAINTS|RISKS|APPROACH):|$)/i
  );
  if (!match) {
    return null;
  }
  const goal = match[1].trim();
  return goal.length > 0 ? goal : null;
}

function extractContentTerms(text: string): string[] {
  const stopWords = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "to",
    "of",
    "in",
    "on",
    "for",
    "with",
    "by",
    "from",
    "this",
    "that",
    "these",
    "those",
    "is",
    "are",
    "be",
    "as",
    "at",
    "it",
    "its",
    "into",
    "should",
    "must",
    "can",
    "will",
    "would",
    "about",
    "after",
    "before",
    "through",
    "across"
  ]);

  const counts = new Map<string, number>();
  for (const token of text.toLowerCase().match(/[a-z0-9_.-]+/g) ?? []) {
    if (token.length < 3 || stopWords.has(token)) {
      continue;
    }
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 10)
    .map(([token]) => token);
}

function isSubstantiveOutput(output: string): boolean {
  const stripped = output
    .replace(/^(sure|of course|i['’]ll|let me|here['’]s|certainly)[^.]*\.\s*/gi, "")
    .replace(/\n---+\n/g, "\n")
    .trim();
  return stripped.length >= 10;
}

function outputAddressesTask(output: string, taskContent: string): boolean {
  const taskTerms = extractContentTerms(taskContent);
  if (taskTerms.length === 0) {
    return true;
  }
  const normalizedOutput = output.toLowerCase();
  const found = taskTerms.filter((term) => normalizedOutput.includes(term));
  return found.length >= Math.max(1, Math.ceil(taskTerms.length * 0.3));
}

function outputAlignedWithGoal(output: string, goal: string): boolean {
  const goalTerms = extractContentTerms(goal);
  if (goalTerms.length === 0) {
    return true;
  }
  const normalizedOutput = output.toLowerCase();
  return goalTerms.some((term) => normalizedOutput.includes(term));
}

function verifyTaskOutput(options: {
  task: AutoQueueTask;
  output: string;
  preflightGoal: string | null;
  claimedWriteCount: number;
  verifiedWriteCount: number;
  postProcessErrors: string[];
}): {
  passed: boolean;
  reason: string;
  signals: {
    substantive: boolean;
    addressesTask: boolean;
    artifactsVerified: boolean;
    goalAligned: boolean;
  };
} {
  const signals = {
    substantive: isSubstantiveOutput(options.output),
    addressesTask: outputAddressesTask(options.output, options.task.content),
    artifactsVerified:
      options.postProcessErrors.length === 0 &&
      (options.claimedWriteCount === 0 || options.verifiedWriteCount >= options.claimedWriteCount),
    goalAligned: options.preflightGoal
      ? outputAlignedWithGoal(options.output, options.preflightGoal)
      : true
  };

  const passed = signals.substantive && signals.artifactsVerified;
  const reason = [
    `substantive=${signals.substantive ? "yes" : "no"}`,
    `addressesTask=${signals.addressesTask ? "yes" : "no"}`,
    `artifactsVerified=${signals.artifactsVerified ? "yes" : "no"}`,
    `goalAligned=${signals.goalAligned ? "yes" : "no"}`
  ].join(", ");

  return { passed, reason, signals };
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
      return "crew> ";
  }
}

function truncateForPrompt(content: string, limit: number): { text: string; truncated: boolean } {
  if (content.length <= limit) {
    return { text: content, truncated: false };
  }

  return {
    text: `${content.slice(0, limit)}\n\n[truncated by Local Crew after ${limit} characters]`,
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

/**
 * Extract significant keywords from a task string for overlap comparison.
 * Strips common low-information words so we match on substantive topics.
 */
function extractTaskKeywords(content: string): Set<string> {
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "to", "for", "of", "in", "on", "is", "are", "was",
    "with", "by", "from", "at", "that", "this", "it", "be", "as", "has", "have", "had",
    "not", "but", "if", "its", "all", "into", "our", "their", "can", "will", "do", "does",
    "more", "most", "each", "every", "any", "no", "been", "would", "should", "could",
    "than", "also", "only", "how", "what", "when", "where", "which", "who", "that",
    "review", "update", "improve", "enhance", "optimize", "implement", "add", "create",
    "ensure", "check", "verify", "analyze", "generate", "build", "make", "use",
    "system", "current", "existing", "new", "based", "local", "crew",
  ]);
  const words = content.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);
  return new Set(words.filter((w) => w.length > 2 && !stopWords.has(w)));
}

/**
 * Check if a proposed task is too similar to an existing one based on keyword overlap.
 * Returns true if >= 60% of the proposed task's keywords match an existing task.
 */
function isTaskDuplicate(
  proposed: string,
  existingTasks: ReadonlyArray<{ content: string }>
): boolean {
  const proposedKeywords = extractTaskKeywords(proposed);
  if (proposedKeywords.size === 0) return false;

  for (const existing of existingTasks) {
    const existingKeywords = extractTaskKeywords(existing.content);
    if (existingKeywords.size === 0) continue;
    let overlap = 0;
    for (const word of proposedKeywords) {
      if (existingKeywords.has(word)) overlap++;
    }
    const overlapRatio = overlap / proposedKeywords.size;
    if (overlapRatio >= 0.6) return true;
  }
  return false;
}

/** Rotating pool of diverse fallback tasks when the model fails to produce parseable output. */
const FALLBACK_TASK_POOL: Array<{ priority: "medium" | "low"; content: string }> = [
  { priority: "medium", content: "Compile a concise briefing on recent industry AI engineering developments relevant to local inference." },
  { priority: "low", content: "Audit memory and index files for stale or redundant context that can be pruned." },
  { priority: "medium", content: "Review the orchestrator changelog and summarize the three most impactful recent improvements." },
  { priority: "low", content: "Draft a short status report on network resource utilization patterns from recent telemetry." },
  { priority: "medium", content: "Research one actionable optimization for the current hardware configuration using web search." },
  { priority: "low", content: "Organize the focus todo list by removing completed or obsolete items." },
  { priority: "medium", content: "Generate a user-facing daily briefing with weather, news highlights, and system status." },
  { priority: "low", content: "Search Wikipedia for a topic related to the user profile interests and write a brief summary." },
];
let fallbackRotation = 0;

function pickFallbackTasks(): Array<{ priority: "medium" | "low"; content: string }> {
  const pick1 = FALLBACK_TASK_POOL[fallbackRotation % FALLBACK_TASK_POOL.length];
  const pick2 = FALLBACK_TASK_POOL[(fallbackRotation + 1) % FALLBACK_TASK_POOL.length];
  fallbackRotation = (fallbackRotation + 2) % FALLBACK_TASK_POOL.length;
  return [pick1, pick2];
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

export class LocalCrewApp {
  private config: AppConfig;
  private sessions: SessionsFile;
  private systemState: SystemState;
  private runtime: RuntimeState;
  private portalSession: PortalSession | null;
  private readonly rootDir: string;
  private readonly fetchFn?: FetchFn;
  private readonly speakFn: SpeakFn;
  private readonly warn: WarnFn;
  private readonly platform: NodeJS.Platform;
  private activeCycleCount = 0;
  private static readonly DEFAULT_MAX_PARALLEL_CYCLES = 3;
  /** AbortController for cancelling in-flight auto-cycle fetch operations on /stop. */
  private autoCycleAbort: AbortController | null = null;
  /** Maps resource alias → the task currently being processed by that resource. */
  private readonly activeTasksByResource = new Map<string, AutoQueueTask>();
  /** IDs of tasks currently being processed (prevents duplicate dequeue under parallel dispatch). */
  private readonly processingTaskIds = new Set<number>();
  private apiServerHandle?: { pushDisplayEvent(payload: Record<string, unknown>): void };
  private readonly resourceTelemetry = new Map<string, ResourceTelemetry>();
  /** Tracks when each resource last had a network-level failure (e.g. "fetch failed"). */
  private readonly networkFailureTimes = new Map<string, number>();
  /** ISO epoch ms of when each resource alias last received a task assignment — used for fairness scoring. */
  private readonly resourceLastAssignedAt = new Map<string, number>();
  /** Live OS metrics from agent sync, keyed by alias. Stale entries older than 10 minutes are ignored. */
  private readonly liveDeviceMetrics = new Map<string, LiveDeviceMetrics & { receivedAt: number }>();
  /** Cooldown period (ms) during which a network-failed resource gets a routing penalty. */
  private static readonly NETWORK_FAILURE_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes
  /** Date slug (YYYY-MM-DD) of the last successfully queued daily-work task, prevents re-queuing loop. */
  private lastDailyWorkQueuedDate: string | null = null;
  /** Background health status per resource alias. */
  private readonly resourceHealth = new Map<string, ResourceHealthResult>();
  /** Timestamp of last health poll cycle. */
  private lastHealthPollAt = 0;
  /** Interval between background health polls (5 minutes). */
  private static readonly HEALTH_POLL_INTERVAL_MS = 5 * 60 * 1000;
  /** Cooldown (ms) after a queue fill failure before retrying — prevents fill-fail loops. */
  private static readonly FILL_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
  private static readonly QUEUE_FILL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes — queue fill prompts are large
  /** Timestamp of the last failed queue fill attempt (used for cooldown). */
  private lastFillFailedAt = 0;
  /** Consecutive idle cycles with no work — used for pulse backoff. */
  private consecutiveIdleCycles = 0;
  /** Script sandbox session tracker for rate-limiting rejected purpose-slugs. */
  private readonly scriptTracker = new ScriptSessionTracker();
  /** Epoch ms when the app was created — used for uptime calculation. */
  private readonly _startedAt = Date.now();

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
    this.portalSession = loadPortalSession(this.rootDir);
    this.fetchFn = options.fetchFn;
    this.speakFn = options.speakFn ?? defaultSpeakFn;
    this.warn = options.warn ?? (() => {});
    this.platform = options.platform ?? process.platform;
    setModelProfile(config.preferences?.modelProfile ?? "auto");
    this.runtime = {
      mode: "command",
      currentEndpoint: config.defaultEndpoint
    };
  }

  static async create(options: ExecuteOptions = {}): Promise<LocalCrewApp> {
    const rootDir = options.rootDir ?? process.cwd();
    const [config, sessions, systemState] = await Promise.all([
      loadConfig(rootDir),
      loadSessions(rootDir),
      loadSystemState(rootDir)
    ]);

    const app = new LocalCrewApp(config, sessions, systemState, { ...options, rootDir });
    await ensureDropboxLayout(rootDir);
    await app.sanitizeAutoQueueState();
    await app.syncSystemFiles();
    return app;
  }

  setApiServerHandle(handle: { pushDisplayEvent(payload: Record<string, unknown>): void }): void {
    this.apiServerHandle = handle;
  }

  private pushDisplayEvent(payload: Record<string, unknown>): void {
    if (!this.apiServerHandle) {
      return;
    }
    this.apiServerHandle.pushDisplayEvent(payload);
  }

  private getDefaultResourceTelemetry(alias: string): ResourceTelemetry {
    const queueDepth = this.systemState.auto.pending.filter(
      (task) => task.requestedResource === alias || task.assignedResource === alias
    ).length;
    return {
      queueDepth,
      ramUsagePct: 0,
      tokensPerSecond: 0,
      activeModel: null,
      avgQueueWaitMs: 0,
      successRate: 1,
      failureCount: 0
    };
  }

  private updateResourceTelemetry(alias: string, result: OllamaChatResult, durationMs: number): void {
    const previous = this.resourceTelemetry.get(alias) ?? this.getDefaultResourceTelemetry(alias);
    const tokensPerSecond =
      typeof result.evalCount === "number" && typeof result.evalDuration === "number" && result.evalDuration > 0
        ? (result.evalCount * 1_000_000_000) / result.evalDuration
        : previous.tokensPerSecond;
    const queueDepth = this.systemState.auto.pending.filter(
      (task) => task.requestedResource === alias || task.assignedResource === alias
    ).length;
    const sampleCount = Math.max(1, Math.min(20, previous.avgQueueWaitMs > 0 ? 2 : 1));
    const avgQueueWaitMs =
      sampleCount === 1 ? durationMs : Math.round((previous.avgQueueWaitMs + durationMs) / 2);

    this.resourceTelemetry.set(alias, {
      ...previous,
      queueDepth,
      tokensPerSecond: Number.isFinite(tokensPerSecond) ? tokensPerSecond : previous.tokensPerSecond,
      activeModel: previous.activeModel,
      avgQueueWaitMs
    });
  }

  private updateResourceOutcome(alias: string, model: string, success: boolean, errorMessage?: string): void {
    const previous = this.resourceTelemetry.get(alias) ?? this.getDefaultResourceTelemetry(alias);
    const nextFailureCount = success ? previous.failureCount : previous.failureCount + 1;
    const nextSuccessRate = success
      ? Math.min(1, previous.successRate + 0.05)
      : Math.max(0, previous.successRate - 0.1);
    this.resourceTelemetry.set(alias, {
      ...previous,
      activeModel: previous.activeModel,
      failureCount: nextFailureCount,
      successRate: nextSuccessRate,
      queueDepth: this.systemState.auto.pending.filter(
        (task) => task.requestedResource === alias || task.assignedResource === alias
      ).length
    });

    // Track network-level failures for routing cooldown.
    if (!success && errorMessage && isNetworkError(errorMessage)) {
      this.networkFailureTimes.set(alias, Date.now());
    }
  }

  private setResourceActiveModel(alias: string, activeModel: string | null): void {
    const previous = this.resourceTelemetry.get(alias) ?? this.getDefaultResourceTelemetry(alias);
    this.resourceTelemetry.set(alias, {
      ...previous,
      activeModel,
      queueDepth: this.systemState.auto.pending.filter(
        (task) => task.requestedResource === alias || task.assignedResource === alias
      ).length
    });
  }

  /**
   * Build a synthetic resourceLoad penalty map that adds a heavy load value
   * for any resource currently within its network-failure cooldown window.
   * The penalty decays linearly from 10 → 0 over the cooldown period.
   */
  private getNetworkFailurePenalties(): Record<string, number> {
    const penalties: Record<string, number> = {};
    const now = Date.now();
    for (const [alias, failedAt] of this.networkFailureTimes) {
      const elapsed = now - failedAt;
      if (elapsed < LocalCrewApp.NETWORK_FAILURE_COOLDOWN_MS) {
        const fraction = 1 - elapsed / LocalCrewApp.NETWORK_FAILURE_COOLDOWN_MS;
        penalties[alias] = Math.round(10 * fraction);
      }
    }
    return penalties;
  }

  /**
   * Ping all registered resources in parallel to update their health status.
   * Called from runIdleCycle on a 5-minute interval during auto mode.
   */
  async runHealthPoll(): Promise<void> {
    const resources = listResources(this.rootDir);
    if (resources.length === 0) return;

    const results = await Promise.allSettled(
      resources.map(async (resource) => {
        const result = await pingResource(
          resource.baseUrl,
          resource.apiStyle ?? "ollama",
          this.fetchFn,
          resource.apiKeyEnv
        );
        this.resourceHealth.set(resource.alias, result);
        // If a previously-offline resource is back, clear network failure cooldown
        if (result.status === "online") {
          this.networkFailureTimes.delete(resource.alias);
        }
        return { alias: resource.alias, ...result };
      })
    );

    // Push updated health state to GUI
    this.pushDisplayState();

    const statusCounts = { online: 0, degraded: 0, offline: 0 };
    for (const r of results) {
      if (r.status === "fulfilled") {
        statusCounts[r.value.status]++;
      }
    }
    this.lastHealthPollAt = Date.now();
    this.warn(
      `Health poll: ${statusCounts.online} online, ${statusCounts.degraded} degraded, ${statusCounts.offline} offline`
    );
  }

  /**
   * Get the health status of a resource by alias. Returns undefined if never polled.
   */
  getResourceHealth(alias: string): ResourceHealthResult | undefined {
    return this.resourceHealth.get(alias);
  }

  /**
   * Get health status for all resources as a plain object.
   */
  getResourceHealthMap(): Record<string, { status: ResourceHealthStatus; latencyMs: number; checkedAt: number }> {
    const result: Record<string, { status: ResourceHealthStatus; latencyMs: number; checkedAt: number }> = {};
    for (const [alias, health] of this.resourceHealth) {
      result[alias] = { status: health.status, latencyMs: health.latencyMs, checkedAt: health.checkedAt };
    }
    return result;
  }

  private getSystemTps(): number {
    let total = 0;
    for (const telemetry of this.resourceTelemetry.values()) {
      total += telemetry.tokensPerSecond;
    }
    return Math.round(total);
  }

  /**
   * Get a deduped list of recent completed task content strings (last 20)
   * for injecting into queue fill prompts to prevent repetition.
   */
  private getRecentCompletedTopics(): string[] {
    const completed = this.systemState.auto.completed;
    const recent = completed.slice(-20);
    return recent
      .filter((task) => task.status === "completed" && task.content)
      .map((task) => task.content.slice(0, 120));
  }

  private getActiveResourceSummaries(): Array<{
    alias: string;
    isBusy: boolean;
    activeModel: string | null;
    tokensPerSecond: number;
    queueDepth: number;
    successRate: number;
    health?: ResourceHealthStatus;
    healthLatencyMs?: number;
  }> {
    const aliases = listResources(this.rootDir).map((resource) => resource.alias);
    return aliases.map((alias) => {
      const telemetry = this.resourceTelemetry.get(alias) ?? this.getDefaultResourceTelemetry(alias);
      const health = this.resourceHealth.get(alias);
      const isBusy = this.activeTasksByResource.has(alias);
      return {
        alias,
        isBusy,
        activeModel: isBusy ? telemetry.activeModel : null,
        tokensPerSecond: Math.round(telemetry.tokensPerSecond),
        queueDepth: telemetry.queueDepth,
        successRate: Number(telemetry.successRate.toFixed(2)),
        ...(health ? { health: health.status, healthLatencyMs: health.latencyMs } : {})
      };
    });
  }

  private getLastCompletedSummary(): {
    id: number;
    content: string;
    status: "queued" | "completed" | "failed";
    resourceAlias: string | null;
    model: string | null;
    qualityVerification: AutoQueueTask["qualityVerification"] | null;
    durationMs: number | null;
  } | null {
    const last = this.systemState.auto.completed[this.systemState.auto.completed.length - 1];
    if (!last) {
      return null;
    }
    return {
      id: last.id,
      content: last.content,
      status: last.status,
      resourceAlias: last.assignedResource ?? null,
      model: last.assignedModel ?? null,
      qualityVerification: last.qualityVerification ?? null,
      durationMs: last.durationMs ?? null
    };
  }

  private emitTaskEvent(payload: Record<string, unknown>): void {
    this.pushDisplayEvent(payload);
  }

  private pushDisplayState(): void {
    const auto = this.systemState.auto;
    const prefs = this.config.preferences;
    const availableResourceCount = this.getAvailableResourceCount();
    const desiredPendingDepth = this.getDesiredPendingDepth();
    const refillThreshold = this.getQueueRefillThreshold();
    const parallelCycleLimit = this.getEffectiveParallelCycleLimit();
    this.pushDisplayEvent({
      type: "state",
      orchestratorName: this.config.orchestratorName,
      ...(this.getAccountUsername() ? { accountUsername: this.getAccountUsername() } : {}),
      orchestratorAlias: this.resolveOrchestratorAlias(),
      mode: this.runtime.mode,
      auto: {
        enabled: auto.enabled,
        pendingCount: auto.pending.length,
        completedCount: auto.totalCompletedCount ?? auto.completed.length,
        failedCount: auto.completed.filter((task) => task.status === "failed").length,
        busy: this.activeCycleCount > 0,
        availableResourceCount,
        desiredPendingDepth,
        refillThreshold,
        parallelCycleLimit,
        availableCycleSlots: Math.max(0, parallelCycleLimit - this.activeCycleCount),
        activeTasks: [...this.activeTasksByResource.values()].map(t => ({
          id: t.id,
          content: t.content.replace(/^\{domain:[A-Z]+\}\s*/i, ""),
          assignedResource: t.assignedResource ?? null,
          requestedResource: t.requestedResource ?? null,
          priority: t.priority
        })),
        nextTask: auto.pending[0]
          ? {
              id: auto.pending[0].id,
              content: auto.pending[0].content,
              assignedResource: auto.pending[0].assignedResource ?? null
            }
          : null,
        lastCompleted: this.getLastCompletedSummary(),
        dailySession: auto.dailySession ?? null
      },
      resourceTelemetry: Object.fromEntries(this.resourceTelemetry),
      systemTps: this.getSystemTps(),
      modelProfile: getModelProfile(),
      activeResources: this.getActiveResourceSummaries(),
      resourceHealth: this.getResourceHealthMap(),
      preferences: prefs ?? {},
      displayMetrics: this.getDisplayMetrics()
    });
  }

  getPrompt(): string {
    return buildPrompt(this.runtime.mode, this.runtime.currentEndpoint, this.config.defaultEndpoint, {
      currentAgent: this.runtime.currentAgent,
      queueDepth: this.systemState.auto.pending.length,
      priority: this.systemState.auto.defaultPriority,
      autoBusy: this.isAutoBusy()
    });
  }

  /**
   * Return structured prompt state for styled rendering by the terminal layer.
   */
  getPromptState(): {
    mode: string;
    currentEndpoint: string;
    defaultEndpoint: string;
    currentAgent?: string;
    queueDepth: number;
    priority: string;
    autoBusy: boolean;
    resourceCount: number;
  } {
    return {
      mode: this.runtime.mode,
      currentEndpoint: this.runtime.currentEndpoint,
      defaultEndpoint: this.config.defaultEndpoint,
      currentAgent: this.runtime.currentAgent,
      queueDepth: this.systemState.auto.pending.length,
      priority: this.systemState.auto.defaultPriority,
      autoBusy: this.isAutoBusy(),
      resourceCount: listResources(this.rootDir).length,
    };
  }

  /**
   * Return structured state for the persistent status bar above the prompt.
   */
  getStatusBarState(): {
    mode: string;
    resourceCount: number;
    queuePending: number;
    queueCompleted: number;
    autoBusy: boolean;
    autoEnabled: boolean;
    orchestratorName: string;
  } {
    return {
      mode: this.runtime.mode,
      resourceCount: listResources(this.rootDir).length,
      queuePending: this.systemState.auto.pending.length,
      queueCompleted: this.systemState.auto.completed.length,
      autoBusy: this.isAutoBusy(),
      autoEnabled: this.systemState.auto.enabled,
      orchestratorName: this.getOrchestratorName(),
    };
  }

  isAutoMode(): boolean {
    return this.runtime.mode === "auto" && this.systemState.auto.enabled;
  }

  isAutoBusy(): boolean {
    return this.activeCycleCount > 0;
  }

  /** Collect all participant + resource aliases for internal-query filtering. */
  private getNetworkAliases(): string[] {
    const aliases = new Set<string>();
    for (const alias of Object.keys(this.config.endpoints)) {
      aliases.add(alias);
    }
    for (const r of listResources(this.rootDir)) {
      aliases.add(r.alias);
    }
    return [...aliases];
  }

  /** Cached internal-query patterns keyed by system terms string. */
  private internalQueryPatternCache = new Map<string, { aliases: string; pattern: RegExp }>();

  /** Get or build a cached internal query pattern for the given system terms. */
  private getInternalQueryPattern(systemTerms: string): RegExp {
    const aliases = this.getNetworkAliases();
    const aliasKey = aliases.sort().join(",");
    const cached = this.internalQueryPatternCache.get(systemTerms);
    if (cached && cached.aliases === aliasKey) return cached.pattern;
    const pattern = buildInternalQueryPattern(systemTerms, aliases);
    this.internalQueryPatternCache.set(systemTerms, { aliases: aliasKey, pattern });
    return pattern;
  }

  private getConfiguredMaxParallelCycles(): number {
    return Math.max(
      1,
      getEnvNumber(
        "LOCALCREW_MAX_PARALLEL_CYCLES",
        LocalCrewApp.DEFAULT_MAX_PARALLEL_CYCLES
      )
    );
  }

  private getSchedulableResourceAliases(): string[] {
    const aliases = listResources(this.rootDir).map((resource) => resource.alias);
    if (aliases.length === 0) {
      return [];
    }
    const availableAliases = aliases.filter(
      (alias) => this.resourceHealth.get(alias)?.status !== "offline"
    );
    return availableAliases.length > 0 ? availableAliases : aliases;
  }

  private getAvailableResourceCount(): number {
    return this.getSchedulableResourceAliases().length;
  }

  private getDesiredPendingDepth(): number {
    return Math.max(2, this.getAvailableResourceCount() * 2);
  }

  private getQueueRefillThreshold(): number {
    return Math.max(1, this.getAvailableResourceCount());
  }

  private getEffectiveParallelCycleLimit(): number {
    const availableResourceCount = this.getAvailableResourceCount();
    if (availableResourceCount <= 0) {
      return 0;
    }
    return Math.max(
      1,
      Math.min(this.getConfiguredMaxParallelCycles(), availableResourceCount)
    );
  }

  private getResourceHealthStatuses(): Record<string, ResourceHealthStatus> {
    const statuses: Record<string, ResourceHealthStatus> = {};
    for (const [alias, health] of this.resourceHealth) {
      statuses[alias] = health.status;
    }
    return statuses;
  }

  /**
   * Compute derived display metrics for the billboard wallboard.
   * Returns structured data for operational status, fleet summary,
   * back-pressure, and queue health.
   */
  private getDisplayMetrics(): {
    systemStatus: {
      overallState: "active" | "degraded" | "blocked" | "idle" | "recovering";
      backPressure: "nominal" | "rising" | "high" | "critical";
      bottleneck: string;
      uptimeMs: number;
    };
    fleetSummary: {
      totalNodes: number;
      onlineNodes: number;
      activeNodes: number;
      idleNodes: number;
      errorNodes: number;
      utilizationPct: number;
    };
    queueHealth: {
      oldestPendingAgeSec: number;
      oldestRunningAgeSec: number;
      failedCount: number;
      retryCount: number;
      stalledCount: number;
      drainRatePerMin: number;
    };
    dispatch: {
      state: string;
      reason: string;
      strategy: string;
    };
  } {
    const now = Date.now();
    const resources = listResources(this.rootDir);
    const totalNodes = resources.length;
    let onlineNodes = 0;
    let errorNodes = 0;
    const activeAliases = new Set([...this.activeTasksByResource.keys()]);

    for (const r of resources) {
      const h = this.resourceHealth.get(r.alias);
      if (h && h.status === "offline") {
        errorNodes++;
      } else {
        onlineNodes++;
      }
    }

    const activeNodes = activeAliases.size;
    const idleNodes = Math.max(0, onlineNodes - activeNodes);
    const utilizationPct = onlineNodes > 0 ? Math.round((activeNodes / onlineNodes) * 100) : 0;

    // Back-pressure: compare pending queue depth to desired depth
    const pending = this.systemState.auto.pending.length;
    const desired = this.getDesiredPendingDepth();
    const ratio = desired > 0 ? pending / desired : 0;
    let backPressure: "nominal" | "rising" | "high" | "critical" = "nominal";
    if (activeNodes > 0 && idleNodes === 0 && pending > desired) backPressure = "rising";
    if (ratio >= 1.5 && idleNodes === 0) backPressure = "high";
    if (ratio >= 2.5 || (errorNodes > 0 && pending > desired)) backPressure = "critical";

    // Bottleneck detection
    let bottleneck = "none";
    if (errorNodes > 0) {
      const offlineNames = resources
        .filter(r => this.resourceHealth.get(r.alias)?.status === "offline")
        .map(r => r.alias);
      bottleneck = offlineNames.join(", ") + " offline";
    } else if (backPressure !== "nominal" && activeNodes >= onlineNodes) {
      bottleneck = "all nodes saturated";
    } else if (this.activeCycleCount >= this.getEffectiveParallelCycleLimit()) {
      bottleneck = "parallel cycle limit reached";
    }

    // Overall state
    let overallState: "active" | "degraded" | "blocked" | "idle" | "recovering" = "idle";
    if (activeNodes > 0) overallState = "active";
    if (errorNodes > 0 && activeNodes > 0) overallState = "degraded";
    if (errorNodes > 0 && activeNodes === 0 && pending > 0) overallState = "blocked";
    if (!this.isAutoMode() && activeNodes === 0) overallState = "idle";
    if (errorNodes > 0 && activeNodes > 0 && backPressure === "nominal") overallState = "recovering";

    // Queue health
    let oldestPendingAgeSec = 0;
    let oldestRunningAgeSec = 0;
    for (const task of this.systemState.auto.pending) {
      if (task.createdAt) {
        const age = (now - new Date(task.createdAt).getTime()) / 1000;
        if (age > oldestPendingAgeSec) oldestPendingAgeSec = age;
      }
    }
    for (const task of this.activeTasksByResource.values()) {
      if (task.startedAt) {
        const age = (now - new Date(task.startedAt).getTime()) / 1000;
        if (age > oldestRunningAgeSec) oldestRunningAgeSec = age;
      }
    }
    const failedCount = this.systemState.auto.completed.filter(t => t.status === "failed").length;
    const stalledCount = [...this.activeTasksByResource.values()].filter(t => {
      if (!t.startedAt) return false;
      return (now - new Date(t.startedAt).getTime()) > 5 * 60 * 1000; // >5 min
    }).length;

    // Drain rate: completed in last 10 minutes → per minute
    const tenMinAgo = now - 10 * 60 * 1000;
    const recentCompleted = this.systemState.auto.completed.filter(t =>
      t.completedAt && new Date(t.completedAt).getTime() > tenMinAgo
    ).length;
    const drainRatePerMin = Number((recentCompleted / 10).toFixed(1));

    // Dispatch state
    let dispatchState = "dispatching";
    let dispatchReason = "";
    let strategy = "maximize throughput";
    if (!this.isAutoMode()) {
      dispatchState = "manual";
      dispatchReason = "auto mode off";
      strategy = "user-directed";
    } else if (pending === 0 && activeNodes === 0) {
      dispatchState = "idle";
      dispatchReason = "queue empty";
      strategy = "awaiting queue fill";
    } else if (this.activeCycleCount >= this.getEffectiveParallelCycleLimit()) {
      dispatchState = "at capacity";
      dispatchReason = "parallel limit " + this.getEffectiveParallelCycleLimit();
      strategy = "drain active tasks";
    } else if (backPressure !== "nominal") {
      dispatchState = "throttled";
      dispatchReason = "back pressure " + backPressure;
      strategy = "rebalance to idle nodes";
    }

    return {
      systemStatus: {
        overallState,
        backPressure,
        bottleneck,
        uptimeMs: now - (this._startedAt ?? now),
      },
      fleetSummary: {
        totalNodes,
        onlineNodes,
        activeNodes,
        idleNodes,
        errorNodes,
        utilizationPct,
      },
      queueHealth: {
        oldestPendingAgeSec: Math.round(oldestPendingAgeSec),
        oldestRunningAgeSec: Math.round(oldestRunningAgeSec),
        failedCount,
        retryCount: 0,
        stalledCount,
        drainRatePerMin,
      },
      dispatch: {
        state: dispatchState,
        reason: dispatchReason,
        strategy,
      },
    };
  }

  shouldAutoPulse(): boolean {
    return this.isAutoMode() && this.activeCycleCount < this.getEffectiveParallelCycleLimit();
  }

  /** Returns how many additional parallel task cycles can be dispatched right now. */
  getAvailableCycleSlots(): number {
    if (!this.isAutoMode()) return 0;
    const parallelCycleLimit = this.getEffectiveParallelCycleLimit();
    const pendingCount = this.systemState.auto.pending.filter(
      t => !this.processingTaskIds.has(t.id)
    ).length;
    return Math.min(
      Math.max(0, parallelCycleLimit - this.activeCycleCount),
      Math.max(1, pendingCount)
    );
  }

  getAutoPulseIntervalMs(): number {
    return getEnvNumber("LOCALCREW_AUTO_PULSE_INTERVAL_MS", DEFAULT_AUTO_PULSE_INTERVAL_MS);
  }

  /**
   * Records whether the last pulse cycle did any real work.
   * Idle cycles accumulate a backoff multiplier to reduce CPU pressure
   * when the queue is empty; any meaningful work resets the counter.
   */
  recordIdleCycle(wasIdle: boolean): void {
    if (wasIdle) {
      this.consecutiveIdleCycles++;
    } else {
      this.consecutiveIdleCycles = 0;
    }
  }

  /**
   * Returns the effective pulse interval, applying exponential backoff
   * after 3 consecutive idle cycles (caps at ~7× the base interval).
   */
  getEffectivePulseIntervalMs(): number {
    const base = this.getAutoPulseIntervalMs();
    const MAX_MULTIPLIER = 7;
    const multiplier = Math.min(
      MAX_MULTIPLIER,
      Math.pow(2, Math.floor(this.consecutiveIdleCycles / 3))
    );
    return base * multiplier;
  }

  getAutoSourceDocumentCharLimit(): number {
    return getEnvNumber(
      "LOCALCREW_AUTO_SOURCE_DOC_CHAR_LIMIT",
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
      "Local Crew Status",
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
              this.formatRequestedResource(nextTask.requestedResource)
            }${nextTask.requestedModel ? `/${nextTask.requestedModel}` : ""} ${nextTask.content}`
          : "(none queued)"
      }`,
      `Last completed: ${
        lastCompleted
          ? `#${lastCompleted.id}${lastCompleted.delegationRole ? ` {${lastCompleted.delegationRole}}` : ""} via ${this.formatResourceRoutingTarget(lastCompleted.assignedResource, lastCompleted.assignedModel)}`
          : "(none yet)"
      }`,
      `Top tier: ${tiers.top.map((profile) => `@${this.toDisplayResourceAlias(profile.alias)}`).join(", ") || "(none)"}`,
      `Mid tier: ${tiers.mid.map((profile) => `@${this.toDisplayResourceAlias(profile.alias)}`).join(", ") || "(none)"}`,
      `Low tier: ${tiers.low.map((profile) => `@${this.toDisplayResourceAlias(profile.alias)}`).join(", ") || "(none)"}`,
      `Resources: ${resources.length}`,
      ...(resources.length <= 1
        ? [
            'Onboarding: run `npm run setup:agent` on the next agent device. It will prefill the first three IP numbers from the local network, you confirm or enter the final number of the orchestrator IP, then it will prompt for a device nickname and sync it here automatically.'
          ]
        : []),
      `Agents: ${agents.length > 0 ? agents.map((agent) => `@${agent.slug}`).join(", ") : "(none)"}`,
      `Dropbox: ${dropbox.inbox.length} inbox / ${dropbox.active.length} active / ${dropbox.outbox.length} outbox`,
      `Telemetry: ${telemetry.totalEvents} events, ${telemetry.byKind["ollama.chat"] ?? 0} model calls, ${telemetry.wikipedia.calls} wiki searches`,
      `Last audit: ${lastAudit ? `#${lastAudit.id} ${lastAudit.summary}` : "(none yet)"}`,
      `Top models:${topModels.length > 0 ? "" : " (none yet)"}`,
      ...(topModels.map((key) => `  ${formatTelemetryBucket(telemetry, key)}`)),
      `Docs: focus ${internalFiles.focusTodo.modifiedAt} | roadmap ${internalFiles.roadmap.modifiedAt}`,
      `Docs: changelog ${internalFiles.changelog.modifiedAt} | directives ${internalFiles.directives.modifiedAt}`,
      `Explorer roots: ${getStoragePaths(this.rootDir).systemDir} | ${getDropboxPaths(this.rootDir).externalMemoryDir}`,
      "",
      "Press Esc to return."
    ];
  }

  async getStatusSnapshot(): Promise<{
    orchestratorName: string;
    accountUsername?: string;
    orchestratorAlias: string;
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
      failedCount: number;
      availableResourceCount: number;
      desiredPendingDepth: number;
      refillThreshold: number;
      parallelCycleLimit: number;
      availableCycleSlots: number;
    };
    nextTask?: AutoQueueTask;
    lastCompleted?: AutoQueueTask;
    tiers: ReturnType<typeof getResourceProfilesByTier>;
    capacity: ReturnType<typeof getResourceCapacitySummary>;
    agents: AgentMeta[];
    docs: Awaited<ReturnType<typeof getInternalFileDetails>>;
    telemetry: TelemetrySummary;
    dropbox: Awaited<ReturnType<typeof getDropboxSnapshot>>;
    resourceTelemetry: Record<string, ResourceTelemetry>;
    systemTps: number;
    modelProfile: ReturnType<typeof getModelProfile>;
    activeResources: ReturnType<LocalCrewApp["getActiveResourceSummaries"]>;
    resourceHealth: ReturnType<LocalCrewApp["getResourceHealthMap"]>;
    displayMetrics: ReturnType<LocalCrewApp["getDisplayMetrics"]>;
  }> {
    const [agents, docs, telemetry, dropbox] = await Promise.all([
      listAgents(this.rootDir),
      getInternalFileDetails(this.rootDir),
      loadTelemetrySummary(this.rootDir),
      getDropboxSnapshot(this.rootDir)
    ]);
    const availableResourceCount = this.getAvailableResourceCount();
    const desiredPendingDepth = this.getDesiredPendingDepth();
    const refillThreshold = this.getQueueRefillThreshold();
    const parallelCycleLimit = this.getEffectiveParallelCycleLimit();

    return {
      orchestratorName: this.config.orchestratorName,
      ...(this.getAccountUsername() ? { accountUsername: this.getAccountUsername() } : {}),
      orchestratorAlias: this.resolveOrchestratorAlias(),
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
        completedCount: this.systemState.auto.totalCompletedCount ?? this.systemState.auto.completed.length,
        failedCount: this.systemState.auto.completed.filter((task) => task.status === "failed").length,
        availableResourceCount,
        desiredPendingDepth,
        refillThreshold,
        parallelCycleLimit,
        availableCycleSlots: this.getAvailableCycleSlots()
      },
      nextTask: this.sortPendingTasks(this.systemState.auto.pending)[0],
      lastCompleted: this.systemState.auto.completed.at(-1),
      tiers: getResourceProfilesByTier(this.rootDir),
      capacity: getResourceCapacitySummary(this.rootDir),
      agents,
      docs,
      telemetry,
      dropbox,
      resourceTelemetry: Object.fromEntries(this.resourceTelemetry),
      systemTps: this.getSystemTps(),
      modelProfile: getModelProfile(),
      activeResources: this.getActiveResourceSummaries(),
      resourceHealth: this.getResourceHealthMap(),
      displayMetrics: this.getDisplayMetrics()
    };
  }

  async getQueueSnapshot(): Promise<{
    enabled: boolean;
    busy: boolean;
    defaultPriority: TaskPriority;
    availableResourceCount: number;
    desiredPendingDepth: number;
    refillThreshold: number;
    activeTasks: AutoQueueTask[];
    pending: AutoQueueTask[];
    completed: AutoQueueTask[];
  }> {
    const activeTasks = [...this.activeTasksByResource.values()].map(task => ({
      ...task,
      content: task.content.replace(/^\{domain:[A-Z]+\}\s*/i, "")
    }));
    const activeIds = new Set(activeTasks.map(t => t.id));
    return {
      enabled: this.isAutoMode(),
      busy: this.isAutoBusy(),
      defaultPriority: this.systemState.auto.defaultPriority,
      availableResourceCount: this.getAvailableResourceCount(),
      desiredPendingDepth: this.getDesiredPendingDepth(),
      refillThreshold: this.getQueueRefillThreshold(),
      activeTasks,
      pending: this.sortPendingTasks(
        this.systemState.auto.pending.filter(t => !activeIds.has(t.id))
      ).map(task => ({
        ...task,
        content: task.content.replace(/^\{domain:[A-Z]+\}\s*/i, "")
      })),
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

  getPreferences() {
    return this.config.preferences;
  }

  private isWeatherEnabled(): boolean {
    return !!(this.config.preferences?.zipCode || this.config.preferences?.city);
  }

  async getDailyWorkSnapshot(): Promise<DailyWorkSnapshot> {
    const intervalMs = parseDailyWorkIntervalMs(this.config.preferences?.dailyWorkIntervalHours);
    return getDailyWorkSnapshot(this.rootDir, intervalMs);
  }

  async getResourcesSnapshot() {
    const orchestratorAlias = this.resolveOrchestratorAlias();
    return listResources(this.rootDir).map(r => ({
      ...r,
      shipRole: getShipRoleLabel(r, orchestratorAlias)
    }));
  }

  buildPortalSnapshot(): PortalSnapshot {
    const status = this.getStatusBarState();
    const failedCount = this.systemState.auto.completed.filter((task) => task.status === "failed").length;
    const nextTask = this.sortPendingTasks(this.systemState.auto.pending)[0];
    const lastCompleted = this.getLastCompletedSummary();
    const activeResources = new Map(this.getActiveResourceSummaries().map((resource) => [resource.alias, resource]));
    const resources = listResources(this.rootDir).map((resource) => ({
      alias: resource.alias,
      tier: resource.tier,
      isBusy: activeResources.get(resource.alias)?.isBusy === true,
      model:
        activeResources.get(resource.alias)?.isBusy === true
          ? activeResources.get(resource.alias)?.activeModel ?? resource.defaultModel
          : null,
    }));
    const dailySession = this.systemState.auto.dailySession
      ? {
          active: !this.systemState.auto.dailySession.completedAt,
          startTime: this.systemState.auto.dailySession.startedAt ?? null,
          taskCount: this.systemState.auto.dailySession.tasksCompleted,
          errorCount: this.systemState.auto.dailySession.tasksErrored,
        }
      : null;

    return {
      mode: status.mode,
      busy: status.autoBusy,
      queueDepth: {
        pending: status.queuePending,
        completed: status.queueCompleted,
        failed: failedCount,
      },
      nextTask: nextTask
        ? {
            priority: nextTask.priority,
            content: nextTask.content,
            resourceAlias: nextTask.assignedResource ?? nextTask.requestedResource ?? null,
          }
        : null,
      lastCompleted: lastCompleted
        ? {
            content: lastCompleted.content,
            resourceAlias: lastCompleted.resourceAlias,
          }
        : null,
      orchestratorName: status.orchestratorName,
      resources,
      capacity: getResourceCapacitySummary(this.rootDir),
      modelProfile: getModelProfile(),
      tps: this.getSystemTps(),
      dailySession,
    };
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

    // Store live OS metrics from the sync payload for use in routing decisions.
    if (report.liveMetrics && typeof report.liveMetrics.freeMemGb === "number") {
      this.liveDeviceMetrics.set(alias, { ...report.liveMetrics, receivedAt: Date.now() });
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
        await atomicWriteFile(directivesPath, next, "utf8");
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
        return `@${this.toDisplayResourceAlias(key)} | calls ${bucket.calls} | errors ${bucket.errors} | avg ${averageDuration}ms | eval ${bucket.evalCount}`;
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
                `#${task.id} [${task.priority}]${task.delegationRole ? ` {${task.delegationRole}}` : ""}${this.formatRequestedResource(task.requestedResource)}${task.requestedModel ? `/${task.requestedModel}` : ""} ${task.content}`
            )
          : ["(none pending)"]),
        "",
        `Recent completed: ${completed.length}`,
        ...(completed.length > 0
          ? completed.map(
              (task) =>
                `#${task.id}${task.delegationRole ? ` {${task.delegationRole}}` : ""} via ${this.formatResourceRoutingTarget(task.assignedResource, task.assignedModel)} ${task.content}`
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
          `@${this.toDisplayResourceAlias(key)}: ${bucket.calls} call(s), ${bucket.errors} error(s), avg ${bucket.calls > 0 ? Math.round(bucket.totalDurationMs / bucket.calls) : 0}ms`
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
                `- Pending #${task.id} [${task.priority}]${task.delegationRole ? ` {${task.delegationRole}}` : ""}${this.formatRequestedResource(task.requestedResource)}${task.requestedModel ? `/${task.requestedModel}` : ""}: ${task.content}`
            )
          : ["- Pending: (none)"]),
        ...(completed.length > 0
          ? completed.map(
              (task) =>
                `- Completed #${task.id}${task.delegationRole ? ` {${task.delegationRole}}` : ""} via ${this.formatResourceRoutingTarget(task.assignedResource, task.assignedModel)}: ${task.content}`
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

  async getExploreTree(): Promise<{
    rootPath: string;
    lines: string[];
    sitemapPath: string;
    outlineIndexPath: string;
  }> {
    const tree = await getInternalFileTree(this.rootDir);
    const paths = getStoragePaths(this.rootDir);
    return {
      rootPath: tree.rootPath,
      sitemapPath: paths.documentSitemapPath,
      outlineIndexPath: paths.documentOutlineIndexPath,
      lines: [
        "Explorer",
        "",
        "Generated navigation:",
        `- Sitemap: ${paths.documentSitemapPath}`,
        `- Outline index: ${paths.documentOutlineIndexPath}`,
        "",
        ...tree.lines,
        "",
        "Start with the sitemap for a compact document map, then open a specific file or outline sidecar.",
        "Use HEADING: Parent > Child selectors in UPDATE anchors when revising markdown incrementally.",
        "Type a full path from .localcrew/system or external-memory and press Enter to open it. Press Esc to return."
      ]
    };
  }

  async readExploreFile(path: string) {
    return readInternalFile(path, this.rootDir);
  }

  async searchExploreFiles(query: string) {
    return searchInternalFiles(query, this.rootDir);
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
    if (this.autoCycleAbort) {
      this.autoCycleAbort.abort();
      this.autoCycleAbort = null;
    }
    await this.setAutoEnabled(false);
    if (this.runtime.mode === "auto") {
      this.runtime = {
        mode: "command",
        currentEndpoint: this.runtime.currentEndpoint,
        currentAgent: undefined
      };
    }
  }

  /** Number of auto cycles currently executing (drains to 0 after /stop). */
  getActiveCycleCount(): number {
    return this.activeCycleCount;
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
    this.emitTaskEvent({
      type: "daily-complete",
      sessionId: new Date(session.startedAt).toISOString().slice(0, 10),
      summary: `${session.tasksCompleted} completed, ${session.tasksErrored} errored. Digest: ${entry.path}`
    });
    return `Daily Digest written to ${entry.path}. Session completed: ${session.tasksCompleted} tasks completed, ${session.tasksErrored} errored.`;
  }

  private async runAutoCycleLocked(run: () => Promise<CommandResult>): Promise<CommandResult> {
    if (this.activeCycleCount >= this.getEffectiveParallelCycleLimit()) {
      return { lines: [], errors: [], shouldExit: false };
    }
    this.activeCycleCount++;
    return run().finally(() => {
      this.activeCycleCount--;
    });
  }

  private async syncSystemFiles(): Promise<void> {
    const paths = getStoragePaths(this.rootDir);
    await saveFocusTodo(this.systemState.auto.pending, this.rootDir);
    await atomicWriteFile(
      paths.deviceInventoryPath,
      `${renderResourceInventory(this.rootDir).trimEnd()}
`,
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
    await syncDocumentNavigation(this.rootDir);
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
      "Commands: /daily [start|finish], /promote <resource>, /topology [assign|delegate|undelegate], /preferences [set <key> <value>], /compact, /reset, /clear, /restart-server, /exit",
      "",
      "Tip: /help <topic> for details — topics: chat, auto, resources, participants, agents, tools, topology, preferences, daily"
    ];
  }

  getHelpTopic(topic: string): string[] {
    const topics: Record<string, string[]> = {
      chat: [
        "# Chat",
        "",
        "  /chat                      Start a 1-on-1 chat session with the default participant",
        "  /group                     Start a group chat with all participants",
        "  /end                       End the current chat or group session",
        "  @alias message             Send a message to a specific participant",
        '  @from to @to: "message"    Crosstalk — send a directed message between two participants',
        "  /direct <resource> \"msg\"   Send a message directly to a specific inference resource",
        "  /direct <resource> \"msg\" model   Same, with an explicit model override",
        "",
        "In chat mode, plain messages go to the default participant. In group mode,",
        "all participants respond in round-robin. Use /default <alias> to change the",
        "default. Use /end to return to command mode.",
      ],
      auto: [
        "# Auto Mode",
        "",
        "  /auto                      Enter autonomous orchestration mode",
        "  /stop                      Stop the auto pulse and return to command mode",
        "  /priority [high|medium|low]  Set or show default task priority",
        "  /compact                   Summarize older messages to free context space",
        "",
        "In auto mode, plain messages are queued as tasks. The background pulse",
        "processes tasks by routing them to the best available resource by tier.",
        "Complex tasks are automatically delegated to idle sub-orchestrators when",
        "the network topology has them configured.",
        "",
        "The queue uses a 3-phase consensus flow: draft → review → finalize.",
        "Tasks can also be ingested from the external-memory/inbox dropbox.",
      ],
      resources: [
        "# Resources",
        "",
        "  /resource list             List all configured inference resources",
        "  /resource add <alias> \"Label\" <url> [top|mid|low] [ollama|openai|anthropic]",
        "                             Add a new resource",
        "  /resource edit <alias>     Edit resource metadata (hardware, context, models)",
        "  /resource refresh <alias>  Probe the endpoint for available models",
        "  /resource remove <alias>   Remove a resource from the inventory",
        "",
        "Resources are inference endpoints (Ollama, OpenAI-compatible, or Anthropic).",
        "Each has a tier (top, mid, low) that controls task routing priority.",
        "Hardware metadata (CPU, RAM, GPU, VRAM, context tokens) is optional but",
        "improves routing decisions. Use npm run setup:agent to onboard",
        "remote devices automatically.",
      ],
      participants: [
        "# Participants",
        "",
        "  /participant list          List all chat participants",
        "  /participant add <alias> <resource> [\"nickname\"]",
        "                             Add a new participant bound to a resource",
        "  /participant edit <alias>  Edit participant configuration",
        "  /participant remove <alias> Remove a participant",
        "  /nickname [@alias] [\"name\"]  Set or show participant nickname",
        "  /bind [@alias] [resource]  Bind a participant to a different resource",
        "  /model [alias model]       Set the model for a participant",
        "  /models [resource|@alias]  List available models on a resource or participant",
        "  /default [alias]           Set or show the default participant",
        "  /rename <old> <new>        Rename a participant alias",
        "  /instructions [@alias] [\"text\"]  View or set participant instructions",
        "  /voice [@alias] [preset|list]    Set or list voice presets (macOS only)",
        "  /sound [on|off]            Toggle voice playback (macOS only)",
      ],
      agents: [
        "# Agents",
        "",
        "  /agent list                List all agent identities",
        "  /agent new                 Create a new agent (interactive workflow)",
        "  /agent <name>              Enter agent chat mode",
        "  /agent edit <name>         Edit an agent's spec or memory",
        "  /end                       Leave agent chat mode",
        "",
        "Agents are persistent working identities with their own specs, memory,",
        "and resource bindings — separate from chat participants. The built-in",
        "data-analyst agent is seeded from external-memory/agents/.",
      ],
      tools: [
        "# Web Tools & Grounding",
        "",
        "Models can request external data by emitting special marker lines:",
        "",
        "  WIKIPEDIA: <query>           Wikipedia article search",
        "  REDDIT: <query>              Reddit discussion search (tech subreddits)",
        "  SEARCH[<topic>]: <query>     DuckDuckGo web search",
        "  WEATHER: <location>          Open-Meteo weather forecast",
        "  BENLIVE: <path>              benlive.tv content",
        "  WEBSITE: <path>              Personal website content",
        "",
        "Web search topics: news, jobs, software-engineering, ai-engineering.",
        "Set your personal website: /preferences set website <url>",
        "Set weather location: /preferences set city <name> or /preferences set zip <code>",
      ],
      port: [
        "# Port",
        "",
        "  /login [token]                          Connect this Local Crew orchestrator to Port",
        "  /port                                   Show current Port connection status",
        "  /port feed [public|mates|profile] [all|general|advice|help|daily-log]",
        "                                           Browse the Port Logs feed from the CLI",
        '  /port post [public|mates|profile] [general|advice|help|daily-log] "message"',
        "                                           Publish a Port Log from this Captain",
        '  /port reply <logId> "message"           Reply to an existing Port Log',
        "",
        "Captain-originated posting uses the Port authorization settings configured in",
        `${PORTAL_BASE_URL}/port/. If no audience is supplied, the CLI uses that Captain's`,
        "default audience. Accept the Port terms in the web UI before posting or replying.",
      ],
      topology: [
        "# Network Topology",
        "",
        "  /topology                  View the current network hierarchy",
        "  /topology assign <alias> <role>",
        "                             Assign a resource role: primary-orchestrator, orchestrator, or agent",
        "  /topology delegate <orchestrator> <agent>",
        "                             Assign an agent as a subordinate of a sub-orchestrator",
        "  /topology undelegate <orchestrator> <agent>",
        "                             Remove an agent from a sub-orchestrator",
        "  /promote <alias>           Reassign the primary orchestrator to a different device",
        "",
        "Only top-tier resources with ≥16k context tokens qualify as orchestrators.",
        "Sub-orchestrators coordinate their subordinate agents independently and",
        "continue operating when the primary orchestrator is offline.",
      ],
      preferences: [
        "# Preferences",
        "",
        "  /preferences               View all current preferences",
        "  /preferences set city <name>        Set default weather city",
        "  /preferences set zip <code>         Set default weather zip code",
        "  /preferences set website <url>      Set personal website URL",
        "  /preferences set directive \"text\"    Set daily digest directive",
        "  /preferences set interval <hours>    Set daily work refresh interval (e.g. 6)",
        "  /preferences set dailyDirective \"text\"  Set daily work briefing directive",
        "",
        "Preferences are stored locally in .localcrew/config.json and used by",
        "the weather tool, personal website tool, and daily digest generation.",
        "",
        "Full key names also accepted: zipCode, personalWebsiteUrl, dailyDigestDirective, dailyWorkIntervalHours, dailyWorkDirective.",
      ],
      daily: [
        "# Daily Work Sessions",
        "",
        "  /daily                     Show current daily session status",
        "  /daily status              Same as bare /daily",
        "  /daily start               Begin a tracked daily work session",
        "  /daily finish              Complete the session and generate a digest",
        "",
        "Daily sessions bound autonomous work into coherent cycles. The orchestrator",
        "tracks tasks completed and errors during the session. On finish, a digest",
        "is generated summarizing what was accomplished, what failed, and next priorities.",
        "Set /preferences set directive \"...\" to customize the digest format.",
      ],
    };

    const help = topics[topic];
    if (!help) {
      return [
        `Unknown help topic: ${topic}`,
        "",
        "Available topics: " + Object.keys(topics).join(", "),
      ];
    }
    return help;
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

  private getAccountUsername(): string | undefined {
    const username = this.portalSession?.username?.trim().replace(/^@+/, "");
    return username ? username.toLowerCase() : undefined;
  }

  private getPortalSessionExpiryTime(session: PortalSession | null = this.portalSession): number | null {
    if (!session?.expiresAt) {
      return null;
    }

    const parsed = Date.parse(session.expiresAt);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private isPortalSessionExpired(session: PortalSession | null = this.portalSession): boolean {
    const expiry = this.getPortalSessionExpiryTime(session);
    return expiry !== null && expiry <= Date.now();
  }

  private getPortStatusLines(): string[] {
    if (!this.portalSession) {
      return [
        `Port is not connected. Open ${PORTAL_BASE_URL}/port/ in your browser and sign in.`,
        "Click 'Connect Local Crew' to generate a device token, then run /login <token>.",
        "After that you can browse /port feed and publish with /port post or /port reply.",
      ];
    }

    if (this.isPortalSessionExpired()) {
      return [
        `Port session expired${this.portalSession.expiresAt ? ` at ${this.portalSession.expiresAt}` : ""}.`,
        `Open ${PORTAL_BASE_URL}/port/ in your browser and sign in again.`,
        "Generate a fresh device token from Port, then run /login <token>.",
      ];
    }

    const username = this.getAccountUsername();
    const expiryLine = this.portalSession.expiresAt
      ? `Session expires at ${this.portalSession.expiresAt}.`
      : "Session expiry unavailable. Reconnect to refresh credentials.";

    return [
      `Port connected as ${username ? `@${username}` : "an authenticated Captain"} from orchestrator ${this.portalSession.orchestratorId}.`,
      expiryLine,
      "Use /port feed [public|mates|profile] [all|general|advice|help|daily-log] to browse Port Logs.",
      'Use /port post [public|mates|profile] [general|advice|help|daily-log] "message" to publish.',
      'Use /port reply <logId> "message" to continue a thread.',
    ];
  }

  private formatPortFeedLines(result: PortFeedResult): string[] {
    const header = `Port feed: ${this.formatPortAudienceLabel(result.feed)} / ${this.formatPortSectionLabel(result.section)}`;

    if (result.logs.length === 0) {
      return [header, "No Port Logs matched this filter."];
    }

    const lines = [header, ""];
    for (const log of result.logs) {
      lines.push(...this.formatPortLogLines(log));
      lines.push("");
    }

    lines.pop();
    return lines;
  }

  private formatPortLogLines(log: PortLogEntry): string[] {
    const headerParts = [
      log.id,
      log.displayName || "Captain",
      log.username ? `@${log.username}` : null,
      this.formatPortAudienceLabel(log.audience),
      this.formatPortSectionLabel(log.section),
      `score ${log.score ?? 0}`,
      this.formatPortTimestamp(log.createdAt),
    ].filter((value): value is string => Boolean(value));

    const lines = [headerParts.join(" · ")];
    lines.push(this.truncatePortText(log.content));

    const replies = Array.isArray(log.replies) ? log.replies.slice(0, 3) : [];
    for (const reply of replies) {
      const replyAuthor = reply.displayName || reply.username || "Captain";
      lines.push(`  -> ${replyAuthor}: ${this.truncatePortText(reply.content, 140)}`);
    }

    return lines;
  }

  private truncatePortText(content: string, maxLength = 180): string {
    const normalized = content.replace(/\s+/g, " ").trim();
    if (normalized.length <= maxLength) {
      return normalized;
    }

    return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
  }

  private formatPortAudienceLabel(value: string): string {
    switch (value) {
      case "public":
        return "Public";
      case "mates":
        return "Mates";
      case "profile":
      default:
        return "Profile";
    }
  }

  private formatPortSectionLabel(value: string): string {
    switch (value) {
      case "all":
        return "All";
      case "daily-log":
        return "Daily Log";
      default:
        return titleCase(value.replace(/-/g, " "));
    }
  }

  private formatPortTimestamp(value: string | number | null | undefined): string {
    if (!value) {
      return "just now";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
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

  private toDisplayResourceAlias(resourceAlias: string | null | undefined): string {
    if (!resourceAlias) {
      return "?";
    }

    if (resourceAlias === this.resolveOrchestratorAlias()) {
      return resourceAlias;
    }

    if (this.config.endpoints[resourceAlias]) {
      return resourceAlias;
    }

    const looksHostStyle =
      resourceAlias.includes(".") ||
      /^(desktop-|laptop-|mac-|macbook-|imac-|windows-|win-|host-|node-)/i.test(resourceAlias) ||
      (resourceAlias.split("-").length >= 3 && /\d/.test(resourceAlias));
    if (!looksHostStyle) {
      return resourceAlias;
    }

    try {
      const profile = getResourceProfile(resourceAlias, this.rootDir);
      const labelAlias = profile.label
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
      if (labelAlias && isValidAlias(labelAlias)) {
        return labelAlias;
      }
    } catch {
      // Fall through to the original alias when profile lookup fails.
    }

    return resourceAlias;
  }

  private formatResourceRoutingTarget(
    resourceAlias: string | null | undefined,
    model: string | null | undefined
  ): string {
    const displayAlias = this.toDisplayResourceAlias(resourceAlias);
    return `@${displayAlias}/${model?.trim() ? model : "(default)"}`;
  }

  private formatRequestedResource(resourceAlias?: string): string {
    return resourceAlias ? ` -> @${this.toDisplayResourceAlias(resourceAlias)}` : "";
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
    this.activeCycleCount = 0;
    this.activeTasksByResource.clear();
    this.processingTaskIds.clear();
    this.runtime = {
      mode: "command",
      currentEndpoint: this.config.defaultEndpoint
    };
    await this.persistConfig();
    await this.persistSessions();
    await this.persistSystemState();
  }

  private async resetAutoRunState(options: {
    keepAutoEnabled?: boolean;
    resetTelemetry?: boolean;
  } = {}): Promise<void> {
    const restartDailySession = Boolean(
      this.systemState.auto.dailySession && !this.systemState.auto.dailySession.completedAt
    );
    this.systemState = {
      ...this.systemState,
      auto: {
        ...this.systemState.auto,
        enabled: options.keepAutoEnabled ?? this.systemState.auto.enabled,
        lastTaskId: 0,
        totalCompletedCount: 0,
        pending: [],
        completed: [],
        ...(restartDailySession ? { dailySession: startDailySession() } : {})
      }
    };
    if (!restartDailySession) {
      delete this.systemState.auto.dailySession;
    }
    this.activeCycleCount = 0;
    this.activeTasksByResource.clear();
    this.processingTaskIds.clear();
    this.lastDailyWorkQueuedDate = null;
    this.lastFillFailedAt = 0;
    this.networkFailureTimes.clear();
    if (options.resetTelemetry) {
      await resetTelemetry(this.rootDir);
    }
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
    timeoutMs?: number;
    abortSignal?: AbortSignal;
  }): Promise<OllamaChatResult> {
    const started = Date.now();

    try {
      const result = await chatWithOllamaDetailed(options.endpoint, options.messages, this.fetchFn, options.timeoutMs, options.abortSignal);
      const durationMs =
        typeof result.totalDuration === "number"
          ? Math.round(result.totalDuration / 1_000_000)
          : Date.now() - started;

      this.updateResourceTelemetry(options.resourceAlias, result, durationMs);
      this.updateResourceOutcome(options.resourceAlias, options.endpoint.model, true);

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
      const errorMsg = (error as Error).message;
      this.updateResourceOutcome(options.resourceAlias, options.endpoint.model, false, errorMsg);

      const fallbackEndpoint = this.getSpecializedModelFallbackEndpoint(
        options.endpoint,
        options.resourceAlias,
        options.scope,
        errorMsg
      );

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

      if (fallbackEndpoint) {
        const fallbackStarted = Date.now();
        this.warn(
          `Falling back from ${options.endpoint.model} to ${fallbackEndpoint.model} on @${options.resourceAlias} after transient failure.`
        );

        await appendAuditEvent(
          {
            timestamp: new Date().toISOString(),
            kind: "system",
            scope: `${options.scope}.model-fallback`,
            summary: `Retrying ${options.summary.toLowerCase()} on @${options.resourceAlias} with default model ${fallbackEndpoint.model}.`,
            success: true,
            actor: options.actor,
            resourceAlias: options.resourceAlias,
            target: options.target,
            model: fallbackEndpoint.model,
            metadata: {
              failedModel: options.endpoint.model,
              failedError: errorMsg
            }
          },
          this.rootDir
        );

        try {
          const fallbackResult = await chatWithOllamaDetailed(
            fallbackEndpoint,
            options.messages,
            this.fetchFn,
            options.timeoutMs,
            options.abortSignal
          );
          const fallbackDurationMs =
            typeof fallbackResult.totalDuration === "number"
              ? Math.round(fallbackResult.totalDuration / 1_000_000)
              : Date.now() - fallbackStarted;

          this.updateResourceTelemetry(options.resourceAlias, fallbackResult, fallbackDurationMs);
          this.updateResourceOutcome(options.resourceAlias, fallbackEndpoint.model, true);

          await appendAuditEvent(
            {
              timestamp: new Date().toISOString(),
              kind: "ollama.chat",
              scope: `${options.scope}.model-fallback`,
              summary: `${options.summary} (default-model fallback).`,
              success: true,
              actor: options.actor,
              resourceAlias: options.resourceAlias,
              target: options.target,
              model: fallbackEndpoint.model,
              durationMs: fallbackDurationMs,
              promptMessageCount: options.messages.length,
              promptChars: options.messages.reduce((total, message) => total + message.content.length, 0),
              responseChars: fallbackResult.text.length,
              promptEvalCount: fallbackResult.promptEvalCount,
              evalCount: fallbackResult.evalCount,
              requestMessages: options.messages,
              responseText: fallbackResult.text,
              metadata: {
                failedModel: options.endpoint.model
              }
            },
            this.rootDir
          );

          return fallbackResult;
        } catch (fallbackError) {
          this.updateResourceOutcome(
            options.resourceAlias,
            fallbackEndpoint.model,
            false,
            (fallbackError as Error).message
          );
          await appendAuditEvent(
            {
              timestamp: new Date().toISOString(),
              kind: "ollama.chat",
              scope: `${options.scope}.model-fallback`,
              summary: `${options.summary} (default-model fallback).`,
              success: false,
              actor: options.actor,
              resourceAlias: options.resourceAlias,
              target: options.target,
              model: fallbackEndpoint.model,
              durationMs: Date.now() - fallbackStarted,
              promptMessageCount: options.messages.length,
              promptChars: options.messages.reduce((total, message) => total + message.content.length, 0),
              requestMessages: options.messages,
              error: (fallbackError as Error).message,
              metadata: {
                failedModel: options.endpoint.model,
                initialError: errorMsg
              }
            },
            this.rootDir
          );
          throw fallbackError;
        }
      }

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
      this.getInternalQueryPattern(INTERNAL_WIKIPEDIA_SYSTEM_TERMS).test(parsedToolRequest.query)
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
      this.getInternalQueryPattern(INTERNAL_REDDIT_SYSTEM_TERMS).test(parsedToolRequest.query)
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
      this.getInternalQueryPattern(INTERNAL_SEARCH_SYSTEM_TERMS).test(parsedRequest.query)
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
      taskPrompt: options.taskPrompt,
      weatherEnabled: this.isWeatherEnabled()
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
      parentTaskId?: number;
      parentResultSummary?: string;
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
      ...(options.parentTaskId ? { parentTaskId: options.parentTaskId } : {}),
      ...(options.parentResultSummary
        ? { parentResultSummary: summarizeForParentResult(options.parentResultSummary) }
        : {}),
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

    // Let the routing engine choose the best available resource rather than
    // pinning to the orchestrator — which may already be overloaded.
    return this.enqueueAutoTask(content, "high", "orchestrator:safe-mode");
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
  }): Promise<{ recoveryTask?: AutoQueueTask; retried?: boolean }> {
    const MAX_RETRIES = 1;
    const currentRetries = options.task.retryCount ?? 0;

    // Retry-with-fallback: if the task has retries left and a different resource
    // exists, re-queue it with the failed resource noted for avoidance.
    if (currentRetries < MAX_RETRIES && options.assignedResource && !this.isSafeModeRecoveryTask(options.task)) {
      const retryTask: AutoQueueTask = {
        ...options.task,
        status: "queued",
        retryCount: currentRetries + 1,
        lastFailedResource: options.assignedResource,
        requestedResource: undefined,
        assignedResource: undefined,
        assignedModel: undefined,
        result: undefined,
        errorMessage: undefined
      };

      this.systemState = {
        ...this.systemState,
        auto: {
          ...this.systemState.auto,
          pending: this.sortPendingTasks([retryTask, ...options.remaining])
        }
      };
      await this.persistSystemState();
      await appendChangelogEntry(
        `Retrying auto task #${options.task.id} (attempt ${currentRetries + 1}/${MAX_RETRIES + 1}) after failure on ${options.assignedResource}: ${options.errorMessage}`,
        this.rootDir
      );
      await appendAuditEvent(
        {
          timestamp: new Date().toISOString(),
          kind: "system",
          scope: "auto.task.retry",
          summary: `Retrying task #${options.task.id} after failure on ${options.assignedResource}.`,
          success: true,
          actor: "orchestrator",
          target: `task:${options.task.id}`,
          metadata: {
            retryCount: currentRetries + 1,
            failedResource: options.assignedResource,
            errorMessage: options.errorMessage
          }
        },
        this.rootDir
      );
      return { retried: true };
    }

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
        completed: [...this.systemState.auto.completed, failedTask].slice(-AUTO_COMPLETED_TASK_LIMIT),
        totalCompletedCount: (this.systemState.auto.totalCompletedCount ?? 0) + 1
      }
    };
    await this.persistSystemState();
    await appendChangelogEntry(
      `Quarantined failed auto task #${options.task.id}. Error: ${options.errorMessage}`,
      this.rootDir
    );

    let recoveryTask: AutoQueueTask | undefined;
    if (options.createRecoveryTask) {
      // Circuit breaker: cap safe-mode recovery tasks in the pending queue to
      // prevent a cascade where recovery tasks themselves keep failing.
      const existingRecoveryCount = this.systemState.auto.pending.filter((t) =>
        this.isSafeModeRecoveryTask(t)
      ).length;
      if (existingRecoveryCount < 2) {
        recoveryTask = await this.queueSafeModeRecoveryTask({
          failedTaskId: options.task.id,
          reason: options.errorMessage,
          failedTaskSummary: options.task.content
        });
        await appendChangelogEntry(
          `Queued safe mode recovery task #${recoveryTask.id} after auto task #${options.task.id} failed.`,
          this.rootDir
        );
      } else {
        await appendChangelogEntry(
          `Skipped safe mode recovery for task #${options.task.id} — ${existingRecoveryCount} recovery tasks already pending.`,
          this.rootDir
        );
      }
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
        `- Reason redirected by Local Crew: ${options.reason}`,
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
    "daily-work.md": (paths) => paths.dailyWorkPath,
  };

  /**
   * Attempt to write content to a canonical orchestrator memory file
   * (summary, focus-todo, roadmap). Returns null if the filename does not
   * match a known canonical path.
   */
  private getCanonicalMemoryTarget(
    filename: string
  ): Promise<{ path: string; relativePath: string } | null> {
    const normalized = filename.replace(/^\/+/, "").toLowerCase();
    const resolver = this.CANONICAL_MEMORY_FILES[normalized];
    if (!resolver) {
      return Promise.resolve(null);
    }
    const paths = getStoragePaths(this.rootDir);
    const targetPath = resolver(paths);
    return Promise.resolve({
      path: targetPath,
      relativePath: normalized
    });
  }

  private async writeTextDocumentAtomically(targetPath: string, content: string): Promise<void> {
    await mkdir(dirname(targetPath), { recursive: true });
    await atomicWriteFile(targetPath, `${content.trimEnd()}\n`, "utf8");
  }

  private async applyDirectiveToTarget(
    targetPath: string,
    directive: GeneratedFileDirective
  ): Promise<void> {
    await withFileLock(targetPath, async () => {
      if (directive.kind === "write") {
        await this.writeTextDocumentAtomically(targetPath, directive.content);
        return;
      }

      const currentContent = await readFile(targetPath, "utf8").catch(() => "");
      const nextContent = applyGeneratedFileDirective(currentContent, directive);
      await this.writeTextDocumentAtomically(targetPath, nextContent);
    });
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
    await atomicWriteFile(targetPath, `${content.trimEnd()}\n`, "utf8");
    return {
      path: targetPath,
      relativePath: safeRelativePath
    };
  }

  private resolveDropboxGeneratedDocumentPath(
    stage: Extract<GeneratedFileStage, "active" | "outbox">,
    filename: string
  ): { path: string; relativePath: string } {
    const paths = getDropboxPaths(this.rootDir);
    const safeRelativePath = ensureSafeGeneratedRelativePath(filename);
    const targetRoot = resolve(stage === "active" ? paths.activeDir : paths.outboxDir);
    const targetPath = resolve(join(targetRoot, safeRelativePath));
    if (!targetPath.startsWith(`${targetRoot}/`) && targetPath !== targetRoot) {
      throw new Error("Dropbox write path must stay inside the requested stage.");
    }
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

  private getOperationalEndpointForTask(
    resourceAlias: string,
    desiredPurpose: "default" | "reasoning" | "coding" | "tools",
    taskContent: string
  ): EndpointConfig {
    const resource = getResourceProfile(resourceAlias, this.rootDir);
    const liveMetrics = this.liveDeviceMetrics.get(resourceAlias);
    const baseTelemetry = this.resourceTelemetry.get(resourceAlias) ?? this.getDefaultResourceTelemetry(resourceAlias);
    const ramUsagePct = liveMetrics
      ? Math.round((1 - liveMetrics.freeMemGb / liveMetrics.totalMemGb) * 100)
      : baseTelemetry.ramUsagePct;
    const cpuLoadPct =
      liveMetrics && typeof resource.cpuLogicalCores === "number" && resource.cpuLogicalCores > 0
        ? Math.max(0, Math.min(100, Math.round((liveMetrics.loadAvg1m / resource.cpuLogicalCores) * 100)))
        : baseTelemetry.cpuLoadPct;
    const resolvedPurpose = resolveResourcePurpose(
      resource,
      desiredPurpose,
      classifyTask(taskContent),
      {
        ...baseTelemetry,
        ramUsagePct,
        ...(cpuLoadPct !== undefined ? { cpuLoadPct } : {})
      },
      this.getResourceHealth(resourceAlias)?.status
    );

    return getResourceEndpoint(resourceAlias, resolvedPurpose, this.rootDir);
  }

  private getSpecializedModelFallbackEndpoint(
    endpoint: EndpointConfig,
    resourceAlias: string,
    scope: string,
    errorMessage: string
  ): EndpointConfig | null {
    const isAutonomousScope = scope.startsWith("auto.") || scope === "agent.create";
    const transientFailure =
      isNetworkError(errorMessage) ||
      /^HTTP 5\d\d/.test(errorMessage) ||
      /missing message\.content/i.test(errorMessage) ||
      /timed out/i.test(errorMessage);

    if (!isAutonomousScope || !transientFailure) {
      return null;
    }

    const profile = getResourceProfile(resourceAlias, this.rootDir);
    const specializedModels = [profile.reasoningModel, profile.codingModel, profile.toolsModel].filter(
      (model): model is string => Boolean(model && model.trim())
    );

    if (!specializedModels.includes(endpoint.model) || endpoint.model === profile.defaultModel) {
      return null;
    }

    return {
      ...endpoint,
      model: profile.defaultModel
    };
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
      parentTaskId?: number;
      parentResultSummary?: string;
    } = {}
  ): Promise<{ tasks: AutoQueueTask[]; notes: string[] }> {
    const addedTasks: AutoQueueTask[] = [];
    const notes: string[] = [];

    // Build dedup comparison pool: pending tasks + last 20 completed tasks
    const dedupPool: Array<{ content: string }> = [
      ...this.systemState.auto.pending,
      ...this.systemState.auto.completed.slice(-20),
    ];

    for (const task of queuedTasks) {
      if (!task.content.trim()) {
        continue;
      }

      const normalizedTask = this.normalizeQueuedTaskRouting(task);

      // Structural dedup: reject tasks too similar to recent work
      if (
        this.isAutonomousTaskSource(createdBy) &&
        isTaskDuplicate(normalizedTask.content, dedupPool)
      ) {
        notes.push(`Skipped duplicate task: ${normalizedTask.content.slice(0, 80)}`);
        continue;
      }

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
    fileDirectives: GeneratedFileDirective[],
    options: {
      createdBy?: string;
      taskId?: number;
      sourceDocumentRelativePath?: string;
    } = {}
  ): Promise<{
    lines: string[];
    writes: Array<{
      stage: "active" | "outbox" | "internal";
      path: string;
      verified: boolean;
    }>;
  }> {
    const writtenLines: string[] = [];
    const writes: Array<{
      stage: "active" | "outbox" | "internal";
      path: string;
      verified: boolean;
    }> = [];

    for (const fileDirective of fileDirectives) {
      if (!fileDirective.filename.trim()) {
        continue;
      }

      const isAutonomousWrite = Boolean(
        options.createdBy && this.isAutonomousTaskSource(options.createdBy)
      );
      const safeFilename = fileDirective.filename.replaceAll("\\", "/").trim();
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
            fileDirective.kind === "write"
              ? fileDirective.content.trim() || "(none)"
              : [
                  `Requested update mode: ${fileDirective.mode}`,
                  "",
                  fileDirective.content.trim() || "(none)"
                ].join("\n")
          ].join("\n"),
          createdBy: options.createdBy ?? "orchestrator",
          taskId: options.taskId,
          relatedPath: safeFilename,
          reason:
            "Autonomous file writes are limited to internal text artifacts. Executable scripts, source files, and app-level implementation requests are redirected into outbox feature tickets."
        });
        writtenLines.push(`Redirected external file request to outbox ticket: ${ticketPath}`);
        writes.push({
          stage: "outbox",
          path: ticketPath,
          verified: true
        });
        continue;
      }

      if (
        this.shouldPreferInternalWrite({
          stage: fileDirective.stage,
          filename: safeFilename,
          createdBy: options.createdBy,
          sourceDocumentRelativePath: options.sourceDocumentRelativePath
        })
      ) {
        // Check if this targets a canonical memory file (summary, focus-todo, roadmap).
        const canonicalEntry = await this.getCanonicalMemoryTarget(safeFilename);
        if (canonicalEntry) {
          await this.applyDirectiveToTarget(canonicalEntry.path, fileDirective);
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
          writes.push({
            stage: "internal",
            path: canonicalEntry.relativePath,
            verified: true
          });
          continue;
        }

        const entry =
          fileDirective.kind === "write"
            ? await this.writeInternalGeneratedDocument(safeFilename, fileDirective.content)
            : (() => {
                const paths = getStoragePaths(this.rootDir);
                const safeRelativePath = ensureSafeGeneratedRelativePath(safeFilename);
                const targetPath = resolve(join(paths.orchestratorGeneratedDir, safeRelativePath));
                const allowedRoot = resolve(paths.orchestratorGeneratedDir);
                if (!targetPath.startsWith(`${allowedRoot}/`) && targetPath !== allowedRoot) {
                  throw new Error("Internal write path must stay inside the orchestrator generated directory.");
                }
                return {
                  path: targetPath,
                  relativePath: safeRelativePath
                };
              })();
        if (fileDirective.kind === "update") {
          await this.applyDirectiveToTarget(entry.path, fileDirective);
        }
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
        writes.push({
          stage: "internal",
          path: entry.relativePath,
          verified: true
        });
        continue;
      }

      const entry =
        fileDirective.kind === "write"
          ? await writeGeneratedDropboxDocument(
              fileDirective.stage as "active" | "outbox",
              fileDirective.filename,
              fileDirective.content,
              this.rootDir
            )
          : this.resolveDropboxGeneratedDocumentPath(
              fileDirective.stage as "active" | "outbox",
              fileDirective.filename
            );
      if (fileDirective.kind === "update") {
        await this.applyDirectiveToTarget(entry.path, fileDirective);
      }
      await appendAuditEvent(
        {
          timestamp: new Date().toISOString(),
          kind: "system",
          scope: "dropbox.write",
          summary: `${fileDirective.kind === "write" ? "Wrote" : "Updated"} ${fileDirective.stage} dropbox file ${entry.relativePath}.`,
          success: true,
          actor: "orchestrator",
          target: entry.relativePath,
          metadata: {
            stage: fileDirective.stage,
            path: entry.path
          }
        },
        this.rootDir
      );
      writtenLines.push(`${fileDirective.kind === "write" ? "Wrote" : "Updated"} ${fileDirective.stage} file: ${entry.path}`);
      writes.push({
        stage: fileDirective.stage,
        path: entry.relativePath,
        verified: true
      });
    }

    return {
      lines: writtenLines,
      writes
    };
  }

  /**
   * Process SCRIPT_REQUEST blocks from auto task or agent output.
   * Performs static analysis, logs audit events, and executes approved scripts.
   */
  private async handleScriptRequests(
    scriptRequests: ScriptRequest[],
    options: { createdBy?: string; taskId?: number } = {}
  ): Promise<{ lines: string[]; results: ScriptExecutionResult[] }> {
    const lines: string[] = [];
    const results: ScriptExecutionResult[] = [];

    for (const request of scriptRequests) {
      request.requestedBy = options.createdBy ?? "orchestrator";

      // Check session-level blocking
      if (this.scriptTracker.isBlocked(request.purposeSlug)) {
        lines.push(
          `Script [${request.purposeSlug}] blocked — exceeded ${this.scriptTracker.maxRejectionsPerSlug} rejections this session.`
        );
        await appendAuditEvent(
          {
            timestamp: new Date().toISOString(),
            kind: "system",
            scope: "script.blocked",
            summary: `Script ${request.purposeSlug} blocked for session after repeated rejections.`,
            success: false,
            actor: request.requestedBy,
            target: request.purposeSlug,
          },
          this.rootDir
        );
        continue;
      }

      // Log proposal
      await appendAuditEvent(
        {
          timestamp: new Date().toISOString(),
          kind: "system",
          scope: "script.proposed",
          summary: `Script proposed: ${request.purposeSlug} (${request.language}) — ${request.purpose}`,
          success: true,
          actor: request.requestedBy,
          target: request.purposeSlug,
          metadata: { language: request.language, purpose: request.purpose },
        },
        this.rootDir
      );

      // Static analysis
      const review = staticAnalyze(request);

      if (review.verdict === "rejected") {
        this.scriptTracker.recordRejection(request.purposeSlug);
        lines.push(
          `Script [${request.purposeSlug}] rejected: ${review.reason}`,
          ...review.violations.map((v) => `  - ${v}`)
        );
        await appendAuditEvent(
          {
            timestamp: new Date().toISOString(),
            kind: "system",
            scope: "script.rejected",
            summary: `Script ${request.purposeSlug} rejected: ${review.reason}`,
            success: false,
            actor: "orchestrator",
            target: request.purposeSlug,
            metadata: { violations: review.violations },
          },
          this.rootDir
        );
        continue;
      }

      // Execute approved script
      lines.push(`Script [${request.purposeSlug}] approved — executing ${request.language} sandbox...`);
      await appendAuditEvent(
        {
          timestamp: new Date().toISOString(),
          kind: "system",
          scope: "script.approved",
          summary: `Script ${request.purposeSlug} approved for execution.`,
          success: true,
          actor: "orchestrator",
          target: request.purposeSlug,
        },
        this.rootDir
      );

      const result = await executeScript(request, this.rootDir);
      results.push(result);

      if (result.success) {
        const outputPreview = result.stdout.length > 500
          ? result.stdout.slice(0, 500) + "..."
          : result.stdout;
        lines.push(
          `Script [${request.purposeSlug}] completed (${result.durationMs}ms):`,
          outputPreview || "(no output)"
        );
      } else {
        lines.push(
          `Script [${request.purposeSlug}] failed (exit ${result.exitCode}${result.timedOut ? ", timed out" : ""}):`,
          result.stderr || "(no error output)"
        );
      }

      await appendAuditEvent(
        {
          timestamp: new Date().toISOString(),
          kind: "system",
          scope: result.success ? "script.executed" : "script.failed",
          summary: result.success
            ? `Script ${request.purposeSlug} executed successfully (${result.durationMs}ms).`
            : `Script ${request.purposeSlug} failed: ${result.stderr.slice(0, 200)}`,
          success: result.success,
          actor: "orchestrator",
          target: request.purposeSlug,
          metadata: {
            durationMs: result.durationMs,
            exitCode: result.exitCode,
            timedOut: result.timedOut,
            stdoutLength: result.stdout.length,
            stderrLength: result.stderr.length,
          },
        },
        this.rootDir
      );
    }

    return { lines, results };
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
        `- Canonical resource roster: ${canonicalRoster}. Use only these exact aliases. If unsure, omit the alias and let Local Crew route the task automatically.`,
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
          "- This task exists because Local Crew observed an unexpected failure or derailment during autonomous work.",
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
          summary: `Pre-flight reasoning for auto task #${options.task.id}.`,
          abortSignal: this.autoCycleAbort?.signal
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
      currentDateTime: formatCurrentDateTime(),
      weatherEnabled: this.isWeatherEnabled()
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
          `Agent chat failed for @${agent.slug} via ${this.formatResourceRoutingTarget(selection.alias, endpoint.model)} (${endpoint.baseUrl}): ${(error as Error).message}`
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
      agentName: agent.slug,
      parentResultSummary: replyText
    });
    const queued = queuedResult.tasks;
    let writtenFiles: string[] = [];
    const postProcessErrors: string[] = [];
    try {
      const writeResult = await this.handleGeneratedFileWrites(parsed.fileDirectives, {
        createdBy: `agent:${agent.slug}`
      });
      writtenFiles = writeResult.lines;
    } catch (error) {
      postProcessErrors.push(`Dropbox write warning: ${(error as Error).message}`);
    }
    // Process any script requests from the agent
    let scriptLines: string[] = [];
    if (parsed.scriptRequests.length > 0) {
      try {
        const scriptResult = await this.handleScriptRequests(parsed.scriptRequests, {
          createdBy: `agent:${agent.slug}`,
        });
        scriptLines = scriptResult.lines;
      } catch (error) {
        postProcessErrors.push(`Script execution warning: ${(error as Error).message}`);
      }
    }
    await appendChangelogEntry(
      `Agent @${agent.slug} replied via ${this.formatResourceRoutingTarget(selection.alias, endpoint.model)}. Queued ${queued.length} follow-up task${queued.length === 1 ? "" : "s"} and wrote ${writtenFiles.length} file${writtenFiles.length === 1 ? "" : "s"}.`,
      this.rootDir
    );

    return {
      lines: [
        `@${agent.slug}: ${replyText}`,
        ...writtenFiles,
        ...scriptLines,
        ...queuedResult.notes,
        ...queued.map(
          (task) =>
            `Queued #${task.id} [${task.priority}]${task.delegationRole ? ` {${task.delegationRole}}` : ""}${
              this.formatRequestedResource(task.requestedResource)
            }${task.requestedModel ? `/${task.requestedModel}` : ""} from @${agent.slug}: ${task.content}`
        )
      ],
      errors: postProcessErrors,
      shouldExit: false
    };
  }

  private async fillAutoQueue(): Promise<{ queued: AutoQueueTask[]; notes: string[] }> {
    const refillThreshold = this.getQueueRefillThreshold();
    const desiredPendingDepth = this.getDesiredPendingDepth();
    const remainingQueueCapacity = Math.max(
      0,
      desiredPendingDepth - this.systemState.auto.pending.length
    );
    if (
      this.systemState.auto.pending.length > refillThreshold ||
      remainingQueueCapacity <= 0
    ) {
      return {
        queued: [],
        notes: []
      };
    }

    // Circuit breaker: if a recent fill attempt failed, respect the cooldown
    // window so the system processes existing tasks instead of looping.
    if (Date.now() - this.lastFillFailedAt < LocalCrewApp.FILL_COOLDOWN_MS) {
      return { queued: [], notes: [] };
    }

    // Prevent duplicate fallback accumulation: if previous fill failures
    // already queued diagnostic tasks, process those first.
    const hasFallbackTasks = this.systemState.auto.pending.some(
      (t) => t.createdBy === "orchestrator:auto-fill-fallback"
    );
    if (hasFallbackTasks) {
      return { queued: [], notes: [] };
    }

    // Bail early if auto mode was stopped while we were waiting.
    if (!this.isAutoMode()) {
      return { queued: [], notes: [] };
    }

    const abortSignal = this.autoCycleAbort?.signal;

    const [documents, agents] = await Promise.all([
      loadSystemDocuments(this.rootDir),
      listAgents(this.rootDir)
    ]);
    const orchestratorAlias = this.resolveOrchestratorAlias();
    const resourceRoster = this.getResourceRosterText();
    const allResources = listResources(this.rootDir);

    // For the draft phase, prefer a mid-tier or non-orchestrator resource to
    // keep the top-tier machine free for task execution.
    const draftResource =
      allResources.find((r) => r.tier === "mid" && r.alias !== orchestratorAlias) ??
      allResources.find((r) => r.alias !== orchestratorAlias) ??
      null;
    const draftAlias = draftResource?.alias ?? orchestratorAlias;
    const draftEndpoint = this.getOperationalEndpointForTask(
      draftAlias,
      "reasoning",
      "Draft and refine the autonomous queue backlog with enough headroom left for execution."
    );
    // Finalize always uses the orchestrator — it makes the final queue decision.
    const finalizeEndpoint = this.getOperationalEndpointForTask(
      orchestratorAlias,
      "reasoning",
      "Finalize the autonomous queue backlog after critique and preserve reasoning headroom for execution."
    );
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
      currentDateTime: fillDateTime,
      recentCompletedTopics: this.getRecentCompletedTopics(),
      targetTaskCount: remainingQueueCapacity,
      weatherEnabled: this.isWeatherEnabled()
    });

    let draftReply: string;
    try {
      draftReply = (
        await this.callModel({
          scope: "auto.queue-fill.draft",
          actor: "orchestrator",
          endpoint: draftEndpoint,
          resourceAlias: draftAlias,
          target: draftAlias,
          messages: draftMessages,
          summary: "Drafting the auto queue backlog.",
          timeoutMs: LocalCrewApp.QUEUE_FILL_TIMEOUT_MS,
          abortSignal
        })
      ).text;
      draftReply = await this.resolveExternalTools({
        scope: "auto.queue-fill.draft",
        actor: "orchestrator",
        endpoint: draftEndpoint,
        resourceAlias: draftAlias,
        target: draftAlias,
        messages: draftMessages,
        rawReply: draftReply
      });
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return { queued: [], notes: ["Queue fill cancelled (auto mode stopped)."] };
      }
      this.lastFillFailedAt = Date.now();
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

    // Checkpoint: bail if auto mode was stopped during the draft phase.
    if (!this.isAutoMode()) {
      return { queued: [], notes: ["Queue fill cancelled (auto mode stopped)."] };
    }

    const draftTasks = parseQueueFillOutput(draftReply);
    this.emitTaskEvent({
      type: "queue-fill",
      phase: "draft",
      taskCount: draftTasks.length
    });
    const draftTaskText =
      draftTasks.length > 0
        ? draftTasks.map((task) => `[${task.priority}] ${task.content}`).join("\n")
        : draftReply.trim();
    // Prefer an orchestrator-capable resource as reviewer, fall back to any non-primary top-tier
    const reviewerResource =
      allResources.find(
        (resource) =>
          resource.alias !== orchestratorAlias &&
          getEffectiveResourceRole(resource, orchestratorAlias) === "orchestrator"
      ) ??
      allResources.find(
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
        currentDateTime: fillDateTime,
        weatherEnabled: this.isWeatherEnabled()
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
            summary: `Reviewing the drafted auto queue backlog with @${reviewerResource.alias}.`,
            abortSignal
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
        if ((error as Error).name === "AbortError") {
          return { queued: [], notes: ["Queue fill cancelled (auto mode stopped)."] };
        }
        reviewFeedback = `Critique unavailable because the reviewer step failed: ${(error as Error).message}\nVERDICT: revise`;
      }
    }

    // Checkpoint: bail if auto mode was stopped during the review phase.
    if (!this.isAutoMode()) {
      return { queued: [], notes: ["Queue fill cancelled (auto mode stopped)."] };
    }

    const reviewVerdict = parseQueueReviewVerdict(reviewFeedback);
    this.emitTaskEvent({
      type: "queue-fill",
      phase: "review",
      verdict: reviewVerdict,
      taskCount: draftTasks.length
    });
    if (reviewVerdict === "reject") {
      await appendChangelogEntry(
        reviewerResource
          ? `Auto queue draft rejected by reviewer @${reviewerResource.alias}; no tasks were finalized.`
          : "Auto queue draft rejected; no tasks were finalized.",
        this.rootDir
      );
      return {
        queued: [],
        notes: [
          reviewerResource
            ? `Queue fill rejected by @${reviewerResource.alias} (VERDICT: reject).`
            : "Queue fill rejected (VERDICT: reject)."
        ]
      };
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
      currentDateTime: fillDateTime,
      targetTaskCount: remainingQueueCapacity,
      weatherEnabled: this.isWeatherEnabled()
    });

    let finalReply: string;
    try {
      finalReply = (
        await this.callModel({
          scope: "auto.queue-fill.finalize",
          actor: "orchestrator",
          endpoint: finalizeEndpoint,
          resourceAlias: orchestratorAlias,
          target: this.getOrchestratorName(),
          messages: finalizeMessages,
          summary: reviewerResource
            ? `Finalizing the auto queue backlog after critique from @${reviewerResource.alias}.`
            : "Finalizing the auto queue backlog without a secondary reviewer.",
          timeoutMs: LocalCrewApp.QUEUE_FILL_TIMEOUT_MS,
          abortSignal
        })
      ).text;
      finalReply = await this.resolveExternalTools({
        scope: "auto.queue-fill.finalize",
        actor: "orchestrator",
        endpoint: finalizeEndpoint,
        resourceAlias: orchestratorAlias,
        target: this.getOrchestratorName(),
        messages: finalizeMessages,
        rawReply: finalReply
      });
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return { queued: [], notes: ["Queue fill cancelled (auto mode stopped)."] };
      }
      this.lastFillFailedAt = Date.now();
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
    this.emitTaskEvent({
      type: "queue-fill",
      phase: "finalize",
      verdict: reviewVerdict,
      taskCount: parsedTasks.length
    });
    const tasks =
      parsedTasks.length > 0
        ? parsedTasks
        : pickFallbackTasks();
    const tasksToQueue = tasks.slice(0, remainingQueueCapacity);
    const notes =
      tasks.length > tasksToQueue.length
        ? [
            `Backlog capped at ${desiredPendingDepth} pending task${desiredPendingDepth === 1 ? "" : "s"} based on current resource capacity.`
          ]
        : [];

    const queuedResult = await this.queueParsedTasks(tasksToQueue, "orchestrator:auto-fill");
    if (queuedResult.tasks.length > 0 || queuedResult.notes.length > 0 || notes.length > 0) {
      await appendChangelogEntry(
        reviewerResource
          ? `Auto queue filled after draft/review/finalize consensus between ${this.getOrchestratorName()} and @${reviewerResource.alias}. Verdict: ${reviewVerdict}.`
          : `Auto queue filled after orchestrator-only planning because no secondary reviewer resource was available.`,
        this.rootDir
      );
    }
    return {
      queued: queuedResult.tasks,
      notes: [...notes, ...queuedResult.notes]
    };
  }

  private async processNextAutoTask(): Promise<CommandResult> {
    // Filter out tasks already being processed to prevent duplicate dequeue under parallel dispatch.
    const busyAliases = new Set(this.activeTasksByResource.keys());
    const available = this.sortPendingTasks(
      this.systemState.auto.pending.filter(t => !this.processingTaskIds.has(t.id) &&
        (!t.requestedResource || !busyAliases.has(t.requestedResource)))
    );
    let task = available[0];
    if (!task) {
      return { lines: [], errors: [], shouldExit: false };
    }

    // Eagerly mark as processing to prevent duplicate picks by concurrent cycles.
    this.processingTaskIds.add(task.id);
    const taskStartedAt = new Date().toISOString();
    const taskStartMs = Date.now();
    let activeResourceAlias: string | null = null;
    try {
      const [documents, agents, telemetrySummary] = await Promise.all([
        loadSystemDocuments(this.rootDir),
        listAgents(this.rootDir),
        loadTelemetrySummary(this.rootDir)
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
      for (const alias of this.activeTasksByResource.keys()) {
        resourceLoad[alias] = (resourceLoad[alias] ?? 0) + 1;
      }

      // Merge in network-failure cooldown penalties so recently-failed resources
      // are deprioritized even for tasks beyond the immediate retry.
      const networkPenalties = this.getNetworkFailurePenalties();
      for (const [alias, penalty] of Object.entries(networkPenalties)) {
        resourceLoad[alias] = (resourceLoad[alias] ?? 0) + penalty;
      }

      // Parse domain tag and strip it from task content before routing/execution.
      const taskDomain = parseTaskDomain(task.content);
      if (taskDomain) {
        task = {
          ...task,
          domain: taskDomain,
          content: task.content.replace(/^\{domain:[A-Z]+\}\s*/i, "")
        };
      }

      // Build filtered live metrics map (entries within the last 10 minutes only).
      const TEN_MIN_MS = 10 * 60 * 1000;
      const now = Date.now();
      const liveMetricsByAlias: Record<string, LiveDeviceMetrics & { receivedAt: number }> = {};
      for (const [alias, metrics] of this.liveDeviceMetrics) {
        if (now - metrics.receivedAt < TEN_MIN_MS) {
          liveMetricsByAlias[alias] = metrics;
        }
      }

      const healthStatuses = this.getResourceHealthStatuses();
      let selection;
      let routingFallbackWarning: string | null = null;

      // If this is a retry, heavily penalize the resource that previously failed
      // so the routing engine picks a different one.
      if (task.lastFailedResource) {
        resourceLoad[task.lastFailedResource] = (resourceLoad[task.lastFailedResource] ?? 0) + 10;
      }

      try {
        selection = chooseResourceForTask(task.content, task.requestedResource ?? "auto", this.rootDir, {
          resourceLoad,
          primaryOrchestratorAlias: this.resolveOrchestratorAlias(),
          telemetrySummary,
          lastAssignedByAlias: Object.fromEntries(this.resourceLastAssignedAt),
          liveMetricsByAlias,
          healthStatuses
        });
      } catch (error) {
        const invalidRequestedResource = task.requestedResource;
        selection = chooseResourceForTask(task.content, "auto", this.rootDir, {
          resourceLoad,
          primaryOrchestratorAlias: this.resolveOrchestratorAlias(),
          telemetrySummary,
          lastAssignedByAlias: Object.fromEntries(this.resourceLastAssignedAt),
          liveMetricsByAlias,
          healthStatuses
        });
        task.requestedResource = undefined;
        routingFallbackWarning = `Ignored unknown requested resource "${invalidRequestedResource}" and fell back to automatic routing on @${this.toDisplayResourceAlias(selection.alias)}.`;
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

      let endpoint = this.getAutoTaskEndpoint(selection);
      if (task.requestedModel) {
        endpoint.model = task.requestedModel;
      }
      if (!endpoint.model?.trim()) {
        const recovery = await this.quarantineFailedAutoTask({
          task,
          remaining: this.systemState.auto.pending.filter(t => t.id !== task.id),
          assignedResource: selection.alias,
          errorMessage: `No default model configured for resource "${selection.alias}".`,
          createRecoveryTask: !this.isSafeModeRecoveryTask(task),
          startedAt: taskStartedAt,
          taskStartMs
        });
        if (recovery.retried) {
          return {
            lines: [`Auto task #${task.id} failed on @${this.toDisplayResourceAlias(selection.alias)} (no model). Retrying on another resource.`],
            errors: [],
            shouldExit: false
          };
        }
        return {
          lines: recovery.recoveryTask
            ? [
                `Quarantined failed auto task #${task.id} and queued safe mode recovery task #${recovery.recoveryTask.id}.`
              ]
            : [`Quarantined failed safe mode recovery task #${task.id}.`],
          errors: [
            `Auto task #${task.id} could not resolve a model for @${this.toDisplayResourceAlias(selection.alias)} (${endpoint.baseUrl}).`
          ],
          shouldExit: false
        };
      }

      // Context budget pre-flight: estimate whether the prompt will fit within
      // the selected resource's context window. If it doesn't fit, attempt to
      // reroute to the resource with the highest available context window.
      const systemContextChars =
        (documents.directives?.length ?? 0) +
        (documents.inventory?.length ?? 0) +
        (documents.roadmap?.length ?? 0) +
        (documents.focusTodo?.length ?? 0) +
        (documents.changelog?.length ?? 0) +
        (documents.orchestratorSummary?.length ?? 0);
      const budgetCheck = checkContextBudget(task.content, selection.alias, this.rootDir, {
        systemContextChars
      });
      let contextBudgetRerouteAudit:
        | {
            originalAlias: string;
            originalMaxContext: number;
            estimatedPromptTokens: number;
            newAlias: string;
            newMaxContext: number;
          }
        | null = null;
      if (!budgetCheck.fits) {
        const highestCtxResource = findHighestContextResource(this.rootDir);
        if (highestCtxResource && highestCtxResource.alias !== selection.alias) {
          const rerouteCheck = checkContextBudget(task.content, highestCtxResource.alias, this.rootDir, {
            systemContextChars
          });
          if (rerouteCheck.fits) {
            const originalAlias = selection.alias;
            selection.alias = highestCtxResource.alias;
            selection.tier = highestCtxResource.tier;
            selection.rationale = `Rerouted from ${originalAlias} (context budget exceeded: ${budgetCheck.estimatedPromptTokens}/${budgetCheck.availableTokens} tokens) to ${highestCtxResource.alias} (${rerouteCheck.availableTokens} tokens available).`;
            const rerouteEndpoint = this.getAutoTaskEndpoint(selection);
            if (rerouteEndpoint.model?.trim()) {
              endpoint = {
                ...rerouteEndpoint,
                model: task.requestedModel ?? rerouteEndpoint.model
              };
              contextBudgetRerouteAudit = {
                originalAlias,
                originalMaxContext: budgetCheck.maxContextTokens,
                estimatedPromptTokens: budgetCheck.estimatedPromptTokens,
                newAlias: highestCtxResource.alias,
                newMaxContext: rerouteCheck.maxContextTokens
              };
            }
          }
        }
      }

      this.resourceLastAssignedAt.set(selection.alias, Date.now());
      const activeTask: AutoQueueTask = {
        ...task,
        assignedResource: selection.alias,
        assignedModel: endpoint.model,
        startedAt: taskStartedAt
      };
      activeResourceAlias = selection.alias;
      this.activeTasksByResource.set(activeResourceAlias, activeTask);
      this.setResourceActiveModel(activeResourceAlias, endpoint.model);

      if (contextBudgetRerouteAudit) {
        await appendAuditEvent(
          {
            timestamp: new Date().toISOString(),
            kind: "system",
            scope: "auto.route.context-budget-reroute",
            summary: `Rerouted task #${task.id} from ${contextBudgetRerouteAudit.originalAlias} to ${contextBudgetRerouteAudit.newAlias} due to context budget overflow.`,
            success: true,
            actor: "orchestrator",
            target: `task:${task.id}`,
            metadata: {
              originalResource: contextBudgetRerouteAudit.originalAlias,
              originalMaxContext: contextBudgetRerouteAudit.originalMaxContext,
              estimatedPromptTokens: contextBudgetRerouteAudit.estimatedPromptTokens,
              newResource: contextBudgetRerouteAudit.newAlias,
              newMaxContext: contextBudgetRerouteAudit.newMaxContext
            }
          },
          this.rootDir
        );
      }

      const extraContextBlocks = await this.getAutoTaskExtraContext(task);

      // Inject domain-specific agent identity block at the front of context blocks.
      if (task.domain) {
        const identityBlock = await buildAgentIdentityBlock(task.domain, this.rootDir);
        if (identityBlock) {
          extraContextBlocks.unshift(identityBlock);
        }
      }

      // Pre-flight: ask the model to reason briefly about the task before executing.
      // Failure is non-fatal — we log it and proceed without the context block.
      const preflightContext = await this.runTaskPreflight({
        task: activeTask,
        documents,
        endpoint,
        resourceAlias: selection.alias
      });
      if (preflightContext) {
        extraContextBlocks.push(preflightContext);
      }
      if (task.parentTaskId && task.parentResultSummary) {
        extraContextBlocks.push(
          `Prior task output (task #${task.parentTaskId}):\n${task.parentResultSummary}`
        );
      }
      const preflightGoal = preflightContext ? extractPreflightGoal(preflightContext) : null;

      const resourceProfile = getResourceProfile(selection.alias, this.rootDir);

      // Add delegation context when task is routed to a sub-orchestrator.
      if (
        selection.delegateToOrchestrator &&
        selection.availableSubordinates &&
        selection.availableSubordinates.length > 0
      ) {
        task.delegatedOrchestrator = selection.delegateToOrchestrator;
        task.subordinateResources = selection.availableSubordinates;
        const subordinateDetails = selection.availableSubordinates.map((alias) => {
          try {
            const sub = getResourceProfile(alias, this.rootDir);
            return `  - @${alias} (${sub.label}): ${sub.tier} tier, ${sub.maxContextTokens ?? "?"} ctx, model: ${sub.defaultModel}`;
          } catch {
            return `  - @${alias}: unknown`;
          }
        });
        extraContextBlocks.push([
          "## Sub-Orchestrator Delegation",
          `You are operating as a sub-orchestrator for this task. You have been delegated this complex assignment by the primary orchestrator (@${this.resolveOrchestratorAlias()}).`,
          "You may coordinate the following subordinate agent resources to help complete this task:",
          ...subordinateDetails,
          "",
          "Use these subordinates for structured, indexing, and smaller sub-tasks while you handle reasoning, coordination, and synthesis.",
          "Report your final result clearly. The primary orchestrator will integrate your output."
        ].join("\n"));
      }

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
        dailySessionContext: this.getDailySessionContext(),
        weatherEnabled: this.isWeatherEnabled()
      });

      this.emitTaskEvent({
        type: "task-start",
        taskId: task.id,
        resourceAlias: selection.alias,
        model: endpoint.model,
        taskContent: task.content
      });

      let rawReply: string;
      let modelEvalCount = 0;
      try {
        const modelResult = await this.callModel({
          scope: "auto.task",
          actor: "orchestrator",
          endpoint,
          resourceAlias: selection.alias,
          target: `task:${task.id}`,
          messages: outgoingMessages,
          summary: `Processing auto task #${task.id}.`,
          abortSignal: this.autoCycleAbort?.signal
        });
        rawReply = modelResult.text;
        modelEvalCount = modelResult.evalCount ?? 0;
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
        // When auto mode is stopped, abort errors are expected — return the
        // task to the queue silently instead of quarantining it.
        if ((error as Error).name === "AbortError") {
          task.status = "queued";
          return {
            lines: [`Auto task #${task.id} cancelled (auto mode stopped).`],
            errors: [],
            shouldExit: false
          };
        }
        const errorMessage = (error as Error).message;
        const recovery = await this.quarantineFailedAutoTask({
          task,
          remaining: this.systemState.auto.pending.filter(t => t.id !== task.id),
          assignedResource: selection.alias,
          assignedModel: endpoint.model,
          errorMessage,
          createRecoveryTask: !this.isSafeModeRecoveryTask(task),
          startedAt: taskStartedAt,
          taskStartMs
        });
        this.emitTaskEvent({
          type: "task-complete",
          taskId: task.id,
          resourceAlias: selection.alias,
          status: "failed",
          qualitySignals: null,
          durationMs: Date.now() - taskStartMs,
          tokenCount: 0
        });
        if (recovery.retried) {
          return {
            lines: [`Auto task #${task.id} failed on @${this.toDisplayResourceAlias(selection.alias)}: ${errorMessage}. Retrying on another resource.`],
            errors: [],
            shouldExit: false
          };
        }
        return {
          lines: recovery.recoveryTask
            ? [
                `Quarantined failed auto task #${task.id} and queued safe mode recovery task #${recovery.recoveryTask.id}.`
              ]
            : [`Quarantined failed safe mode recovery task #${task.id}.`],
          errors: [`Auto task #${task.id} failed on @${this.toDisplayResourceAlias(selection.alias)} (${endpoint.baseUrl}): ${errorMessage}`],
          shouldExit: false
        };
      }

      const parsed = parseQueuedTasks(rawReply);
      const replyText = parsed.replyText || "(No direct result text.)";
      const postProcessErrors: string[] = [];
      let writtenFiles: string[] = [];
      let writeDetails: Array<{ stage: "active" | "outbox" | "internal"; path: string; verified: boolean }> = [];
      try {
        const writeResult = await this.handleGeneratedFileWrites(parsed.fileDirectives, {
          createdBy: task.createdBy,
          taskId: task.id,
          sourceDocumentRelativePath: task.sourceDocumentRelativePath
        });
        writtenFiles = writeResult.lines;
        writeDetails = writeResult.writes;
      } catch (error) {
        postProcessErrors.push(`Dropbox write warning: ${(error as Error).message}`);
      }

      // Process any script requests from the auto task.
      let scriptLines: string[] = [];
      if (parsed.scriptRequests.length > 0) {
        try {
          const scriptResult = await this.handleScriptRequests(parsed.scriptRequests, {
            createdBy: task.createdBy,
            taskId: task.id,
          });
          scriptLines = scriptResult.lines;
        } catch (error) {
          postProcessErrors.push(`Script execution warning: ${(error as Error).message}`);
        }
      }

      const verifiedWriteCount = writtenFiles.length;
      const verification = verifyTaskOutput({
        task,
        output: replyText,
        preflightGoal,
        claimedWriteCount: parsed.fileDirectives.length,
        verifiedWriteCount,
        postProcessErrors
      });
      const taskCompletedAt = new Date().toISOString();
      const completedTask: AutoQueueTask = {
        ...task,
        status: verification.passed ? "completed" : "failed",
        startedAt: taskStartedAt,
        completedAt: taskCompletedAt,
        durationMs: Date.now() - taskStartMs,
        assignedResource: selection.alias,
        assignedModel: endpoint.model,
        result: replyText,
        qualityVerification: verification,
        ...(verification.passed
          ? {}
          : { errorMessage: `Task output verification failed: ${verification.reason}` })
      };

      this.systemState = {
        ...this.systemState,
        auto: {
          ...this.systemState.auto,
          pending: this.systemState.auto.pending.filter(t => t.id !== task.id),
          completed: [...this.systemState.auto.completed, completedTask].slice(
            -AUTO_COMPLETED_TASK_LIMIT
          ),
          totalCompletedCount: (this.systemState.auto.totalCompletedCount ?? 0) + 1
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

      // Auto-save daily work result: when a daily-work task completes successfully
      // and the model didn't emit a proper file directive for daily-work.md,
      // save the result directly to daily-work.md to prevent re-queuing loop.
      if (
        completedTask.createdBy === "orchestrator:daily-work" &&
        completedTask.status === "completed" &&
        completedTask.result
      ) {
        const alreadyWrote = writeDetails.some(
          (w) => w.path === "daily-work.md" || w.path.endsWith("/daily-work.md")
        );
        if (!alreadyWrote) {
          try {
            await saveDailyWork(completedTask.result, this.rootDir);
          } catch {
            // Non-fatal — the staleness dedup will still prevent loops.
          }
        }
      }

      const queuedResult = verification.passed
        ? await this.queueParsedTasks(parsed.queuedTasks, "orchestrator:auto-processed", {
            parentTaskId: completedTask.id,
            parentResultSummary: completedTask.result
          })
        : {
            tasks: [],
            notes: [
              `Suppressed ${parsed.queuedTasks.length} follow-up task${parsed.queuedTasks.length === 1 ? "" : "s"} because task #${completedTask.id} failed quality verification.`
            ]
          };
      const queued = queuedResult.tasks;
      for (const write of writeDetails) {
        this.emitTaskEvent({
          type: "task-write",
          taskId: task.id,
          stage: write.stage,
          path: write.path,
          verified: write.verified
        });
      }

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
        `${verification.passed ? "Completed" : "Failed"} auto task #${task.id} on ${this.formatResourceRoutingTarget(selection.alias, endpoint.model)}. Queued ${queued.length} follow-up task${queued.length === 1 ? "" : "s"} and wrote ${writtenFiles.length} file${writtenFiles.length === 1 ? "" : "s"}.`,
        this.rootDir
      );

      // Check whether the model signaled daily work complete.
      let dailyDigestLine: string | null = null;
      if (/^DAILY_COMPLETE\s*$/m.test(rawReply)) {
        dailyDigestLine = await this.finishDailyWork();
      }
      this.emitTaskEvent({
        type: "task-complete",
        taskId: completedTask.id,
        resourceAlias: selection.alias,
        status: completedTask.status === "failed" ? "failed" : "completed",
        qualitySignals: completedTask.qualityVerification?.signals ?? null,
        durationMs: completedTask.durationMs ?? 0,
        tokenCount: modelEvalCount
      });

      return {
        lines: [
          `${this.getOrchestratorName()} ${verification.passed ? "completed" : "failed"} #${task.id} [${task.priority}]${task.delegationRole ? ` {${task.delegationRole}}` : ""} via ${this.formatResourceRoutingTarget(selection.alias, endpoint.model)}.`,
          replyText,
          ...(verification.passed ? [] : [`Verification: ${verification.reason}`]),
          ...(routingFallbackWarning ? [routingFallbackWarning] : []),
          ...writtenFiles,
          ...scriptLines,
          ...queuedResult.notes,
          ...(movedSourceLine ? [movedSourceLine] : []),
          ...queued.map(
            (queuedTask) =>
              `Queued #${queuedTask.id} [${queuedTask.priority}]${queuedTask.delegationRole ? ` {${queuedTask.delegationRole}}` : ""}${
                this.formatRequestedResource(queuedTask.requestedResource)
              }${queuedTask.requestedModel ? `/${queuedTask.requestedModel}` : ""}: ${queuedTask.content}`
          ),
          ...(dailyDigestLine ? [dailyDigestLine] : [])
        ],
        errors: postProcessErrors,
        shouldExit: false
      };
    } finally {
      if (activeResourceAlias) {
        this.activeTasksByResource.delete(activeResourceAlias);
        this.setResourceActiveModel(activeResourceAlias, null);
        this.pushDisplayState();
      }
      this.processingTaskIds.delete(task.id);
    }
  }

  async runIdleCycle(): Promise<CommandResult> {
    if (!this.isAutoMode()) {
      return {
        lines: [],
        errors: [],
        shouldExit: false
      };
    }

    // Background health poll — check resource liveness on a 5-minute timer.
    if (Date.now() - this.lastHealthPollAt >= LocalCrewApp.HEALTH_POLL_INTERVAL_MS) {
      try {
        await this.runHealthPoll();
      } catch {
        // Health poll is best-effort, never block task processing.
      }
    }

    try {
      return await this.runAutoCycleLocked(async () => {
        // Front-load daily work generation when the document is stale or missing.
        if (this.systemState.auto.pending.length === 0) {
          const intervalMs = parseDailyWorkIntervalMs(this.config.preferences?.dailyWorkIntervalHours);
          const stale = await isDailyWorkStale(this.rootDir, intervalMs);
          const dateSlug = new Date().toISOString().slice(0, 10);
          if (stale && this.lastDailyWorkQueuedDate !== dateSlug) {
            const taskContent = buildDailyWorkTaskContent(dateSlug);
            // Check if we already have a daily-work task in pending or recently completed.
            const alreadyQueued = this.systemState.auto.pending.some(
              (t) => t.content.includes("Daily Work briefing")
            );
            const recentlyCompleted = this.systemState.auto.completed.some(
              (t) => t.createdBy === "orchestrator:daily-work" && t.status === "completed"
                && t.completedAt && t.completedAt.startsWith(dateSlug)
            );
            if (!alreadyQueued && !recentlyCompleted) {
              const queued = await this.queueParsedTasks(
                [{ priority: "high", content: taskContent, requestedResource: undefined }],
                "orchestrator:daily-work"
              );
              if (queued.tasks.length > 0) {
                this.lastDailyWorkQueuedDate = dateSlug;
                return {
                  lines: [
                    `Daily work document is stale — queued high-priority refresh task #${queued.tasks[0].id}.`,
                    ...queued.notes
                  ],
                  errors: [],
                  shouldExit: false
                };
              }
            }
          }
        }

        // Process a pending task first so concurrent cycles pick up work
        // immediately, then top-up afterwards to keep the queue full.
        const processedLines: string[] = [];
        const processedErrors: string[] = [];
        let taskProcessed = false;
        if (this.systemState.auto.pending.length > 0) {
          const processed = await this.processNextAutoTask();
          processedLines.push(...processed.lines);
          processedErrors.push(...processed.errors);
          taskProcessed = processed.lines.length > 0;
        }

        // Top-up: whenever the queue is below desired capacity, try to
        // ingest inbox documents or fill with generated tasks.
        // Skip top-up entirely if auto mode was stopped mid-cycle.
        const belowCapacity = this.isAutoMode() && this.systemState.auto.pending.length < this.getDesiredPendingDepth();
        const topUpLines: string[] = [];
        if (belowCapacity) {
          const ingested = await this.ingestNextInboxDocumentTask();
          if (ingested) {
            topUpLines.push(`Ingested inbox document ${ingested.relativePath} and queued #${ingested.task.id}.`);
          }

          // Still below capacity after inbox ingestion? Generate tasks.
          if (this.systemState.auto.pending.length < this.getDesiredPendingDepth()) {
            const filled = await this.fillAutoQueue();
            if (filled.queued.length > 0 || filled.notes.length > 0) {
              topUpLines.push(
                `${this.getOrchestratorName()} topped up the queue with ${filled.queued.length} task${filled.queued.length === 1 ? "" : "s"}.`,
                ...filled.notes,
                ...filled.queued.map((task) => `Queued #${task.id} [${task.priority}]: ${task.content}`)
              );
            }
          }
        }

        // If we top-upped but haven't processed a task yet (queue was empty
        // before top-up), process one of the newly added tasks now.
        if (!taskProcessed && this.systemState.auto.pending.length > 0) {
          const processed = await this.processNextAutoTask();
          processedLines.push(...processed.lines);
          processedErrors.push(...processed.errors);
        }

        // Nothing happened — no tasks processed and no top-up occurred.
        if (processedLines.length === 0 && topUpLines.length === 0) {
          return { lines: [], errors: processedErrors, shouldExit: false };
        }

        return {
          lines: [...topUpLines, ...processedLines],
          errors: processedErrors,
          shouldExit: false
        };
      });
    } catch (error) {
      // AbortError from /stop cancellation is expected — exit silently.
      if ((error as Error).name === "AbortError") {
        return { lines: [], errors: [], shouldExit: false };
      }
      let recoveryLine: string | undefined;
      if (this.systemState.auto.pending.length > 0) {
        const [task, ...remaining] = this.sortPendingTasks(
          this.systemState.auto.pending.filter(t => !this.processingTaskIds.has(t.id))
        );
        const recovery = await this.quarantineFailedAutoTask({
          task,
          remaining,
          errorMessage: `Unexpected auto-cycle exception: ${(error as Error).message}`,
          createRecoveryTask: !this.isSafeModeRecoveryTask(task)
        });
        recoveryLine = recovery.retried
          ? `Task #${task.id} will be retried on another resource after auto-cycle exception.`
          : recovery.recoveryTask
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
      const endpoint = this.getOperationalEndpointForTask(
        orchestratorAlias,
        "reasoning",
        normalizedAnswers.mission
      );
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

      if (command.type === "help.topic") {
        return {
          lines: this.getHelpTopic(command.topic),
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
        const existingSession = this.portalSession;

        if (!command.token) {
          return {
            lines: [
              `Open ${PORTAL_BASE_URL}/port/ in your browser and sign in.`,
              "Click 'Connect Local Crew' to generate a device token.",
              "Then run: /login <token>",
              ...(existingSession
                ? [
                    this.isPortalSessionExpired(existingSession)
                      ? `Stored portal session expired${existingSession.expiresAt ? ` at ${existingSession.expiresAt}` : ""}.`
                      : `Currently connected as orchestrator ${existingSession.orchestratorId}.`
                  ]
                : [])
            ],
            errors: [],
            shouldExit: false
          };
        }

        try {
          const result = await validateDeviceToken(
            command.token,
            {
              orchestratorName: this.getOrchestratorName(),
              capacitySummary: getResourceCapacitySummary(this.rootDir),
            },
            this.fetchFn ?? fetch
          );
          const session = { ...result, connectedAt: new Date().toISOString() };
          await savePortalSession(this.rootDir, session);
          this.portalSession = session;
          await pushSnapshot(session, this.buildPortalSnapshot(), this.fetchFn ?? fetch);
          return {
            lines: [
              `Connected to Local Crew Portal (orchestrator: ${result.orchestratorId}).`,
              `View your HUD at ${PORTAL_BASE_URL}/port/`,
            ],
            errors: [],
            shouldExit: false
          };
        } catch (error) {
          return {
            lines: [],
            errors: [
              `Portal login failed: ${error instanceof Error ? error.message : String(error)}`
            ],
            shouldExit: false
          };
        }
      }

      if (command.type === "port.status") {
        return {
          lines: this.getPortStatusLines(),
          errors: [],
          shouldExit: false
        };
      }

      if (command.type === "port.feed") {
        if (!this.portalSession) {
          return {
            lines: [],
            errors: [`Port is not connected. Open ${PORTAL_BASE_URL}/port/ and run /login <token>.`],
            shouldExit: false
          };
        }

        if (this.isPortalSessionExpired()) {
          return {
            lines: [],
            errors: [`Port session expired. Open ${PORTAL_BASE_URL}/port/ and run /login <token>.`],
            shouldExit: false
          };
        }

        try {
          const result = await fetchPortLogs(
            this.portalSession,
            {
              feed: command.feed,
              section: command.section,
              limit: 8,
            },
            this.fetchFn ?? fetch
          );

          return {
            lines: this.formatPortFeedLines(result),
            errors: [],
            shouldExit: false
          };
        } catch (error) {
          return {
            lines: [],
            errors: [`Port feed failed: ${error instanceof Error ? error.message : String(error)}`],
            shouldExit: false
          };
        }
      }

      if (command.type === "port.post") {
        if (!this.portalSession) {
          return {
            lines: [],
            errors: [`Port is not connected. Open ${PORTAL_BASE_URL}/port/ and run /login <token>.`],
            shouldExit: false
          };
        }

        if (this.isPortalSessionExpired()) {
          return {
            lines: [],
            errors: [`Port session expired. Open ${PORTAL_BASE_URL}/port/ and run /login <token>.`],
            shouldExit: false
          };
        }

        try {
          const result = await publishPortLog(
            this.portalSession,
            {
              content: command.content,
              ...(command.audience ? { audience: command.audience } : {}),
              ...(command.section ? { section: command.section } : {})
            },
            this.fetchFn ?? fetch
          );

          const createdLog = result.log;
          const audienceLabel = createdLog?.audience ? this.formatPortAudienceLabel(createdLog.audience) : "default audience";
          const sectionLabel = createdLog?.section ? this.formatPortSectionLabel(createdLog.section) : "general";

          return {
            lines: [
              `Published Port Log ${createdLog?.id ?? "(pending id)"} to ${audienceLabel} / ${sectionLabel}.`,
              ...(typeof result.community?.tokenBalance === "number"
                ? [`Remaining token balance: ${result.community.tokenBalance}.`]
                : []),
            ],
            errors: [],
            shouldExit: false
          };
        } catch (error) {
          return {
            lines: [],
            errors: [`Port publish failed: ${error instanceof Error ? error.message : String(error)}`],
            shouldExit: false
          };
        }
      }

      if (command.type === "port.reply") {
        if (!this.portalSession) {
          return {
            lines: [],
            errors: [`Port is not connected. Open ${PORTAL_BASE_URL}/port/ and run /login <token>.`],
            shouldExit: false
          };
        }

        if (this.isPortalSessionExpired()) {
          return {
            lines: [],
            errors: [`Port session expired. Open ${PORTAL_BASE_URL}/port/ and run /login <token>.`],
            shouldExit: false
          };
        }

        try {
          const result = await publishPortLog(
            this.portalSession,
            {
              parentId: command.logId,
              content: command.content,
            },
            this.fetchFn ?? fetch
          );

          return {
            lines: [
              `Replied to Port Log ${command.logId} with reply ${result.log?.id ?? "(pending id)"}.`,
              ...(typeof result.community?.tokenBalance === "number"
                ? [`Remaining token balance: ${result.community.tokenBalance}.`]
                : []),
            ],
            errors: [],
            shouldExit: false
          };
        } catch (error) {
          return {
            lines: [],
            errors: [`Port reply failed: ${error instanceof Error ? error.message : String(error)}`],
            shouldExit: false
          };
        }
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
        this.autoCycleAbort = new AbortController();
        this.runtime = {
          ...this.runtime,
          mode: "auto",
          currentAgent: undefined
        };
        // Auto-start a daily work session if none is active or if the calendar day has changed.
        const existingSession = this.systemState.auto.dailySession;
        const sessionDate = existingSession?.startedAt ? existingSession.startedAt.slice(0, 10) : null;
        const today = new Date().toISOString().slice(0, 10);
        const dailyStarted = !existingSession || Boolean(existingSession.completedAt) || sessionDate !== today;
        if (dailyStarted) {
          this.systemState = {
            ...this.systemState,
            auto: { ...this.systemState.auto, dailySession: startDailySession() }
          };
          await this.persistSystemState();
        }
        this.pushDisplayState();
        return {
          lines: [
            `Entered auto mode. Plain messages are queued at ${this.systemState.auto.defaultPriority} priority.`,
            `The background pulse will keep ${this.getOrchestratorName()} moving until /stop.`,
            ...(dailyStarted ? ["Daily work session started automatically."] : [])
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

        const inFlightCount = this.activeCycleCount;
        await this.stopAutoMode();
        const lines = ["Auto mode stopped."];
        if (inFlightCount > 0) {
          lines.push(
            `Cancelling ${inFlightCount} in-progress cycle${inFlightCount === 1 ? "" : "s"}… pending work will complete safely.`
          );
        }
        return {
          lines,
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
        const profileLabel = getModelProfile();
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
            `Current participant: @${this.runtime.currentEndpoint} (${endpoint.nickname}) using @${endpoint.resourceAlias}/${endpoint.model} [policy=${policyLabel}${purposeSuffix}] [profile=${profileLabel}]. Plain messages still go to @${this.config.defaultEndpoint}.`
          ],
          errors: [],
          shouldExit: false
        };
      }

      if (command.type === "model.profile.get") {
        return {
          lines: [`Model profile mode: ${getModelProfile()}.`],
          errors: [],
          shouldExit: false
        };
      }

      if (command.type === "model.profile.set") {
        try {
          setModelProfile(command.mode);
          this.config = setPreference(this.config, "modelProfile", command.mode);
          await this.persistConfig();
          return {
            lines: [`Model profile mode is now ${command.mode}.`],
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
        if (prefs.dailyWorkIntervalHours) lines.push(`  dailyWorkIntervalHours: ${prefs.dailyWorkIntervalHours}`);
        if (prefs.dailyWorkDirective) lines.push(`  dailyWorkDirective: ${prefs.dailyWorkDirective}`);
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
          if (!isOrchestratorCapable(resource)) {
            return {
              lines: [],
              errors: [
                `Resource @${resource.alias} is tier "${resource.tier}" with ${resource.maxContextTokens ?? 0} context tokens. Only top-tier resources with 16k+ context can be promoted to orchestrator.`
              ],
              shouldExit: false
            };
          }
          // Mark previous primary as regular orchestrator if different
          const previousAlias = this.resolveOrchestratorAlias();
          if (previousAlias !== command.alias) {
            try {
              const previous = getResourceProfile(previousAlias, this.rootDir);
              if (previous.resourceRole === "primary-orchestrator") {
                await updateResource(previousAlias, { ...previous, resourceRole: "orchestrator" }, this.rootDir);
              }
            } catch { /* previous resource may not exist */ }
          }
          // Set new primary
          await updateResource(command.alias, { ...resource, resourceRole: "primary-orchestrator" }, this.rootDir);
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

      if (command.type === "topology") {
        const topology = renderNetworkTopology(this.resolveOrchestratorAlias(), this.rootDir);
        return {
          lines: topology.split("\n"),
          errors: [],
          shouldExit: false
        };
      }

      if (command.type === "topology.assign") {
        try {
          const resource = getResourceProfile(command.alias, this.rootDir);
          if (command.role !== "agent" && !isOrchestratorCapable(resource)) {
            return {
              lines: [],
              errors: [
                `Resource @${resource.alias} does not meet orchestrator requirements (top tier, 16k+ context). Can only assign "agent" role.`
              ],
              shouldExit: false
            };
          }
          await updateResource(command.alias, { ...resource, resourceRole: command.role }, this.rootDir);
          await appendChangelogEntry(`Assigned resource role "${command.role}" to @${command.alias}.`, this.rootDir);
          return {
            lines: [`Resource @${command.alias} role set to "${command.role}".`],
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

      if (command.type === "topology.delegate") {
        try {
          const orchestratorResource = getResourceProfile(command.orchestratorAlias, this.rootDir);
          const agentResource = getResourceProfile(command.agentAlias, this.rootDir);
          const role = getEffectiveResourceRole(orchestratorResource, this.resolveOrchestratorAlias());
          if (role !== "orchestrator" && role !== "primary-orchestrator") {
            return {
              lines: [],
              errors: [`Resource @${command.orchestratorAlias} is not an orchestrator-capable resource (role: ${role}).`],
              shouldExit: false
            };
          }
          const subordinates = new Set(orchestratorResource.subordinateResources ?? []);
          subordinates.add(agentResource.alias);
          await updateResource(command.orchestratorAlias, {
            ...orchestratorResource,
            subordinateResources: [...subordinates]
          }, this.rootDir);
          await appendChangelogEntry(
            `Delegated @${command.agentAlias} as subordinate to @${command.orchestratorAlias}.`,
            this.rootDir
          );
          return {
            lines: [
              `@${command.agentAlias} is now a subordinate agent of @${command.orchestratorAlias}.`,
              `@${command.orchestratorAlias} can coordinate @${command.agentAlias} for complex tasks.`
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

      if (command.type === "topology.undelegate") {
        try {
          const orchestratorResource = getResourceProfile(command.orchestratorAlias, this.rootDir);
          const subordinates = new Set(orchestratorResource.subordinateResources ?? []);
          if (!subordinates.has(command.agentAlias)) {
            return {
              lines: [],
              errors: [`@${command.agentAlias} is not currently a subordinate of @${command.orchestratorAlias}.`],
              shouldExit: false
            };
          }
          subordinates.delete(command.agentAlias);
          await updateResource(command.orchestratorAlias, {
            ...orchestratorResource,
            subordinateResources: [...subordinates]
          }, this.rootDir);
          await appendChangelogEntry(
            `Removed @${command.agentAlias} as subordinate of @${command.orchestratorAlias}.`,
            this.rootDir
          );
          return {
            lines: [`@${command.agentAlias} is no longer a subordinate of @${command.orchestratorAlias}.`],
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
          if (this.isAutoBusy()) {
            return {
              lines: [],
              errors: ["Wait for the current auto cycle to finish before resetting the run state."],
              shouldExit: false
            };
          }
          await this.resetAutoRunState({
            keepAutoEnabled: true,
            resetTelemetry: true
          });
          return {
            lines: ["Auto run state reset."],
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

      // Server restart is handled at the REPL level (index.ts) since the
      // server lifecycle is not owned by LocalCrewApp.
      if (command.type === "restartServer") {
        return {
          lines: ["Server restart is handled at the REPL level."],
          errors: [],
          shouldExit: false
        };
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
