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

export type PortLogAudience = "public" | "mates" | "profile";
export type PortLogSection = "all" | "general" | "advice" | "help" | "daily-log";

export interface PortCommunitySummary {
  username?: string | null;
  displayName?: string | null;
  membershipTier?: string | null;
  tokenBalance?: number;
  monthlyTokenAllotment?: number;
  dailyTokenAllotment?: number;
  termsAcceptedAt?: string | number | null;
  authorizedCaptainSlots?: number;
  authorizedCaptainCount?: number;
}

export interface PortLogEntry {
  id: string;
  parentId?: string | null;
  rootId?: string | null;
  uid?: string;
  username?: string | null;
  displayName?: string | null;
  authorType?: string | null;
  authorLabel?: string | null;
  premiumBadge?: boolean;
  audience: PortLogAudience;
  section: Exclude<PortLogSection, "all">;
  content: string;
  createdAt?: string | number | null;
  updatedAt?: string | number | null;
  score?: number;
  upVotes?: number;
  downVotes?: number;
  replyCount?: number;
  replies?: PortLogEntry[];
}

export interface PortFeedResult {
  logs: PortLogEntry[];
  feed: PortLogAudience;
  section: PortLogSection;
}

export interface PortPublishOptions {
  content: string;
  audience?: PortLogAudience;
  section?: Exclude<PortLogSection, "all">;
  parentId?: string;
}

export interface PortPublishResult {
  created: boolean;
  log: PortLogEntry | null;
  community?: PortCommunitySummary;
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
    },
    body: JSON.stringify({ snapshot }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Portal snapshot push failed (${response.status}): ${text}`);
  }
}

async function readPortalError(response: Response): Promise<string> {
  const data = await response.json().catch(() => null) as { message?: string; code?: string } | null;
  if (data?.message) {
    return data.message;
  }

  const text = await response.text().catch(() => "");
  return text || `Request failed with status ${response.status}.`;
}

function buildPortalSessionHeaders(session: PortalSession, includeContentType = false): Headers {
  const headers = new Headers({
    authorization: `Bearer ${session.sessionToken}`,
  });

  if (includeContentType) {
    headers.set("Content-Type", "application/json");
  }

  return headers;
}

export async function fetchPortLogs(
  session: PortalSession,
  options: {
    feed?: PortLogAudience;
    section?: PortLogSection;
    limit?: number;
  },
  fetchFn: FetchFn
): Promise<PortFeedResult> {
  const params = new URLSearchParams();
  if (options.feed) {
    params.set("feed", options.feed);
  }
  if (options.section) {
    params.set("section", options.section);
  }
  if (typeof options.limit === "number") {
    params.set("limit", String(options.limit));
  }

  const url = `${PORTAL_BASE_URL}/api/port/logs${params.size > 0 ? `?${params.toString()}` : ""}`;
  const response = await fetchFn(url, {
    method: "GET",
    headers: buildPortalSessionHeaders(session),
  });

  if (!response.ok) {
    throw new Error(`Port feed fetch failed (${response.status}): ${await readPortalError(response)}`);
  }

  return await response.json() as PortFeedResult;
}

/**
 * Fetch the public Port feed without authentication.
 * Requires the backend to expose GET /api/port/public-feed (see feature request).
 */
export async function fetchPublicFeed(
  options: {
    section?: PortLogSection;
    limit?: number;
    username?: string;
  },
  fetchFn: FetchFn
): Promise<PortFeedResult> {
  const params = new URLSearchParams();
  if (options.section && options.section !== "all") {
    params.set("section", options.section);
  }
  if (typeof options.limit === "number") {
    params.set("limit", String(options.limit));
  }
  if (options.username) {
    params.set("username", options.username);
  }

  const url = `${PORTAL_BASE_URL}/api/port/public-feed${params.size > 0 ? `?${params.toString()}` : ""}`;
  const response = await fetchFn(url, { method: "GET" });

  if (!response.ok) {
    throw new Error(`Public feed fetch failed (${response.status}): ${await readPortalError(response)}`);
  }

  return await response.json() as PortFeedResult;
}

export async function publishPortLog(
  session: PortalSession,
  options: PortPublishOptions,
  fetchFn: FetchFn
): Promise<PortPublishResult> {
  const body: Record<string, string> = {
    content: options.content,
  };

  if (options.audience) {
    body.audience = options.audience;
  }
  if (options.section) {
    body.section = options.section;
  }
  if (options.parentId) {
    body.parentId = options.parentId;
  }

  const response = await fetchFn(`${PORTAL_BASE_URL}/api/port/logs`, {
    method: "POST",
    headers: buildPortalSessionHeaders(session, true),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Port log publish failed (${response.status}): ${await readPortalError(response)}`);
  }

  return await response.json() as PortPublishResult;
}
