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
import type { EndpointApiStyle, EndpointConfig, ModelPurpose } from "./types.ts";

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
  return normalizeAlias(getEnvString("CRUSTY_ORCHESTRATOR_ALIAS", "orchestrator"));
}

function getDefaultLocalResource(rootDir = process.cwd()): ResourceProfile {
  loadLocalEnv(rootDir);
  const alias = getOrchestratorResourceAlias(rootDir);
  return {
    alias,
    label: getEnvString("CRUSTY_ORCHESTRATOR_LABEL", "Local Orchestrator"),
    tier: getTier(getOptionalEnvString("CRUSTY_ORCHESTRATOR_TIER"), "top"),
    baseUrl: getEnvString("CRUSTY_ORCHESTRATOR_BASE_URL", "http://127.0.0.1:11434"),
    apiStyle: normalizeApiStyle(getOptionalEnvString("CRUSTY_ORCHESTRATOR_API_STYLE")),
    ...(getOptionalEnvString("CRUSTY_ORCHESTRATOR_API_KEY_ENV")
      ? { apiKeyEnv: getOptionalEnvString("CRUSTY_ORCHESTRATOR_API_KEY_ENV") }
      : {}),
    ...(getOptionalEnvString("CRUSTY_ORCHESTRATOR_HOST_NAME")
      ? { hostName: getOptionalEnvString("CRUSTY_ORCHESTRATOR_HOST_NAME") }
      : {}),
    ...(getOptionalEnvString("CRUSTY_ORCHESTRATOR_PLATFORM")
      ? { platform: getOptionalEnvString("CRUSTY_ORCHESTRATOR_PLATFORM") }
      : {}),
    defaultModel: getEnvString("CRUSTY_ORCHESTRATOR_DEFAULT_MODEL", "llama3.1:8b"),
    ...(getOptionalEnvString("CRUSTY_ORCHESTRATOR_REASONING_MODEL")
      ? { reasoningModel: getOptionalEnvString("CRUSTY_ORCHESTRATOR_REASONING_MODEL") }
      : {}),
    ...(getOptionalEnvString("CRUSTY_ORCHESTRATOR_CODING_MODEL")
      ? { codingModel: getOptionalEnvString("CRUSTY_ORCHESTRATOR_CODING_MODEL") }
      : {}),
    ...(getOptionalEnvString("CRUSTY_ORCHESTRATOR_TOOLS_MODEL")
      ? { toolsModel: getOptionalEnvString("CRUSTY_ORCHESTRATOR_TOOLS_MODEL") }
      : {}),
    ...(getOptionalEnvString("CRUSTY_ORCHESTRATOR_EMBEDDING_MODEL")
      ? { embeddingModel: getOptionalEnvString("CRUSTY_ORCHESTRATOR_EMBEDDING_MODEL") }
      : {}),
    role: getEnvString(
      "CRUSTY_ORCHESTRATOR_ROLE",
      "Primary orchestration resource for chat, planning, verification, and local artifact work."
    ),
    capabilities: getEnvList("CRUSTY_ORCHESTRATOR_CAPABILITIES", [
      "reasoning",
      "planning",
      "chat",
      "code generation",
      "tool formatting",
      "embeddings"
    ]),
    notes: getEnvList("CRUSTY_ORCHESTRATOR_NOTES", [
      "This is the first device a new user should bring online.",
      "Use the local setup script to confirm Ollama connectivity and seed the orchestrator profile.",
      "Bring additional agent devices online through the CLI or GUI once the orchestrator is stable."
    ]),
    ...(getEnvNumber("CRUSTY_ORCHESTRATOR_CPU_LOGICAL_CORES", 0) > 0
      ? { cpuLogicalCores: getEnvNumber("CRUSTY_ORCHESTRATOR_CPU_LOGICAL_CORES", 0) }
      : {}),
    ...(getEnvNumber("CRUSTY_ORCHESTRATOR_RAM_GB", 0) > 0
      ? { ramGb: getEnvNumber("CRUSTY_ORCHESTRATOR_RAM_GB", 0) }
      : {}),
    ...(getOptionalEnvString("CRUSTY_ORCHESTRATOR_GPU_MODEL")
      ? { gpuModel: getOptionalEnvString("CRUSTY_ORCHESTRATOR_GPU_MODEL") }
      : {}),
    ...(getEnvNumber("CRUSTY_ORCHESTRATOR_GPU_COUNT", 0) > 0
      ? { gpuCount: getEnvNumber("CRUSTY_ORCHESTRATOR_GPU_COUNT", 0) }
      : {}),
    ...(getEnvNumber("CRUSTY_ORCHESTRATOR_TOTAL_VRAM_GB", 0) > 0
      ? { totalVramGb: getEnvNumber("CRUSTY_ORCHESTRATOR_TOTAL_VRAM_GB", 0) }
      : {}),
    ...(getEnvNumber("CRUSTY_ORCHESTRATOR_MAX_CONTEXT_TOKENS", 0) > 0
      ? { maxContextTokens: getEnvNumber("CRUSTY_ORCHESTRATOR_MAX_CONTEXT_TOKENS", 0) }
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
  } = {}
): {
  alias: string;
  tier: ResourceTier;
  purpose: "default" | "reasoning" | "coding" | "tools";
  rationale: string;
} {
  const resourceLoad = options.resourceLoad ?? {};
  const resources = sortForRouting(listResources(rootDir));
  const orchestratorAlias = getOrchestratorResourceAlias(rootDir);
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

  return {
    alias: orchestrator.alias,
    tier: orchestrator.tier,
    purpose: orchestrator.reasoningModel ? "reasoning" : "default",
    rationale: `Defaulted to ${orchestrator.alias} as the primary orchestrator resource for reasoning and verification after considering the current resource load profile.`
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
