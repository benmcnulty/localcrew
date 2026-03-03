import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";

import {
  getEnvList,
  getEnvNumber,
  getEnvString,
  getOptionalEnvString,
  loadLocalEnv
} from "./env.ts";
import { atomicWriteFile, atomicWriteFileSync, getStoragePaths, withFileLock } from "./storage.ts";
import type { EndpointApiStyle, EndpointConfig, ModelProfileMode, ModelPurpose, ResourceRole } from "./types.ts";

export type ResourceTier = "top" | "mid" | "low";
export type ResourceApiStyle = EndpointApiStyle;

export interface ResourceProfile {
  alias: string;
  label: string;
  tier: ResourceTier;
  baseUrl: string;
  apiStyle?: ResourceApiStyle;
  apiKeyEnv?: string;
  deviceId?: string;
  hostName?: string;
  platform?: string;
  defaultModel: string;
  reasoningModel?: string;
  codingModel?: string;
  toolsModel?: string;
  embeddingModel?: string;
  role: string;
  capabilities: string[];
  notes: string[];
  cpuLogicalCores?: number;
  ramGb?: number;
  gpuModel?: string;
  gpuCount?: number;
  totalVramGb?: number;
  maxContextTokens?: number;
  availableModels?: string[];
  lastRefreshedAt?: string;
  endpointVersion?: string;
  /** Network orchestration role: primary-orchestrator, orchestrator, or agent. */
  resourceRole?: ResourceRole;
  /** Aliases of resources assigned as subordinates to this orchestrator-capable resource. */
  subordinateResources?: string[];
}

export interface ResourceCapacitySummary {
  resourceCount: number;
  knownCpuLogicalCores: number;
  knownRamGb: number;
  knownGpuCount: number;
  knownTotalVramGb: number;
  highestKnownContextTokens: number;
}

const RESOURCE_ALIAS_PATTERN = /^[a-z][a-z0-9_-]*$/;
let activeModelProfile: ModelProfileMode = "auto";

export function setModelProfile(mode: ModelProfileMode): void {
  activeModelProfile = mode;
}

export function getModelProfile(): ModelProfileMode {
  return activeModelProfile;
}

function findModelByFamily(profile: ResourceProfile, family: string): string | undefined {
  const lowerFamily = family.toLowerCase();
  const candidates = [
    profile.defaultModel,
    profile.reasoningModel,
    profile.codingModel,
    profile.toolsModel,
    ...(profile.availableModels ?? [])
  ].filter((candidate): candidate is string => Boolean(candidate && candidate.trim()));

  return candidates.find((candidate) => candidate.toLowerCase().startsWith(lowerFamily));
}

function getTier(value: string | undefined, fallback: ResourceTier): ResourceTier {
  return value === "top" || value === "mid" || value === "low" ? value : fallback;
}

function normalizeAlias(alias: string): string {
  return alias.trim().toLowerCase();
}

function normalizeApiStyle(value: unknown): ResourceApiStyle {
  if (value === "openai" || value === "anthropic") {
    return value;
  }

  return "ollama";
}

function getOptionalPositiveNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return value;
}

export function getOrchestratorResourceAlias(rootDir = process.cwd()): string {
  return normalizeAlias(getEnvString("LOCALCREW_ORCHESTRATOR_ALIAS", "orchestrator"));
}

function getDefaultLocalResource(rootDir = process.cwd()): ResourceProfile {
  loadLocalEnv(rootDir);
  const alias = getOrchestratorResourceAlias(rootDir);
  return {
    alias,
    label: getEnvString("LOCALCREW_ORCHESTRATOR_LABEL", "Local Crew"),
    tier: getTier(getOptionalEnvString("LOCALCREW_ORCHESTRATOR_TIER"), "top"),
    baseUrl: getEnvString("LOCALCREW_ORCHESTRATOR_BASE_URL", "http://127.0.0.1:11434"),
    apiStyle: normalizeApiStyle(getOptionalEnvString("LOCALCREW_ORCHESTRATOR_API_STYLE")),
    ...(getOptionalEnvString("LOCALCREW_ORCHESTRATOR_API_KEY_ENV")
      ? { apiKeyEnv: getOptionalEnvString("LOCALCREW_ORCHESTRATOR_API_KEY_ENV") }
      : {}),
    ...(getOptionalEnvString("LOCALCREW_ORCHESTRATOR_HOST_NAME")
      ? { hostName: getOptionalEnvString("LOCALCREW_ORCHESTRATOR_HOST_NAME") }
      : {}),
    ...(getOptionalEnvString("LOCALCREW_ORCHESTRATOR_PLATFORM")
      ? { platform: getOptionalEnvString("LOCALCREW_ORCHESTRATOR_PLATFORM") }
      : {}),
    defaultModel: getEnvString("LOCALCREW_ORCHESTRATOR_DEFAULT_MODEL", "llama3.1:8b"),
    ...(getOptionalEnvString("LOCALCREW_ORCHESTRATOR_REASONING_MODEL")
      ? { reasoningModel: getOptionalEnvString("LOCALCREW_ORCHESTRATOR_REASONING_MODEL") }
      : {}),
    ...(getOptionalEnvString("LOCALCREW_ORCHESTRATOR_CODING_MODEL")
      ? { codingModel: getOptionalEnvString("LOCALCREW_ORCHESTRATOR_CODING_MODEL") }
      : {}),
    ...(getOptionalEnvString("LOCALCREW_ORCHESTRATOR_TOOLS_MODEL")
      ? { toolsModel: getOptionalEnvString("LOCALCREW_ORCHESTRATOR_TOOLS_MODEL") }
      : {}),
    ...(getOptionalEnvString("LOCALCREW_ORCHESTRATOR_EMBEDDING_MODEL")
      ? { embeddingModel: getOptionalEnvString("LOCALCREW_ORCHESTRATOR_EMBEDDING_MODEL") }
      : {}),
    role: getEnvString(
      "LOCALCREW_ORCHESTRATOR_ROLE",
      "Primary orchestration resource for chat, planning, verification, and local artifact work."
    ),
    capabilities: getEnvList("LOCALCREW_ORCHESTRATOR_CAPABILITIES", [
      "reasoning",
      "planning",
      "chat",
      "code generation",
      "tool formatting",
      "embeddings"
    ]),
    notes: getEnvList("LOCALCREW_ORCHESTRATOR_NOTES", [
      "This is the first device a new user should bring online.",
      "Use the local setup script to confirm Ollama connectivity and seed the orchestrator profile.",
      "Bring additional agent devices online through the CLI or GUI once the orchestrator is stable."
    ]),
    ...(getEnvNumber("LOCALCREW_ORCHESTRATOR_CPU_LOGICAL_CORES", 0) > 0
      ? { cpuLogicalCores: getEnvNumber("LOCALCREW_ORCHESTRATOR_CPU_LOGICAL_CORES", 0) }
      : {}),
    ...(getEnvNumber("LOCALCREW_ORCHESTRATOR_RAM_GB", 0) > 0
      ? { ramGb: getEnvNumber("LOCALCREW_ORCHESTRATOR_RAM_GB", 0) }
      : {}),
    ...(getOptionalEnvString("LOCALCREW_ORCHESTRATOR_GPU_MODEL")
      ? { gpuModel: getOptionalEnvString("LOCALCREW_ORCHESTRATOR_GPU_MODEL") }
      : {}),
    ...(getEnvNumber("LOCALCREW_ORCHESTRATOR_GPU_COUNT", 0) > 0
      ? { gpuCount: getEnvNumber("LOCALCREW_ORCHESTRATOR_GPU_COUNT", 0) }
      : {}),
    ...(getEnvNumber("LOCALCREW_ORCHESTRATOR_TOTAL_VRAM_GB", 0) > 0
      ? { totalVramGb: getEnvNumber("LOCALCREW_ORCHESTRATOR_TOTAL_VRAM_GB", 0) }
      : {}),
    ...(getEnvNumber("LOCALCREW_ORCHESTRATOR_MAX_CONTEXT_TOKENS", 0) > 0
      ? { maxContextTokens: getEnvNumber("LOCALCREW_ORCHESTRATOR_MAX_CONTEXT_TOKENS", 0) }
      : {})
  };
}

