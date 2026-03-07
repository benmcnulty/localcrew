/**
 * Daily Work — generates and manages a daily briefing document.
 *
 * Responsibilities:
 * - Load / save the daily work document from `.localcrew/system/secure/orchestrator/daily-work.md`
 * - Detect staleness (configurable interval, default 6 hours)
 * - Provide a template for the briefing document
 * - Expose a snapshot for the API / display overlay
 */

import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { getStoragePaths, atomicWriteFile } from "./storage.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default refresh interval — 6 hours in milliseconds. */
export const DEFAULT_DAILY_WORK_INTERVAL_MS = 6 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

export function getDailyWorkPath(rootDir = process.cwd()): string {
  const paths = getStoragePaths(rootDir);
  return join(paths.orchestratorDir, "daily-work.md");
}

// ---------------------------------------------------------------------------
// Load / Save
// ---------------------------------------------------------------------------

export interface DailyWorkDocument {
  /** Raw markdown content. */
  content: string;
  /** ISO-8601 timestamp of last write. Derived from file stat. */
  updatedAt: string;
  /** Whether the document is older than the configured refresh interval. */
  stale: boolean;
}

/**
 * Load the daily work document. Returns `null` when no document exists.
 */
export async function loadDailyWork(
  rootDir = process.cwd(),
  intervalMs = DEFAULT_DAILY_WORK_INTERVAL_MS,
): Promise<DailyWorkDocument | null> {
  const docPath = getDailyWorkPath(rootDir);
  if (!existsSync(docPath)) {
    return null;
  }
  try {
    const raw = await readFile(docPath, "utf8");
    const fileStat = await stat(docPath);
    const updatedAt = fileStat.mtime.toISOString();
    const ageMs = Date.now() - fileStat.mtime.getTime();
    return {
      content: raw,
      updatedAt,
      stale: ageMs > intervalMs,
    };
  } catch {
    return null;
  }
}

/**
 * Write (or overwrite) the daily work document.
 * If a previous document exists it is archived before being replaced.
 */
export async function saveDailyWork(
  content: string,
  rootDir = process.cwd(),
): Promise<void> {
  const paths = getStoragePaths(rootDir);
  const docPath = paths.dailyWorkPath;
  await mkdir(join(docPath, ".."), { recursive: true });

  // Archive the existing document before overwriting.
  if (existsSync(docPath)) {
    try {
      const fileStat = await stat(docPath);
      const ts = fileStat.mtime.toISOString().replace(/[:.]/g, "-").slice(0, 19);
      await mkdir(paths.dailyWorkArchiveDir, { recursive: true });
      const existingContent = await readFile(docPath, "utf8");
      await writeFile(join(paths.dailyWorkArchiveDir, `daily-work-${ts}.md`), existingContent, "utf8");
    } catch {
      // Archive failure is non-fatal — proceed with save.
    }
  }

  await atomicWriteFile(docPath, content);
}

// ---------------------------------------------------------------------------
// Archive
// ---------------------------------------------------------------------------

export interface DailyWorkArchiveEntry {
  filename: string;
  updatedAt: string;
  content: string;
}

/** Maximum number of archive entries surfaced via the API. */
const MAX_ARCHIVE_ENTRIES = 10;

/**
 * Load archived daily work documents, newest first, up to MAX_ARCHIVE_ENTRIES.
 */
