import { describe, expect, test } from "bun:test";

import {
  extractContentTerms,
  isLowInformationAutonomousTask,
  isSubstantiveOutput,
  isTaskDuplicate,
  outputAddressesTask,
  outputAlignedWithGoal,
  verifyTaskOutput
} from "../src/quality.ts";
import type { AutoQueueTask } from "../src/types.ts";

// ---------------------------------------------------------------------------
// extractContentTerms
// ---------------------------------------------------------------------------

describe("extractContentTerms", () => {
  test("returns top content words from a sentence", () => {
    const terms = extractContentTerms("routing quality memory hygiene telemetry accuracy");
    expect(terms).toContain("routing");
    expect(terms).toContain("quality");
    expect(terms).toContain("memory");
  });

  test("excludes stop words", () => {
    const terms = extractContentTerms("the quick brown fox jumped over the lazy dog");
    expect(terms).not.toContain("the");
    expect(terms).not.toContain("and");
    expect(terms).toContain("fox");
  });

  test("excludes tokens shorter than 3 characters", () => {
    const terms = extractContentTerms("AI ML NLP models routing");
    expect(terms).not.toContain("ai");
    expect(terms).not.toContain("ml");
    expect(terms).toContain("routing");
  });

  test("returns at most 10 terms", () => {
    const longText = "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi";
    const terms = extractContentTerms(longText);
    expect(terms.length).toBeLessThanOrEqual(10);
  });

  test("returns empty array for empty string", () => {
    expect(extractContentTerms("")).toEqual([]);
  });

  test("is case-insensitive", () => {
    const terms = extractContentTerms("Routing ROUTING routing");
    expect(terms).toContain("routing");
  });
});

// ---------------------------------------------------------------------------
// isSubstantiveOutput
// ---------------------------------------------------------------------------