function normalizeResource(alias: string, value: unknown): ResourceProfile {
  if (!value || typeof value !== "object") {
    throw new Error(`Resource "${alias}" must be an object.`);
  }

  const candidate = value as Partial<ResourceProfile>;
  const normalizedAlias = normalizeAlias(alias);
  if (!RESOURCE_ALIAS_PATTERN.test(normalizedAlias)) {
    throw new Error(`Resource alias "${alias}" is invalid.`);
  }

  if (typeof candidate.label !== "string" || candidate.label.trim() === "") {
    throw new Error(`Resource "${alias}" is missing a valid label.`);
  }

  if (typeof candidate.baseUrl !== "string" || candidate.baseUrl.trim() === "") {
    throw new Error(`Resource "${alias}" is missing a valid baseUrl.`);
  }

  if (typeof candidate.defaultModel !== "string" || candidate.defaultModel.trim() === "") {
    throw new Error(`Resource "${alias}" is missing a valid defaultModel.`);
  }

  if (typeof candidate.role !== "string" || candidate.role.trim() === "") {
    throw new Error(`Resource "${alias}" is missing a valid role.`);
  }

  return {
    alias: normalizedAlias,
    label: candidate.label.trim(),
    tier: getTier(candidate.tier, "mid"),
    baseUrl: candidate.baseUrl.trim(),
    apiStyle: normalizeApiStyle(candidate.apiStyle),
    ...(typeof candidate.apiKeyEnv === "string" && candidate.apiKeyEnv.trim() !== ""
      ? { apiKeyEnv: candidate.apiKeyEnv.trim() }
      : {}),
    ...(typeof candidate.deviceId === "string" && candidate.deviceId.trim() !== ""
      ? { deviceId: candidate.deviceId.trim() }
      : {}),
    ...(typeof candidate.hostName === "string" && candidate.hostName.trim() !== ""
      ? { hostName: candidate.hostName.trim() }
      : {}),
    ...(typeof candidate.platform === "string" && candidate.platform.trim() !== ""
      ? { platform: candidate.platform.trim() }
      : {}),
    defaultModel: candidate.defaultModel.trim(),
    ...(typeof candidate.reasoningModel === "string" && candidate.reasoningModel.trim() !== ""
      ? { reasoningModel: candidate.reasoningModel.trim() }
      : {}),
    ...(typeof candidate.codingModel === "string" && candidate.codingModel.trim() !== ""
      ? { codingModel: candidate.codingModel.trim() }
      : {}),
    ...(typeof candidate.toolsModel === "string" && candidate.toolsModel.trim() !== ""
      ? { toolsModel: candidate.toolsModel.trim() }
      : {}),
    ...(typeof candidate.embeddingModel === "string" && candidate.embeddingModel.trim() !== ""
      ? { embeddingModel: candidate.embeddingModel.trim() }
      : {}),
    role: candidate.role.trim(),
    capabilities: Array.isArray(candidate.capabilities)
      ? candidate.capabilities.filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "")
      : [],
    notes: Array.isArray(candidate.notes)
      ? candidate.notes.filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "")
      : [],
    ...(getOptionalPositiveNumber(candidate.cpuLogicalCores)
      ? { cpuLogicalCores: getOptionalPositiveNumber(candidate.cpuLogicalCores) }
      : {}),
    ...(getOptionalPositiveNumber(candidate.ramGb)
      ? { ramGb: getOptionalPositiveNumber(candidate.ramGb) }
      : {}),
    ...(typeof candidate.gpuModel === "string" && candidate.gpuModel.trim() !== ""
      ? { gpuModel: candidate.gpuModel.trim() }
      : {}),
    ...(getOptionalPositiveNumber(candidate.gpuCount)
      ? { gpuCount: getOptionalPositiveNumber(candidate.gpuCount) }
      : {}),
    ...(getOptionalPositiveNumber(candidate.totalVramGb)
      ? { totalVramGb: getOptionalPositiveNumber(candidate.totalVramGb) }
      : {}),
    ...(getOptionalPositiveNumber(candidate.maxContextTokens)
      ? { maxContextTokens: getOptionalPositiveNumber(candidate.maxContextTokens) }
      : {}),
    ...(Array.isArray(candidate.availableModels)
      ? {
          availableModels: candidate.availableModels.filter(
            (entry): entry is string => typeof entry === "string" && entry.trim() !== ""
          )
        }
      : {}),
    ...(typeof candidate.lastRefreshedAt === "string" && candidate.lastRefreshedAt.trim() !== ""
      ? { lastRefreshedAt: candidate.lastRefreshedAt.trim() }
      : {}),
    ...(typeof candidate.endpointVersion === "string" && candidate.endpointVersion.trim() !== ""
      ? { endpointVersion: candidate.endpointVersion.trim() }
      : {}),
    ...(candidate.resourceRole === "primary-orchestrator" ||
      candidate.resourceRole === "orchestrator" ||
      candidate.resourceRole === "agent"
      ? { resourceRole: candidate.resourceRole }
      : {}),
    ...(Array.isArray(candidate.subordinateResources)
      ? {
          subordinateResources: candidate.subordinateResources.filter(
            (entry): entry is string => typeof entry === "string" && entry.trim() !== ""
          )
        }
      : {})
  };
}

