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

export const RESOURCE_PROFILES: Record<string, ResourceProfile> = {
  air: {
    alias: "air",
    label: "Orchestrator / Hub",
    tier: "top",
    baseUrl: "http://192.168.1.223:11434",
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
      "macOS 26.3 on Apple M4 with 32 GB RAM",
      "Best default choice when task routing is ambiguous",
      "Use qwen3-coder for patch-heavy work and gpt-oss for reasoning"
    ]
  },
  vic: {
    alias: "vic",
    label: "Workhorse / GPU node",
    tier: "top",
    baseUrl: "http://192.168.1.175:11434",
    defaultModel: "llama3.1:latest",
    toolsModel: "gemma3:4b",
    embeddingModel: "nomic-embed-text:latest",
    role: "GPU-backed generation workhorse for sustained drafting and heavier chat.",
    capabilities: ["chat", "drafting", "review", "parallel generation", "embeddings"],
    notes: [
      "Windows 11 on i7-13700 with RTX 3060 12 GB",
      "Good for heavier general generation without tying up air",
      "Intended future landing zone for larger pulled models"
    ]
  },
  min: {
    alias: "min",
    label: "Lightweight / tools+embed node",
    tier: "mid",
    baseUrl: "http://192.168.1.190:11434",
    defaultModel: "llama3.2:1b",
    toolsModel: "qwen2.5:0.5b",
    embeddingModel: "granite-embedding:latest",
    role: "Cheap structured routing, lightweight indexing, and low-latency tool-shaped tasks.",
    capabilities: ["routing", "json", "classification", "light chat", "embeddings"],
    notes: [
      "macOS 26.3 on Apple M2 with 8 GB RAM",
      "Best for low-cost structured outputs and queue/memory bookkeeping",
      "Keep prompts tight"
    ]
  },
  pav: {
    alias: "pav",
    label: "Legacy / constrained node",
    tier: "low",
    baseUrl: "http://192.168.1.108:11434",
    defaultModel: "llama3.2:latest",
    role: "Overflow capacity and alternate small-model perspective.",
    capabilities: ["small chat", "overflow", "alternate perspective"],
    notes: [
      "Windows 10 with constrained C: drive and D: available",
      "Not suitable for heavy inference",
      "Use sparingly for parallelism or simple alternate takes"
    ]
  }
};

function selectModel(profile: ResourceProfile, purpose: "default" | "reasoning" | "coding" | "tools"): string {
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

export function getResourceProfile(alias: string): ResourceProfile {
  const profile = RESOURCE_PROFILES[alias.toLowerCase()];
  if (!profile) {
    throw new Error(`Unknown resource "${alias}".`);
  }
  return profile;
}

export function getResourceEndpoint(
  alias: string,
  purpose: "default" | "reasoning" | "coding" | "tools" = "default"
): EndpointConfig {
  const profile = getResourceProfile(alias);

  return {
    baseUrl: profile.baseUrl,
    model: selectModel(profile, purpose),
    instructions: "",
    voicePreset: ""
  };
}

export function chooseResourceForTask(
  task: string,
  preferredResource = "auto"
): {
  alias: string;
  tier: ResourceTier;
  purpose: "default" | "reasoning" | "coding" | "tools";
  rationale: string;
} {
  const normalizedTask = task.toLowerCase();

  if (preferredResource !== "auto") {
    const profile = getResourceProfile(preferredResource);
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

export function getResourceProfilesByTier(): Record<ResourceTier, ResourceProfile[]> {
  return {
    top: Object.values(RESOURCE_PROFILES).filter((profile) => profile.tier === "top"),
    mid: Object.values(RESOURCE_PROFILES).filter((profile) => profile.tier === "mid"),
    low: Object.values(RESOURCE_PROFILES).filter((profile) => profile.tier === "low")
  };
}

export function renderResourceInventory(): string {
  return [
    "# Device Inventory",
    "",
    ...Object.values(RESOURCE_PROFILES).flatMap((profile) => [
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

export function getResourceAliases(): string[] {
  return Object.keys(RESOURCE_PROFILES);
}
