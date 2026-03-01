import { hostname, networkInterfaces, platform, totalmem, cpus } from "node:os";

import type { EndpointApiStyle } from "./types.ts";

export interface DiscoveredModelInfo {
  name: string;
  parameterSize?: string;
  quantizationLevel?: string;
}

export interface DiscoveredResourceModels {
  availableModels: string[];
  endpointVersion?: string;
  defaultModel?: string;
  reasoningModel?: string;
  codingModel?: string;
  toolsModel?: string;
  embeddingModel?: string;
  models: DiscoveredModelInfo[];
}

export interface LocalMachineProfile {
  hostName: string;
  platform: string;
  cpuLogicalCores: number;
  ramGb: number;
  localIp?: string;
}

export type FetchFn = typeof fetch;

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function pickModel(names: string[], candidates: string[], fallback?: string): string | undefined {
  for (const candidate of candidates) {
    const exact = names.find((name) => name.toLowerCase() === candidate.toLowerCase());
    if (exact) {
      return exact;
    }
  }

  for (const candidate of candidates) {
    const partial = names.find((name) => name.toLowerCase().includes(candidate.toLowerCase()));
    if (partial) {
      return partial;
    }
  }

  return fallback ?? names[0];
}

function getAuthHeaders(apiKeyEnv?: string): Record<string, string> {
  if (!apiKeyEnv) {
    return {};
  }

  const apiKey = process.env[apiKeyEnv]?.trim();
  if (!apiKey) {
    return {};
  }

  return {
    authorization: `Bearer ${apiKey}`
  };
}

export function detectLocalIpAddress(): string | undefined {
  const interfaces = networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) {
        return entry.address;
      }
    }
  }

  return undefined;
}

export function detectLocalMachineProfile(): LocalMachineProfile {
  const localIp = detectLocalIpAddress();
  return {
    hostName: hostname(),
    platform: platform(),
    cpuLogicalCores: cpus().length,
    ramGb: Math.round((totalmem() / 1024 / 1024 / 1024) * 10) / 10,
    ...(localIp ? { localIp } : {})
  };
}

export async function probeResourceModels(
  baseUrl: string,
  apiStyle: EndpointApiStyle = "ollama",
  fetchFn: FetchFn = fetch,
  apiKeyEnv?: string
): Promise<DiscoveredResourceModels> {
  const headers = getAuthHeaders(apiKeyEnv);

  if (apiStyle === "openai") {
    const response = await fetchFn(`${trimTrailingSlash(baseUrl)}/v1/models`, {
      headers
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const body = (await response.json()) as {
      data?: Array<{ id?: unknown }>;
    };
    const availableModels = Array.isArray(body.data)
      ? body.data
          .map((entry) => (typeof entry.id === "string" ? entry.id.trim() : ""))
          .filter((entry) => entry !== "")
      : [];

    return {
      availableModels,
      defaultModel: pickModel(availableModels, ["gpt-4", "llama", "qwen", "gemma"], availableModels[0]),
      reasoningModel: pickModel(availableModels, ["gpt-4", "gpt-oss", "reason"], availableModels[0]),
      codingModel: pickModel(availableModels, ["coder", "code", "qwen"], undefined),
      toolsModel: pickModel(availableModels, ["tool", "json", "gemma", "qwen"], undefined),
      embeddingModel: pickModel(availableModels, ["embed"], undefined),
      models: availableModels.map((name) => ({ name }))
    };
  }

  const [versionResponse, tagsResponse] = await Promise.all([
    fetchFn(`${trimTrailingSlash(baseUrl)}/api/version`, { headers }),
    fetchFn(`${trimTrailingSlash(baseUrl)}/api/tags`, { headers })
  ]);

  if (!tagsResponse.ok) {
    throw new Error(`HTTP ${tagsResponse.status}: ${await tagsResponse.text()}`);
  }

  const version = versionResponse.ok ? ((await versionResponse.json()) as { version?: string }) : {};
  const tags = (await tagsResponse.json()) as {
    models?: Array<{
      name?: unknown;
      details?: {
        parameter_size?: unknown;
        quantization_level?: unknown;
      };
    }>;
  };

  const models = Array.isArray(tags.models)
    ? tags.models
        .map((entry) => ({
          name: typeof entry.name === "string" ? entry.name.trim() : "",
          ...(typeof entry.details?.parameter_size === "string"
            ? { parameterSize: entry.details.parameter_size }
            : {}),
          ...(typeof entry.details?.quantization_level === "string"
            ? { quantizationLevel: entry.details.quantization_level }
            : {})
        }))
        .filter((entry) => entry.name !== "")
    : [];
  const availableModels = models.map((entry) => entry.name);

  return {
    availableModels,
    ...(typeof version.version === "string" ? { endpointVersion: version.version } : {}),
    defaultModel: pickModel(
      availableModels,
      ["llama3.1:8b", "llama3.1:latest", "llama3.2:3b", "llama3.2:latest", "gemma3:4b"],
      availableModels[0]
    ),
    reasoningModel: pickModel(availableModels, ["gpt-oss:20b", "reason"], availableModels[0]),
    codingModel: pickModel(availableModels, ["coder", "code"], undefined),
    toolsModel: pickModel(availableModels, ["gemma", "qwen", "tool"], undefined),
    embeddingModel: pickModel(availableModels, ["embed"], undefined),
    models
  };
}