function normalizeResources(raw: unknown, rootDir = process.cwd()): Record<string, ResourceProfile> {
  if (!raw || typeof raw !== "object") {
    return { [getDefaultLocalResource(rootDir).alias]: getDefaultLocalResource(rootDir) };
  }

  const parsed = raw as { resources?: unknown };
  const rawResources =
    parsed.resources && typeof parsed.resources === "object"
      ? (parsed.resources as Record<string, unknown>)
      : {};

  const resources = Object.fromEntries(
    Object.entries(rawResources).map(([alias, resource]) => [
      normalizeAlias(alias),
      normalizeResource(alias, resource)
    ])
  );

  if (Object.keys(resources).length === 0) {
    const defaultResource = getDefaultLocalResource(rootDir);
    return { [defaultResource.alias]: defaultResource };
  }

  return resources;
}

// In-memory cache to avoid repeated sync disk reads in hot paths.
// Populated by loadResources(), invalidated by save/add/update/remove.
let cachedResources: Record<string, ResourceProfile> | null = null;
let cachedRootDir: string | null = null;

export async function saveResources(
  resources: Record<string, ResourceProfile>,
  rootDir = process.cwd()
): Promise<void> {
  const paths = getStoragePaths(rootDir);
  await mkdir(paths.storageDir, { recursive: true });
  await atomicWriteFile(paths.resourcesPath, `${JSON.stringify({ resources }, null, 2)}\n`);
  cachedResources = resources;
  cachedRootDir = rootDir;
}

