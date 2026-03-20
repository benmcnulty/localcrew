/**
 * Prompt eval framework.
 *
 * Validates structural invariants of prompt component files and composition
 * correctness before any migration happens. Run this after editing component
 * files to catch regressions early.
 */

import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "bun:test";

import { applyConditionals, composePromptBlock, interpolatePrompt } from "../src/prompt-loader.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Path to the canonical external-memory directory used by this project.
const EXTERNAL_MEMORY_DIR = resolve(__dirname, "..", "external-memory");
const COMPONENTS_DIR = join(EXTERNAL_MEMORY_DIR, "prompts", "components");

// Root dir for composePromptBlock calls — the project root.
const ROOT_DIR = resolve(__dirname, "..");

/** Read a component file directly (no caching, for eval assertions). */
async function readComponent(relativePath: string): Promise<string> {
  return readFile(join(COMPONENTS_DIR, relativePath), "utf8");
}

/** Recursively collect all .md files under a directory. */
async function collectMarkdownFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await collectMarkdownFiles(fullPath)));
    } else if (entry.name.endsWith(".md")) {
      results.push(fullPath);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// A. Component integrity
// ---------------------------------------------------------------------------

describe("Component integrity", () => {
  test("all expected component files exist and are non-empty", async () => {
    const required = [
      "tools/grounding.md",
      "tools/queue.md",
      "tools/write.md",
      "tools/next.md",
      "identity/orchestrator-chat.md",
      "identity/orchestrator-auto.md",
      "identity/orchestrator-preflight.md",
      "identity/agent.md",
      "identity/reviewer.md",
      "identity/finalizer.md",
      "stance/compaction.md",
      "stance/auto-mode.md",
      "stance/queue-draft.md",
      "stance/queue-review.md",
      "stance/queue-finalize.md",
      "stance/daily-work.md",
      "guardrails/containment.md",
      "guardrails/task-quality.md",
      "format/domain-taxonomy.md",
      "format/preflight-output.md",
      "format/canonical-memory.md",
      "defaults/directives.md",
      "defaults/roadmap.md",
      "defaults/focus-todo.md",
      "defaults/workflow.md"
    ];

    for (const path of required) {
      let content: string;
      try {
        content = await readComponent(path);
      } catch {
        throw new Error(`Component file missing or unreadable: ${path}`);
      }
      if (content.trim().length === 0) throw new Error(`Component is empty: ${path}`);
    }
  });

  test("no component file exceeds 8000 characters (prompt bloat guard)", async () => {
    const files = await collectMarkdownFiles(COMPONENTS_DIR);
    for (const file of files) {
      const content = await readFile(file, "utf8");
      if (content.length > 8000) throw new Error(`Component too large (>8000 chars): ${file}`);
    }
  });

  test("no component contains unresolved {{}} markers after full variable injection", async () => {
    const allVars: Record<string, string> = {
      orchestratorName: "TestOrchestrator",
      alias: "test-alias",
      participantList: "@a, @b",
      participantRoster: "Alice (@a), Bob (@b)",
      resourceAlias: "orchestrator",
      resourceRationale: "Primary resource.",
      maxContextTokens: "32000",
      agentName: "Zora",
      agentSlug: "zora",
      preferredResource: "orchestrator",
      reviewerAlias: "reviewer",
      name: "TestName",
      role: "orchestrator",
      date: "2026-03-19",
      userProfile: "Software engineer.",
      focusTodo: "- [high] Keep routing quality high."
    };

    const files = await collectMarkdownFiles(COMPONENTS_DIR);
    for (const file of files) {
      const content = await readFile(file, "utf8");
      const afterConditionals = applyConditionals(content, {
        weatherEnabled: true,
        showExtra: true,
        hasContextLimit: true
      });
      const interpolated = interpolatePrompt(afterConditionals, allVars);
      const remaining = interpolated.match(/\{\{[^}#/][^}]*\}\}/g);
      if (remaining !== null)
        throw new Error(`Unresolved placeholders in ${file}: ${remaining.join(", ")}`);
      expect(remaining).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// B. Structural invariants
// ---------------------------------------------------------------------------

describe("Structural invariants", () => {
  test("grounding.md contains all 6 tool format instructions", async () => {
    const content = await readComponent("tools/grounding.md");
    expect(content).toContain("WIKIPEDIA:");
    expect(content).toContain("REDDIT:");
    expect(content).toContain("SEARCH[topic]:");
    expect(content).toContain("WEATHER:");
    expect(content).toContain("BENLIVE:");
    expect(content).toContain("WEBSITE:");
  });

  test("grounding.md wraps WEATHER line in {{#if weatherEnabled}} conditional", async () => {
    const content = await readComponent("tools/grounding.md");
    expect(content).toContain("{{#if weatherEnabled}}");
    const withWeather = applyConditionals(content, { weatherEnabled: true });
    expect(withWeather).toContain("WEATHER:");
    const withoutWeather = applyConditionals(content, { weatherEnabled: false });
    expect(withoutWeather).not.toContain("WEATHER:");
  });

  test("write.md contains both WRITE and UPDATE format definitions", async () => {
    const content = await readComponent("tools/write.md");
    expect(content).toContain("WRITE[");
    expect(content).toContain("ENDWRITE");
    expect(content).toContain("UPDATE[");
    expect(content).toContain("ENDUPDATE");
  });

  test("queue.md contains QUEUE format with priority, resource-alias, and role tag", async () => {
    const content = await readComponent("tools/queue.md");
    expect(content).toContain("QUEUE[");
    expect(content).toContain("resource-alias");
    expect(content).toContain("{reviewer}");
  });

  test("domain-taxonomy.md defines all 5 domains", async () => {
    const content = await readComponent("format/domain-taxonomy.md");
    expect(content).toContain("SYSTEM:");
    expect(content).toContain("RESEARCH:");
    expect(content).toContain("KNOWLEDGE:");
    expect(content).toContain("SYNTHESIS:");
    expect(content).toContain("IDENTITY:");
  });

  test("preflight-output.md contains all 4 output sections", async () => {
    const content = await readComponent("format/preflight-output.md");
    expect(content).toContain("GOAL:");
    expect(content).toContain("CONSTRAINTS:");
    expect(content).toContain("RISKS:");
    expect(content).toContain("APPROACH:");
  });

  test("compaction.md contains compaction instructions", async () => {
    const content = await readComponent("stance/compaction.md");
    expect(content).toContain("consensus summary");
    expect(content).toContain("summary and output only the summary");
  });

  test("daily-work.md contains all 5 briefing sections", async () => {
    const content = await readComponent("stance/daily-work.md");
    expect(content).toContain("Today's Focus");
    expect(content).toContain("Active Projects");
    expect(content).toContain("Research & Discovery");
    expect(content).toContain("Quick Reference");
    expect(content).toContain("System Health");
  });
});

// ---------------------------------------------------------------------------
// C. Composition correctness
// ---------------------------------------------------------------------------

describe("Composition correctness", () => {
  const sharedVars: Record<string, string> = {
    orchestratorName: "Crew",
    resourceAlias: "orchestrator",
    resourceRationale: "Primary resource.",
    alias: "crew",
    participantList: "@a, @b",
    participantRoster: "Alice (@a), Bob (@b)",
    agentName: "Zora",
    agentSlug: "zora",
    preferredResource: "orchestrator",
    reviewerAlias: "reviewer"
  };

  test("auto-task composition contains identity, stance, grounding, write, queue, guardrails", async () => {
    const result = await composePromptBlock(
      [
        "components/identity/orchestrator-auto.md",
        "components/stance/auto-mode.md",
        "components/tools/grounding.md",
        "components/tools/queue.md",
        "components/tools/write.md",
        "components/guardrails/containment.md",
        "components/format/canonical-memory.md"
      ],
      sharedVars,
      { weatherEnabled: true, hasContextLimit: false },
      undefined,
      ROOT_DIR
    );
    expect(result).toContain("Crew");
    expect(result).toContain("orchestrator identity");
    expect(result).toContain("self-aware self-improvement");
    expect(result).toContain("WIKIPEDIA:");
    expect(result).toContain("QUEUE[");
    expect(result).toContain("WRITE[");
    expect(result).toContain("Stay inside internal process improvement");
    expect(result).toContain("WRITE[internal][summary.md]");
  });

  test("chat composition contains identity, grounding, NEXT but NOT write format", async () => {
    const result = await composePromptBlock(
      [
        "components/identity/orchestrator-chat.md",
        "components/tools/grounding.md",
        "components/tools/next.md"
      ],
      sharedVars,
      { weatherEnabled: false },
      undefined,
      ROOT_DIR
    );
    expect(result).toContain("You are @crew");
    expect(result).toContain("WIKIPEDIA:");
    expect(result).toContain("NEXT:");
    expect(result).not.toContain("WRITE[");
    expect(result).not.toContain("WEATHER:");
  });

  test("agent composition contains identity, grounding, write format, queue format", async () => {
    const result = await composePromptBlock(
      [
        "components/identity/agent.md",
        "components/tools/grounding.md",
        "components/tools/write.md",
        "components/tools/queue.md"
      ],
      sharedVars,
      { weatherEnabled: true },
      undefined,
      ROOT_DIR
    );
    expect(result).toContain("Zora (@zora)");
    expect(result).toContain("WIKIPEDIA:");
    expect(result).toContain("WRITE[");
    expect(result).toContain("QUEUE[");
  });

  test("queue-fill composition contains draft stance, domain taxonomy, and grounding", async () => {
    const result = await composePromptBlock(
      [
        "components/stance/queue-draft.md",
        "components/format/domain-taxonomy.md",
        "components/tools/grounding.md"
      ],
      sharedVars,
      { weatherEnabled: false },
      undefined,
      ROOT_DIR
    );
    expect(result).toContain("fresh batch of work");
    expect(result).toContain("SYSTEM:");
    expect(result).toContain("RESEARCH:");
    expect(result).toContain("WIKIPEDIA:");
  });

  test("review composition contains reviewer identity and VERDICT instruction", async () => {
    const result = await composePromptBlock(
      ["components/identity/reviewer.md", "components/stance/queue-review.md"],
      sharedVars,
      { weatherEnabled: false },
      undefined,
      ROOT_DIR
    );
    expect(result).toContain("@reviewer");
    expect(result).toContain("VERDICT:");
  });

  test("preflight composition contains identity and preflight output format", async () => {
    const result = await composePromptBlock(
      [
        "components/identity/orchestrator-preflight.md",
        "components/format/preflight-output.md"
      ],
      sharedVars,
      {},
      undefined,
      ROOT_DIR
    );
    expect(result).toContain("Crew");
    expect(result).toContain("reasoning carefully before acting");
    expect(result).toContain("GOAL:");
    expect(result).toContain("APPROACH:");
  });

  test("WEATHER conditional: absent when weatherEnabled=false, present when true", async () => {
    const withWeather = await composePromptBlock(
      ["components/tools/grounding.md"],
      {},
      { weatherEnabled: true },
      undefined,
      ROOT_DIR
    );
    const withoutWeather = await composePromptBlock(
      ["components/tools/grounding.md"],
      {},
      { weatherEnabled: false },
      undefined,
      ROOT_DIR
    );
    expect(withWeather).toContain("WEATHER:");
    expect(withoutWeather).not.toContain("WEATHER:");
  });
});

// ---------------------------------------------------------------------------
// D. Duplication guard
// ---------------------------------------------------------------------------

describe("Duplication guard", () => {
  test("no two component files share more than 30% of their lines", async () => {
    const files = await collectMarkdownFiles(COMPONENTS_DIR);
    const contents: Array<{ file: string; lines: string[] }> = [];

    for (const file of files) {
      const content = await readFile(file, "utf8");
      const lines = content
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 10);
      contents.push({ file, lines });
    }

    const violations: string[] = [];
    for (let i = 0; i < contents.length; i++) {
      for (let j = i + 1; j < contents.length; j++) {
        const a = contents[i];
        const b = contents[j];
        if (a.lines.length === 0 || b.lines.length === 0) continue;

        const setA = new Set(a.lines);
        const setB = new Set(b.lines);
        const intersection = [...setA].filter((line) => setB.has(line));
        const smaller = Math.min(setA.size, setB.size);
        const overlapRatio = intersection.length / smaller;

        if (overlapRatio > 0.3) {
          violations.push(
            `Overlap ${Math.round(overlapRatio * 100)}% between:\n  ${a.file}\n  ${b.file}`
          );
        }
      }
    }

    if (violations.length > 0) throw new Error(`Duplication detected:\n${violations.join("\n\n")}`);
    expect(violations).toHaveLength(0);
  });
});
