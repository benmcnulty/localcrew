import { existsSync, readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getOptionalEnvString } from "./env.ts";
import { atomicWriteFile } from "./storage.ts";

export const PORTAL_BASE_URL = getOptionalEnvString("LOCALCREW_PORTAL_URL", "https://benlive.tv") ?? "https://benlive.tv";

export interface PortalSession {
  sessionToken: string;
  deviceId?: string;
  orchestratorId: string;
  userId: string;
  username?: string;
  displayName?: string;
  expiresAt: string;
  connectedAt: string;
}

export interface PortalSnapshot {
  mode: string;
  busy?: boolean;
  queueDepth?: {
    pending: number;
    completed: number;
    failed: number;
  };
  nextTask?: {
    priority: string;
    content: string;
    resourceAlias?: string | null;
  } | null;
  lastCompleted?: {
    content: string;
    resourceAlias?: string | null;
  } | null;
  resources?: Array<{ alias: string; tier?: string; isBusy?: boolean; model?: string | null }>;
  capacity?: {
    resourceCount: number;
    knownCpuLogicalCores: number;
    knownRamGb: number;
    knownGpuCount: number;
    knownTotalVramGb: number;
    highestKnownContextTokens: number;
  } | null;
  modelProfile?: string;
  tps?: number;
  dailySession?: {
    active: boolean;
    startTime: string | null;
    taskCount: number;
    errorCount: number;
  } | null;
  orchestratorName?: string;
}

export type FetchFn = typeof fetch;

function portalSessionPath(rootDir: string): string {
  return join(rootDir, ".localcrew", "portal-session.json");
}

export function loadPortalSession(rootDir: string): PortalSession | null {
  const path = portalSessionPath(rootDir);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as PortalSession;
  } catch {
    return null;
  }
}

export async function savePortalSession(rootDir: string, session: PortalSession): Promise<void> {
  const path = portalSessionPath(rootDir);
  await mkdir(dirname(path), { recursive: true });
  await atomicWriteFile(path, JSON.stringify(session, null, 2));
}

export async function validateDeviceToken(
  token: string,
  details: {
    orchestratorName: string;
    capacitySummary?: unknown;
  },
  fetchFn: FetchFn
): Promise<PortalSession> {
  const url = `${PORTAL_BASE_URL}/api/crew/validate-token`;
  const response = await fetchFn(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      orchestratorName: details.orchestratorName,
      capacitySummary: details.capacitySummary ?? null,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Portal token validation failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    sessionToken: string;
    deviceId?: string;
    orchestratorId: string;
    userId: string;
    username?: string;
    displayName?: string;
    expiresAt: string;
  };

  return {
    sessionToken: data.sessionToken,
    ...(typeof data.deviceId === "string" ? { deviceId: data.deviceId } : {}),
    orchestratorId: data.orchestratorId,
    userId: data.userId,
    ...(typeof data.username === "string" ? { username: data.username } : {}),
    ...(typeof data.displayName === "string" ? { displayName: data.displayName } : {}),
    expiresAt: data.expiresAt,
    connectedAt: new Date().toISOString(),
  };
}

export async function pushSnapshot(
  session: PortalSession,
  snapshot: PortalSnapshot,
  fetchFn: FetchFn
): Promise<void> {
  const url = `${PORTAL_BASE_URL}/api/crew/snapshot`;
  const response = await fetchFn(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${session.sessionToken}`,
      "X-Crew-Session": session.sessionToken,
    },
    body: JSON.stringify({ snapshot }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Portal snapshot push failed (${response.status}): ${text}`);
  }
}
