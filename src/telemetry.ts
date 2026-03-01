import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";

import { getStoragePaths } from "./storage.ts";
import type { AuditEvent, TelemetryMetricBucket, TelemetrySummary } from "./types.ts";

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

  await appendFile(paths.auditLogPath, `${JSON.stringify(nextEvent)}\n`, "utf8");
  await writeFile(paths.telemetrySummaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  return nextEvent;
}

export async function readRecentAuditEvents(
  limit = 10,
  rootDir = process.cwd()
): Promise<AuditEvent[]> {
  const paths = getStoragePaths(rootDir);
  await ensureTelemetryLayout(rootDir);
  const raw = await readFile(paths.auditLogPath, "utf8");
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

  return lines
    .slice(Math.max(0, lines.length - limit))
    .map((line) => JSON.parse(line) as AuditEvent)
    .reverse();
}
