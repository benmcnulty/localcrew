import { mkdir, readFile } from "node:fs/promises";

import { getEnvBoolean, getEnvString, loadLocalEnv } from "./env.ts";
import { getOrchestratorIdentityName } from "./orchestrator-identity.ts";
import { getResourceProfile, listResources } from "./resources.ts";
import { atomicWriteFile, getStoragePaths } from "./storage.ts";
import type { AppConfig, EndpointConfig, ModelPolicy, UserPreferences } from "./types.ts";
import { titleCase } from "./utils.ts";
import {
  getDefaultVoicePreset,
  getGeneratedDefaultVoicePresets,
  hasVoicePreset,
  normalizeVoicePreset,
  voicePresetExists
} from "./voices.ts";

const ALIAS_PATTERN = /^[a-z][a-z0-9_-]*$/;

function getLegacyDefaultInstruction(alias: string): string {
  return `You are ${titleCase(alias)}. Reply clearly and concisely.`;
}

export function getDefaultInstruction(alias: string, nickname = titleCase(alias)): string {
  const name = nickname.trim() || titleCase(alias);

  switch (alias.toLowerCase()) {
    case "erin":
      return `You are ${name}, the facilitator of this contributor group. Lead with synthesis, keep the discussion grounded, and connect the strongest ideas into a clear next step.`;
    case "zora":
      return `You are ${name}, the critical reviewer of this contributor group. Look for weak assumptions, edge cases, and risks, then sharpen the conversation with precise challenges or corrections.`;
    case "sam":
      return `You are ${name}, the pragmatic minimalist of this contributor group. Prefer the simplest workable move, keep replies tight, and cut through unnecessary complexity.`;
    case "pav":
      return `You are ${name}, the exploratory builder of this contributor group. Push for novel angles, alternative approaches, and creative combinations that still stay actionable.`;
    default:
      return `You are ${name}, a distinct contributor in a shared group chat. Reply clearly, stay in character, and add a specific perspective.`;
  }
}

function getDefaultEndpointNickname(alias: string, label?: string): string {
  return typeof label === "string" && label.trim() !== "" ? label.trim() : titleCase(alias);
}

function getDefaultEndpointConfig(
  alias: string,
  resourceAlias: string,
  rootDir = process.cwd()
): EndpointConfig {
  const upperAlias = alias.toUpperCase();
  let fallbackBaseUrl = "http://127.0.0.1:11434";
  let fallbackModel = "llama3.1:8b";
  let fallbackApiStyle: "ollama" | "openai" | "anthropic" = "ollama";
  let fallbackApiKeyEnv: string | undefined;
  const fallbackNickname = titleCase(alias);

  try {
    const resource = getResourceProfile(resourceAlias, rootDir);
    fallbackBaseUrl = resource.baseUrl;
    fallbackModel = resource.defaultModel;
    fallbackApiStyle = resource.apiStyle ?? "ollama";
    fallbackApiKeyEnv = resource.apiKeyEnv;
  } catch {
    // Resource not found during bootstrap — fall back to hardcoded defaults
  }

  const nickname = getEnvString(`LOCALCREW_ENDPOINT_${upperAlias}_NICKNAME`, fallbackNickname);

  return {
    resourceAlias: getEnvString(`LOCALCREW_ENDPOINT_${upperAlias}_RESOURCE`, resourceAlias),
    nickname,
    baseUrl: getEnvString(`LOCALCREW_ENDPOINT_${upperAlias}_BASE_URL`, fallbackBaseUrl),
    apiStyle: fallbackApiStyle,
    ...(fallbackApiKeyEnv ? { apiKeyEnv: fallbackApiKeyEnv } : {}),
    model: getEnvString(`LOCALCREW_ENDPOINT_${upperAlias}_MODEL`, fallbackModel),
    instructions: getEnvString(
      `LOCALCREW_ENDPOINT_${upperAlias}_INSTRUCTIONS`,
      getDefaultInstruction(alias, nickname)
    ),
    voicePreset: normalizeVoicePreset(
      getEnvString(`LOCALCREW_ENDPOINT_${upperAlias}_VOICE`, getDefaultVoicePreset(alias)),
      alias
    )
  };
}