describe("isSubstantiveOutput", () => {
  test("returns true for a normal substantive response", () => {
    expect(isSubstantiveOutput("The routing table has been updated with three new entries.")).toBe(
      true
    );
  });

  test("returns false for an empty string", () => {
    expect(isSubstantiveOutput("")).toBe(false);
  });

  test("returns false for whitespace-only", () => {
    expect(isSubstantiveOutput("   \n  ")).toBe(false);
  });

  test("strips boilerplate opener before checking length", () => {
    // A response that is only a boilerplate opener with < 10 chars of content
    const bare = "Sure, let me help. ok";
    // "ok" has 2 chars after stripping — too short
    expect(isSubstantiveOutput("Sure, let me help.")).toBe(false);
    void bare; // avoid unused-var lint
  });

  test("returns true when substantive content follows boilerplate", () => {
    const response =
      "Sure, let me help. The orchestrator memory was updated with the latest telemetry results.";
    expect(isSubstantiveOutput(response)).toBe(true);
  });

  test("strips horizontal rules", () => {
    const response = "\n---\n\n---\n";
    expect(isSubstantiveOutput(response)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// outputAddressesTask
// ---------------------------------------------------------------------------

describe("outputAddressesTask", () => {
  test("returns true when output covers >= 30% of task terms", () => {
    const task = "Update the routing documentation with current resource aliases.";
    const output = "The routing docs now contain the updated aliases as requested.";
    expect(outputAddressesTask(output, task)).toBe(true);
  });

  test("returns false when output shares no task terms", () => {
    const task = "Analyze telemetry data for anomalies in inference latency.";
    const output = "The weather forecast shows sunshine tomorrow.";
    expect(outputAddressesTask(output, task)).toBe(false);
  });

  test("returns true when task has no extractable terms", () => {
    expect(outputAddressesTask("anything", "the and is to of")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// outputAlignedWithGoal
// ---------------------------------------------------------------------------

describe("outputAlignedWithGoal", () => {
  test("returns true when at least one goal term appears in output", () => {
    const output = "The memory summary was updated to reflect recent changes.";
    const goal = "Update the memory summary.";
    expect(outputAlignedWithGoal(output, goal)).toBe(true);
  });

  test("returns false when no goal terms appear in output", () => {
    const output = "The weather is sunny.";
    const goal = "Compact the orchestrator memory file.";
    expect(outputAlignedWithGoal(output, goal)).toBe(false);
  });

  test("returns true when goal has no extractable terms", () => {
    expect(outputAlignedWithGoal("anything", "the and is")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// verifyTaskOutput
// ---------------------------------------------------------------------------

function makeTask(content: string): AutoQueueTask {
  return {
    id: 1,
    content,
    priority: "medium",
    createdAt: new Date().toISOString(),
    createdBy: "user",
    status: "queued"
  };
}

describe("verifyTaskOutput", () => {
  test("passes when output is substantive and no artifact errors", () => {
    const result = verifyTaskOutput({
      task: makeTask("Write a summary of routing improvements."),
      output: "The routing improvements have been documented in the memory summary file.",
      preflightGoal: null,
      claimedWriteCount: 0,
      verifiedWriteCount: 0,
      postProcessErrors: []
    });
    expect(result.passed).toBe(true);
    expect(result.signals.substantive).toBe(true);
    expect(result.signals.artifactsVerified).toBe(true);
  });

  test("fails when output is not substantive", () => {
    const result = verifyTaskOutput({
      task: makeTask("Write a summary."),
      output: "Sure.",
      preflightGoal: null,
      claimedWriteCount: 0,
      verifiedWriteCount: 0,
      postProcessErrors: []
    });
    expect(result.passed).toBe(false);
    expect(result.signals.substantive).toBe(false);
    expect(result.reason).toContain("substantive=no");
  });

  test("fails when claimed writes exceed verified writes", () => {
    const result = verifyTaskOutput({
      task: makeTask("Write a report file."),
      output: "A detailed report covering all improvements to the routing system has been written.",
      preflightGoal: null,
      claimedWriteCount: 2,
      verifiedWriteCount: 1,
      postProcessErrors: []
    });
    expect(result.passed).toBe(false);
    expect(result.signals.artifactsVerified).toBe(false);
  });

  test("fails when postProcessErrors is non-empty", () => {
    const result = verifyTaskOutput({
      task: makeTask("Update the memory index."),
      output: "The memory index was updated with the latest routing telemetry data.",
      preflightGoal: null,
      claimedWriteCount: 0,
      verifiedWriteCount: 0,
      postProcessErrors: ["Write failed: permission denied"]
    });
    expect(result.passed).toBe(false);
    expect(result.signals.artifactsVerified).toBe(false);
  });

  test("reason string contains all four signal labels", () => {
    const result = verifyTaskOutput({
      task: makeTask("Summarize recent improvements."),
      output: "The improvements have been summarized.",
      preflightGoal: null,
      claimedWriteCount: 0,
      verifiedWriteCount: 0,
      postProcessErrors: []
    });
    expect(result.reason).toContain("substantive=");
    expect(result.reason).toContain("addressesTask=");
    expect(result.reason).toContain("artifactsVerified=");
    expect(result.reason).toContain("goalAligned=");
  });

  test("goalAligned is true when preflightGoal is null", () => {
    const result = verifyTaskOutput({
      task: makeTask("Anything."),
      output: "A detailed response about something entirely different from the goal.",
      preflightGoal: null,
      claimedWriteCount: 0,
      verifiedWriteCount: 0,
      postProcessErrors: []
    });
    expect(result.signals.goalAligned).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isLowInformationAutonomousTask
// ---------------------------------------------------------------------------

describe("isLowInformationAutonomousTask", () => {
  test("returns true for an empty string", () => {
    expect(isLowInformationAutonomousTask("")).toBe(true);
  });

  test("returns true for a bare placeholder verb", () => {
    expect(isLowInformationAutonomousTask("implement")).toBe(true);
    expect(isLowInformationAutonomousTask("review")).toBe(true);
    expect(isLowInformationAutonomousTask("update")).toBe(true);
  });

  test("returns false for a specific concrete task", () => {
    expect(
      isLowInformationAutonomousTask("Review the orchestrator changelog for the past week")
    ).toBe(false);
  });

  test("returns true for a two-word phrase", () => {
    expect(isLowInformationAutonomousTask("do it")).toBe(true);
  });

  test("returns false for a five-word or longer task", () => {
    expect(isLowInformationAutonomousTask("Summarize recent routing quality improvements")).toBe(
      false
    );
  });
});

// ---------------------------------------------------------------------------
// isTaskDuplicate
// ---------------------------------------------------------------------------

describe("isTaskDuplicate", () => {
  test("returns false when existing tasks list is empty", () => {
    expect(isTaskDuplicate("Update the routing docs", [])).toBe(false);
  });

  test("returns true when proposed shares >= 60% keywords with existing", () => {
    const existing = [{ content: "Audit memory index files for outdated context" }];
    const proposed = "Audit the memory index for outdated stale context entries";
    expect(isTaskDuplicate(proposed, existing)).toBe(true);
  });

  test("returns false when proposed shares < 60% keywords with existing", () => {
    const existing = [{ content: "Generate a user-facing daily briefing document" }];
    const proposed = "Compile telemetry data for routing performance analysis";
    expect(isTaskDuplicate(proposed, existing)).toBe(false);
  });

  test("returns false when proposed has no extractable keywords", () => {
    const existing = [{ content: "A specific task with keywords" }];
    expect(isTaskDuplicate("do it", existing)).toBe(false);
  });
});
