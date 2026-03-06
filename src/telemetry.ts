import { appendFile, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";

import { atomicWriteFile, getStoragePaths, withFileLock } from "./storage.ts";
import type { AuditEvent, TelemetryMetricBucket, TelemetrySummary } from "./types.ts";

/** Maximum audit log size in bytes before rotation (~5 MB). */
const AUDIT_LOG_MAX_BYTES = 5 * 1024 * 1024;
/** Number of rotated archive files to keep. */
const AUDIT_LOG_KEEP_ARCHIVES = 2;

function getAuditLogArchivePath(logPath: string, index: number): string {
  return logPath.replace(/\.jsonl$/, `.${index}.jsonl`);
}

function emptyBucket(): TelemetryMetricBucket {
  return {
    calls: 0,
    errors: 0,
    totalDurationMs: 0,
    promptEvalCount: 0,
    evalCount: 0,
    promptChars: 0,
    responseChars: 0
  };
}

export function getDefaultTelemetrySummary(): TelemetrySummary {
  return {
    updatedAt: null,
    totalEvents: 0,
    lastEventId: 0,
    byKind: {},
    byScope: {},
    models: {},
    resources: {},
    wikipedia: {
      calls: 0,
      errors: 0,
      totalDurationMs: 0,
      recentQueries: []
    },
    reddit: {
      calls: 0,
      errors: 0,
      totalDurationMs: 0,
      recentQueries: []
    },
    search: {
      calls: 0,
      errors: 0,
      totalDurationMs: 0,
      recentQueries: []
    },
    weather: {
      calls: 0,
      errors: 0,
      totalDurationMs: 0,
      recentLocations: []
    },
    benlive: {
      calls: 0,
      errors: 0,
      totalDurationMs: 0,
      recentPaths: []
    },
    website: {
      calls: 0,
      errors: 0,
      totalDurationMs: 0,
      recentPaths: []
    },
    recent: []
  };
}

async function ensureTelemetryLayout(rootDir = process.cwd()): Promise<void> {
  const paths = getStoragePaths(rootDir);
  await mkdir(paths.telemetryDir, { recursive: true });

  try {
    await readFile(paths.telemetrySummaryPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
    await writeFile(
      paths.telemetrySummaryPath,
      `${JSON.stringify(getDefaultTelemetrySummary(), null, 2)}\n`,
      "utf8"
    );
  }

  try {
    await readFile(paths.auditLogPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
    await writeFile(paths.auditLogPath, "", "utf8");
  }
}

export async function loadTelemetrySummary(rootDir = process.cwd()): Promise<TelemetrySummary> {
  const paths = getStoragePaths(rootDir);
  await ensureTelemetryLayout(rootDir);

  try {
    const raw = await readFile(paths.telemetrySummaryPath, "utf8");
    return JSON.parse(raw) as TelemetrySummary;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Telemetry summary is not valid JSON: ${error.message}`);
    }

    throw error;
  }
}

export async function resetTelemetry(rootDir = process.cwd()): Promise<void> {
  const paths = getStoragePaths(rootDir);
  await withFileLock(paths.telemetrySummaryPath, async () => {
    await ensureTelemetryLayout(rootDir);
    await atomicWriteFile(
      paths.telemetrySummaryPath,
      `${JSON.stringify(getDefaultTelemetrySummary(), null, 2)}\n`
    );
    await atomicWriteFile(paths.auditLogPath, "");
    for (let index = 1; index <= AUDIT_LOG_KEEP_ARCHIVES; index += 1) {
      await rm(getAuditLogArchivePath(paths.auditLogPath, index), { force: true }).catch(() => {});
    }
  });
}

function updateMetricBucket(
  buckets: Record<string, TelemetryMetricBucket>,
  key: string,
  event: AuditEvent
): void {
  const existing = buckets[key] ?? emptyBucket();
  existing.calls += 1;
  if (!event.success) {
    existing.errors += 1;
  }
  existing.totalDurationMs += event.durationMs ?? 0;
  existing.promptEvalCount += event.promptEvalCount ?? 0;
  existing.evalCount += event.evalCount ?? 0;
  existing.promptChars += event.promptChars ?? 0;
  existing.responseChars += event.responseChars ?? 0;
  buckets[key] = existing;
}

export async function appendAuditEvent(
  event: Omit<AuditEvent, "id">,
  rootDir = process.cwd()
): Promise<AuditEvent> {
  const paths = getStoragePaths(rootDir);
  return withFileLock(paths.telemetrySummaryPath, async () => {
    await ensureTelemetryLayout(rootDir);
    const summary = await loadTelemetrySummary(rootDir);
    const nextEvent: AuditEvent = {
      ...event,
      id: summary.lastEventId + 1
    };

  summary.lastEventId = nextEvent.id;
  summary.updatedAt = nextEvent.timestamp;
  summary.totalEvents += 1;
  summary.byKind[nextEvent.kind] = (summary.byKind[nextEvent.kind] ?? 0) + 1;
  summary.byScope[nextEvent.scope] = (summary.byScope[nextEvent.scope] ?? 0) + 1;

  if (nextEvent.kind === "ollama.chat") {
    const modelKey = `${nextEvent.resourceAlias ?? "unknown"}/${nextEvent.model ?? "unknown"}`;
    updateMetricBucket(summary.models, modelKey, nextEvent);
    if (nextEvent.resourceAlias) {
      updateMetricBucket(summary.resources, nextEvent.resourceAlias, nextEvent);
    }
  }

  if (nextEvent.kind === "wikipedia.search") {
    summary.wikipedia.calls += 1;
    if (!nextEvent.success) {
      summary.wikipedia.errors += 1;
    }
    summary.wikipedia.totalDurationMs += nextEvent.durationMs ?? 0;
    const query = typeof nextEvent.metadata?.query === "string" ? nextEvent.metadata.query : undefined;
    if (query) {
      summary.wikipedia.recentQueries = [query, ...summary.wikipedia.recentQueries.filter((value) => value !== query)].slice(0, 10);
    }
  }

  if (nextEvent.kind === "reddit.search") {
    summary.reddit ??= { calls: 0, errors: 0, totalDurationMs: 0, recentQueries: [] };
    summary.reddit.calls += 1;
    if (!nextEvent.success) {
      summary.reddit.errors += 1;
    }
    summary.reddit.totalDurationMs += nextEvent.durationMs ?? 0;
    const query = typeof nextEvent.metadata?.query === "string" ? nextEvent.metadata.query : undefined;
    if (query) {
      summary.reddit.recentQueries = [query, ...summary.reddit.recentQueries.filter((value) => value !== query)].slice(0, 10);
    }
  }

  if (nextEvent.kind === "search.web") {
    summary.search ??= { calls: 0, errors: 0, totalDurationMs: 0, recentQueries: [] };
    summary.search.calls += 1;
    if (!nextEvent.success) {
      summary.search.errors += 1;
    }
    summary.search.totalDurationMs += nextEvent.durationMs ?? 0;
    const query = typeof nextEvent.metadata?.query === "string" ? nextEvent.metadata.query : undefined;
    if (query) {
      summary.search.recentQueries = [query, ...summary.search.recentQueries.filter((value) => value !== query)].slice(0, 10);
    }
  }

  if (nextEvent.kind === "weather.fetch") {
    summary.weather ??= { calls: 0, errors: 0, totalDurationMs: 0, recentLocations: [] };
    summary.weather.calls += 1;
    if (!nextEvent.success) {
      summary.weather.errors += 1;
    }
    summary.weather.totalDurationMs += nextEvent.durationMs ?? 0;
    const location = typeof nextEvent.metadata?.location === "string" ? nextEvent.metadata.location : undefined;
    if (location) {
      summary.weather.recentLocations = [location, ...summary.weather.recentLocations.filter((value) => value !== location)].slice(0, 10);
    }
  }

  if (nextEvent.kind === "benlive.fetch") {
    summary.benlive ??= { calls: 0, errors: 0, totalDurationMs: 0, recentPaths: [] };
    summary.benlive.calls += 1;
    if (!nextEvent.success) {
      summary.benlive.errors += 1;
    }
    summary.benlive.totalDurationMs += nextEvent.durationMs ?? 0;
    const topic = typeof nextEvent.metadata?.topic === "string" ? nextEvent.metadata.topic : undefined;
    if (topic) {
      summary.benlive.recentPaths = [topic, ...summary.benlive.recentPaths.filter((value) => value !== topic)].slice(0, 10);
    }
  }

  if (nextEvent.kind === "website.fetch") {
    summary.website ??= { calls: 0, errors: 0, totalDurationMs: 0, recentPaths: [] };
    summary.website.calls += 1;
    if (!nextEvent.success) {
      summary.website.errors += 1;
    }
    summary.website.totalDurationMs += nextEvent.durationMs ?? 0;
    const topic = typeof nextEvent.metadata?.topic === "string" ? nextEvent.metadata.topic : undefined;
    if (topic) {
      summary.website.recentPaths = [topic, ...summary.website.recentPaths.filter((value) => value !== topic)].slice(0, 10);
    }
  }

  summary.recent = [
    {
      id: nextEvent.id,
      timestamp: nextEvent.timestamp,
      kind: nextEvent.kind,
      scope: nextEvent.scope,
      summary: nextEvent.summary,
      success: nextEvent.success
    },
    ...summary.recent
  ].slice(0, 20);

  await rotateAuditLogIfNeeded(paths.auditLogPath);
  await appendFile(paths.auditLogPath, `${JSON.stringify(nextEvent)}\n`, "utf8");
  await atomicWriteFile(paths.telemetrySummaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  return nextEvent;
  });
}

/**
 * Rotate the audit log when it exceeds AUDIT_LOG_MAX_BYTES.
 * Keeps up to AUDIT_LOG_KEEP_ARCHIVES numbered archive files
 * (audit-log.1.jsonl, audit-log.2.jsonl, etc.).
 */
async function rotateAuditLogIfNeeded(logPath: string): Promise<void> {
  try {
    const info = await stat(logPath);
    if (info.size < AUDIT_LOG_MAX_BYTES) {
      return;
    }
  } catch {
    return;
  }

  // Shift existing archives: .2 is deleted, .1 becomes .2, current becomes .1
  for (let i = AUDIT_LOG_KEEP_ARCHIVES; i >= 1; i--) {
    const archivePath = getAuditLogArchivePath(logPath, i);
    if (i === AUDIT_LOG_KEEP_ARCHIVES) {
      // Delete the oldest archive (overwritten by rename below or just gone)
      try {
        const { unlink } = await import("node:fs/promises");
        await unlink(archivePath);
      } catch {
        // File may not exist — that is fine
      }
    }
    if (i > 1) {
      const olderPath = getAuditLogArchivePath(logPath, i - 1);
      try {
        await rename(olderPath, archivePath);
      } catch {
        // Source may not exist yet
      }
    }
  }

  // Rotate current log to .1
  const firstArchive = getAuditLogArchivePath(logPath, 1);
  try {
    await rename(logPath, firstArchive);
    await writeFile(logPath, "", "utf8");
  } catch {
    // Best-effort rotation; do not block the caller
  }
}

export async function readRecentAuditEvents(
  limit = 10,
  rootDir = process.cwd()
): Promise<AuditEvent[]> {
  const paths = getStoragePaths(rootDir);
  await ensureTelemetryLayout(rootDir);
  const allEvents: AuditEvent[] = [];

  for (const candidatePath of [
    paths.auditLogPath,
    ...Array.from({ length: AUDIT_LOG_KEEP_ARCHIVES }, (_, index) =>
      getAuditLogArchivePath(paths.auditLogPath, index + 1)
    )
  ]) {
    try {
      const raw = await readFile(candidatePath, "utf8");
      const events = raw
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line !== "")
        .map((line) => JSON.parse(line) as AuditEvent);
      allEvents.push(...events);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  return allEvents
    .sort((left, right) => right.id - left.id)
    .slice(0, limit);
}