function getDefaultEndpoints(rootDir = process.cwd()): Record<string, EndpointConfig> {
  loadLocalEnv(rootDir);
  const resources = listResources(rootDir);
  const fallbackResourceAlias = resources[0]?.alias ?? "orchestrator";

  return {
    erin: getDefaultEndpointConfig("erin", resources[0]?.alias ?? fallbackResourceAlias, rootDir),
    zora: getDefaultEndpointConfig("zora", resources[1]?.alias ?? fallbackResourceAlias, rootDir),
    sam: getDefaultEndpointConfig("sam", resources[2]?.alias ?? fallbackResourceAlias, rootDir),
    pav: getDefaultEndpointConfig("pav", resources[3]?.alias ?? fallbackResourceAlias, rootDir)
  };
}

export function getDefaultConfig(rootDir = process.cwd()): AppConfig {
  loadLocalEnv(rootDir);
  const endpoints = getDefaultEndpoints(rootDir);
  const endpointAliases = Object.keys(endpoints);
  const requestedDefault = getEnvString(
    "LOCALCREW_DEFAULT_ENDPOINT",
    endpointAliases[0] ?? "orchestrator"
  ).toLowerCase();

  return {
    orchestratorName: getOrchestratorIdentityName(rootDir),
    defaultEndpoint: endpointAliases.includes(requestedDefault)
      ? requestedDefault
      : (endpointAliases[0] ?? "orchestrator"),
    soundEnabled: getEnvBoolean("LOCALCREW_SOUND_ENABLED", true),
    endpoints
  };
}

function normalizeInstruction(
  alias: string,
  nickname: string,
  instructions: unknown
): { value: string; changed: boolean } {
  if (typeof instructions !== "string") {
    return {
      value: getDefaultInstruction(alias, nickname),
      changed: true
    };
  }

  const generatedInstructions = new Set([
    getLegacyDefaultInstruction(alias),
    getDefaultInstruction(alias, titleCase(alias)),
    getDefaultInstruction(alias, nickname)
  ]);

  if (generatedInstructions.has(instructions)) {
    return {
      value: getDefaultInstruction(alias, nickname),
      changed: true
    };
  }

  return {
    value: instructions,
    changed: false
  };
}

