export function buildDiscoveryFailureHelp(
  apiStyle: "ollama" | "openai" | "anthropic",
  endpointUrl: string,
  machine: { platform: string },
): string;

export function buildLocalEndpointCandidates(
  baseUrl: string,
  apiStyle: "ollama" | "openai" | "anthropic",
): string[];

export function buildRecommendedOllamaServeCommand(
  platformName: string,
  endpointUrl: string,
): string;

export function getEndpointSetupNotes(
  localEndpoint: string,
  apiStyle: "ollama" | "openai" | "anthropic",
  machine: { platform: string; localIp?: string },
): string[];

export function getRecommendedOllamaHost(endpointUrl: string): string;

export function isLocalEndpointHost(
  hostName: string,
  machine: { localIp?: string },
): boolean;

export function isPrivateIpv4Address(value: string): boolean;

export function parseArgs(argv: string[]): {
  rootDir: string;
  endpointUrl: string;
  apiStyle: "ollama" | "openai" | "anthropic";
  apiKeyEnv?: string;
  agentPort?: number;
  alias?: string;
  nickname?: string;
  tier?: "top" | "mid" | "low";
  orchestratorUrl?: string;
  gpuModel?: string;
  gpuCount?: number;
  totalVramGb?: number;
  maxContextTokens?: number;
  once: boolean;
};