export function loadResources(rootDir = process.cwd()): Record<string, ResourceProfile> {
  if (cachedResources !== null && cachedRootDir === rootDir) {
    return cachedResources;
  }

  loadLocalEnv(rootDir);
  const paths = getStoragePaths(rootDir);
  mkdirSync(paths.storageDir, { recursive: true });

  if (!existsSync(paths.resourcesPath)) {
    const defaultResource = getDefaultLocalResource(rootDir);
    const resources = { [defaultResource.alias]: defaultResource };
    atomicWriteFileSync(paths.resourcesPath, `${JSON.stringify({ resources }, null, 2)}\n`);
    cachedResources = resources;
    cachedRootDir = rootDir;
    return resources;
  }

  try {
    const parsed = JSON.parse(readFileSync(paths.resourcesPath, "utf8"));
    const resources = normalizeResources(parsed, rootDir);
    cachedResources = resources;
    cachedRootDir = rootDir;
    return resources;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Resources file is not valid JSON: ${error.message}`);
    }

    throw error;
  }
}

/**
 * Async version of loadResources — uses non-blocking I/O.
 * Prefer this in non-hot-path code (startup, API handlers).
 */
export async function loadResourcesAsync(rootDir = process.cwd()): Promise<Record<string, ResourceProfile>> {
  if (cachedResources !== null && cachedRootDir === rootDir) {
    return cachedResources;
  }

  loadLocalEnv(rootDir);
  const paths = getStoragePaths(rootDir);
  await mkdir(paths.storageDir, { recursive: true });

  try {
    const raw = await readFile(paths.resourcesPath, "utf8");
    const parsed = JSON.parse(raw);
    const resources = normalizeResources(parsed, rootDir);
    cachedResources = resources;
    cachedRootDir = rootDir;
    return resources;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      const defaultResource = getDefaultLocalResource(rootDir);
      const resources = { [defaultResource.alias]: defaultResource };
      await atomicWriteFile(paths.resourcesPath, `${JSON.stringify({ resources }, null, 2)}\n`);
      cachedResources = resources;
      cachedRootDir = rootDir;
      return resources;
    }

    if (error instanceof SyntaxError) {
      throw new Error(`Resources file is not valid JSON: ${error.message}`);
    }

    throw error;
  }
}

/** Invalidate the in-memory resource cache (e.g., after external changes). */
export function invalidateResourceCache(): void {
  cachedResources = null;
  cachedRootDir = null;
}

export function listResources(rootDir = process.cwd()): ResourceProfile[] {
  return Object.values(loadResources(rootDir)).sort((left, right) => left.alias.localeCompare(right.alias));
}

export async function addResource(
  resource: Omit<ResourceProfile, "alias"> & { alias: string },
  rootDir = process.cwd()
): Promise<ResourceProfile> {
  const paths = getStoragePaths(rootDir);
  return withFileLock(paths.resourcesPath, async () => {
    const resources = await loadResourcesAsync(rootDir);
    const alias = normalizeAlias(resource.alias);
    if (!RESOURCE_ALIAS_PATTERN.test(alias)) {
      throw new Error(`Invalid resource alias "${resource.alias}".`);
    }
    if (resources[alias]) {
      throw new Error(`Resource "${alias}" already exists.`);
    }

    const normalized = normalizeResource(alias, resource);
    await saveResources({ ...resources, [alias]: normalized }, rootDir);
    return normalized;
  });
}

export async function updateResource(
  alias: string,
  resource: ResourceProfile,
  rootDir = process.cwd()
): Promise<ResourceProfile> {
  const paths = getStoragePaths(rootDir);
  return withFileLock(paths.resourcesPath, async () => {
    const resources = await loadResourcesAsync(rootDir);
    const normalizedAlias = normalizeAlias(alias);
    if (!resources[normalizedAlias]) {
      throw new Error(`Unknown resource "${alias}".`);
    }

    const normalized = normalizeResource(normalizedAlias, resource);
    await saveResources({ ...resources, [normalizedAlias]: normalized }, rootDir);
    return normalized;
  });
}

export async function removeResource(alias: string, rootDir = process.cwd()): Promise<void> {
  const paths = getStoragePaths(rootDir);
  return withFileLock(paths.resourcesPath, async () => {
    const resources = await loadResourcesAsync(rootDir);
    const normalizedAlias = normalizeAlias(alias);
    if (!resources[normalizedAlias]) {
      throw new Error(`Unknown resource "${alias}".`);
    }
    if (Object.keys(resources).length === 1) {
      throw new Error("At least one resource must remain configured.");
    }
    const next = { ...resources };
    delete next[normalizedAlias];
    await saveResources(next, rootDir);
  });
}

export function selectModel(
  profile: ResourceProfile,
  purpose: "default" | "reasoning" | "coding" | "tools"
): string {
  if (activeModelProfile === "all-llamas") {
    const llamaModel = findModelByFamily(profile, "llama");
    if (!llamaModel) {
      throw new Error(`Model profile all-llamas requires a llama model on @${profile.alias}.`);
    }
    return llamaModel;
  }

  if (purpose === "coding" && profile.codingModel) {
    return profile.codingModel;
  }

  if (purpose === "reasoning" && profile.reasoningModel) {
    return profile.reasoningModel;
  }

  if (purpose === "tools" && profile.toolsModel) {
    return profile.toolsModel;
  }

  return profile.defaultModel;
}

export function getResourceProfile(alias: string, rootDir = process.cwd()): ResourceProfile {
  const profile = loadResources(rootDir)[normalizeAlias(alias)];
  if (!profile) {
    throw new Error(`Unknown resource "${alias}".`);
  }
  return profile;
}

export function getResourceEndpoint(
  alias: string,
  purpose: "default" | "reasoning" | "coding" | "tools" = "default",
  rootDir = process.cwd()
): EndpointConfig {
  const profile = getResourceProfile(alias, rootDir);

  return {
    resourceAlias: profile.alias,
    nickname: profile.label,
    baseUrl: profile.baseUrl,
    apiStyle: profile.apiStyle ?? "ollama",
    ...(profile.apiKeyEnv ? { apiKeyEnv: profile.apiKeyEnv } : {}),
    model: selectModel(profile, purpose),
    instructions: "",
    voicePreset: ""
  };
}

/**
 * Classify a message or task description into a model purpose.
 * Uses the same regex heuristics as `chooseResourceForTask()`.
 */
export function detectTaskPurpose(text: string): ModelPurpose {
  const normalized = text.toLowerCase();

  if (
    /\b(code|patch|refactor|typescript|node|bun|test|bug|implement|diff|compile|fix)\b/.test(
      normalized
    )
  ) {
    return "coding";
  }

  if (
    /\b(json|queue|route|router|classify|index|memory|tag|organize|metadata|changelog|todo|log|inventory|benchmark result|summary table)\b/.test(
      normalized
    )
  ) {
    return "tools";
  }

  if (
    /\b(reason|think|explain|why|analyze|compare|evaluate|critique|assess|debate|argue|logic|proof|math|calculate)\b/.test(
      normalized
    )
  ) {
    return "reasoning";
  }

  return "default";
}

/**
 * Select the best model for an endpoint given a detected purpose.
 * Checks endpoint purpose-specific slots first, then falls back to the
 * bound resource's purpose slots, then the endpoint's default model.
 */
export function selectModelForEndpoint(
  endpoint: EndpointConfig,
  purpose: ModelPurpose,
  rootDir = process.cwd()
): string {
  if (purpose === "coding" && endpoint.codingModel) return endpoint.codingModel;
  if (purpose === "reasoning" && endpoint.reasoningModel) return endpoint.reasoningModel;
  if (purpose === "tools" && endpoint.toolsModel) return endpoint.toolsModel;

  try {
    const resource = getResourceProfile(endpoint.resourceAlias, rootDir);
    const resourceModel = selectModel(resource, purpose);
    if (resourceModel !== resource.defaultModel) return resourceModel;
  } catch {
    // Resource binding not resolved — use endpoint default
  }

  return endpoint.model;
}

export interface TaskMetadata {
  taskId: number;
  content: string;
  tokenEstimate: number;
  taskType: "chat" | "reasoning" | "extraction" | "classification" | "planning" | "research";
  reasoningDepth: "low" | "medium" | "high";
  latencySensitive: boolean;
  requiresWebTools: boolean;
  requiresVision: boolean;
}

export interface ResourceTelemetry {
  queueDepth: number;
  ramUsagePct: number;
  tokensPerSecond: number;
  activeModel: string | null;
  avgQueueWaitMs: number;
  successRate: number;
  failureCount: number;
}

const SCORE_WEIGHTS = {
  availability: 0.4,
  memoryHeadroom: 0.3,
  capabilityMatch: 0.3
};

const MAX_QUEUE_DEPTH = 5;

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function estimateTokenCount(content: string): number {
  return Math.max(32, Math.ceil(content.length / 4));
}

function inferReasoningDepth(content: string, taskType: TaskMetadata["taskType"]): TaskMetadata["reasoningDepth"] {
  const normalized = content.toLowerCase();
  if (
    /\b(complex|multi[- ]?step|thorough|comprehensive|end[- ]?to[- ]?end|deep|architecture|tradeoff|benchmark|evaluate)\b/.test(
      normalized
    )
  ) {
    return "high";
  }

  if (taskType === "reasoning" || taskType === "planning" || /\b(analyze|compare|design|plan)\b/.test(normalized)) {
    return "medium";
  }

  return "low";
}

function inferTaskType(content: string): TaskMetadata["taskType"] {
  const normalized = content.toLowerCase();
  if (/\b(search|wikipedia|reddit|news|research|references|citations?)\b/.test(normalized)) {
    return "research";
  }
  if (/\b(classify|categorize|tag|label|triage)\b/.test(normalized)) {
    return "classification";
  }
  if (/\b(extract|parse|summarize table|json|index|metadata)\b/.test(normalized)) {
    return "extraction";
  }
  if (/\b(plan|roadmap|proposal|spec|draft|queue fill|orchestrate)\b/.test(normalized)) {
    return "planning";
  }
  if (/\b(reason|analyze|compare|evaluate|critique|assess|why)\b/.test(normalized)) {
    return "reasoning";
  }
  return "chat";
}

export function classifyTask(content: string): TaskMetadata {
  const taskType = inferTaskType(content);
  return {
    taskId: 0,
    content,
    tokenEstimate: estimateTokenCount(content),
    taskType,
    reasoningDepth: inferReasoningDepth(content, taskType),
    latencySensitive: /\b(urgent|asap|immediately|quick|fast)\b/i.test(content),
    requiresWebTools: /\b(search|wikipedia|reddit|web)\b/i.test(content),
    requiresVision: /\b(image|screenshot|diagram|vision)\b/i.test(content)
  };
}

function capabilityMatchScore(resource: ResourceProfile, task: TaskMetadata): number {
  if (task.reasoningDepth === "high" || task.tokenEstimate > 8000) {
    return resource.tier === "top" ? 1 : resource.tier === "mid" ? 0.6 : 0.3;
  }

  if (task.taskType === "classification" || task.taskType === "extraction") {
    return resource.tier === "low" ? 0.9 : resource.tier === "mid" ? 0.8 : 0.7;
  }

  if (task.taskType === "research") {
    if (resource.tier === "top") return 1;
    if (resource.tier === "mid") return 0.8;
    return 0.5;
  }

  if (task.taskType === "planning" || task.taskType === "reasoning") {
    return resource.tier === "top" ? 0.95 : resource.tier === "mid" ? 0.7 : 0.45;
  }

  return resource.tier === "low" ? 0.8 : resource.tier === "mid" ? 0.85 : 0.9;
}

export function computeResourceScore(
  resource: ResourceProfile,
  telemetry: ResourceTelemetry,
  task: TaskMetadata
): number {
  const availability = clamp01(1 - telemetry.queueDepth / MAX_QUEUE_DEPTH);
  const memoryHeadroom = clamp01(1 - telemetry.ramUsagePct / 100);
  const capabilityMatch = capabilityMatchScore(resource, task);

  return (
    SCORE_WEIGHTS.availability * availability +
    SCORE_WEIGHTS.memoryHeadroom * memoryHeadroom +
    SCORE_WEIGHTS.capabilityMatch * capabilityMatch
  );
}

export function routeTask(
  task: TaskMetadata,
  resources: ResourceProfile[],
  telemetry: Record<string, ResourceTelemetry>
): { resource: ResourceProfile; score: number; rationale: string } {
  if (resources.length === 0) {
    throw new Error("No resources are configured.");
  }

  const scored = resources.map((resource) => {
    const metrics = telemetry[resource.alias] ?? {
      queueDepth: 0,
      ramUsagePct: 0,
      tokensPerSecond: 0,
      activeModel: null,
      avgQueueWaitMs: 0,
      successRate: 1,
      failureCount: 0
    };
    const score = computeResourceScore(resource, metrics, task);
    return { resource, score };
  });

  scored.sort((left, right) => {
    if (left.score !== right.score) {
      return right.score - left.score;
    }
    return left.resource.alias.localeCompare(right.resource.alias);
  });

  const selected = scored[0];
  const rationale = `Scored ${selected.resource.alias} highest (${selected.score.toFixed(2)}) for ${task.taskType} work with ${task.reasoningDepth} reasoning depth.`;
  return {
    resource: selected.resource,
    score: selected.score,
    rationale
  };
}

function pickFirst(
  resources: ResourceProfile[],
  predicate: (profile: ResourceProfile) => boolean
): ResourceProfile | undefined {
  return resources.find(predicate);
}

function getResourceLoad(alias: string, resourceLoad: Record<string, number>): number {
  return resourceLoad[alias] ?? 0;
}

function pickLeastLoaded(
  resources: ResourceProfile[],
  resourceLoad: Record<string, number>,
  predicate?: (profile: ResourceProfile) => boolean
): ResourceProfile | undefined {
  const matches = predicate ? resources.filter(predicate) : [...resources];
  if (matches.length === 0) {
    return undefined;
  }

  return [...matches].sort((left, right) => {
    const leftLoad = getResourceLoad(left.alias, resourceLoad);
    const rightLoad = getResourceLoad(right.alias, resourceLoad);
    if (leftLoad !== rightLoad) {
      return leftLoad - rightLoad;
    }
    return left.alias.localeCompare(right.alias);
  })[0];
}

function pickHighestContext(
  resources: ResourceProfile[],
  resourceLoad: Record<string, number>,
  predicate?: (profile: ResourceProfile) => boolean
): ResourceProfile | undefined {
  const matches = predicate ? resources.filter(predicate) : [...resources];
  if (matches.length === 0) {
    return undefined;
  }

  return [...matches].sort((left, right) => {
    const leftContext = left.maxContextTokens ?? 0;
    const rightContext = right.maxContextTokens ?? 0;
    if (leftContext !== rightContext) {
      return rightContext - leftContext;
    }

    const leftLoad = getResourceLoad(left.alias, resourceLoad);
    const rightLoad = getResourceLoad(right.alias, resourceLoad);
    if (leftLoad !== rightLoad) {
      return leftLoad - rightLoad;
    }

    return left.alias.localeCompare(right.alias);
  })[0];
}

function sortForRouting(resources: ResourceProfile[]): ResourceProfile[] {
  const tierRank: Record<ResourceTier, number> = { top: 0, mid: 1, low: 2 };
  return [...resources].sort((left, right) => {
    if (tierRank[left.tier] !== tierRank[right.tier]) {
      return tierRank[left.tier] - tierRank[right.tier];
    }
    return left.alias.localeCompare(right.alias);
  });
}

export function chooseResourceForTask(
  task: string,
  preferredResource = "auto",
  rootDir = process.cwd(),
  options: {
    resourceLoad?: Record<string, number>;
    primaryOrchestratorAlias?: string;
  } = {}
): {
  alias: string;
  tier: ResourceTier;
  purpose: "default" | "reasoning" | "coding" | "tools";
  rationale: string;
  /** When set, this task should be delegated to the named sub-orchestrator. */
  delegateToOrchestrator?: string;
  /** Resources available as subordinates for the delegated orchestrator. */
  availableSubordinates?: string[];
} {
  const resourceLoad = options.resourceLoad ?? {};
  const resources = sortForRouting(listResources(rootDir));
  const telemetryByAlias: Record<string, ResourceTelemetry> = Object.fromEntries(
    resources.map((resource) => [
      resource.alias,
      {
        queueDepth: getResourceLoad(resource.alias, resourceLoad),
        ramUsagePct: 0,
        tokensPerSecond: 0,
        activeModel: null,
        avgQueueWaitMs: 0,
        successRate: 1,
        failureCount: 0
      }
    ])
  );
  const orchestratorAlias = options.primaryOrchestratorAlias ?? getOrchestratorResourceAlias(rootDir);
  const orchestrator = resources.find((profile) => profile.alias === orchestratorAlias) ?? resources[0];
  if (!orchestrator) {
    throw new Error("No resources are configured.");
  }

  if (preferredResource !== "auto") {
    const profile = getResourceProfile(preferredResource, rootDir);
    return {
      alias: profile.alias,
      tier: profile.tier,
      purpose: "default",
      rationale: `Preferred resource ${profile.alias} was requested explicitly. Current queued load on that resource is ${getResourceLoad(profile.alias, resourceLoad)}.`
    };
  }

  const normalizedTask = task.toLowerCase();
  const top = resources.filter((profile) => profile.tier === "top");
  const mid = resources.filter((profile) => profile.tier === "mid");
  const low = resources.filter((profile) => profile.tier === "low");
  const topAgent =
    pickLeastLoaded(top, resourceLoad, (profile) => profile.alias !== orchestrator.alias) ??
    pickLeastLoaded(top, resourceLoad);

  if (
    /\b(long context|large context|context window|wide context|big transcript|large transcript|long document|large document|many files|broad review)\b/.test(
      normalizedTask
    )
  ) {
    const selected =
      pickHighestContext(top, resourceLoad) ??
      pickHighestContext(resources, resourceLoad) ??
      orchestrator;
    return {
      alias: selected.alias,
      tier: selected.tier,
      purpose:
        selected.reasoningModel && selected.alias === orchestrator.alias ? "reasoning" : "default",
      rationale: `Selected ${selected.alias} for a context-heavy task using the highest known context budget while considering current queue load.`
    };
  }

  if (
    /\b(code|patch|refactor|typescript|node|bun|test|bug|implement|diff|compile|fix)\b/.test(
      normalizedTask
    )
  ) {
    const selected =
      pickLeastLoaded(top, resourceLoad, (profile) => Boolean(profile.codingModel)) ??
      pickLeastLoaded(resources, resourceLoad, (profile) => Boolean(profile.codingModel)) ??
      orchestrator;
    return {
      alias: selected.alias,
      tier: selected.tier,
      purpose: selected.codingModel ? "coding" : "reasoning",
      rationale: `Selected ${selected.alias} for code-heavy work using the strongest available coding or reasoning model with current queue load in mind.`
    };
  }

  if (
    /\b(draft|write|review|compare|analyze|analysis|outline|document|documentation|spec|proposal|synthesize)\b/.test(
      normalizedTask
    )
  ) {
    const selected = topAgent ?? orchestrator;
    return {
      alias: selected.alias,
      tier: selected.tier,
      purpose: "default",
      rationale: `Selected ${selected.alias} as the strongest available drafting resource without blocking the primary orchestrator unnecessarily, while preferring the least-loaded suitable top-tier node.`
    };
  }

  if (
    /\b(json|queue|route|router|classify|index|memory|tag|organize|metadata|changelog|todo|log|inventory|benchmark result|summary table)\b/.test(
      normalizedTask
    )
  ) {
    const selected =
      pickLeastLoaded(mid, resourceLoad, (profile) => Boolean(profile.toolsModel)) ??
      pickLeastLoaded(resources, resourceLoad, (profile) => Boolean(profile.toolsModel)) ??
      orchestrator;
    return {
      alias: selected.alias,
      tier: selected.tier,
      purpose: selected.toolsModel ? "tools" : "default",
      rationale: `Selected ${selected.alias} for structured routing, indexing, or bookkeeping work to preserve higher-tier reasoning capacity and keep idle helper nodes useful.`
    };
  }

  // Detect complex multi-step tasks that benefit from sub-orchestrator delegation
  if (
    /\b(multi[- ]?step|coordinate|orchestrate|delegate|complex|pipeline|workflow|end[- ]?to[- ]?end|comprehensive|thorough|parallel)\b/.test(
      normalizedTask
    )
  ) {
    const subOrchestrators = resources.filter(
      (profile) =>
        profile.alias !== orchestrator.alias &&
        getEffectiveResourceRole(profile, orchestratorAlias) === "orchestrator" &&
        getResourceLoad(profile.alias, resourceLoad) === 0
    );
    if (subOrchestrators.length > 0) {
      const selected = subOrchestrators[0];
      const subordinates = selected.subordinateResources ?? [];
      return {
        alias: selected.alias,
        tier: selected.tier,
        purpose: selected.reasoningModel ? "reasoning" : "default",
        rationale: `Delegating complex multi-step task to sub-orchestrator @${selected.alias} which can coordinate independently${subordinates.length > 0 ? ` with subordinates: ${subordinates.map((s) => `@${s}`).join(", ")}` : ""}.`,
        delegateToOrchestrator: selected.alias,
        availableSubordinates: subordinates
      };
    }
  }

  if (
    /\b(sanity check|small context|isolated|extract|format|rename|single|short|tiny|overflow|backup|simple)\b/.test(
      normalizedTask
    )
  ) {
    const selected =
      pickLeastLoaded(low, resourceLoad) ??
      pickLeastLoaded(mid, resourceLoad) ??
      topAgent ??
      orchestrator;
    return {
      alias: selected.alias,
      tier: selected.tier,
      purpose: "default",
      rationale: `Selected ${selected.alias} for a smaller isolated task that does not require the best reasoning tier.`
    };
  }

  const classified = classifyTask(task);
  const scoredRoute = routeTask(classified, resources, telemetryByAlias);
  const fallbackPurpose =
    classified.taskType === "reasoning" || classified.taskType === "planning"
      ? "reasoning"
      : classified.taskType === "classification" || classified.taskType === "extraction"
        ? "tools"
        : "default";

  return {
    alias: scoredRoute.resource.alias,
    tier: scoredRoute.resource.tier,
    purpose:
      fallbackPurpose === "reasoning" && scoredRoute.resource.reasoningModel
        ? "reasoning"
        : fallbackPurpose === "tools" && scoredRoute.resource.toolsModel
          ? "tools"
          : "default",
    rationale: scoredRoute.rationale
  };
}

export function getResourceProfilesByTier(
  rootDir = process.cwd()
): Record<ResourceTier, ResourceProfile[]> {
  const profiles = listResources(rootDir);

  return {
    top: profiles.filter((profile) => profile.tier === "top"),
    mid: profiles.filter((profile) => profile.tier === "mid"),
    low: profiles.filter((profile) => profile.tier === "low")
  };
}

export function renderResourceInventory(rootDir = process.cwd()): string {
  return [
    "# Device Inventory",
    "",
    ...listResources(rootDir).flatMap((profile) => [
      `## ${profile.alias} (${profile.label})`,
      `- Tier: ${profile.tier}`,
      `- Base URL: ${profile.baseUrl}`,
      `- API style: ${profile.apiStyle ?? "ollama"}`,
      ...(profile.deviceId ? [`- Device ID: ${profile.deviceId}`] : []),
      ...(profile.hostName || profile.platform
        ? [
            `- Host: ${[profile.hostName, profile.platform].filter(Boolean).join(" / ")}`
          ]
        : []),
      `- Role: ${profile.role}`,
      ...(profile.resourceRole ? [`- Network role: ${profile.resourceRole}`] : []),
      ...(profile.subordinateResources && profile.subordinateResources.length > 0
        ? [`- Subordinate agents: ${profile.subordinateResources.map((alias) => `@${alias}`).join(", ")}`]
        : []),
      `- Default model: ${profile.defaultModel}`,
      ...(profile.reasoningModel ? [`- Reasoning model: ${profile.reasoningModel}`] : []),
      ...(profile.codingModel ? [`- Coding model: ${profile.codingModel}`] : []),
      ...(profile.toolsModel ? [`- Tools model: ${profile.toolsModel}`] : []),
      ...(profile.embeddingModel ? [`- Embedding model: ${profile.embeddingModel}`] : []),
      ...(profile.cpuLogicalCores || profile.ramGb || profile.gpuModel || profile.gpuCount || profile.totalVramGb
        ? [
            `- Hardware: ${[
              profile.cpuLogicalCores ? `${profile.cpuLogicalCores} CPU threads` : "",
              profile.ramGb ? `${profile.ramGb} GB RAM` : "",
              profile.gpuCount ? `${profile.gpuCount} GPU${profile.gpuCount === 1 ? "" : "s"}` : "",
              profile.gpuModel ? profile.gpuModel : "",
              profile.totalVramGb ? `${profile.totalVramGb} GB VRAM` : ""
            ]
              .filter(Boolean)
              .join(", ")}`
          ]
        : []),
      ...(profile.maxContextTokens ? [`- Max context: ${profile.maxContextTokens} tokens`] : []),
      ...(profile.availableModels && profile.availableModels.length > 0
        ? [`- Available models: ${profile.availableModels.join(", ")}`]
        : []),
      ...(profile.endpointVersion ? [`- Endpoint version: ${profile.endpointVersion}`] : []),
      ...(profile.lastRefreshedAt ? [`- Last refreshed: ${profile.lastRefreshedAt}`] : []),
      `- Capabilities: ${profile.capabilities.join(", ") || "(none listed)"}`,
      ...profile.notes.map((note) => `- ${note}`),
      ""
    ])
  ].join("\n");
}