function normalizeEndpoint(
  alias: string,
  value: unknown,
  rootDir = process.cwd()
): { endpoint: EndpointConfig; changed: boolean } {
  if (!value || typeof value !== "object") {
    throw new Error(`Endpoint "${alias}" must be an object.`);
  }

  const candidate = value as Partial<EndpointConfig>;
  const nickname =
    typeof candidate.nickname === "string" && candidate.nickname.trim() !== ""
      ? candidate.nickname.trim()
      : getDefaultEndpointNickname(alias);
  const resourceAlias =
    typeof candidate.resourceAlias === "string" && candidate.resourceAlias.trim() !== ""
      ? candidate.resourceAlias.trim().toLowerCase()
      : alias;

  let baseUrl =
    typeof candidate.baseUrl === "string" && candidate.baseUrl.trim() !== ""
      ? candidate.baseUrl.trim()
      : "http://127.0.0.1:11434";
  let apiStyle: "ollama" | "openai" | "anthropic" =
    candidate.apiStyle === "openai" || candidate.apiStyle === "anthropic"
      ? candidate.apiStyle
      : "ollama";
  let apiKeyEnv =
    typeof candidate.apiKeyEnv === "string" && candidate.apiKeyEnv.trim() !== ""
      ? candidate.apiKeyEnv.trim()
      : undefined;
  let model =
    typeof candidate.model === "string" && candidate.model.trim() !== ""
      ? candidate.model.trim()
      : "llama3.1:8b";

  try {
    const resource = getResourceProfile(resourceAlias, rootDir);
    if (typeof candidate.baseUrl !== "string" || candidate.baseUrl.trim() === "") {
      baseUrl = resource.baseUrl;
    }
    if (typeof candidate.apiStyle !== "string") {
      apiStyle = resource.apiStyle ?? "ollama";
    }
    if (typeof candidate.apiKeyEnv !== "string" || candidate.apiKeyEnv.trim() === "") {
      apiKeyEnv = resource.apiKeyEnv;
    }
    if (typeof candidate.model !== "string" || candidate.model.trim() === "") {
      model = resource.defaultModel;
    }
  } catch {
    if (typeof candidate.baseUrl !== "string" || candidate.baseUrl.trim() === "") {
      throw new Error(`Endpoint "${alias}" is missing a valid "baseUrl".`);
    }
    if (typeof candidate.model !== "string" || candidate.model.trim() === "") {
      throw new Error(`Endpoint "${alias}" is missing a valid "model".`);
    }
  }

  const instructions = normalizeInstruction(alias, nickname, candidate.instructions);
  const requestedVoicePreset =
    typeof candidate.voicePreset === "string" ? candidate.voicePreset : getDefaultVoicePreset(alias);
  const normalizedRequestedVoicePreset = normalizeVoicePreset(requestedVoicePreset, alias);
  const defaultVoicePreset = getDefaultVoicePreset(alias);
  const shouldUpgradeDefaultVoice =
    getGeneratedDefaultVoicePresets(alias).includes(normalizedRequestedVoicePreset) &&
    normalizedRequestedVoicePreset !== defaultVoicePreset;
  const voicePreset = shouldUpgradeDefaultVoice
    ? defaultVoicePreset
    : normalizedRequestedVoicePreset;

  const modelPolicy: ModelPolicy | undefined =
    candidate.modelPolicy === "auto" || candidate.modelPolicy === "fixed"
      ? candidate.modelPolicy
      : undefined;
  const reasoningModel =
    typeof candidate.reasoningModel === "string" && candidate.reasoningModel.trim() !== ""
      ? candidate.reasoningModel.trim()
      : undefined;
  const codingModel =
    typeof candidate.codingModel === "string" && candidate.codingModel.trim() !== ""
      ? candidate.codingModel.trim()
      : undefined;
  const toolsModel =
    typeof candidate.toolsModel === "string" && candidate.toolsModel.trim() !== ""
      ? candidate.toolsModel.trim()
      : undefined;

  return {
    endpoint: {
      resourceAlias,
      nickname,
      baseUrl,
      apiStyle,
      ...(apiKeyEnv ? { apiKeyEnv } : {}),
      model,
      ...(modelPolicy ? { modelPolicy } : {}),
      ...(reasoningModel ? { reasoningModel } : {}),
      ...(codingModel ? { codingModel } : {}),
      ...(toolsModel ? { toolsModel } : {}),
      instructions: instructions.value,
      voicePreset
    },
    changed:
      instructions.changed ||
      shouldUpgradeDefaultVoice ||
      typeof candidate.apiStyle !== "string" ||
      (apiKeyEnv !== undefined &&
        (typeof candidate.apiKeyEnv !== "string" || candidate.apiKeyEnv.trim() === "")) ||
      typeof candidate.voicePreset !== "string" ||
      !hasVoicePreset(candidate.voicePreset) ||
      typeof candidate.nickname !== "string" ||
      typeof candidate.resourceAlias !== "string"
  };
}

function normalizePreferences(raw: unknown): UserPreferences | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const candidate = raw as Record<string, unknown>;
  const result: UserPreferences = {};
  let hasField = false;

  if (typeof candidate.zipCode === "string" && candidate.zipCode.trim() !== "") {
    result.zipCode = candidate.zipCode.trim();
    hasField = true;
  }
  if (typeof candidate.city === "string" && candidate.city.trim() !== "") {
    result.city = candidate.city.trim();
    hasField = true;
  }
  if (typeof candidate.personalWebsiteUrl === "string" && candidate.personalWebsiteUrl.trim() !== "") {
    result.personalWebsiteUrl = candidate.personalWebsiteUrl.trim();
    hasField = true;
  }
  if (typeof candidate.dailyDigestDirective === "string" && candidate.dailyDigestDirective.trim() !== "") {
    result.dailyDigestDirective = candidate.dailyDigestDirective.trim();
    hasField = true;
  }
  if (candidate.jobSearchEnabled !== undefined) {
    if (typeof candidate.jobSearchEnabled === "boolean") {
      result.jobSearchEnabled = candidate.jobSearchEnabled;
      hasField = true;
    } else if (typeof candidate.jobSearchEnabled === "string") {
      const v = (candidate.jobSearchEnabled as string).toLowerCase().trim();
      if (v === "true" || v === "yes" || v === "1" || v === "y") {
        result.jobSearchEnabled = true;
        hasField = true;
      } else if (v === "false" || v === "no" || v === "0" || v === "n") {
        result.jobSearchEnabled = false;
        hasField = true;
      }
    }
  }
  if (candidate.modelProfile !== undefined) {
    const modelProfileValue = String(candidate.modelProfile).trim().toLowerCase();
    if (modelProfileValue === "all-llamas" || modelProfileValue === "custom" || modelProfileValue === "auto") {
      result.modelProfile = modelProfileValue;
      hasField = true;
    }
  }

  return hasField ? result : undefined;
}

