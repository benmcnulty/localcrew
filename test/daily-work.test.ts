import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import {
  DEFAULT_DAILY_WORK_INTERVAL_MS,
  getDailyWorkPath,
  getDailyWorkSnapshot,
  isDailyWorkStale,
  loadDailyWork,
  parseDailyWorkIntervalMs,
  buildDailyWorkPrompt,
  buildDailyWorkTaskContent,
  saveDailyWork,
} from "../src/daily-work.ts";
import { getStoragePaths } from "../src/storage.ts";

async function withTempDir(fn: (rootDir: string) => Promise<void>): Promise<void> {
  const rootDir = await mkdtemp(join(tmpdir(), "localcrew-daily-work-test-"));
  try {
    await fn(rootDir);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

describe("daily-work", () => {
  test("getDailyWorkPath returns path under orchestratorDir", async () => {
    await withTempDir(async (rootDir) => {
      const paths = getStoragePaths(rootDir);
      const dailyPath = getDailyWorkPath(rootDir);
      expect(dailyPath).toBe(join(paths.orchestratorDir, "daily-work.md"));
    });
  });

  test("loadDailyWork returns null when no document exists", async () => {
    await withTempDir(async (rootDir) => {
      const doc = await loadDailyWork(rootDir);
      expect(doc).toBeNull();
    });
  });

  test("saveDailyWork creates and loadDailyWork reads the document", async () => {
    await withTempDir(async (rootDir) => {
      // Ensure storage dir exists
      const paths = getStoragePaths(rootDir);
      await mkdir(join(rootDir, ".localcrew"), { recursive: true });
      await mkdir(paths.orchestratorDir, { recursive: true });

      const content = "# Daily Work\n\nTest content.";
      await saveDailyWork(content, rootDir);

      const doc = await loadDailyWork(rootDir);
      expect(doc).not.toBeNull();
      expect(doc!.content).toBe(content);
      expect(doc!.stale).toBe(false);
      expect(doc!.updatedAt).toBeTruthy();
    });
  });

  test("isDailyWorkStale returns false when orchestrator dir does not exist", async () => {
    await withTempDir(async (rootDir) => {
      const stale = await isDailyWorkStale(rootDir);
      expect(stale).toBe(false);
    });
  });

  test("isDailyWorkStale returns true when document is missing but dir exists", async () => {
    await withTempDir(async (rootDir) => {
      const paths = getStoragePaths(rootDir);
      await mkdir(join(rootDir, ".localcrew"), { recursive: true });
      await mkdir(paths.orchestratorDir, { recursive: true });

      const stale = await isDailyWorkStale(rootDir);
      expect(stale).toBe(true);
    });
  });

  test("isDailyWorkStale returns false for fresh document", async () => {
    await withTempDir(async (rootDir) => {
      const paths = getStoragePaths(rootDir);
      await mkdir(join(rootDir, ".localcrew"), { recursive: true });
      await mkdir(paths.orchestratorDir, { recursive: true });

      await saveDailyWork("# Fresh", rootDir);
      const stale = await isDailyWorkStale(rootDir);
      expect(stale).toBe(false);
    });
  });

  test("isDailyWorkStale returns true for a very short interval", async () => {
    await withTempDir(async (rootDir) => {
      const paths = getStoragePaths(rootDir);
      await mkdir(join(rootDir, ".localcrew"), { recursive: true });
      await mkdir(paths.orchestratorDir, { recursive: true });

      await saveDailyWork("# Old doc", rootDir);
      // Wait a tick so file age > 1ms
      await new Promise((r) => setTimeout(r, 5));
      // Use 1ms interval so it's immediately stale
      const stale = await isDailyWorkStale(rootDir, 1);
      expect(stale).toBe(true);
    });
  });

  test("parseDailyWorkIntervalMs defaults to 6 hours", () => {
    expect(parseDailyWorkIntervalMs()).toBe(DEFAULT_DAILY_WORK_INTERVAL_MS);
    expect(parseDailyWorkIntervalMs(undefined)).toBe(DEFAULT_DAILY_WORK_INTERVAL_MS);
    expect(parseDailyWorkIntervalMs("")).toBe(DEFAULT_DAILY_WORK_INTERVAL_MS);
  });

  test("parseDailyWorkIntervalMs parses hours", () => {
    expect(parseDailyWorkIntervalMs("4")).toBe(4 * 60 * 60 * 1000);
    expect(parseDailyWorkIntervalMs("1")).toBe(1 * 60 * 60 * 1000);
  });

  test("parseDailyWorkIntervalMs clamps to 24 hours", () => {
    expect(parseDailyWorkIntervalMs("48")).toBe(24 * 60 * 60 * 1000);
    expect(parseDailyWorkIntervalMs("100")).toBe(24 * 60 * 60 * 1000);
  });

  test("parseDailyWorkIntervalMs rejects invalid values", () => {
    expect(parseDailyWorkIntervalMs("abc")).toBe(DEFAULT_DAILY_WORK_INTERVAL_MS);
    expect(parseDailyWorkIntervalMs("0")).toBe(DEFAULT_DAILY_WORK_INTERVAL_MS);
    expect(parseDailyWorkIntervalMs("-1")).toBe(DEFAULT_DAILY_WORK_INTERVAL_MS);
  });

  test("getDailyWorkSnapshot returns unavailable when no document", async () => {
    await withTempDir(async (rootDir) => {
      const snap = await getDailyWorkSnapshot(rootDir);
      expect(snap.available).toBe(false);
      expect(snap.content).toBeNull();
      expect(snap.updatedAt).toBeNull();
      expect(snap.stale).toBe(true);
    });
  });

  test("getDailyWorkSnapshot returns content when document exists", async () => {
    await withTempDir(async (rootDir) => {
      const paths = getStoragePaths(rootDir);
      await mkdir(join(rootDir, ".localcrew"), { recursive: true });
      await mkdir(paths.orchestratorDir, { recursive: true });

      const content = "# Daily Work\n\nSnapshot test.";
      await saveDailyWork(content, rootDir);

      const snap = await getDailyWorkSnapshot(rootDir);
      expect(snap.available).toBe(true);
      expect(snap.content).toBe(content);
      expect(snap.stale).toBe(false);
      expect(snap.intervalMs).toBe(DEFAULT_DAILY_WORK_INTERVAL_MS);
    });
  });

  test("buildDailyWorkPrompt includes required sections", () => {
    const prompt = buildDailyWorkPrompt({
      orchestratorName: "TestBot",
      date: "2026-03-04",
      userProfile: "AI engineer at Acme Corp.",
      focusTodo: "- Finish API v2",
    });

    expect(prompt).toContain("TestBot");
    expect(prompt).toContain("2026-03-04");
    expect(prompt).toContain("AI engineer at Acme Corp.");
    expect(prompt).toContain("Finish API v2");
    expect(prompt).toContain("Today's Focus");
    expect(prompt).toContain("Active Projects");
    expect(prompt).toContain("Research & Discovery");
    expect(prompt).toContain("Quick Reference");
    expect(prompt).toContain("System Health");
  });

  test("buildDailyWorkPrompt includes previous document when provided", () => {
    const prompt = buildDailyWorkPrompt({
      orchestratorName: "Bot",
      date: "2026-03-04",
      userProfile: "",
      focusTodo: "",
      previousDocument: "# Previous\n\nOld content.",
    });

    expect(prompt).toContain("Previous Daily Work Document");
    expect(prompt).toContain("Old content.");
  });

  test("buildDailyWorkPrompt includes custom directive when provided", () => {
    const prompt = buildDailyWorkPrompt({
      orchestratorName: "Bot",
      date: "2026-03-04",
      userProfile: "",
      focusTodo: "",
      customDirective: "Focus on TypeScript best practices.",
    });

    expect(prompt).toContain("Custom Directive");
    expect(prompt).toContain("Focus on TypeScript best practices.");
  });

  test("buildDailyWorkTaskContent includes date and WRITE instruction", () => {
    const content = buildDailyWorkTaskContent("2026-03-04");
    expect(content).toContain("2026-03-04");
    expect(content).toContain("WRITE[internal][daily-work.md]");
    expect(content).toContain("Daily Work briefing");
  });
});
