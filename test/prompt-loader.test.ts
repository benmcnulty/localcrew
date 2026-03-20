import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test, beforeEach } from "bun:test";

import {
  applyConditionals,
  clearPromptCache,
  composePromptBlock,
  interpolatePrompt,
  loadPromptComponent
} from "../src/prompt-loader.ts";

async function withTempDir(run: (rootDir: string) => Promise<void>): Promise<void> {
  const rootDir = await mkdtemp(join(tmpdir(), "localcrew-loader-"));
  try {
    await run(rootDir);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

/**
 * Write a component file into a temp dir's external-memory/prompts tree.
 * Also ensures the external-memory/orchestrator marker exists so that
 * getExternalMemoryDir() returns the local dir instead of the seed dir.
 */
async function writeComponent(
  rootDir: string,
  relativePath: string,
  content: string
): Promise<void> {
  // Create the orchestrator marker so loadSeedFile uses this rootDir.
  await mkdir(join(rootDir, "external-memory", "orchestrator"), { recursive: true });
  const fullPath = join(rootDir, "external-memory", "prompts", relativePath);
  await mkdir(join(fullPath, ".."), { recursive: true });
  await writeFile(fullPath, content, "utf8");
}

beforeEach(() => {
  clearPromptCache();
});

// ---------------------------------------------------------------------------
// interpolatePrompt
// ---------------------------------------------------------------------------

describe("interpolatePrompt", () => {
  test("replaces a single placeholder", () => {
    expect(interpolatePrompt("Hello {{name}}!", { name: "World" })).toBe("Hello World!");
  });

  test("replaces multiple distinct placeholders", () => {
    const result = interpolatePrompt("{{a}} and {{b}}", { a: "foo", b: "bar" });
    expect(result).toBe("foo and bar");
  });

  test("replaces the same placeholder multiple times", () => {
    const result = interpolatePrompt("{{x}} then {{x}}", { x: "hello" });
    expect(result).toBe("hello then hello");
  });

  test("leaves unknown placeholders as-is", () => {
    const result = interpolatePrompt("Hello {{unknown}}!", { name: "World" });
    expect(result).toBe("Hello {{unknown}}!");
  });

  test("handles empty vars object", () => {
    expect(interpolatePrompt("Hello {{name}}", {})).toBe("Hello {{name}}");
  });

  test("trims whitespace around variable names", () => {
    expect(interpolatePrompt("{{ name }}", { name: "trimmed" })).toBe("trimmed");
  });

  test("ignores undefined values and leaves placeholder intact", () => {
    const result = interpolatePrompt("{{a}}", { a: undefined });
    expect(result).toBe("{{a}}");
  });

  test("does not modify {{#if ...}} or {{/if}} markers", () => {
    const template = "{{#if flag}}content{{/if}}";
    expect(interpolatePrompt(template, {})).toBe(template);
  });
});

// ---------------------------------------------------------------------------
// applyConditionals
// ---------------------------------------------------------------------------

describe("applyConditionals", () => {
  test("keeps content when flag is true", () => {
    const result = applyConditionals("{{#if show}}visible{{/if}}", { show: true });
    expect(result).toBe("visible");
  });

  test("removes block when flag is false", () => {
    const result = applyConditionals("{{#if show}}visible{{/if}}", { show: false });
    expect(result).toBe("");
  });

  test("removes block when flag is absent", () => {
    const result = applyConditionals("{{#if show}}visible{{/if}}", {});
    expect(result).toBe("");
  });

  test("handles multi-line content blocks", () => {
    const template = "before {{#if flag}}\nline one\nline two\n{{/if}} after";
    expect(applyConditionals(template, { flag: true })).toBe("before \nline one\nline two\n after");
    expect(applyConditionals(template, { flag: false })).toBe("before  after");
  });

  test("processes multiple independent blocks", () => {
    const template = "{{#if a}}A{{/if}} mid {{#if b}}B{{/if}}";
    expect(applyConditionals(template, { a: true, b: false })).toBe("A mid ");
    expect(applyConditionals(template, { a: false, b: true })).toBe(" mid B");
  });

  test("trims whitespace around flag names", () => {
    const result = applyConditionals("{{#if  flag  }}yes{{/if}}", { flag: true });
    expect(result).toBe("yes");
  });

  test("the WEATHER conditional pattern from grounding.md", () => {
    const template = "SEARCH stuff.{{#if weatherEnabled}} WEATHER: location.{{/if}} BENLIVE stuff.";
    const withWeather = applyConditionals(template, { weatherEnabled: true });
    expect(withWeather).toContain("WEATHER:");
    const withoutWeather = applyConditionals(template, { weatherEnabled: false });
    expect(withoutWeather).not.toContain("WEATHER:");
  });
});

// ---------------------------------------------------------------------------
// loadPromptComponent
// ---------------------------------------------------------------------------

describe("loadPromptComponent", () => {
  test("loads an existing component file", async () => {
    await withTempDir(async (rootDir) => {
      await writeComponent(rootDir, "components/tools/test.md", "Hello from file.");
      const result = await loadPromptComponent("components/tools/test.md", "fallback", rootDir);
      expect(result).toBe("Hello from file.");
    });
  });

  test("returns fallback when file does not exist", async () => {
    await withTempDir(async (rootDir) => {
      const result = await loadPromptComponent("components/missing.md", "my fallback", rootDir);
      expect(result).toBe("my fallback");
    });
  });

  test("caches the result on second call", async () => {
    await withTempDir(async (rootDir) => {
      await writeComponent(rootDir, "components/tools/cached.md", "original");
      const first = await loadPromptComponent("components/tools/cached.md", "", rootDir);
      // Overwrite the file — cached result should still be returned
      await writeFile(
        join(rootDir, "external-memory", "prompts", "components/tools/cached.md"),
        "modified",
        "utf8"
      );
      const second = await loadPromptComponent("components/tools/cached.md", "", rootDir);
      expect(first).toBe("original");
      expect(second).toBe("original"); // cache hit
    });
  });

  test("clearPromptCache forces a fresh load", async () => {
    await withTempDir(async (rootDir) => {
      await writeComponent(rootDir, "components/tools/cleartest.md", "v1");
      await loadPromptComponent("components/tools/cleartest.md", "", rootDir);

      await writeFile(
        join(rootDir, "external-memory", "prompts", "components/tools/cleartest.md"),
        "v2",
        "utf8"
      );
      clearPromptCache();
      const result = await loadPromptComponent("components/tools/cleartest.md", "", rootDir);
      expect(result).toBe("v2");
    });
  });

  test("rejects path traversal attempts", async () => {
    await withTempDir(async (rootDir) => {
      await expect(
        loadPromptComponent("../../etc/passwd", "fallback", rootDir)
      ).rejects.toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// composePromptBlock
// ---------------------------------------------------------------------------

describe("composePromptBlock", () => {
  test("composes multiple components into one string", async () => {
    await withTempDir(async (rootDir) => {
      await writeComponent(rootDir, "components/a.md", "Part A.");
      await writeComponent(rootDir, "components/b.md", "Part B.");
      const result = await composePromptBlock(
        ["components/a.md", "components/b.md"],
        {},
        undefined,
        undefined,
        rootDir
      );
      expect(result).toBe("Part A. Part B.");
    });
  });

  test("uses per-path fallback when file is missing", async () => {
    await withTempDir(async (rootDir) => {
      await writeComponent(rootDir, "components/present.md", "Present.");
      const result = await composePromptBlock(
        ["components/present.md", "components/missing.md"],
        {},
        undefined,
        { "components/missing.md": "Fallback." },
        rootDir
      );
      expect(result).toBe("Present. Fallback.");
    });
  });

  test("skips empty parts (missing file + empty fallback)", async () => {
    await withTempDir(async (rootDir) => {
      await writeComponent(rootDir, "components/present.md", "Hello.");
      const result = await composePromptBlock(
        ["components/present.md", "components/missing.md"],
        {},
        undefined,
        undefined,
        rootDir
      );
      expect(result).toBe("Hello.");
    });
  });

  test("applies conditionals before interpolation", async () => {
    await withTempDir(async (rootDir) => {
      await writeComponent(
        rootDir,
        "components/cond.md",
        "Base. {{#if showExtra}}Extra: {{name}}.{{/if}}"
      );
      const withFlag = await composePromptBlock(
        ["components/cond.md"],
        { name: "Alice" },
        { showExtra: true },
        undefined,
        rootDir
      );
      expect(withFlag).toBe("Base. Extra: Alice.");

      clearPromptCache();
      const withoutFlag = await composePromptBlock(
        ["components/cond.md"],
        { name: "Alice" },
        { showExtra: false },
        undefined,
        rootDir
      );
      expect(withoutFlag).toBe("Base.");
    });
  });

  test("interpolates variables across concatenated parts", async () => {
    await withTempDir(async (rootDir) => {
      await writeComponent(rootDir, "components/p1.md", "You are {{name}}.");
      await writeComponent(rootDir, "components/p2.md", "Your role is {{role}}.");
      const result = await composePromptBlock(
        ["components/p1.md", "components/p2.md"],
        { name: "Crew", role: "orchestrator" },
        undefined,
        undefined,
        rootDir
      );
      expect(result).toBe("You are Crew. Your role is orchestrator.");
    });
  });

  test("the weatherEnabled flag controls WEATHER inclusion", async () => {
    await withTempDir(async (rootDir) => {
      await writeComponent(
        rootDir,
        "components/tools/grounding.md",
        "SEARCH stuff.{{#if weatherEnabled}} WEATHER: location.{{/if}} BENLIVE stuff."
      );

      clearPromptCache();
      const withWeather = await composePromptBlock(
        ["components/tools/grounding.md"],
        {},
        { weatherEnabled: true },
        undefined,
        rootDir
      );
      expect(withWeather).toContain("WEATHER:");

      clearPromptCache();
      const withoutWeather = await composePromptBlock(
        ["components/tools/grounding.md"],
        {},
        { weatherEnabled: false },
        undefined,
        rootDir
      );
      expect(withoutWeather).not.toContain("WEATHER:");
    });
  });
});