export function setPreference(config: AppConfig, key: string, value: string): AppConfig {
  const validKeys: (keyof UserPreferences)[] = ["zipCode", "city", "personalWebsiteUrl", "dailyDigestDirective", "jobSearchEnabled", "modelProfile", "dailyWorkIntervalHours", "dailyWorkDirective", "portRecommended", "autoPublishToPort"];
  if (!validKeys.includes(key as keyof UserPreferences)) {
    throw new Error(`Invalid preference key "${key}". Valid keys: ${validKeys.join(", ")}`);
  }

  const trimmed = value.trim();
  const existing = config.preferences ?? {};

  if (trimmed === "") {
    const updated = { ...existing };
    delete updated[key as keyof UserPreferences];
    const hasFields = Object.values(updated).some((v) => v !== undefined);
    return {
      ...config,
      ...(hasFields ? { preferences: updated } : {}),
    };
  }

  // jobSearchEnabled is a boolean preference — coerce string values.
  if (key === "jobSearchEnabled") {
    const v = trimmed.toLowerCase();
    const boolValue = v === "true" || v === "yes" || v === "1" || v === "y";
    return {
      ...config,
      preferences: { ...existing, jobSearchEnabled: boolValue }
    };
  }

  // Boolean flags
  if (key === "portRecommended" || key === "autoPublishToPort") {
    const v = trimmed.toLowerCase();
    const boolValue = v === "true" || v === "yes" || v === "1" || v === "y";
    return {
      ...config,
      preferences: { ...existing, [key]: boolValue }
    };
  }

  if (key === "modelProfile") {
    const v = trimmed.toLowerCase();
    if (v !== "all-llamas" && v !== "custom" && v !== "auto") {
      throw new Error('Invalid modelProfile. Valid values: all-llamas, custom, auto');
    }
    return {
      ...config,
      preferences: { ...existing, modelProfile: v }
    };
  }

  return {
    ...config,
    preferences: {
      ...existing,
      [key]: trimmed,
    },
  };
}

function normalizeConfig(
  raw: unknown,
  rootDir = process.cwd()
): { config: AppConfig; changed: boolean } {
  if (!raw || typeof raw !== "object") {
    throw new Error("Config root must be an object.");
  }

  const candidate = raw as {
    orchestratorName?: unknown;
    orchestratorResourceAlias?: unknown;
    defaultEndpoint?: unknown;
    soundEnabled?: unknown;
    endpoints?: unknown;
    preferences?: unknown;
  };

  if (!candidate.endpoints || typeof candidate.endpoints !== "object") {
    throw new Error('Config must include an "endpoints" object.');
  }

  let changed = false;
  const rawEndpoints = candidate.endpoints as Record<string, unknown>;
  const endpoints = Object.entries(rawEndpoints).reduce<Record<string, EndpointConfig>>(
    (accumulator, [alias, endpoint]) => {
      const normalizedAlias = alias.toLowerCase();
      const result = normalizeEndpoint(normalizedAlias, endpoint, rootDir);
      accumulator[normalizedAlias] = result.endpoint;
      changed ||= result.changed || normalizedAlias !== alias;
      return accumulator;
    },
    {}
  );

  const endpointKeys = Object.keys(endpoints);
  if (endpointKeys.length === 0) {
    throw new Error("Config must define at least one endpoint.");
  }

  const requestedDefault =
    typeof candidate.defaultEndpoint === "string"
      ? candidate.defaultEndpoint.toLowerCase()
      : endpointKeys[0];
  const defaultEndpoint = endpointKeys.includes(requestedDefault)
    ? requestedDefault
    : endpointKeys[0];
  const soundEnabled =
    typeof candidate.soundEnabled === "boolean" ? candidate.soundEnabled : true;
  const orchestratorName =
    typeof candidate.orchestratorName === "string" && candidate.orchestratorName.trim() !== ""
      ? candidate.orchestratorName.trim()
      : getOrchestratorIdentityName(rootDir);

  const orchestratorResourceAlias =
    typeof candidate.orchestratorResourceAlias === "string" &&
    candidate.orchestratorResourceAlias.trim() !== ""
      ? candidate.orchestratorResourceAlias.trim().toLowerCase()
      : undefined;

  changed ||=
    typeof candidate.defaultEndpoint !== "string" ||
    requestedDefault !== defaultEndpoint ||
    typeof candidate.soundEnabled !== "boolean" ||
    typeof candidate.orchestratorName !== "string";

  const preferences = normalizePreferences(candidate.preferences);

  return {
    config: {
      orchestratorName,
      defaultEndpoint,
      soundEnabled,
      endpoints,
      ...(orchestratorResourceAlias ? { orchestratorResourceAlias } : {}),
      ...(preferences ? { preferences } : {}),
    },
    changed
  };
}

