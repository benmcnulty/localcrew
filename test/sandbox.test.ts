/**
 * Tests for the sandboxed script execution module (src/sandbox.ts).
 *
 * Covers: parsing, static analysis, execution, and session tracking.
 */
import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  parseScriptRequests,
  staticAnalyze,
  executeScript,
  ScriptSessionTracker,
  MAX_SCRIPT_LINES,
  MAX_EXECUTION_MS,
  type ScriptRequest,
} from "../src/sandbox.ts";

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "sandbox-test-"));
  try {
    // Create .localcrew/system/sandbox so executeScript can write temp files
    await mkdir(join(dir, ".localcrew", "system", "sandbox"), { recursive: true });
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

describe("parseScriptRequests", () => {
  test("extracts a single Python script request", () => {
    const text = [
      "Here is the analysis.",
      "SCRIPT_REQUEST[data-summary]",
      "#!/usr/bin/env python3",
      '"""',
      "Purpose: Summarize the data",
      '"""',
      "import json",
      'print(json.dumps({"total": 42}))',
      "ENDSCRIPT",
      "Done.",
    ].join("\n");

    const results = parseScriptRequests(text);
    expect(results).toHaveLength(1);
    expect(results[0].purposeSlug).toBe("data-summary");
    expect(results[0].language).toBe("python");
    expect(results[0].purpose).toBe("Summarize the data");
    expect(results[0].source).toContain("import json");
  });

  test("extracts a single JavaScript script request", () => {
    const text = [
      "SCRIPT_REQUEST[latency-check]",
      "#!/usr/bin/env node",
      "// Purpose: Calculate average latency",
      "const values = [10, 20, 30];",
      "const avg = values.reduce((a, b) => a + b, 0) / values.length;",
      "console.log(avg);",
      "ENDSCRIPT",
    ].join("\n");

    const results = parseScriptRequests(text);
    expect(results).toHaveLength(1);
    expect(results[0].purposeSlug).toBe("latency-check");
    expect(results[0].language).toBe("javascript");
    expect(results[0].purpose).toBe("Calculate average latency");
    expect(results[0].source).toContain("const avg");
  });

  test("extracts multiple script requests", () => {
    const text = [
      "SCRIPT_REQUEST[step-one]",
      "print('hello')",
      "ENDSCRIPT",
      "Some text in between.",
      "SCRIPT_REQUEST[step-two]",
      "console.log('world');",
      "ENDSCRIPT",
    ].join("\n");

    const results = parseScriptRequests(text);
    expect(results).toHaveLength(2);
    expect(results[0].purposeSlug).toBe("step-one");
    expect(results[0].language).toBe("python");
    expect(results[1].purposeSlug).toBe("step-two");
    expect(results[1].language).toBe("javascript");
  });

  test("returns empty array for text with no script blocks", () => {
    const text = "Just normal chat response with WRITE[active] blocks.";
    expect(parseScriptRequests(text)).toHaveLength(0);
  });

  test("detects JavaScript from heuristics (const, let, function)", () => {
    const text = [
      "SCRIPT_REQUEST[calc]",
      "const x = 10;",
      "console.log(x * 2);",
      "ENDSCRIPT",
    ].join("\n");

    const results = parseScriptRequests(text);
    expect(results[0].language).toBe("javascript");
  });

  test("detects Python from heuristics (def, import, print)", () => {
    const text = [
      "SCRIPT_REQUEST[calc]",
      "import math",
      "print(math.sqrt(144))",
      "ENDSCRIPT",
    ].join("\n");

    const results = parseScriptRequests(text);
    expect(results[0].language).toBe("python");
  });

  test("defaults to Python when language cannot be determined", () => {
    const text = [
      "SCRIPT_REQUEST[mystery]",
      "x = 42",
      "ENDSCRIPT",
    ].join("\n");

    const results = parseScriptRequests(text);
    expect(results[0].language).toBe("python");
  });
});

// ─── Static Analysis ─────────────────────────────────────────────────────────

describe("staticAnalyze", () => {
  function makeRequest(
    source: string,
    language: "python" | "javascript" = "python",
  ): ScriptRequest {
    return {
      purposeSlug: "test",
      language,
      source,
      purpose: "Test script",
      requestedBy: "test-agent",
    };
  }

  describe("Python analysis", () => {
    test("approves a safe Python script", () => {
      const result = staticAnalyze(
        makeRequest(
          [
            "import json",
            "import math",
            "data = {'x': math.sqrt(144)}",
            "print(json.dumps(data))",
          ].join("\n"),
        ),
      );
      expect(result.verdict).toBe("approved");
      expect(result.violations).toHaveLength(0);
    });

    test("rejects subprocess import", () => {
      const result = staticAnalyze(
        makeRequest("import subprocess\nsubprocess.run(['ls'])"),
      );
      expect(result.verdict).toBe("rejected");
      expect(result.violations.some((v) => v.includes("subprocess"))).toBe(true);
    });

    test("rejects socket import", () => {
      const result = staticAnalyze(makeRequest("import socket"));
      expect(result.verdict).toBe("rejected");
      expect(result.violations.some((v) => v.includes("socket"))).toBe(true);
    });

    test("rejects requests library", () => {
      const result = staticAnalyze(makeRequest("import requests\nrequests.get('http://evil.com')"));
      expect(result.verdict).toBe("rejected");
      expect(result.violations.some((v) => v.includes("requests"))).toBe(true);
    });

    test("rejects eval()", () => {
      const result = staticAnalyze(makeRequest("eval('__import__(\"os\").system(\"rm -rf /\")')"));
      expect(result.verdict).toBe("rejected");
      expect(result.violations.some((v) => v.includes("eval"))).toBe(true);
    });

    test("rejects exec()", () => {
      const result = staticAnalyze(makeRequest("exec('malicious_code')"));
      expect(result.verdict).toBe("rejected");
      expect(result.violations.some((v) => v.includes("exec"))).toBe(true);
    });

    test("rejects __import__()", () => {
      const result = staticAnalyze(makeRequest("__import__('os').system('ls')"));
      expect(result.verdict).toBe("rejected");
      expect(result.violations.some((v) => v.includes("__import__"))).toBe(true);
    });

    test("rejects os.system()", () => {
      const result = staticAnalyze(makeRequest("import os\nos.system('ls')"));
      expect(result.verdict).toBe("rejected");
      expect(
        result.violations.some((v) => v.includes("os.system")),
      ).toBe(true);
    });

    test("rejects os.environ access", () => {
      const result = staticAnalyze(makeRequest("import os\nprint(os.environ['SECRET'])"));
      expect(result.verdict).toBe("rejected");
      expect(result.violations.some((v) => v.includes("os.environ"))).toBe(true);
    });

    test("rejects threading", () => {
      const result = staticAnalyze(makeRequest("import threading"));
      expect(result.verdict).toBe("rejected");
    });

    test("rejects open() for writing", () => {
      const result = staticAnalyze(makeRequest("open('file.txt', 'w').write('data')"));
      expect(result.verdict).toBe("rejected");
      expect(result.violations.some((v) => v.includes("open"))).toBe(true);
    });

    test("rejects script exceeding line limit", () => {
      const lines = Array.from({ length: MAX_SCRIPT_LINES + 5 }, (_, i) => `x = ${i}`);
      const result = staticAnalyze(makeRequest(lines.join("\n")));
      expect(result.verdict).toBe("rejected");
      expect(result.violations.some((v) => v.includes("line limit"))).toBe(true);
    });

    test("does not count comments toward line limit", () => {
      const code = Array.from({ length: 10 }, (_, i) => `x = ${i}`);
      const comments = Array.from({ length: 300 }, () => "# comment");
      const result = staticAnalyze(makeRequest([...comments, ...code].join("\n")));
      expect(result.verdict).toBe("approved");
    });
  });

  describe("JavaScript analysis", () => {
    test("approves a safe JavaScript script", () => {
      const result = staticAnalyze(
        makeRequest(
          [
            "const data = [1, 2, 3, 4, 5];",
            "const sum = data.reduce((a, b) => a + b, 0);",
            "const avg = sum / data.length;",
            "console.log(JSON.stringify({ avg }));",
          ].join("\n"),
          "javascript",
        ),
      );
      expect(result.verdict).toBe("approved");
      expect(result.violations).toHaveLength(0);
    });

    test("rejects require()", () => {
      const result = staticAnalyze(
        makeRequest("const fs = require('fs');", "javascript"),
      );
      expect(result.verdict).toBe("rejected");
      expect(result.violations.some((v) => v.includes("require"))).toBe(true);
    });

    test("rejects dynamic import()", () => {
      const result = staticAnalyze(
        makeRequest("const fs = await import('fs');", "javascript"),
      );
      expect(result.verdict).toBe("rejected");
      expect(result.violations.some((v) => v.includes("import"))).toBe(true);
    });

    test("rejects static import statement", () => {
      const result = staticAnalyze(
        makeRequest("import { readFile } from 'fs';\nconsole.log('hi');", "javascript"),
      );
      expect(result.verdict).toBe("rejected");
      expect(result.violations.some((v) => v.includes("import"))).toBe(true);
    });

    test("rejects process.env access", () => {
      const result = staticAnalyze(
        makeRequest("const key = process.env.API_KEY;", "javascript"),
      );
      expect(result.verdict).toBe("rejected");
      expect(result.violations.some((v) => v.includes("process.env"))).toBe(true);
    });

    test("rejects process.exit", () => {
      const result = staticAnalyze(
        makeRequest("process.exit(1);", "javascript"),
      );
      expect(result.verdict).toBe("rejected");
      expect(result.violations.some((v) => v.includes("process.exit"))).toBe(true);
    });

    test("rejects eval()", () => {
      const result = staticAnalyze(
        makeRequest("eval('malicious');", "javascript"),
      );
      expect(result.verdict).toBe("rejected");
      expect(result.violations.some((v) => v.includes("eval"))).toBe(true);
    });

    test("rejects Function() constructor", () => {
      const result = staticAnalyze(
        makeRequest("const fn = Function('return this');", "javascript"),
      );
      expect(result.verdict).toBe("rejected");
      expect(result.violations.some((v) => v.includes("Function"))).toBe(true);
    });

    test("rejects fetch global", () => {
      const result = staticAnalyze(
        makeRequest("const res = fetch('http://evil.com');", "javascript"),
      );
      expect(result.verdict).toBe("rejected");
      expect(result.violations.some((v) => v.includes("fetch"))).toBe(true);
    });

    test("rejects Worker", () => {
      const result = staticAnalyze(
        makeRequest("const w = new Worker('evil.js');", "javascript"),
      );
      expect(result.verdict).toBe("rejected");
      expect(result.violations.some((v) => v.includes("Worker"))).toBe(true);
    });

    test("rejects globalThis bracket access", () => {
      const result = staticAnalyze(
        makeRequest("globalThis['require']('fs');", "javascript"),
      );
      expect(result.verdict).toBe("rejected");
    });
  });

  describe("cross-language", () => {
    test("accumulates multiple violations", () => {
      const result = staticAnalyze(
        makeRequest(
          "import subprocess\nimport socket\nos.system('ls')\neval('x')",
        ),
      );
      expect(result.verdict).toBe("rejected");
      expect(result.violations.length).toBeGreaterThanOrEqual(3);
    });
  });
});

// ─── Execution ────────────────────────────────────────────────────────────────

describe("executeScript", () => {
  test("executes a simple Python script", async () => {
    await withTempDir(async (dir) => {
      const req: ScriptRequest = {
        purposeSlug: "hello-py",
        language: "python",
        source: "print('hello from python')",
        purpose: "Say hello",
        requestedBy: "test",
      };
      const result = await executeScript(req, dir);
      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe("hello from python");
      expect(result.exitCode).toBe(0);
      expect(result.timedOut).toBe(false);
      expect(result.durationMs).toBeGreaterThan(0);
    });
  });

  test("executes a Python script with json output", async () => {
    await withTempDir(async (dir) => {
      const req: ScriptRequest = {
        purposeSlug: "json-out",
        language: "python",
        source: [
          "import json",
          "data = {'count': 3, 'items': [1, 2, 3]}",
          "print(json.dumps(data))",
        ].join("\n"),
        purpose: "JSON output",
        requestedBy: "test",
      };
      const result = await executeScript(req, dir);
      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.stdout.trim());
      expect(parsed.count).toBe(3);
      expect(parsed.items).toEqual([1, 2, 3]);
    });
  });

  test("captures stderr from a failing Python script", async () => {
    await withTempDir(async (dir) => {
      const req: ScriptRequest = {
        purposeSlug: "fail-py",
        language: "python",
        source: "raise ValueError('test error')",
        purpose: "Fail intentionally",
        requestedBy: "test",
      };
      const result = await executeScript(req, dir);
      expect(result.success).toBe(false);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("ValueError");
    });
  });

  test("executes a simple JavaScript script", async () => {
    await withTempDir(async (dir) => {
      const req: ScriptRequest = {
        purposeSlug: "hello-js",
        language: "javascript",
        source: "console.log('hello from javascript');",
        purpose: "Say hello",
        requestedBy: "test",
      };
      const result = await executeScript(req, dir);
      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe("hello from javascript");
      expect(result.exitCode).toBe(0);
      expect(result.timedOut).toBe(false);
    });
  });

  test("executes JavaScript with JSON computation", async () => {
    await withTempDir(async (dir) => {
      const req: ScriptRequest = {
        purposeSlug: "compute-js",
        language: "javascript",
        source: [
          "const values = [10, 20, 30, 40, 50];",
          "const sum = values.reduce((a, b) => a + b, 0);",
          "const avg = sum / values.length;",
          "console.log(JSON.stringify({ sum, avg }));",
        ].join("\n"),
        purpose: "Compute stats",
        requestedBy: "test",
      };
      const result = await executeScript(req, dir);
      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.stdout.trim());
      expect(parsed.sum).toBe(150);
      expect(parsed.avg).toBe(30);
    });
  });

  test("JavaScript sandbox blocks require()", async () => {
    await withTempDir(async (dir) => {
      const req: ScriptRequest = {
        purposeSlug: "blocked-require",
        language: "javascript",
        // Even if static analysis is bypassed, the VM sandbox blocks require
        source: "const x = typeof require;  console.log(x);",
        purpose: "Test sandbox",
        requestedBy: "test",
      };
      const result = await executeScript(req, dir);
      // require should be undefined in sandbox context
      expect(result.stdout.trim()).toBe("undefined");
    });
  });

  test("JavaScript sandbox blocks process access", async () => {
    await withTempDir(async (dir) => {
      const req: ScriptRequest = {
        purposeSlug: "blocked-process",
        language: "javascript",
        source: "console.log(typeof process);",
        purpose: "Test sandbox",
        requestedBy: "test",
      };
      const result = await executeScript(req, dir);
      expect(result.stdout.trim()).toBe("undefined");
    });
  });

  test("cleans up temporary script files after execution", async () => {
    await withTempDir(async (dir) => {
      const sandboxDir = join(dir, ".localcrew", "system", "sandbox");
      const req: ScriptRequest = {
        purposeSlug: "cleanup-test",
        language: "python",
        source: "print('done')",
        purpose: "Test cleanup",
        requestedBy: "test",
      };
      await executeScript(req, dir);
      const files = await readdir(sandboxDir);
      // The sandbox dir should be empty after cleanup
      expect(files).toHaveLength(0);
    });
  });

  test("Python handles input data via stdin", async () => {
    await withTempDir(async (dir) => {
      const req: ScriptRequest = {
        purposeSlug: "stdin-test",
        language: "python",
        source: [
          "import sys",
          "data = sys.stdin.read()",
          "print(f'Got: {data}')",
        ].join("\n"),
        purpose: "Test stdin",
        requestedBy: "test",
      };
      const result = await executeScript(req, dir, "hello world");
      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe("Got: hello world");
    });
  });

  test("provides input data to JavaScript via __INPUT__", async () => {
    await withTempDir(async (dir) => {
      const req: ScriptRequest = {
        purposeSlug: "input-js",
        language: "javascript",
        source: "console.log('Got: ' + __INPUT__);",
        purpose: "Test input",
        requestedBy: "test",
      };
      const result = await executeScript(req, dir, "hello world");
      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe("Got: hello world");
    });
  });
});

