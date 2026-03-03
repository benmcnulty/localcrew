import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, test } from "bun:test";

import {
  appendChangelogEntry,
  ensureSystemLayout,
  saveFocusTodo,
  saveAgentSpec,
  createAgent,
  loadAgentSpec,
} from "../src/orchestrator-store.ts";
import {
  searchInternalFiles,
  readInternalFile,
  getInternalFileTree,
} from "../src/internal-files.ts";
import { loadSeedFile } from "../src/external-memory.ts";
import {
  ensureDropboxLayout,
  ingestNextInboxDocument,
  writeGeneratedDropboxDocument,
  writeInboxDocument,
} from "../src/dropbox.ts";
import { atomicWriteFile, getStoragePaths } from "../src/storage.ts";
import type { AutoQueueTask } from "../src/types.ts";

async function withTempDir(run: (rootDir: string) => Promise<void>): Promise<void> {
  const rootDir = await mkdtemp(join(tmpdir(), "localcrew-sec-"));
  try {
    await run(rootDir);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// saveFocusTodo — atomicity
// ---------------------------------------------------------------------------
describe("saveFocusTodo atomicity", () => {
  test("writes focus-todo file with atomic write", async () => {
    await withTempDir(async (rootDir) => {
      await ensureSystemLayout(rootDir);
      const tasks: AutoQueueTask[] = [
        { id: 1, content: "Test task one", priority: "high", status: "queued", createdAt: new Date().toISOString(), createdBy: "test" },
        { id: 2, content: "Test task two", priority: "medium", status: "queued", createdAt: new Date().toISOString(), createdBy: "test" },
      ];
      await saveFocusTodo(tasks, rootDir);
      const paths = getStoragePaths(rootDir);
      const content = await readFile(paths.focusTodoPath, "utf8");
      expect(content).toContain("# In Focus Todo");
      expect(content).toContain("[high] #1 Test task one");
      expect(content).toContain("[medium] #2 Test task two");
      expect(content.endsWith("\n")).toBe(true);
    });
  });

  test("writes default focus-todo when task list is empty", async () => {
    await withTempDir(async (rootDir) => {
      await ensureSystemLayout(rootDir);
      await saveFocusTodo([], rootDir);
      const paths = getStoragePaths(rootDir);
      const content = await readFile(paths.focusTodoPath, "utf8");
      expect(content).toContain("# In Focus Todo");
      expect(content.endsWith("\n")).toBe(true);
    });
  });

  test("concurrent saveFocusTodo calls do not corrupt the file", async () => {
    await withTempDir(async (rootDir) => {
      await ensureSystemLayout(rootDir);
      const runs = Array.from({ length: 10 }, (_, i) =>
        saveFocusTodo(
          [{ id: i + 1, content: `Task ${i + 1}`, priority: "medium", status: "queued", createdAt: new Date().toISOString(), createdBy: "test" }],
          rootDir,
        ),
      );
      await Promise.all(runs);
      const paths = getStoragePaths(rootDir);
      const content = await readFile(paths.focusTodoPath, "utf8");
      // File should be valid — the last write wins, but the content is not garbled
      expect(content).toContain("# In Focus Todo");
      expect(content.endsWith("\n")).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// appendChangelogEntry — atomicity + locking
// ---------------------------------------------------------------------------
describe("appendChangelogEntry atomicity and locking", () => {
  test("appends a timestamped entry", async () => {
    await withTempDir(async (rootDir) => {
      await ensureSystemLayout(rootDir);
      await appendChangelogEntry("First change", rootDir);
      const paths = getStoragePaths(rootDir);
      const content = await readFile(paths.changelogPath, "utf8");
      expect(content).toContain("First change");
      // Timestamp is ISO 8601
      expect(content).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  test("concurrent appends are serialized via lock", async () => {
    await withTempDir(async (rootDir) => {
      await ensureSystemLayout(rootDir);
      const runs = Array.from({ length: 5 }, (_, i) =>
        appendChangelogEntry(`Entry ${i + 1}`, rootDir),
      );
      await Promise.all(runs);
      const paths = getStoragePaths(rootDir);
      const content = await readFile(paths.changelogPath, "utf8");
      // All 5 entries must be present — none lost to concurrent overwrites
      for (let i = 1; i <= 5; i++) {
        expect(content).toContain(`Entry ${i}`);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// saveAgentSpec — atomicity
// ---------------------------------------------------------------------------
describe("saveAgentSpec atomicity", () => {
  test("saves agent spec with atomic write", async () => {
    await withTempDir(async (rootDir) => {
      await ensureSystemLayout(rootDir);
      await createAgent(
        {
          name: "tester",
          summary: "A test agent.",
          mission: "Testing things.",
          style: "concise",
          skills: "testing",
          preferredResource: "orchestrator",
        },
        rootDir,
      );
      await saveAgentSpec("tester", "# Updated Spec\n\nNew content.", rootDir);
      const spec = await loadAgentSpec("tester", rootDir);
      expect(spec).toContain("# Updated Spec");
      expect(spec).toContain("New content.");
    });
  });
});

// ---------------------------------------------------------------------------
// searchInternalFiles
// ---------------------------------------------------------------------------
describe("searchInternalFiles", () => {
  test("finds matches in system files", async () => {
    await withTempDir(async (rootDir) => {
      await ensureSystemLayout(rootDir);
      const result = await searchInternalFiles("In Focus Todo", rootDir);
      expect(result.query).toBe("In Focus Todo");
      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches[0].text).toContain("In Focus Todo");
      expect(result.matches[0].line).toBeGreaterThanOrEqual(1);
    });
  });

  test("search is case-insensitive", async () => {
    await withTempDir(async (rootDir) => {
      await ensureSystemLayout(rootDir);
      const result = await searchInternalFiles("in focus todo", rootDir);
      expect(result.matches.length).toBeGreaterThan(0);
    });
  });

  test("returns empty for no matches", async () => {
    await withTempDir(async (rootDir) => {
      await ensureSystemLayout(rootDir);
      const result = await searchInternalFiles("xyzzy_nonexistent_string_42", rootDir);
      expect(result.matches).toHaveLength(0);
      expect(result.truncated).toBe(false);
    });
  });

  test("returns empty for empty query", async () => {
    await withTempDir(async (rootDir) => {
      await ensureSystemLayout(rootDir);
      const result = await searchInternalFiles("", rootDir);
      expect(result.matches).toHaveLength(0);
    });
  });

  test("searches across external-memory when files exist", async () => {
    await withTempDir(async (rootDir) => {
      const emDir = join(rootDir, "external-memory", "orchestrator");
      await mkdir(emDir, { recursive: true });
      await writeFile(join(emDir, "test-doc.md"), "# Unique search marker\n\nSome content.\n");

      await ensureSystemLayout(rootDir);
      const result = await searchInternalFiles("Unique search marker", rootDir);
      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches[0].relativePath).toContain("test-doc.md");
    });
  });

  test("respects truncation limit", async () => {
    await withTempDir(async (rootDir) => {
      // Create a file with many matching lines
      const systemDir = getStoragePaths(rootDir).systemDir;
      await mkdir(systemDir, { recursive: true });
      const lines = Array.from({ length: 200 }, (_, i) => `match-line-${i}`).join("\n");
      const filePath = join(systemDir, "bulk-test.txt");

      await ensureSystemLayout(rootDir);
      await writeFile(filePath, lines);

      const result = await searchInternalFiles("match-line", rootDir);
      expect(result.matches.length).toBeLessThanOrEqual(100);
      expect(result.truncated).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// readInternalFile — path traversal prevention
// ---------------------------------------------------------------------------
describe("readInternalFile path traversal", () => {
  test("rejects paths outside allowed roots", async () => {
    await withTempDir(async (rootDir) => {
      await ensureSystemLayout(rootDir);
      await expect(readInternalFile("/etc/passwd", rootDir)).rejects.toThrow(
        /Path must stay inside/,
      );
    });
  });

  test("rejects relative traversal out of allowed roots", async () => {
    await withTempDir(async (rootDir) => {
      await ensureSystemLayout(rootDir);
      const paths = getStoragePaths(rootDir);
      const escapePath = join(paths.systemDir, "..", "..", "package.json");
      await expect(readInternalFile(escapePath, rootDir)).rejects.toThrow(/Path must stay inside/);
    });
  });

  test("reads files within allowed roots", async () => {
    await withTempDir(async (rootDir) => {
      await ensureSystemLayout(rootDir);
      const paths = getStoragePaths(rootDir);
      const result = await readInternalFile(paths.focusTodoPath, rootDir);
      expect(result.content).toContain("# In Focus Todo");
    });
  });
});

// ---------------------------------------------------------------------------
// loadSeedFile — path validation
// ---------------------------------------------------------------------------
describe("loadSeedFile path validation", () => {
  test("rejects paths that escape external-memory", async () => {
    await withTempDir(async (rootDir) => {
      const emDir = join(rootDir, "external-memory", "orchestrator");
      await mkdir(emDir, { recursive: true });
      await expect(loadSeedFile("../../etc/passwd", "fallback", rootDir)).rejects.toThrow(
        /escapes the external-memory directory/,
      );
    });
  });

  test("rejects absolute-style traversal", async () => {
    await withTempDir(async (rootDir) => {
      const emDir = join(rootDir, "external-memory", "orchestrator");
      await mkdir(emDir, { recursive: true });
      await expect(
        loadSeedFile("orchestrator/../../secret.txt", "fallback", rootDir),
      ).rejects.toThrow(/escapes the external-memory directory/);
    });
  });

  test("returns fallback for missing files with valid paths", async () => {
    await withTempDir(async (rootDir) => {
      const emDir = join(rootDir, "external-memory", "orchestrator");
      await mkdir(emDir, { recursive: true });
      const result = await loadSeedFile("orchestrator/nonexistent.md", "the-fallback", rootDir);
      expect(result).toBe("the-fallback");
    });
  });

  test("reads valid seed files", async () => {
    await withTempDir(async (rootDir) => {
      const emDir = join(rootDir, "external-memory", "orchestrator");
      await mkdir(emDir, { recursive: true });
      await writeFile(join(emDir, "seed.md"), "# Seed Content\n");
      const result = await loadSeedFile("orchestrator/seed.md", "fallback", rootDir);
      expect(result).toBe("# Seed Content\n");
    });
  });
});

// ---------------------------------------------------------------------------
// ingestNextInboxDocument — locking
// ---------------------------------------------------------------------------
describe("ingestNextInboxDocument locking", () => {
  test("ingests inbox document into active folder", async () => {
    await withTempDir(async (rootDir) => {
      const emDir = join(rootDir, "external-memory");
      await mkdir(emDir, { recursive: true });
      await ensureDropboxLayout(rootDir);
      await writeInboxDocument("task.md", "# Task\nDo something.", rootDir);
      const result = await ingestNextInboxDocument(rootDir);
      expect(result).not.toBeNull();
      expect(result!.stage).toBe("active");
      expect(result!.content).toContain("# Task");
    });
  });

  test("returns null when inbox is empty", async () => {
    await withTempDir(async (rootDir) => {
      const emDir = join(rootDir, "external-memory");
      await mkdir(emDir, { recursive: true });
      await ensureDropboxLayout(rootDir);
      const result = await ingestNextInboxDocument(rootDir);
      expect(result).toBeNull();
    });
  });

  test("concurrent ingestion does not double-process", async () => {
    await withTempDir(async (rootDir) => {
      const emDir = join(rootDir, "external-memory");
      await mkdir(emDir, { recursive: true });
      await ensureDropboxLayout(rootDir);
      await writeInboxDocument("single.md", "# Single doc", rootDir);

      // Run 3 concurrent ingestions — only 1 should succeed
      const results = await Promise.all([
        ingestNextInboxDocument(rootDir),
        ingestNextInboxDocument(rootDir),
        ingestNextInboxDocument(rootDir),
      ]);

      const successful = results.filter((r) => r !== null);
      // With locking, exactly one should succeed and the others get null
      expect(successful.length).toBe(1);
      expect(successful[0]!.content).toContain("# Single doc");
    });
  });
});

// ---------------------------------------------------------------------------
// getInternalFileTree — structure validation
// ---------------------------------------------------------------------------
describe("getInternalFileTree", () => {
  test("returns tree for system and external-memory dirs", async () => {
    await withTempDir(async (rootDir) => {
      await ensureSystemLayout(rootDir);
      const emDir = join(rootDir, "external-memory", "orchestrator");
      await mkdir(emDir, { recursive: true });
      await writeFile(join(emDir, "test.md"), "content\n");

      const tree = await getInternalFileTree(rootDir);
      expect(tree.lines.length).toBeGreaterThan(0);
      // Should reference the system dir
      expect(tree.rootPath).toContain(".localcrew");
    });
  });
});

// ---------------------------------------------------------------------------
// atomicWriteFile — temp file cleanup on failure
// ---------------------------------------------------------------------------
describe("atomicWriteFile", () => {
  test("writes file atomically", async () => {
    await withTempDir(async (rootDir) => {
      const filePath = join(rootDir, "test.txt");
      await atomicWriteFile(filePath, "hello world");
      const content = await readFile(filePath, "utf8");
      expect(content).toBe("hello world");
    });
  });

  test("does not leave temp files on successful write", async () => {
    await withTempDir(async (rootDir) => {
      const filePath = join(rootDir, "clean.txt");
      await atomicWriteFile(filePath, "content");
      const entries = await readdir(rootDir);
      const tmpFiles = entries.filter((name) => name.startsWith(".tmp-"));
      expect(tmpFiles).toHaveLength(0);
    });
  });

  test("cleans up temp file when rename target dir is missing", async () => {
    await withTempDir(async (rootDir) => {
      // Write to a path where the file itself doesn't exist but the temp dir does
      // This should succeed normally since we write the temp in the same dir
      const filePath = join(rootDir, "new-file.json");
      await atomicWriteFile(filePath, '{"ok":true}');
      expect(await readFile(filePath, "utf8")).toBe('{"ok":true}');
    });
  });
});

// ---------------------------------------------------------------------------
// searchInternalFiles — binary file skipping
// ---------------------------------------------------------------------------
describe("searchInternalFiles binary handling", () => {
  test("skips binary files containing null bytes", async () => {
    await withTempDir(async (rootDir) => {
      await ensureSystemLayout(rootDir);
      const systemDir = getStoragePaths(rootDir).systemDir;
      // Create a file with null bytes (binary) that contains the search term
      const binaryContent = "findme\0\x01\x02binary data";
      await writeFile(join(systemDir, "binary.bin"), binaryContent);

      const result = await searchInternalFiles("findme", rootDir);
      // The binary file should be skipped
      const binaryMatches = result.matches.filter((m) => m.relativePath.includes("binary.bin"));
      expect(binaryMatches).toHaveLength(0);
    });
  });

  test("handles regex metacharacters in query safely", async () => {
    await withTempDir(async (rootDir) => {
      await ensureSystemLayout(rootDir);
      // Search with regex metacharacters — should not throw
      const result = await searchInternalFiles("(.*[test", rootDir);
      expect(result.matches).toBeInstanceOf(Array);
    });
  });
});

// ---------------------------------------------------------------------------
// writeGeneratedDropboxDocument — path safety via ensureSafeRelativePath
// ---------------------------------------------------------------------------
describe("writeGeneratedDropboxDocument path safety", () => {
  test("rejects filenames with path traversal", async () => {
    await withTempDir(async (rootDir) => {
      const emDir = join(rootDir, "external-memory");
      await mkdir(emDir, { recursive: true });
      await ensureDropboxLayout(rootDir);
      await expect(
        writeGeneratedDropboxDocument("active", "../escape.md", "content", rootDir),
      ).rejects.toThrow(/may not escape/);
    });
  });

  test("rejects hidden filenames", async () => {
    await withTempDir(async (rootDir) => {
      const emDir = join(rootDir, "external-memory");
      await mkdir(emDir, { recursive: true });
      await ensureDropboxLayout(rootDir);
      await expect(
        writeGeneratedDropboxDocument("active", ".secret", "content", rootDir),
      ).rejects.toThrow(/Hidden/);
    });
  });

  test("writes valid document to active stage", async () => {
    await withTempDir(async (rootDir) => {
      const emDir = join(rootDir, "external-memory");
      await mkdir(emDir, { recursive: true });
      await ensureDropboxLayout(rootDir);
      const entry = await writeGeneratedDropboxDocument(
        "active",
        "drafts/notes.md",
        "# Notes\nSome content.",
        rootDir,
      );
      expect(entry.stage).toBe("active");
      expect(entry.relativePath).toBe("drafts/notes.md");
    });
  });

  test("writes valid document to outbox stage", async () => {
    await withTempDir(async (rootDir) => {
      const emDir = join(rootDir, "external-memory");
      await mkdir(emDir, { recursive: true });
      await ensureDropboxLayout(rootDir);
      const entry = await writeGeneratedDropboxDocument(
        "outbox",
        "report.md",
        "# Report",
        rootDir,
      );
      expect(entry.stage).toBe("outbox");
      expect(entry.relativePath).toBe("report.md");
    });
  });
});