export async function saveConfig(config: AppConfig, rootDir = process.cwd()): Promise<void> {
  const paths = getStoragePaths(rootDir);
  await mkdir(paths.storageDir, { recursive: true });
  await atomicWriteFile(paths.configPath, `${JSON.stringify(config, null, 2)}\n`);
}

export async function loadConfig(rootDir = process.cwd()): Promise<AppConfig> {
  loadLocalEnv(rootDir);
  const paths = getStoragePaths(rootDir);
  await mkdir(paths.storageDir, { recursive: true });

  try {
    const raw = await readFile(paths.configPath, "utf8");
    const normalized = normalizeConfig(JSON.parse(raw), rootDir);
    if (normalized.changed) {
      await saveConfig(normalized.config, rootDir);
    }
    return normalized.config;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      const config = getDefaultConfig(rootDir);
      await saveConfig(config, rootDir);
      return config;
    }

    if (error instanceof SyntaxError) {
      throw new Error(`Config file is not valid JSON: ${error.message}`);
    }

    throw error;
  }
}

export function ensureEndpointAlias(config: AppConfig, alias: string): string {
  const normalizedAlias = alias.toLowerCase();
  if (!config.endpoints[normalizedAlias]) {
    throw new Error(`Unknown endpoint alias "${alias}".`);
  }
  return normalizedAlias;
}

export function isValidAlias(alias: string): boolean {
  return ALIAS_PATTERN.test(alias);
}

export function resolveEndpointConfig(
  config: AppConfig,
  alias: string,
  rootDir = process.cwd()
): EndpointConfig {
  const normalizedAlias = ensureEndpointAlias(config, alias);
  const endpoint = config.endpoints[normalizedAlias];

  try {
    const resource = getResourceProfile(endpoint.resourceAlias, rootDir);
    return {
      ...endpoint,
      baseUrl: resource.baseUrl,
      apiStyle: resource.apiStyle ?? "ollama",
      ...(resource.apiKeyEnv ? { apiKeyEnv: resource.apiKeyEnv } : {})
    };
  } catch {
    // Resource binding not resolved — return endpoint as-is with stored values
    return endpoint;
  }
}

export function setOrchestratorName(config: AppConfig, name: string): AppConfig {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Orchestrator name cannot be empty.");
  }

  return {
    ...config,
    orchestratorName: trimmedName
  };
}

export function setEndpointInstructions(
  config: AppConfig,
  alias: string,
  instructions: string
): AppConfig {
  const normalizedAlias = ensureEndpointAlias(config, alias);

  return {
    ...config,
    endpoints: {
      ...config.endpoints,
      [normalizedAlias]: {
        ...config.endpoints[normalizedAlias],
        instructions
      }
    }
  };
}

export function setEndpointVoicePreset(
  config: AppConfig,
  alias: string,
  preset: string
): AppConfig {
  const normalizedAlias = ensureEndpointAlias(config, alias);
  const normalizedPreset = normalizeVoicePreset(preset, normalizedAlias);

  if (!voicePresetExists(normalizedPreset)) {
    throw new Error(`Unknown voice preset "${preset}".`);
  }

  return {
    ...config,
    endpoints: {
      ...config.endpoints,
      [normalizedAlias]: {
        ...config.endpoints[normalizedAlias],
        voicePreset: normalizedPreset
      }
    }
  };
}

export function setEndpointModel(config: AppConfig, alias: string, model: string): AppConfig {
  const normalizedAlias = ensureEndpointAlias(config, alias);
  const trimmedModel = model.trim();
  if (!trimmedModel) {
    throw new Error("Model cannot be empty.");
  }

  return {
    ...config,
    endpoints: {
      ...config.endpoints,
      [normalizedAlias]: {
        ...config.endpoints[normalizedAlias],
        model: trimmedModel
      }
    }
  };
}

