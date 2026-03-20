import { describe, expect, test } from "bun:test";

import {
  parseSharedLearnings,
  identifyNovelLearnings,
  formatLearningsForReflect,
} from "../src/optimization-digest.ts";

describe("parseSharedLearnings", () => {
  test("parses a valid [LEARNING] block", () => {
    const feedText = `
[LEARNING] Title: Prefer top-tier for synthesis tasks
Action: Route summarization and reasoning tasks to top-tier resources
Context: Mid-tier resources struggle with long-context synthesis
Confidence: HIGH
`;
    const learnings = parseSharedLearnings(feedText);
    expect(learnings).toHaveLength(1);
    expect(learnings[0].title).toBe("Prefer top-tier for synthesis tasks");
    expect(learnings[0].action).toBe("Route summarization and reasoning tasks to top-tier resources");
    expect(learnings[0].context).toBe("Mid-tier resources struggle with long-context synthesis");
    expect(learnings[0].confidence).toBe("HIGH");
  });

  test("parses multiple [LEARNING] blocks", () => {
    const feedText = `
[LEARNING] Title: Use short context for indexing
Action: Keep indexing tasks under 2K tokens
Context: Short-context models perform better on structured small tasks
Confidence: MEDIUM

[LEARNING] Title: Batch changelog entries
Action: Collect changelog entries and write in one pass
Context: Frequent small writes cause drift in changelog quality
Confidence: HIGH
`;
    const learnings = parseSharedLearnings(feedText);
    expect(learnings).toHaveLength(2);
    expect(learnings[0].title).toBe("Use short context for indexing");
    expect(learnings[1].confidence).toBe("HIGH");
  });

  test("returns empty array for text with no [LEARNING] blocks", () => {
    const feedText = "Just some regular port feed content here.\n\nNo learnings.";
    expect(parseSharedLearnings(feedText)).toHaveLength(0);
  });

  test("returns empty array for empty string", () => {
    expect(parseSharedLearnings("")).toHaveLength(0);
  });

  test("ignores LOW confidence entries", () => {
    const feedText = `
[LEARNING] Title: Speculative idea
Action: Try this maybe
Context: Not very sure
Confidence: LOW
`;
    expect(parseSharedLearnings(feedText)).toHaveLength(0);
  });

  test("handles missing optional fields gracefully", () => {
    const feedText = `
[LEARNING] Title: Minimal learning
Action: Do the thing
Context: Because it works
Confidence: HIGH
`;
    const learnings = parseSharedLearnings(feedText);
    expect(learnings).toHaveLength(1);
    expect(learnings[0].sourceOrchestrator).toBeUndefined();
  });
});

describe("identifyNovelLearnings", () => {
  test("returns learnings not present in local text", () => {
    const incoming = [
      { title: "New routing rule", action: "Route X", context: "Because Y", confidence: "HIGH" as const },
      { title: "Known rule", action: "Route Z", context: "Because W", confidence: "HIGH" as const },
    ];
    const localLearnings = "## Known rule\n\nRoute Z: Because W\n";
    const novel = identifyNovelLearnings(incoming, localLearnings);
    expect(novel).toHaveLength(1);
    expect(novel[0].title).toBe("New routing rule");
  });

  test("returns all learnings when local text is empty", () => {
    const incoming = [
      { title: "Learning A", action: "Do A", context: "Ctx A", confidence: "HIGH" as const },
      { title: "Learning B", action: "Do B", context: "Ctx B", confidence: "MEDIUM" as const },
    ];
    const novel = identifyNovelLearnings(incoming, "");
    expect(novel).toHaveLength(2);
  });

  test("returns empty array when all learnings are already known", () => {
    const incoming = [
      { title: "Context window ceiling", action: "Check ceiling", context: "Models fail above ceiling", confidence: "HIGH" as const },
    ];
    const localLearnings = "## Context window ceiling\n\nCheck ceiling: Models fail above ceiling\n";
    expect(identifyNovelLearnings(incoming, localLearnings)).toHaveLength(0);
  });
});

describe("formatLearningsForReflect", () => {
  test("formats learnings as readable context block", () => {
    const learnings = [
      { title: "Prefer top-tier", action: "Use top tier", context: "Better results", confidence: "HIGH" as const },
    ];
    const result = formatLearningsForReflect(learnings);
    expect(result).toContain("Prefer top-tier");
    expect(result).toContain("Use top tier");
    expect(result).toContain("Better results");
    expect(result).toContain("HIGH");
  });

  test("formats multiple learnings with separators", () => {
    const learnings = [
      { title: "A", action: "Do A", context: "Ctx A", confidence: "HIGH" as const },
      { title: "B", action: "Do B", context: "Ctx B", confidence: "MEDIUM" as const },
    ];
    const result = formatLearningsForReflect(learnings);
    expect(result).toContain("A");
    expect(result).toContain("B");
  });

  test("returns empty string for empty array", () => {
    expect(formatLearningsForReflect([])).toBe("");
  });
});
