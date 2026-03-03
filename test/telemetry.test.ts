import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { readRecentAuditEvents } from "../src/telemetry.ts";
import { getStoragePaths } from "../src/storage.ts";

async function withTempDir(run: (rootDir: string) => Promise<void>): Promise<void> {
  const rootDir = await mkdtemp(join(tmpdir(), "localcrew-"));

  try {
    await run(rootDir);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

describe("audit log history", () => {
  test("reads recent audit events from rotated archives as well as the active log", async () => {
    await withTempDir(async (rootDir) => {
      const paths = getStoragePaths(rootDir);
      await mkdir(paths.telemetryDir, { recursive: true });
      await writeFile(paths.auditLogPath, "");
      await writeFile(
        paths.auditLogPath.replace(/\.jsonl$/, ".1.jsonl"),
        [
          JSON.stringify({
            id: 9,
            timestamp: "2026-03-01T00:00:09.000Z",
            kind: "system",
            scope: "archive",
            summary: "Older archived event",
            success: true
          }),
          JSON.stringify({
            id: 10,
            timestamp: "2026-03-01T00:00:10.000Z",
            kind: "system",
            scope: "archive",
            summary: "Newest archived event",
            success: true
          })
        ].join("\n") + "\n"
      );

      const recent = await readRecentAuditEvents(2, rootDir);

      expect(recent.map((event) => event.id)).toEqual([10, 9]);
      expect(recent[0].summary).toBe("Newest archived event");
    });
  });
});
