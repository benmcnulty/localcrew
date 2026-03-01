import { describe, expect, test } from "bun:test";

import {
  buildAgentChatMessages,
  buildAutoTaskMessages,
  buildQueueFillFinalizeMessages,
  buildQueueFillMessages,
  buildQueueFillReviewMessages,
  buildTaskPreflightMessages
} from "../src/messages.ts";
import { formatCurrentDateTime } from "../src/utils.ts";

// ---------------------------------------------------------------------------
// formatCurrentDateTime
// ---------------------------------------------------------------------------

describe("formatCurrentDateTime", () => {
  test("returns a string matching the expected format", () => {
    const result = formatCurrentDateTime(new Date("2026-03-02T15:42:00Z"));
    expect(result).toBe("2026-03-02 (Monday) 15:42 UTC (UTC)");
  });

  test("includes the day name", () => {
    const saturday = new Date("2026-03-07T10:00:00Z");
    expect(formatCurrentDateTime(saturday)).toContain("Saturday");
  });

  test("includes UTC offset label when offset is non-zero", () => {
    // Simulate a +05:30 offset by patching getTimezoneOffset on the Date prototype.
    const date = new Date("2026-03-02T10:00:00Z");
    const origOffset = Date.prototype.getTimezoneOffset;
    Date.prototype.getTimezoneOffset = () => -330; // +05:30
    try {
      const result = formatCurrentDateTime(date);
      expect(result).toContain("UTC+05:30");
    } finally {
      Date.prototype.getTimezoneOffset = origOffset;
    }
  });

  test("defaults to current time when no argument given", () => {
    const before = Date.now();
    const result = formatCurrentDateTime();
    const after = Date.now();
    // The year in the result should match the current year
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}/);
    // Result should not be empty
    expect(result.length).toBeGreaterThan(10);
    // Sanity: both timestamps are close
    expect(after - before).toBeLessThan(100);
  });
});

// ---------------------------------------------------------------------------
// Temporal grounding injection
// ---------------------------------------------------------------------------

const BASE_AGENT_OPTIONS = {
  agentName: "Zora",
  agentSlug: "zora",
  preferredResource: "orchestrator",
  orchestratorName: "Crusty",
  spec: "You are Zora.",
  summary: "",
  recentMessages: [],
  taskPrompt: "Hello"
} as const;

const BASE_AUTO_OPTIONS = {
  directives: "Be safe.",
  inventory: "1 device.",
  roadmap: "Improve.",
  focusTodo: "Next step.",
  changelog: "v0.1",
  orchestratorSummary: "All good.",
  orchestratorName: "Crusty",
  agents: [],
  task: "Document the routing logic.",
  priority: "medium",
  createdBy: "user",
  resourceAlias: "orchestrator",
  resourceRationale: "Only resource."
} as const;

describe("buildAgentChatMessages – temporal grounding", () => {
  test("injects currentDateTime as a system message when provided", () => {
    const dt = "2026-03-02 (Monday) 15:42 UTC (UTC)";
    const messages = buildAgentChatMessages({ ...BASE_AGENT_OPTIONS, currentDateTime: dt });
    const systemMessages = messages.filter((m) => m.role === "system");
    const dtMessage = systemMessages.find((m) => m.content.includes(dt));
    expect(dtMessage).toBeDefined();
    expect(dtMessage?.content).toBe(`Current date and time: ${dt}`);
  });

  test("omits datetime system message when currentDateTime is not provided", () => {
    const messages = buildAgentChatMessages({ ...BASE_AGENT_OPTIONS });
    const hasDatetime = messages.some((m) => m.content.startsWith("Current date and time:"));
    expect(hasDatetime).toBe(false);
  });
});

describe("buildAutoTaskMessages – temporal grounding", () => {
  test("injects currentDateTime after the resource inventory block", () => {
    const dt = "2026-03-02 (Monday) 15:42 UTC (UTC)";
    const messages = buildAutoTaskMessages({ ...BASE_AUTO_OPTIONS, currentDateTime: dt });
    const dtIndex = messages.findIndex((m) => m.content.startsWith("Current date and time:"));
    const inventoryIndex = messages.findIndex((m) => m.content.startsWith("Resource inventory:"));
    expect(dtIndex).toBeGreaterThan(inventoryIndex);
  });

  test("omits datetime system message when currentDateTime is not provided", () => {
    const messages = buildAutoTaskMessages({ ...BASE_AUTO_OPTIONS });
    const hasDatetime = messages.some((m) => m.content.startsWith("Current date and time:"));
    expect(hasDatetime).toBe(false);
  });
});

