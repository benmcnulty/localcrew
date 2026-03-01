import { getEnvString, loadLocalEnv } from "./env.ts";

function sanitizeName(value: string): string {
  const trimmed = value.trim();
  return trimmed === "" ? "Orchestrator" : trimmed;
}

export function getOrchestratorIdentityName(rootDir = process.cwd()): string {
  loadLocalEnv(rootDir);
  return sanitizeName(getEnvString("CRUSTY_ORCHESTRATOR_NAME", "Orchestrator"));
}

export function getOrchestratorIdentityLabel(rootDir = process.cwd()): string {
  return `${getOrchestratorIdentityName(rootDir)}, the orchestrator`;
}