export async function loadDailyWorkArchives(
  rootDir = process.cwd(),
): Promise<DailyWorkArchiveEntry[]> {
  const paths = getStoragePaths(rootDir);
  const archiveDir = paths.dailyWorkArchiveDir;
  if (!existsSync(archiveDir)) return [];
  try {
    const files = (await readdir(archiveDir))
      .filter((f) => f.endsWith(".md"))
      .sort()
      .reverse()
      .slice(0, MAX_ARCHIVE_ENTRIES);
    const entries: DailyWorkArchiveEntry[] = [];
    for (const filename of files) {
      try {
        const filePath = join(archiveDir, filename);
        const content = await readFile(filePath, "utf8");
        const fileStat = await stat(filePath);
        entries.push({ filename, updatedAt: fileStat.mtime.toISOString(), content });
      } catch {
        // Skip unreadable files.
      }
    }
    return entries;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Staleness helpers
// ---------------------------------------------------------------------------

/**
 * Returns `true` when the daily work document is missing, or when it is
 * older than `intervalMs`. Returns `false` if the orchestrator directory
 * does not exist (system not yet initialized).
 */
export async function isDailyWorkStale(
  rootDir = process.cwd(),
  intervalMs = DEFAULT_DAILY_WORK_INTERVAL_MS,
): Promise<boolean> {
  // Skip if the orchestrator directory hasn't been created yet.
  const paths = getStoragePaths(rootDir);
  if (!existsSync(paths.orchestratorDir)) {
    return false;
  }
  const doc = await loadDailyWork(rootDir, intervalMs);
  return doc === null || doc.stale;
}

/**
 * Parse the refresh interval from user preferences.
 * Accepts hours as a number (e.g. "4" → 4 hours). Clamps to 1–24 h.
 */
export function parseDailyWorkIntervalMs(value?: string): number {
  if (!value) return DEFAULT_DAILY_WORK_INTERVAL_MS;
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours < 1) return DEFAULT_DAILY_WORK_INTERVAL_MS;
  return Math.min(hours, 24) * 60 * 60 * 1000;
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

/**
 * Build the system prompt fragment that instructs the model to generate
 * a daily work document. The model output will be saved directly.
 */
export function buildDailyWorkPrompt(options: {
  orchestratorName: string;
  date: string;
  userProfile: string;
  focusTodo: string;
  previousDocument?: string;
  customDirective?: string;
}): string {
  const lines: string[] = [
    "You are generating a Daily Work briefing document for the orchestrator.",
    "",
    `**Orchestrator:** ${options.orchestratorName}`,
    `**Date:** ${options.date}`,
    "",
    "## User Profile",
    "",
    options.userProfile || "(No profile available.)",
    "",
    "## Current Focus & Priorities",
    "",
    options.focusTodo || "(No focus items set.)",
    "",
  ];

  if (options.customDirective) {
    lines.push(
      "## Custom Directive",
      "",
      options.customDirective,
      "",
    );
  }

  if (options.previousDocument) {
    lines.push(
      "## Previous Daily Work Document",
      "",
      "Use this for continuity — update stale info, carry forward active items, and add something new:",
      "",
      options.previousDocument,
      "",
    );
  }

  lines.push(
    "## Instructions",
    "",
    "Generate a comprehensive Daily Work markdown document with these sections:",
    "",
    "1. **Today's Focus** — Top 3-5 priorities for today, derived from the focus-todo and user profile.",
    "2. **Active Projects** — Status of ongoing work. Carry forward from previous document if available.",
    "3. **Research & Discovery** — One new topic, tool, technique, or idea to explore today. Each day should introduce something novel.",
    "4. **Quick Reference** — Key facts, links, or reminders the user may need today.",
    "5. **System Health** — Brief notes on orchestrator status, resource availability, or maintenance items.",
    "",
    "Keep the tone concise and actionable. Use bullet points. The document should be useful at a glance.",
    "Each time this document is regenerated, the 'Research & Discovery' section MUST contain something new — a fresh enhancement, technique, tool, or creative idea not seen in the previous document.",
    "",
    "Output ONLY the markdown document content. No preamble, no commentary.",
  );

  return lines.join("\n");
}

/**
 * Build the auto-queue task content string for daily work generation.
 */
export function buildDailyWorkTaskContent(date: string): string {
  return `Generate the Daily Work briefing document for ${date}. This is a high-priority system task — produce the full daily-work.md content. Output the document using WRITE[internal][daily-work.md] so it is saved to the canonical path. Include sections: Today's Focus, Active Projects, Research & Discovery (something new each time), Quick Reference, and System Health.`;
}

// ---------------------------------------------------------------------------
// API Snapshot
// ---------------------------------------------------------------------------

export interface DailyWorkSnapshot {
  available: boolean;
  content: string | null;
  updatedAt: string | null;
  stale: boolean;
  intervalMs: number;
  archives: DailyWorkArchiveEntry[];
}

export async function getDailyWorkSnapshot(
  rootDir = process.cwd(),
  intervalMs = DEFAULT_DAILY_WORK_INTERVAL_MS,
): Promise<DailyWorkSnapshot> {
  const [doc, archives] = await Promise.all([
    loadDailyWork(rootDir, intervalMs),
    loadDailyWorkArchives(rootDir),
  ]);
  return {
    available: doc !== null,
    content: doc?.content ?? null,
    updatedAt: doc?.updatedAt ?? null,
    stale: doc === null || doc.stale,
    intervalMs,
    archives,
  };
}