export function getResourceCapacitySummary(rootDir = process.cwd()): ResourceCapacitySummary {
  return listResources(rootDir).reduce<ResourceCapacitySummary>(
    (summary, profile) => ({
      resourceCount: summary.resourceCount + 1,
      knownCpuLogicalCores: summary.knownCpuLogicalCores + (profile.cpuLogicalCores ?? 0),
      knownRamGb: summary.knownRamGb + (profile.ramGb ?? 0),
      knownGpuCount: summary.knownGpuCount + (profile.gpuCount ?? 0),
      knownTotalVramGb: summary.knownTotalVramGb + (profile.totalVramGb ?? 0),
      highestKnownContextTokens: Math.max(
        summary.highestKnownContextTokens,
        profile.maxContextTokens ?? 0
      )
    }),
    {
      resourceCount: 0,
      knownCpuLogicalCores: 0,
      knownRamGb: 0,
      knownGpuCount: 0,
      knownTotalVramGb: 0,
      highestKnownContextTokens: 0
    }
  );
}

export function getResourceAliases(rootDir = process.cwd()): string[] {
  return listResources(rootDir).map((profile) => profile.alias);
}

/**
 * Minimum context tokens for a resource to qualify as orchestrator-capable.
 * Resources at or above this threshold with a top tier can independently
 * coordinate subordinate agents and process multi-step tool workflows.
 */
