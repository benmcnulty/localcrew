import { mkdir, readFile, writeFile } from "node:fs/promises";

import { getEnvBoolean, getEnvString, loadLocalEnv } from "./env.ts";
import { getStoragePaths } from "./storage.ts";
import type { AppConfig, EndpointConfig } from "./types.ts";
import {
  getDefaultVoicePreset,
  getGeneratedDefaultVoicePresets,
  hasVoicePreset,
  normalizeVoicePreset,
  voicePresetExists
} from "./voices.ts";

const ALIAS_PATTERN = /^[a-z][a-z0-9_-]*$/;

function titleCase(value: string): string {
  if (!value) {
    return value;
  }

  return value.slice(0, 1).toUpperCase() + value.slice(1).toLowerCase();
}

function getLegacyDefaultInstruction(alias: string): string {
  return `You are ${titleCase(alias)}. Reply clearly and concisely.`;
}

export function getDefaultInstruction(alias: string): string {
  const name = titleCase(alias);

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

function getDefaultEndpointModel(alias: string): string {
  switch (alias.toLowerCase()) {
    case "erin":
      return "llama3.1:8b";
    case "zora":
      return "llama3.1:8b";
    case "sam":
      return "llama3.2:1b";
    case "pav":
      return "llama3.2:1b";
    default:
      return "llama3.1:8b";
  }
}

function getDefaultEndpointConfig(alias: string): EndpointConfig {
  const upperAlias = alias.toUpperCase();

  return {
    baseUrl: getEnvString(`CRUSTY_ENDPOINT_${upperAlias}_BASE_URL`, "http://127.0.0.1:11434"),
    model: getEnvString(`CRUSTY_ENDPOINT_${upperAlias}_MODEL`, getDefaultEndpointModel(alias)),
    instructions: getEnvString(
      `CRUSTY_ENDPOINT_${upperAlias}_INSTRUCTIONS`,
      getDefaultInstruction(alias)
    ),
    voicePreset: normalizeVoicePreset(
      getEnvString(`CRUSTY_ENDPOINT_${upperAlias}_VOICE`, getDefaultVoicePreset(alias)),
      alias
    )
  };
}

function getDefaultEndpoints(rootDir = process.cwd()): Record<string, EndpointConfig> {
  loadLocalEnv(rootDir);

  return {
    erin: getDefaultEndpointConfig("erin"),
    zora: getDefaultEndpointConfig("zora"),
    sam: getDefaultEndpointConfig("sam"),
    pav: getDefaultEndpointConfig("pav")
  };
}

export function getDefaultConfig(rootDir = process.cwd()): AppConfig {
  loadLocalEnv(rootDir);

  return {
    defaultEndpoint: getEnvString("CRUSTY_DEFAULT_ENDPOINT", "erin").toLowerCase(),
    soundEnabled: getEnvBoolean("CRUSTY_SOUND_ENABLED", true),
    endpoints: getDefaultEndpoints(rootDir)
  };
}

function normalizeInstruction(alias: string, instructions: unknown): { value: string; changed: boolean } {
  if (typeof instructions !== "string") {
    return {
      value: getDefaultInstruction(alias),
      changed: true
    };
  }

  const generatedInstructions = new Set([
    getLegacyDefaultInstruction(alias),
    getDefaultInstruction(alias)
  ]);

  if (generatedInstructions.has(instructions)) {
    return {
      value: getDefaultInstruction(alias),
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
  value: unknown
): { endpoint: EndpointConfig; changed: boolean } {
  if (!value || typeof value !== "object") {
    throw new Error(`Endpoint "${alias}" must be an object.`);
  }

  const candidate = value as Partial<EndpointConfig>;

  if (typeof candidate.baseUrl !== "string" || candidate.baseUrl.trim() === "") {
    throw new Error(`Endpoint "${alias}" is missing a valid "baseUrl".`);
  }

  if (typeof candidate.model !== "string" || candidate.model.trim() === "") {
    throw new Error(`Endpoint "${alias}" is missing a valid "model".`);
  }

  const instructions = normalizeInstruction(alias, candidate.instructions);
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

  return {
    endpoint: {
      baseUrl: candidate.baseUrl,
      model: candidate.model,
      instructions: instructions.value,
      voicePreset
    },
    changed:
      instructions.changed ||
      shouldUpgradeDefaultVoice ||
      typeof candidate.voicePreset !== "string" ||
      !hasVoicePreset(candidate.voicePreset)
  };
}

function normalizeConfig(raw: unknown): { config: AppConfig; changed: boolean } {
  if (!raw || typeof raw !== "object") {
    throw new Error("Config root must be an object.");
  }

  const candidate = raw as {
    defaultEndpoint?: unknown;
    soundEnabled?: unknown;
    endpoints?: unknown;
  };

  if (!candidate.endpoints || typeof candidate.endpoints !== "object") {
    throw new Error('Config must include an "endpoints" object.');
  }

  let changed = false;
  const rawEndpoints = candidate.endpoints as Record<string, unknown>;

  const endpoints = Object.entries(rawEndpoints).reduce<
    Record<string, EndpointConfig>
  >((accumulator, [alias, endpoint]) => {
    const normalizedAlias = alias.toLowerCase();
    const result = normalizeEndpoint(normalizedAlias, endpoint);
    accumulator[normalizedAlias] = result.endpoint;
    changed ||= result.changed || normalizedAlias !== alias;
    return accumulator;
  }, {});

  const endpointKeys = Object.keys(endpoints);
  if (endpointKeys.length === 0) {
    throw new Error("Config must define at least one endpoint.");
  }

  const requestedDefault =
    typeof candidate.defaultEndpoint === "string"
      ? candidate.defaultEndpoint.toLowerCase()
      : "erin";
  const defaultEndpoint = endpointKeys.includes(requestedDefault)
    ? requestedDefault
    : endpointKeys[0];
  const soundEnabled =
    typeof candidate.soundEnabled === "boolean" ? candidate.soundEnabled : true;

  changed ||=
    typeof candidate.defaultEndpoint !== "string" ||
    requestedDefault !== defaultEndpoint ||
    typeof candidate.soundEnabled !== "boolean";

  return {
    config: {
      defaultEndpoint,
      soundEnabled,
      endpoints
    },
    changed
  };
}

export async function saveConfig(config: AppConfig, rootDir = process.cwd()): Promise<void> {
  const paths = getStoragePaths(rootDir);
  await mkdir(paths.storageDir, { recursive: true });
  await writeFile(paths.configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export async function loadConfig(rootDir = process.cwd()): Promise<AppConfig> {
  loadLocalEnv(rootDir);
  const paths = getStoragePaths(rootDir);
  await mkdir(paths.storageDir, { recursive: true });

  try {
    const raw = await readFile(paths.configPath, "utf8");
    const normalized = normalizeConfig(JSON.parse(raw));
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