export function setEndpointModelPolicy(
  config: AppConfig,
  alias: string,
  policy: ModelPolicy
): AppConfig {
  const normalizedAlias = ensureEndpointAlias(config, alias);

  return {
    ...config,
    endpoints: {
      ...config.endpoints,
      [normalizedAlias]: {
        ...config.endpoints[normalizedAlias],
        modelPolicy: policy
      }
    }
  };
}

export function setEndpointPurposeModel(
  config: AppConfig,
  alias: string,
  purpose: "reasoning" | "coding" | "tools",
  model: string
): AppConfig {
  const normalizedAlias = ensureEndpointAlias(config, alias);
  const trimmedModel = model.trim();
  if (!trimmedModel) {
    throw new Error("Model cannot be empty.");
  }

  const purposeKey =
    purpose === "reasoning"
      ? "reasoningModel"
      : purpose === "coding"
        ? "codingModel"
        : "toolsModel";

  return {
    ...config,
    endpoints: {
      ...config.endpoints,
      [normalizedAlias]: {
        ...config.endpoints[normalizedAlias],
        [purposeKey]: trimmedModel
      }
    }
  };
}

export function setEndpointNickname(config: AppConfig, alias: string, nickname: string): AppConfig {
  const normalizedAlias = ensureEndpointAlias(config, alias);
  const trimmedNickname = nickname.trim();
  if (!trimmedNickname) {
    throw new Error("Nickname cannot be empty.");
  }

  return {
    ...config,
    endpoints: {
      ...config.endpoints,
      [normalizedAlias]: {
        ...config.endpoints[normalizedAlias],
        nickname: trimmedNickname
      }
    }
  };
}

export function setEndpointResourceAlias(
  config: AppConfig,
  alias: string,
  resourceAlias: string,
  rootDir = process.cwd()
): AppConfig {
  const normalizedAlias = ensureEndpointAlias(config, alias);
  const resource = getResourceProfile(resourceAlias, rootDir);

  return {
    ...config,
    endpoints: {
      ...config.endpoints,
      [normalizedAlias]: {
        ...config.endpoints[normalizedAlias],
        resourceAlias: resource.alias,
        baseUrl: resource.baseUrl,
        apiStyle: resource.apiStyle ?? "ollama",
        ...(resource.apiKeyEnv ? { apiKeyEnv: resource.apiKeyEnv } : {})
      }
    }
  };
}

export function addEndpoint(
  config: AppConfig,
  alias: string,
  resourceAlias: string,
  nickname: string | undefined,
  rootDir = process.cwd()
): AppConfig {
  const normalizedAlias = alias.trim().toLowerCase();
  if (!isValidAlias(normalizedAlias)) {
    throw new Error(`Invalid endpoint alias "${alias}".`);
  }
  if (config.endpoints[normalizedAlias]) {
    throw new Error(`Endpoint alias "${normalizedAlias}" already exists.`);
  }

  const resource = getResourceProfile(resourceAlias, rootDir);
  return {
    ...config,
    endpoints: {
      ...config.endpoints,
      [normalizedAlias]: {
        resourceAlias: resource.alias,
        nickname: nickname?.trim() || getDefaultEndpointNickname(normalizedAlias),
        baseUrl: resource.baseUrl,
        apiStyle: resource.apiStyle ?? "ollama",
        ...(resource.apiKeyEnv ? { apiKeyEnv: resource.apiKeyEnv } : {}),
        model: resource.defaultModel,
        instructions: getDefaultInstruction(
          normalizedAlias,
          nickname?.trim() || getDefaultEndpointNickname(normalizedAlias)
        ),
        voicePreset: getDefaultVoicePreset(normalizedAlias)
      }
    }
  };
}

export function removeEndpoint(config: AppConfig, alias: string): AppConfig {
  const normalizedAlias = ensureEndpointAlias(config, alias);
  const endpointAliases = Object.keys(config.endpoints);
  if (endpointAliases.length === 1) {
    throw new Error("At least one participant must remain configured.");
  }

  const nextEndpoints = { ...config.endpoints };
  delete nextEndpoints[normalizedAlias];
  const nextDefault =
    config.defaultEndpoint === normalizedAlias
      ? Object.keys(nextEndpoints)[0]
      : config.defaultEndpoint;

  return {
    ...config,
    defaultEndpoint: nextDefault,
    endpoints: nextEndpoints
  };
}