const ORCHESTRATOR_CAPABLE_CONTEXT_THRESHOLD = 16_384;

/**
 * Determine whether a resource meets the minimum requirements for orchestrator
 * role: top tier with enough context window to handle complex multi-step tasks.
 */
export function isOrchestratorCapable(profile: ResourceProfile): boolean {
  return profile.tier === "top" && (profile.maxContextTokens ?? 0) >= ORCHESTRATOR_CAPABLE_CONTEXT_THRESHOLD;
}

/**
 * Return the effective resource role. If explicitly set on the profile, use that.
 * Otherwise, infer: the primary orchestrator alias gets `"primary-orchestrator"`,
 * top-tier resources meeting the context threshold get `"orchestrator"`, and
 * everything else gets `"agent"`.
 */
export function getEffectiveResourceRole(
  profile: ResourceProfile,
  primaryOrchestratorAlias: string
): ResourceRole {
  if (profile.resourceRole) return profile.resourceRole;
  if (profile.alias === primaryOrchestratorAlias) return "primary-orchestrator";
  if (isOrchestratorCapable(profile)) return "orchestrator";
  return "agent";
}

export interface NetworkTopologyNode {
  alias: string;
  label: string;
  tier: ResourceTier;
  role: ResourceRole;
  maxContextTokens: number;
  subordinates: string[];
}

