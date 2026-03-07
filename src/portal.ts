import { existsSync, readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getOptionalEnvString } from "./env.ts";
import { atomicWriteFile } from "./storage.ts";

export const PORTAL_BASE_URL = getOptionalEnvString("LOCALCREW_PORTAL_URL", "https://benlive.tv") ?? "https://benlive.tv";

export interface PortalSession {
  sessionToken: string;
  orchestratorId: string;
  userId: string;
  expiresAt: string;
  connectedAt: string;
}

export interface PortalSnapshot {
  mode: string;
  queueDepth: number;
  resourceCount: number;
  autoBusy: boolean;
  autoEnabled: boolean;
  orchestratorName: string;
  resources: Array<{ alias: string; label: string; tier?: string }>;
  capacitySummary?: string;
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
  fetchFn: FetchFn
): Promise<PortalSession> {
  const url = `${PORTAL_BASE_URL}/api/crew/validate-token`;
  const response = await fetchFn(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Portal token validation failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    sessionToken: string;
    orchestratorId: string;
    userId: string;
    expiresAt: string;
  };

  return {
    sessionToken: data.sessionToken,
    orchestratorId: data.orchestratorId,
    userId: data.userId,
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
      "X-Crew-Session": session.sessionToken,
    },
    body: JSON.stringify(snapshot),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Portal snapshot push failed (${response.status}): ${text}`);
  }
}