// ─── Session Tracking ─────────────────────────────────────────────────────────

describe("ScriptSessionTracker", () => {
  test("is not blocked initially", () => {
    const tracker = new ScriptSessionTracker();
    expect(tracker.isBlocked("data-analysis")).toBe(false);
  });

  test("blocks after 2 rejections for the same slug", () => {
    const tracker = new ScriptSessionTracker();
    tracker.recordRejection("bad-script");
    expect(tracker.isBlocked("bad-script")).toBe(false);
    tracker.recordRejection("bad-script");
    expect(tracker.isBlocked("bad-script")).toBe(true);
  });

  test("does not block a different slug", () => {
    const tracker = new ScriptSessionTracker();
    tracker.recordRejection("bad-script");
    tracker.recordRejection("bad-script");
    expect(tracker.isBlocked("good-script")).toBe(false);
  });

  test("records and checks session approvals", () => {
    const tracker = new ScriptSessionTracker();
    expect(tracker.hasSessionApproval("data-analysis")).toBe(false);
    tracker.recordSessionApproval("data-analysis");
    expect(tracker.hasSessionApproval("data-analysis")).toBe(true);
    expect(tracker.hasSessionApproval("other")).toBe(false);
  });

  test("reset clears all state", () => {
    const tracker = new ScriptSessionTracker();
    tracker.recordRejection("slug-a");
    tracker.recordRejection("slug-a");
    tracker.recordSessionApproval("slug-b");
    tracker.reset();
    expect(tracker.isBlocked("slug-a")).toBe(false);
    expect(tracker.hasSessionApproval("slug-b")).toBe(false);
  });
});
