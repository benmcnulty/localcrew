import { getEnvList, getEnvString, getOptionalEnvString, loadLocalEnv } from "./env.ts";
import type { EndpointConfig } from "./types.ts";

export type ResourceTier = "top" | "mid" | "low";

export interface ResourceProfile {
  alias: string;
  label: string;
  tier: ResourceTier;
  baseUrl: string;
  defaultModel: string;
  reasoningModel?: string;
  codingModel?: string;
  toolsModel?: string;
  embeddingModel?: string;
  role: string;
  capabilities: string[];
  notes: string[];
}

interface ResourceSeed extends ResourceProfile {}

const RESOURCE_SEEDS: Record<string, ResourceSeed> = {
  air: {
    alias: "air",
    label: "Orchestrator / Hub",
    tier: "top",
    baseUrl: "http://127.0.0.1:11434",
    defaultModel: "llama3.1:8b",
    reasoningModel: "gpt-oss:20b",
    codingModel: "qwen3-coder:latest",
    toolsModel: "gemma3:4b",
    embeddingModel: "nomic-embed-text:latest",
    role: "Primary orchestrator, planning, verification, and artifact writer.",
    capabilities: [
      "reasoning",
      "planning",
      "verification",
      "code generation",
      "tool formatting",
      "embeddings"
    ],
    notes: [
      "Primary orchestration node; configure the real host and models with environment variables.",
      "Best default choice when task routing is ambiguous",
      "Use the coding model for patch-heavy work and the reasoning model for verification"
    ]
  },
  vic: {
    alias: "vic",
    label: "Workhorse / GPU node",
    tier: "top",
    baseUrl: "http://127.0.0.1:11434",
    defaultModel: "llama3.1:8b",
    toolsModel: "gemma3:4b",
    embeddingModel: "nomic-embed-text:latest",
    role: "External generation workhorse for sustained drafting and heavier chat.",
    capabilities: ["chat", "drafting", "review", "parallel generation", "embeddings"],
    notes: [
      "Top-tier external node for sustained generation without tying up the orchestrator.",
      "Good for heavier general generation and drafting",
      "Tune concurrency with the benchmark scripts before raising queue pressure"
    ]
  },
  min: {
    alias: "min",
    label: "Lightweight / tools+embed node",
    tier: "mid",
    baseUrl: "http://127.0.0.1:11434",
    defaultModel: "llama3.2:1b",
    toolsModel: "qwen2.5:0.5b",
    embeddingModel: "granite-embedding:latest",
    role: "Cheap structured routing, lightweight indexing, and low-latency tool-shaped tasks.",
    capabilities: ["routing", "json", "classification", "light chat", "embeddings"],
    notes: [
      "Mid-tier helper for queue bookkeeping, indexing, and low-cost structured work.",
      "Best for low-cost structured outputs and queue/memory bookkeeping",
      "Keep prompts tight"
    ]
  },
  pav: {
    alias: "pav",
    label: "Legacy / constrained node",
    tier: "low",
    baseUrl: "http://127.0.0.1:11434",
    defaultModel: "llama3.2:3b",
    role: "Overflow capacity and alternate small-model perspective.",
    capabilities: ["small chat", "overflow", "alternate perspective"],
    notes: [
      "Low-tier overflow node for small-context isolated tasks.",
      "Not suitable for heavy inference",
      "Use sparingly for parallelism or simple alternate takes"
    ]
  }
};

function getTier(value: string | undefined, fallback: ResourceTier): ResourceTier {
  if (value === "top" || value === "mid" || value === "low") {
    return value;
  }

  return fallback;
}

function getResourceProfiles(rootDir = process.cwd()): Record<string, ResourceProfile> {
  loadLocalEnv(rootDir);

  return Object.fromEntries(
    Object.entries(RESOURCE_SEEDS).map(([alias, seed]) => {
      const prefix = `CRUSTY_RESOURCE_${alias.toUpperCase()}`;
      const profile: ResourceProfile = {
        alias: seed.alias,
        label: getEnvString(`${prefix}_LABEL`, seed.label),
        tier: getTier(getOptionalEnvString(`${prefix}_TIER`), seed.tier),
        baseUrl: getEnvString(`${prefix}_BASE_URL`, seed.baseUrl),
        defaultModel: getEnvString(`${prefix}_DEFAULT_MODEL`, seed.defaultModel),
        role: getEnvString(`${prefix}_ROLE`, seed.role),
        capabilities: getEnvList(`${prefix}_CAPABILITIES`, seed.capabilities),
        notes: getEnvList(`${prefix}_NOTES`, seed.notes)
      };

      const reasoningModel = getOptionalEnvString(`${prefix}_REASONING_MODEL`, seed.reasoningModel);
      const codingModel = getOptionalEnvString(`${prefix}_CODING_MODEL`, seed.codingModel);
      const toolsModel = getOptionalEnvString(`${prefix}_TOOLS_MODEL`, seed.toolsModel);
      const embeddingModel = getOptionalEnvString(
        `${prefix}_EMBEDDING_MODEL`,
        seed.embeddingModel
      );

      return [
        alias,
        {
          ...profile,
          ...(reasoningModel ? { reasoningModel } : {}),
          ...(codingModel ? { codingModel } : {}),
          ...(toolsModel ? { toolsModel } : {}),
          ...(embeddingModel ? { embeddingModel } : {})
        }
      ];
    })
  );
}