/**
 * Build a view of the current network topology: primary orchestrator,
 * sub-orchestrators, and their assigned agents.
 */
export function getNetworkTopology(
  primaryOrchestratorAlias: string,
  rootDir = process.cwd()
): NetworkTopologyNode[] {
  const resources = listResources(rootDir);
  return resources.map((profile) => ({
    alias: profile.alias,
    label: profile.label,
    tier: profile.tier,
    role: getEffectiveResourceRole(profile, primaryOrchestratorAlias),
    maxContextTokens: profile.maxContextTokens ?? 0,
    subordinates: profile.subordinateResources ?? []
  }));
}

/**
 * Render a text summary of the network topology for display or prompt context.
 */
export function renderNetworkTopology(
  primaryOrchestratorAlias: string,
  rootDir = process.cwd()
): string {
  const nodes = getNetworkTopology(primaryOrchestratorAlias, rootDir);
  const lines: string[] = ["# Network Topology", ""];
  const primary = nodes.find((node) => node.role === "primary-orchestrator");
  const orchestrators = nodes.filter((node) => node.role === "orchestrator");
  const agents = nodes.filter((node) => node.role === "agent");

  if (primary) {
    lines.push(`## Primary Orchestrator: @${primary.alias} (${primary.label})`);
    lines.push(`   Context: ${primary.maxContextTokens || "unknown"} tokens`);
    if (primary.subordinates.length > 0) {
      lines.push(`   Direct agents: ${primary.subordinates.map((alias) => `@${alias}`).join(", ")}`);
    }
    lines.push("");
  }

  if (orchestrators.length > 0) {
    lines.push("## Sub-Orchestrators");
    for (const node of orchestrators) {
      lines.push(`- @${node.alias} (${node.label}) — ${node.tier} tier, ${node.maxContextTokens || "?"} ctx`);
      if (node.subordinates.length > 0) {
        lines.push(`  Subordinate agents: ${node.subordinates.map((alias) => `@${alias}`).join(", ")}`);
      }
    }
    lines.push("");
  }

  if (agents.length > 0) {
    lines.push("## Agent Resources");
    for (const node of agents) {
      const assignedTo = nodes.find((parent) => parent.subordinates.includes(node.alias));
      const parentLabel = assignedTo ? ` → assigned to @${assignedTo.alias}` : "";
      lines.push(`- @${node.alias} (${node.label}) — ${node.tier} tier, ${node.maxContextTokens || "?"} ctx${parentLabel}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