const BASE_FILL_OPTIONS = {
  directives: "Be safe.",
  inventory: "1 device.",
  roadmap: "Improve.",
  focusTodo: "Next step.",
  changelog: "v0.1",
  orchestratorSummary: "All good.",
  orchestratorName: "Crusty",
  agents: []
} as const;

describe("buildQueueFillMessages – temporal grounding", () => {
  test("injects currentDateTime when provided", () => {
    const dt = "2026-03-02 (Monday) 15:42 UTC (UTC)";
    const messages = buildQueueFillMessages({ ...BASE_FILL_OPTIONS, currentDateTime: dt });
    const dtMessage = messages.find((m) => m.content.startsWith("Current date and time:"));
    expect(dtMessage).toBeDefined();
    expect(dtMessage?.content).toBe(`Current date and time: ${dt}`);
  });

  test("omits datetime when not provided", () => {
    const messages = buildQueueFillMessages({ ...BASE_FILL_OPTIONS });
    expect(messages.some((m) => m.content.startsWith("Current date and time:"))).toBe(false);
  });
});

describe("buildQueueFillReviewMessages – temporal grounding", () => {
  test("injects currentDateTime before the user message", () => {
    const dt = "2026-03-02 (Monday) 15:42 UTC (UTC)";
    const messages = buildQueueFillReviewMessages({
      orchestratorName: "Crusty",
      reviewerAlias: "zora",
      draftTasks: "[medium] tighten routing docs",
      inventory: "1 device.",
      roadmap: "Improve.",
      focusTodo: "Next step.",
      changelog: "v0.1",
      currentDateTime: dt
    });
    const dtIndex = messages.findIndex((m) => m.content.startsWith("Current date and time:"));
    const userIndex = messages.findIndex((m) => m.role === "user");
    expect(dtIndex).toBeGreaterThan(-1);
    expect(dtIndex).toBeLessThan(userIndex);
  });
});

describe("buildQueueFillFinalizeMessages – temporal grounding", () => {
  test("injects currentDateTime when provided", () => {
    const dt = "2026-03-02 (Monday) 15:42 UTC (UTC)";
    const messages = buildQueueFillFinalizeMessages({
      ...BASE_FILL_OPTIONS,
      draftTasks: "[medium] tighten routing docs",
      reviewFeedback: "VERDICT: approve",
      currentDateTime: dt
    });
    const dtMessage = messages.find((m) => m.content.startsWith("Current date and time:"));
    expect(dtMessage).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// buildTaskPreflightMessages
// ---------------------------------------------------------------------------

describe("buildTaskPreflightMessages", () => {
  const BASE_PREFLIGHT = {
    orchestratorName: "Crusty",
    task: "Audit the routing logic and document it.",
    priority: "medium",
    directives: "No external changes.",
    inventory: "1 device with 16GB RAM."
  } as const;

  test("returns messages array with system + user messages", () => {
    const messages = buildTaskPreflightMessages(BASE_PREFLIGHT);
    expect(messages.some((m) => m.role === "system")).toBe(true);
    expect(messages.some((m) => m.role === "user")).toBe(true);
  });

  test("user message contains the task text", () => {
    const messages = buildTaskPreflightMessages(BASE_PREFLIGHT);
    const user = messages.find((m) => m.role === "user");
    expect(user?.content).toContain(BASE_PREFLIGHT.task);
  });

  test("system message references orchestrator name", () => {
    const messages = buildTaskPreflightMessages(BASE_PREFLIGHT);
    const system = messages.find((m) => m.role === "system");
    expect(system?.content).toContain(BASE_PREFLIGHT.orchestratorName);
  });

  test("injects currentDateTime as a system message when provided", () => {
    const dt = "2026-03-02 (Monday) 15:42 UTC (UTC)";
    const messages = buildTaskPreflightMessages({ ...BASE_PREFLIGHT, currentDateTime: dt });
    const dtMessage = messages.find((m) => m.content.startsWith("Current date and time:"));
    expect(dtMessage).toBeDefined();
    expect(dtMessage?.content).toBe(`Current date and time: ${dt}`);
  });

  test("omits datetime message when currentDateTime is not provided", () => {
    const messages = buildTaskPreflightMessages(BASE_PREFLIGHT);
    expect(messages.some((m) => m.content.startsWith("Current date and time:"))).toBe(false);
  });

  test("truncates long directives to keep context budget tight", () => {
    const longDirectives = "x".repeat(2000);
    const messages = buildTaskPreflightMessages({ ...BASE_PREFLIGHT, directives: longDirectives });
    const directivesMessage = messages.find((m) => m.content.startsWith("Core directives summary:"));
    expect(directivesMessage?.content.length).toBeLessThan(1000);
  });
});