function selectModel(
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
  const profile = getResourceProfiles(rootDir)[alias.toLowerCase()];
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
    baseUrl: profile.baseUrl,
    model: selectModel(profile, purpose),
    instructions: "",
    voicePreset: ""
  };
}

export function chooseResourceForTask(
  task: string,
  preferredResource = "auto",
  rootDir = process.cwd()
): {
  alias: string;
  tier: ResourceTier;
  purpose: "default" | "reasoning" | "coding" | "tools";
  rationale: string;
} {
  const normalizedTask = task.toLowerCase();

  if (preferredResource !== "auto") {
    const profile = getResourceProfile(preferredResource, rootDir);
    return {
      alias: profile.alias,
      tier: profile.tier,
      purpose: "default",
      rationale: `Preferred resource ${preferredResource} was requested by the agent configuration.`
    };
  }

  if (
    /\b(code|patch|refactor|typescript|node|bun|test|bug|implement|diff|compile|fix)\b/.test(
      normalizedTask
    )
  ) {
    return {
      alias: "air",
      tier: "top",
      purpose: "coding",
      rationale: "Selected air for code-heavy work using the strongest local code model."
    };
  }

  if (
    /\b(draft|write|review|compare|analyze|analysis|outline|document|documentation|spec|proposal|synthesize)\b/.test(
      normalizedTask
    )
  ) {
    return {
      alias: "vic",
      tier: "top",
      purpose: "default",
      rationale: "Selected vic as the top-tier external workhorse for sustained drafting and analysis."
    };
  }

  if (
    /\b(json|queue|route|router|classify|index|memory|tag|organize|metadata|changelog|todo|log|inventory|benchmark result|summary table)\b/.test(
      normalizedTask
    )
  ) {
    return {
      alias: "min",
      tier: "mid",
      purpose: "tools",
      rationale: "Selected min for medium-difficulty structured output and indexing work to free the top tier."
    };
  }

  if (
    /\b(sanity check|small context|isolated|extract|format|rename|single|short|tiny|overflow|backup|simple)\b/.test(
      normalizedTask
    )
  ) {
    return {
      alias: "pav",
      tier: "low",
      purpose: "default",
      rationale: "Selected pav only for a small-context isolated task that fits the low tier."
    };
  }

  return {
    alias: "air",
    tier: "top",
    purpose: "reasoning",
    rationale: "Defaulted to air for orchestrator reasoning and verification."
  };
}

export function getResourceProfilesByTier(
  rootDir = process.cwd()
): Record<ResourceTier, ResourceProfile[]> {
  const profiles = Object.values(getResourceProfiles(rootDir));

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
    ...Object.values(getResourceProfiles(rootDir)).flatMap((profile) => [
      `## ${profile.alias} (${profile.label})`,
      `- Tier: ${profile.tier}`,
      `- Base URL: ${profile.baseUrl}`,
      `- Role: ${profile.role}`,
      `- Default model: ${profile.defaultModel}`,
      ...(profile.reasoningModel ? [`- Reasoning model: ${profile.reasoningModel}`] : []),
      ...(profile.codingModel ? [`- Coding model: ${profile.codingModel}`] : []),
      ...(profile.toolsModel ? [`- Tools model: ${profile.toolsModel}`] : []),
      ...(profile.embeddingModel ? [`- Embedding model: ${profile.embeddingModel}`] : []),
      `- Capabilities: ${profile.capabilities.join(", ")}`,
      ...profile.notes.map((note) => `- ${note}`),
      ""
    ])
  ].join("\n");
}

export function getResourceAliases(rootDir = process.cwd()): string[] {
  return Object.keys(getResourceProfiles(rootDir));
}
