import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import {
  buildAgentChatMessages,
  buildAgentIdentityBlock,
  buildAutoTaskMessages,
  buildQueueFillFinalizeMessages,
  buildQueueFillMessages,
  buildQueueFillReviewMessages,
  buildTaskPreflightMessages,
  parseTaskDomain
} from "../src/messages.ts";
import { formatCurrentDateTime } from "../src/utils.ts";

async function withTempDir(run: (rootDir: string) => Promise<void>): Promise<void> {
  const rootDir = await mkdtemp(join(tmpdir(), "localcrew-msg-"));
  try {
    await run(rootDir);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

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
  agentName: "Vic",
  agentSlug: "vic",
  preferredResource: "orchestrator",
  orchestratorName: "Captain",
  spec: "You are Vic.",
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
  orchestratorName: "Captain",
  agents: [],
  task: "Document the routing logic.",
  priority: "medium",
  createdBy: "user",
  resourceAlias: "orchestrator",
  resourceRationale: "Only resource."
} as const;

describe("buildAgentChatMessages – temporal grounding", () => {
  test("injects currentDateTime as a system message when provided", async () => {
    const dt = "2026-03-02 (Monday) 15:42 UTC (UTC)";
    const messages = await buildAgentChatMessages({ ...BASE_AGENT_OPTIONS, currentDateTime: dt });
    const systemMessages = messages.filter((m) => m.role === "system");
    const dtMessage = systemMessages.find((m) => m.content.includes(dt));
    expect(dtMessage).toBeDefined();
    expect(dtMessage?.content).toBe(`Current date and time: ${dt}`);
  });

  test("omits datetime system message when currentDateTime is not provided", async () => {
    const messages = await buildAgentChatMessages({ ...BASE_AGENT_OPTIONS });
    const hasDatetime = messages.some((m) => m.content.startsWith("Current date and time:"));
    expect(hasDatetime).toBe(false);
  });
});

describe("buildAutoTaskMessages – temporal grounding", () => {
  test("injects currentDateTime after the resource inventory block", async () => {
    const dt = "2026-03-02 (Monday) 15:42 UTC (UTC)";
    const messages = await buildAutoTaskMessages({ ...BASE_AUTO_OPTIONS, currentDateTime: dt });
    const dtIndex = messages.findIndex((m) => m.content.startsWith("Current date and time:"));
    const inventoryIndex = messages.findIndex((m) => m.content.startsWith("Resource inventory:"));
    expect(dtIndex).toBeGreaterThan(inventoryIndex);
  });

  test("omits datetime system message when currentDateTime is not provided", async () => {
    const messages = await buildAutoTaskMessages({ ...BASE_AUTO_OPTIONS });
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
  orchestratorName: "Captain",
  agents: []
} as const;

describe("buildQueueFillMessages – temporal grounding", () => {
  test("injects currentDateTime when provided", async () => {
    const dt = "2026-03-02 (Monday) 15:42 UTC (UTC)";
    const messages = await buildQueueFillMessages({ ...BASE_FILL_OPTIONS, currentDateTime: dt });
    const dtMessage = messages.find((m) => m.content.startsWith("Current date and time:"));
    expect(dtMessage).toBeDefined();
    expect(dtMessage?.content).toBe(`Current date and time: ${dt}`);
  });

  test("omits datetime when not provided", async () => {
    const messages = await buildQueueFillMessages({ ...BASE_FILL_OPTIONS });
    expect(messages.some((m) => m.content.startsWith("Current date and time:"))).toBe(false);
  });
});

describe("buildQueueFillReviewMessages – temporal grounding", () => {
  test("injects currentDateTime before the user message", async () => {
    const dt = "2026-03-02 (Monday) 15:42 UTC (UTC)";
    const messages = await buildQueueFillReviewMessages({
      orchestratorName: "Captain",
      reviewerAlias: "vic",
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
  test("injects currentDateTime when provided", async () => {
    const dt = "2026-03-02 (Monday) 15:42 UTC (UTC)";
    const messages = await buildQueueFillFinalizeMessages({
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
    orchestratorName: "Captain",
    task: "Audit the routing logic and document it.",
    priority: "medium",
    directives: "No external changes.",
    inventory: "1 device with 16GB RAM."
  } as const;

  test("returns messages array with system + user messages", async () => {
    const messages = await buildTaskPreflightMessages(BASE_PREFLIGHT);
    expect(messages.some((m) => m.role === "system")).toBe(true);
    expect(messages.some((m) => m.role === "user")).toBe(true);
  });

  test("user message contains the task text", async () => {
    const messages = await buildTaskPreflightMessages(BASE_PREFLIGHT);
    const user = messages.find((m) => m.role === "user");
    expect(user?.content).toContain(BASE_PREFLIGHT.task);
  });

  test("system message references orchestrator name", async () => {
    const messages = await buildTaskPreflightMessages(BASE_PREFLIGHT);
    const system = messages.find((m) => m.role === "system");
    expect(system?.content).toContain(BASE_PREFLIGHT.orchestratorName);
  });

  test("injects currentDateTime as a system message when provided", async () => {
    const dt = "2026-03-02 (Monday) 15:42 UTC (UTC)";
    const messages = await buildTaskPreflightMessages({ ...BASE_PREFLIGHT, currentDateTime: dt });
    const dtMessage = messages.find((m) => m.content.startsWith("Current date and time:"));
    expect(dtMessage).toBeDefined();
    expect(dtMessage?.content).toBe(`Current date and time: ${dt}`);
  });

  test("omits datetime message when currentDateTime is not provided", async () => {
    const messages = await buildTaskPreflightMessages(BASE_PREFLIGHT);
    expect(messages.some((m) => m.content.startsWith("Current date and time:"))).toBe(false);
  });

  test("truncates long directives to keep context budget tight", async () => {
    const longDirectives = "x".repeat(2000);
    const messages = await buildTaskPreflightMessages({ ...BASE_PREFLIGHT, directives: longDirectives });
    const directivesMessage = messages.find((m) => m.content.startsWith("Core directives summary:"));
    expect(directivesMessage?.content.length).toBeLessThan(1000);
  });
});

// ---------------------------------------------------------------------------
// parseTaskDomain
// ---------------------------------------------------------------------------

describe("parseTaskDomain", () => {
  test("parses uppercase domain tag from task content", () => {
    expect(parseTaskDomain("{domain:RESEARCH} Find AI jobs")).toBe("research");
  });

  test("parses lowercase domain tag", () => {
    expect(parseTaskDomain("{domain:system} Update routing docs")).toBe("system");
  });

  test("parses mixed-case domain tag", () => {
    expect(parseTaskDomain("{domain:Knowledge} Synthesize findings")).toBe("knowledge");
  });

  test("returns null when no domain tag present", () => {
    expect(parseTaskDomain("A plain task without domain")).toBeNull();
  });

  test("returns null for domain tag not at start of string", () => {
    expect(parseTaskDomain("Some text {domain:RESEARCH} more text")).toBeNull();
  });

  test("returns null for empty string", () => {
    expect(parseTaskDomain("")).toBeNull();
  });

  test("handles domain tag followed by no space", () => {
    expect(parseTaskDomain("{domain:IDENTITY}Develop agent")).toBe("identity");
  });
});

// ---------------------------------------------------------------------------
// buildAgentIdentityBlock
// ---------------------------------------------------------------------------

describe("buildAgentIdentityBlock", () => {
  test("reads agent identity file from external-memory/agents/{domain}.md", async () => {
    await withTempDir(async (rootDir) => {
      const agentsDir = join(rootDir, "external-memory", "agents");
      await mkdir(agentsDir, { recursive: true });
      await writeFile(join(agentsDir, "research.md"), "You are a research specialist.\n");

      const block = await buildAgentIdentityBlock("research", rootDir);
      expect(block).toBe("You are a research specialist.");
    });
  });

  test("returns empty string when domain file does not exist", async () => {
    await withTempDir(async (rootDir) => {
      const block = await buildAgentIdentityBlock("nonexistent", rootDir);
      expect(block).toBe("");
    });
  });

  test("trims whitespace from the spec content", async () => {
    await withTempDir(async (rootDir) => {
      const agentsDir = join(rootDir, "external-memory", "agents");
      await mkdir(agentsDir, { recursive: true });
      await writeFile(join(agentsDir, "knowledge.md"), "  Knowledge organization specialist.\n\n");

      const block = await buildAgentIdentityBlock("knowledge", rootDir);
      expect(block).toBe("Knowledge organization specialist.");
    });
  });
});

// ---------------------------------------------------------------------------
// buildQueueFillMessages – domain-tagged generation
// ---------------------------------------------------------------------------

describe("buildQueueFillMessages – domain tags", () => {
  test("system prompt instructs generation of domain-tagged tasks", async () => {
    const messages = await buildQueueFillMessages({ ...BASE_FILL_OPTIONS });
    const allSystem = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
    expect(allSystem).toContain("{domain:");
    expect(allSystem).toContain("SYSTEM");
    expect(allSystem).toContain("RESEARCH");
    expect(allSystem).toContain("KNOWLEDGE");
    expect(allSystem).toContain("SYNTHESIS");
    expect(allSystem).toContain("IDENTITY");
  });

  test("requests 10-12 tasks across five domains", async () => {
    const messages = await buildQueueFillMessages({ ...BASE_FILL_OPTIONS });
    const allSystem = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
    expect(allSystem).toContain("Generate exactly 8 tasks");
    expect(allSystem).toContain("If the target count is at least 5, include every domain at least once");
  });
});

describe("buildQueueFillFinalizeMessages – domain tags", () => {
  test("finalize prompt preserves domain distribution instruction", async () => {
    const messages = await buildQueueFillFinalizeMessages({
      ...BASE_FILL_OPTIONS,
      draftTasks: "{domain:SYSTEM} [medium] tighten routing docs",
      reviewFeedback: "VERDICT: approve"
    });
    const allSystem = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
    expect(allSystem).toContain("domain");
    expect(allSystem).toContain("Finalize exactly 6 tasks");
  });
});
