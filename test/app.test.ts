import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { LocalCrewApp } from "../src/app.ts";
import { parseCommand } from "../src/commands.ts";
import { getDefaultInstruction, loadConfig } from "../src/config.ts";
import { saveResources, type ResourceProfile } from "../src/resources.ts";
import {
  createAgent,
  listAgents,
  loadAgentSpec,
  loadSystemState
} from "../src/orchestrator-store.ts";
import {
  getConversationCompactedUntil,
  getConversationSummary,
  loadSessions
} from "../src/session-store.ts";
import { speakText } from "../src/speech.ts";
import { getStoragePaths } from "../src/storage.ts";
import {
  appendAuditEvent,
  loadTelemetrySummary,
  readRecentAuditEvents
} from "../src/telemetry.ts";
import type { ChatMessage } from "../src/types.ts";

/** Write a non-stale daily-work.md so idle cycle tests aren't interrupted by the daily work gate. */
async function seedCurrentDailyWork(rootDir: string): Promise<void> {
  const paths = getStoragePaths(rootDir);
  await mkdir(paths.orchestratorDir, { recursive: true });
  await writeFile(paths.dailyWorkPath, "# Daily Work\n\nSeeded for test.", "utf8");
}

async function withTempDir(run: (rootDir: string) => Promise<void>): Promise<void> {
  const rootDir = await mkdtemp(join(tmpdir(), "localcrew-"));

  try {
    await run(rootDir);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

async function seedResourceInventory(rootDir: string): Promise<void> {
  const resources: Record<string, ResourceProfile> = {
    orchestrator: {
      alias: "orchestrator",
      label: "Local Orchestrator",
      tier: "top",
      baseUrl: "http://127.0.0.1:11434",
      defaultModel: "llama3.1:8b",
      reasoningModel: "gpt-oss:20b",
      codingModel: "qwen3-coder:latest",
      toolsModel: "gemma3:4b",
      embeddingModel: "nomic-embed-text:latest",
      role: "Primary orchestration resource.",
      capabilities: ["reasoning", "planning", "chat", "code generation", "tool formatting"],
      notes: []
    },
    workhorse: {
      alias: "workhorse",
      label: "Second Device",
      tier: "top",
      baseUrl: "http://127.0.0.1:11435",
      defaultModel: "llama3.1:8b",
      toolsModel: "gemma3:4b",
      embeddingModel: "nomic-embed-text:latest",
      role: "Top-tier drafting resource.",
      capabilities: ["chat", "drafting"],
      notes: []
    },
    helper: {
      alias: "helper",
      label: "Structured Helper",
      tier: "mid",
      baseUrl: "http://127.0.0.1:11436",
      defaultModel: "llama3.2:1b",
      toolsModel: "qwen2.5:0.5b",
      embeddingModel: "granite-embedding:latest",
      role: "Structured and indexing support.",
      capabilities: ["routing", "indexing"],
      notes: []
    },
    overflow: {
      alias: "overflow",
      label: "Overflow Node",
      tier: "low",
      baseUrl: "http://127.0.0.1:11437",
      defaultModel: "llama3.2:3b",
      role: "Small-context overflow.",
      capabilities: ["small tasks"],
      notes: []
    }
  };

  await saveResources(resources, rootDir);
}

/**
 * Pre-seeds the auto queue with enough low-priority padding tasks to stay
 * above the dynamic refill threshold in the default 4-resource test network,
 * so runIdleCycle skips queue-fill and goes straight to processNextAutoTask.
 * Uses high IDs (900+) and sets lastTaskId to 0 so user-queued tasks still
 * start from 1.
 */
async function seedPaddingTasks(rootDir: string): Promise<void> {
  const paths = getStoragePaths(rootDir);
  await mkdir(paths.systemDir, { recursive: true });
  const padding = Array.from({ length: 5 }, (_, i) => ({
    id: 900 + i,
    content: `Padding task ${i + 1}`,
    priority: "low",
    createdAt: "2026-03-01T00:00:00.000Z",
    createdBy: "test:padding",
    status: "queued",
  }));
  await writeFile(
    paths.systemStatePath,
    `${JSON.stringify(
      {
        auto: {
          enabled: false,
          defaultPriority: "high",
          lastTaskId: 0,
          pending: padding,
          completed: [],
        },
      },
      null,
      2
    )}\n`
  );
}

function makeChatResponse(
  text: string,
  options: {
    promptEvalCount?: number;
    evalCount?: number;
    totalDuration?: number;
  } = {}
): Response {
  return new Response(
    JSON.stringify({
      message: { content: text },
      prompt_eval_count: options.promptEvalCount ?? 24,
      eval_count: options.evalCount ?? 18,
      total_duration: options.totalDuration ?? 125_000_000
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json"
      }
    }
  );
}

describe("LocalCrewApp", () => {
  test("reports idle resources after a completed command response", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);

      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async () => makeChatResponse("Hello from Erin"),
        speakFn: () => {}
      });

      const result = await app.execute(parseCommand("Hello Erin"));
      const status = await app.getStatusSnapshot();
      const orchestrator = status.activeResources.find((resource) => resource.alias === "orchestrator");

      expect(result.errors).toEqual([]);
      expect(orchestrator).toEqual(
        expect.objectContaining({
          alias: "orchestrator",
          isBusy: false,
          activeModel: null
        })
      );
      expect(status.displayMetrics.fleetSummary.utilizationPct).toBe(0);
    });
  });

  test("builds a portal snapshot from live in-flight work and clears the model when idle", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      await seedPaddingTasks(rootDir);
      let modelCallBlocked = false;
      let releaseModelCall: (response: Response) => void = () => {
        throw new Error("Expected a blocked model call resolver.");
      };
      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async (input) => {
          if (String(input).endsWith("/api/tags")) {
            return new Response("{}", { status: 200 });
          }
          if (!modelCallBlocked) {
            modelCallBlocked = true;
            return new Promise<Response>((resolve) => {
              releaseModelCall = resolve;
            });
          }
          return makeChatResponse("Completed the requested draft.");
        },
        speakFn: () => {}
      });

      await app.execute(parseCommand("/auto"));
      const cyclePromise = app.runIdleCycle();

      let queue = await app.getQueueSnapshot();
      for (let attempt = 0; attempt < 100 && queue.activeTasks.length === 0; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        queue = await app.getQueueSnapshot();
      }

      const liveSnapshot = app.buildPortalSnapshot();
      expect(liveSnapshot.busy).toBe(true);
      expect(liveSnapshot.resources?.some((resource) => resource.isBusy === true && typeof resource.model === "string")).toBe(true);

      releaseModelCall(makeChatResponse("Preflight approved."));
      await cyclePromise;

      const idleSnapshot = app.buildPortalSnapshot();
      expect(idleSnapshot.busy).toBe(false);
      expect(idleSnapshot.resources?.every((resource) => resource.isBusy === false ? resource.model === null : true)).toBe(true);
    });
  });

  test("reports online counts from live resource health instead of configured resource total", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async () => makeChatResponse("Hello from Erin"),
        speakFn: () => {}
      });

      const appInternals = app as unknown as {
        resourceHealth: Map<string, { status: "online" | "offline" | "degraded"; latencyMs: number; checkedAt: number }>;
      };
      const now = Date.now();
      appInternals.resourceHealth.set("orchestrator", { status: "online", latencyMs: 12, checkedAt: now });
      appInternals.resourceHealth.set("workhorse", { status: "offline", latencyMs: 5000, checkedAt: now });
      appInternals.resourceHealth.set("helper", { status: "degraded", latencyMs: 140, checkedAt: now });
      appInternals.resourceHealth.set("overflow", { status: "online", latencyMs: 18, checkedAt: now });

      const status = await app.getStatusSnapshot();

      expect(status.displayMetrics.fleetSummary.totalNodes).toBe(4);
      expect(status.displayMetrics.fleetSummary.onlineNodes).toBe(3);
      expect(status.displayMetrics.fleetSummary.errorNodes).toBe(1);
      expect(status.displayMetrics.fleetSummary.utilizationPct).toBe(0);
    });
  });

  test("logs into the Local Crew Portal with orchestrator metadata and exposes the account username", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);

      const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async (input, init) => {
          const url = String(input);
          fetchCalls.push({ url, init });

          if (url.endsWith("/api/crew/validate-token")) {
            return new Response(
              JSON.stringify({
                valid: true,
                userId: "user-1",
                sessionToken: "session-1",
                deviceId: "device-1",
                orchestratorId: "orch-1",
                username: "ben",
                displayName: "Ben McNulty",
                expiresAt: "2026-12-31T00:00:00.000Z"
              }),
              {
                status: 200,
                headers: { "content-type": "application/json" }
              }
            );
          }

          if (url.endsWith("/api/crew/snapshot")) {
            return new Response(JSON.stringify({ accepted: true, heartbeat: 123 }), {
              status: 200,
              headers: { "content-type": "application/json" }
            });
          }

          throw new Error(`Unexpected fetch: ${url}`);
        },
        speakFn: () => {}
      });

      const result = await app.execute(parseCommand("/login TEST1234"));
      const status = await app.getStatusSnapshot();

      expect(result.errors).toEqual([]);
      expect(result.lines[0]).toContain("Connected to Local Crew Portal");
      expect(status.accountUsername).toBe("ben");
      expect(fetchCalls).toHaveLength(2);

      const validateCall = fetchCalls[0];
      const validateBody = JSON.parse(String(validateCall.init?.body)) as {
        token: string;
        orchestratorName: string;
        capacitySummary: { resourceCount: number };
      };
      expect(validateBody.token).toBe("TEST1234");
      expect(validateBody.orchestratorName).toBe("Captain");
      expect(validateBody.capacitySummary.resourceCount).toBe(4);

      const snapshotCall = fetchCalls[1];
      expect(snapshotCall.init?.headers).toEqual(
        expect.objectContaining({ authorization: "Bearer session-1" })
      );
      const snapshotBody = JSON.parse(String(snapshotCall.init?.body)) as {
        snapshot: {
          queueDepth: { pending: number; completed: number; failed: number };
          resources: Array<{ alias: string; isBusy?: boolean; model?: string | null }>;
        };
      };
      expect(snapshotBody.snapshot.queueDepth).toEqual({ pending: 0, completed: 0, failed: 0 });
      expect(snapshotBody.snapshot.resources).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ alias: "orchestrator", isBusy: false, model: null })
        ])
      );
    });
  });

  test("routes command-mode plain messages to the default endpoint", async () => {
    await withTempDir(async (rootDir) => {
      const seenBodies: Array<{ messages?: ChatMessage[] }> = [];
      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async (_input, init) => {
          seenBodies.push(JSON.parse(String(init?.body)));
          return makeChatResponse("Hello from Erin");
        },
        speakFn: () => {}
      });

      const result = await app.execute(parseCommand("Hello Erin"));

      expect(result.lines).toEqual(["@erin: Hello from Erin"]);
      expect(seenBodies[0]?.messages?.at(-1)).toEqual({
        role: "user",
        content: "USER -> @erin: Hello Erin"
      });
    });
  });

  test("routes @alias messages to the addressed participant", async () => {
    await withTempDir(async (rootDir) => {
      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async () => makeChatResponse("Reply from Zora"),
        speakFn: () => {}
      });

      const result = await app.execute(parseCommand("@zora Hello Zora"));

      expect(result.lines).toEqual(["@zora: Reply from Zora"]);
    });
  });

  test("routes chat-mode plain messages to the default endpoint", async () => {
    await withTempDir(async (rootDir) => {
      const seenBodies: Array<{ messages?: ChatMessage[] }> = [];
      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async (_input, init) => {
          seenBodies.push(JSON.parse(String(init?.body)));
          return makeChatResponse("Hello from Erin");
        },
        speakFn: () => {}
      });

      await app.execute(parseCommand("/model zora"));
      await app.execute(parseCommand("/chat"));
      const result = await app.execute(parseCommand("Still goes to default"));

      expect(result.lines).toEqual(["@erin: Hello from Erin"]);
      expect(seenBodies[0]?.messages?.at(-1)).toEqual({
        role: "user",
        content: "USER -> @erin: Still goes to default"
      });
    });
  });

  test("stores a follow-up suggestion instead of auto-submitting it", async () => {
    await withTempDir(async (rootDir) => {
      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async () =>
          makeChatResponse('Erin reply\nNEXT: @zora: "I have introduced myself, please go next."'),
        speakFn: () => {}
      });

      const result = await app.execute(parseCommand("Start the discussion."));
      const sessions = await loadSessions(rootDir);

      expect(result.lines).toEqual(["@erin: Erin reply"]);
      expect(result.followUpRequest).toEqual({
        fromAlias: "erin",
        toAlias: "zora",
        message: "I have introduced myself, please go next."
      });
      expect(sessions.conversation.messages).toEqual([
        {
          speaker: "user",
          target: "erin",
          content: "Start the discussion."
        },
        {
          speaker: "assistant",
          endpoint: "erin",
          content: "Erin reply"
        }
      ]);
    });
  });

  test("submits participant crosstalk and routes the reply to the target participant", async () => {
    await withTempDir(async (rootDir) => {
      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async () => makeChatResponse("Zora reply"),
        speakFn: () => {}
      });

      const result = await app.execute(parseCommand('@erin to @zora: "Please go next."'));
      const sessions = await loadSessions(rootDir);

      expect(result.lines).toEqual(["@zora: Zora reply"]);
      expect(sessions.conversation.messages).toEqual([
        {
          speaker: "assistant",
          endpoint: "erin",
          directedTo: "zora",
          content: "Please go next."
        },
        {
          speaker: "assistant",
          endpoint: "zora",
          content: "Zora reply"
        }
      ]);
    });
  });

  test("shares group conversation context across endpoints", async () => {
    await withTempDir(async (rootDir) => {
      const seenBodies: Array<{ messages?: ChatMessage[] }> = [];
      let callIndex = 0;

      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async (_input, init) => {
          seenBodies.push(JSON.parse(String(init?.body)));
          callIndex += 1;
          return makeChatResponse(callIndex === 1 ? "Erin reply" : "Zora reply");
        },
        speakFn: () => {}
      });

      await app.execute(parseCommand("/group"));
      await app.execute(parseCommand("Hello Erin"));
      const result = await app.execute(parseCommand("@zora What do you think of Erin?"));

      expect(result.lines).toEqual(["@zora: Zora reply"]);
      expect(
        seenBodies[1]?.messages?.some((message) => message.content.includes("@erin: Erin reply"))
      ).toBe(true);
      expect(seenBodies[1]?.messages?.[0]?.content).toContain("critical reviewer");
    });
  });

  test("returns context-aware help output", async () => {
    await withTempDir(async (rootDir) => {
      const app = await LocalCrewApp.create({ rootDir });
      const beforeMode = await app.execute(parseCommand("/help"));

      await app.execute(parseCommand("/chat"));
      const inChat = await app.execute(parseCommand("/help"));

      expect(beforeMode.lines[0]).toContain("Current mode: command");
      expect(inChat.lines[0]).toContain("Current mode: /chat");
      expect(inChat.lines[0]).toContain("Plain messages go to @erin");
      expect(inChat.lines[1]).toContain("Current participant: @erin");
      expect(inChat.lines.some((line) => line.includes("Direct message: @alias message"))).toBe(
        true
      );
      expect(inChat.lines.some((line) => line.includes('@from to @to: "message"'))).toBe(true);
    });
  });

  test("returns an edit request for interactive instruction editing", async () => {
    await withTempDir(async (rootDir) => {
      const app = await LocalCrewApp.create({ rootDir });
      const result = await app.execute(parseCommand("/instructions"));

      expect(result.editRequest).toEqual({
        kind: "instructions",
        target: "erin",
        prompt: "instructions[@erin]> ",
        initialText: getDefaultInstruction("erin")
      });
    });
  });

  test("returns a status viewer request and exposes orchestration status lines", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      const app = await LocalCrewApp.create({ rootDir, speakFn: () => {} });

      await app.execute(parseCommand("/auto"));
      const result = await app.execute(parseCommand("/status"));
      const lines = await app.getStatusLines();

      expect(result.viewerRequest).toEqual({
        kind: "status"
      });
      expect(lines.some((line) => line.includes("Auto pulse: active every"))).toBe(true);
      expect(lines.some((line) => line.includes("Top tier: @orchestrator, @workhorse"))).toBe(
        true
      );
    });
  });

  test("returns a hud viewer request and exposes telemetry-aware hud lines", async () => {
    await withTempDir(async (rootDir) => {
      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async () => makeChatResponse("Hello from Erin"),
        speakFn: () => {}
      });

      await app.execute(parseCommand("Hello Erin"));
      const result = await app.execute(parseCommand("/hud"));
      const lines = await app.getHudLines("status");

      expect(result.viewerRequest).toEqual({
        kind: "hud"
      });
      expect(lines[0]).toContain("HUD");
      expect(lines.some((line) => line.includes("Telemetry:"))).toBe(true);
    });
  });

  test("reads auto-mode tuning from local env files after app creation", async () => {
    await withTempDir(async (rootDir) => {
      await writeFile(
        join(rootDir, ".env.local"),
        "LOCALCREW_AUTO_PULSE_INTERVAL_MS=4321\nLOCALCREW_AUTO_SOURCE_DOC_CHAR_LIMIT=3456\n"
      );

      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async () => makeChatResponse("ok"),
        speakFn: () => {}
      });

      expect(app.getAutoPulseIntervalMs()).toBe(4321);
      expect(app.getAutoSourceDocumentCharLimit()).toBe(3456);
    });
  });

  test("returns an explore viewer request and reads internal files safely", async () => {
    await withTempDir(async (rootDir) => {
      const app = await LocalCrewApp.create({ rootDir, speakFn: () => {} });
      const result = await app.execute(parseCommand("/explore"));
      const tree = await app.getExploreTree();
      const file = await app.readExploreFile(getStoragePaths(rootDir).focusTodoPath);

      expect(result.viewerRequest).toEqual({
        kind: "explore"
      });
      expect(tree.lines.some((line) => line.includes("focus-todo.md"))).toBe(true);
      expect(tree.sitemapPath).toContain("document-sitemap.md");
      expect(file.content).toContain("Refine routing policy using measured queue pressure");
      expect(file.outline?.headings[0]?.trail.join(" > ")).toBe("In Focus Todo");
    });
  });

  test("enters auto mode, queues a task, and processes it through the configured orchestrator identity", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      await seedPaddingTasks(rootDir);
      const previousName = process.env.LOCALCREW_ORCHESTRATOR_NAME;
      process.env.LOCALCREW_ORCHESTRATOR_NAME = "Aster";
      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async () =>
          makeChatResponse(
            "Completed the orchestration task.\nQUEUE[low][overflow]: sanity check the result"
          ),
        speakFn: () => {}
      });

      try {
        await app.execute(parseCommand("/auto"));
        expect(app.shouldAutoPulse()).toBe(true);
        const result = await app.execute(parseCommand("Design a routing policy."));
        const systemState = await loadSystemState(rootDir);

        expect(result.lines[0]).toBe("Queued #1 [high]: Design a routing policy.");
        expect(result.lines[1]).toContain("Aster completed #1 [high] via @orchestrator/");
        expect(result.lines.some((l) =>
          l === "Queued #2 [low] -> @overflow/llama3.2:3b: sanity check the result"
        )).toBe(true);
        expect(systemState.auto.pending).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: 2,
              priority: "low",
              requestedResource: "overflow",
              content: "sanity check the result"
            })
          ])
        );
        expect(systemState.auto.completed).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: 1,
              status: "completed"
            })
          ])
        );
      } finally {
        if (previousName === undefined) {
          delete process.env.LOCALCREW_ORCHESTRATOR_NAME;
        } else {
          process.env.LOCALCREW_ORCHESTRATOR_NAME = previousName;
        }
      }
    });
  });

  test("emits enriched display state and task events during auto processing", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      await seedPaddingTasks(rootDir);
      const pushedEvents: Array<Record<string, unknown>> = [];
      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async () =>
          makeChatResponse(
            "Completed a concrete routing policy review with specific queue safeguards and verification checks."
          ),
        speakFn: () => {}
      });

      app.setApiServerHandle({
        pushDisplayEvent(payload) {
          pushedEvents.push(payload);
        }
      });

      await app.execute(parseCommand("/auto"));
      await app.execute(parseCommand("Review routing policy safeguards and queue verification checks."));

      const taskStart = pushedEvents.find((event) => event.type === "task-start");
      const taskComplete = pushedEvents.find((event) => event.type === "task-complete");
      const latestState = [...pushedEvents].reverse().find((event) => event.type === "state") as
        | {
            auto?: { failedCount?: number; completedCount?: number };
            modelProfile?: string;
            systemTps?: number;
            activeResources?: unknown;
          }
        | undefined;

      expect(taskStart).toBeDefined();
      expect(taskComplete).toBeDefined();
      expect(latestState).toBeDefined();
      expect(latestState?.auto?.failedCount).toBeDefined();
      expect(latestState?.auto?.completedCount).toBeGreaterThanOrEqual(1);
      expect(latestState?.modelProfile).toBeDefined();
      expect(typeof latestState?.systemTps).toBe("number");
      expect(Array.isArray(latestState?.activeResources)).toBe(true);
    });
  });

  test("stops auto mode without clearing the queue state", async () => {
    await withTempDir(async (rootDir) => {
      const app = await LocalCrewApp.create({ rootDir, speakFn: () => {} });

      await app.execute(parseCommand("/auto"));
      const stop = await app.execute(parseCommand("/stop"));
      const state = await loadSystemState(rootDir);

      expect(stop.lines).toEqual(["Auto mode stopped."]);
      expect(app.isAutoMode()).toBe(false);
      expect(app.shouldAutoPulse()).toBe(false);
      expect(app.getPrompt()).toBe("crew> ");
      expect(state.auto.enabled).toBe(false);
    });
  });

  test("fills the auto queue on an idle cycle when it is empty", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      await seedCurrentDailyWork(rootDir);
      const previousName = process.env.LOCALCREW_ORCHESTRATOR_NAME;
      process.env.LOCALCREW_ORCHESTRATOR_NAME = "Aster";
      let callCount = 0;
      const seenModels: string[] = [];
      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async (_input, init) => {
          const body = JSON.parse(String(init?.body)) as { model?: string };
          seenModels.push(body.model ?? "");
          callCount += 1;

          if (callCount === 1) {
            return makeChatResponse(
              "[medium] Tighten the queue routing rubric.\n[low] Audit stale memory summaries.\n[low] Rewrite multiple memory indexes."
            );
          }

          if (callCount === 2) {
            return makeChatResponse(
              "The draft is too broad. Drop the extra memory rewrite task and keep the scope narrow.\nVERDICT: revise"
            );
          }

          // After queue fill (3 calls), processNextAutoTask runs pre-flight +
          // execution calls.  Return generic completions for those.
          return makeChatResponse(
            "[medium] Tighten the queue routing rubric.\n[low] Audit stale memory summaries."
          );
        },
        speakFn: () => {}
      });

      try {
        await app.execute(parseCommand("/auto"));
        const result = await app.runIdleCycle();

        // Top-up message appears first, followed by task processing output.
        expect(result.lines[0]).toBe("Aster topped up the queue with 2 tasks.");
        // Draft routes to the mid-tier resource (helper, llama3.2:1b) to reduce
        // orchestrator load. Review uses the non-primary top-tier (workhorse,
        // llama3.1:8b default). Finalize stays on the orchestrator reasoning
        // model (gpt-oss:20b) for final quality.
        expect(seenModels.slice(0, 3)).toEqual(["llama3.2:1b", "llama3.1:8b", "gpt-oss:20b"]);
      } finally {
        if (previousName === undefined) {
          delete process.env.LOCALCREW_ORCHESTRATOR_NAME;
        } else {
          process.env.LOCALCREW_ORCHESTRATOR_NAME = previousName;
        }
      }
    });
  });

  test("reports one available auto cycle when auto is idle and the queue is empty", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      const app = await LocalCrewApp.create({ rootDir, speakFn: () => {} });

      await app.execute(parseCommand("/auto"));

      expect(app.shouldAutoPulse()).toBe(true);
      expect(app.getAvailableCycleSlots()).toBe(1);
    });
  });

  test("reset in auto mode clears telemetry and queue history for a fresh run", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      const paths = getStoragePaths(rootDir);
      await mkdir(paths.systemDir, { recursive: true });
      await writeFile(
        paths.systemStatePath,
        `${JSON.stringify(
          {
            auto: {
              enabled: true,
              defaultPriority: "high",
              lastTaskId: 12,
              totalCompletedCount: 9,
              pending: [
                {
                  id: 12,
                  content: "Stale queued task.",
                  priority: "medium",
                  createdAt: "2026-03-01T00:00:00.000Z",
                  createdBy: "test:manual",
                  status: "queued"
                }
              ],
              completed: [
                {
                  id: 11,
                  content: "Old completed task.",
                  priority: "low",
                  createdAt: "2026-03-01T00:00:00.000Z",
                  completedAt: "2026-03-01T00:01:00.000Z",
                  createdBy: "test:manual",
                  status: "completed"
                }
              ]
            }
          },
          null,
          2
        )}\n`
      );
      await appendAuditEvent(
        {
          timestamp: "2026-03-01T00:00:00.000Z",
          kind: "ollama.chat",
          scope: "auto.task",
          summary: "Old telemetry event",
          success: true,
          actor: "test",
          resourceAlias: "orchestrator",
          model: "llama3.1:8b",
          evalCount: 42
        },
        rootDir
      );

      const app = await LocalCrewApp.create({ rootDir, speakFn: () => {} });
      await app.execute(parseCommand("/auto"));

      const result = await app.execute(parseCommand("/reset"));
      const state = await loadSystemState(rootDir);
      const telemetry = await loadTelemetrySummary(rootDir);
      const audit = await readRecentAuditEvents(5, rootDir);

      expect(result.lines).toEqual(["Auto run state reset."]);
      expect(state.auto.enabled).toBe(true);
      expect(state.auto.lastTaskId).toBe(0);
      expect(state.auto.totalCompletedCount).toBe(0);
      expect(state.auto.pending).toEqual([]);
      expect(state.auto.completed).toEqual([]);
      expect(telemetry.totalEvents).toBe(0);
      expect(telemetry.lastEventId).toBe(0);
      expect(telemetry.models).toEqual({});
      expect(audit).toEqual([]);
    });
  });

  test("caps auto-filled pending work at twice the available resource count", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      await seedCurrentDailyWork(rootDir);
      let callCount = 0;
      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async () => {
          callCount += 1;
          if (callCount === 1) {
            return makeChatResponse(
              Array.from(
                { length: 12 },
                (_, index) => `[medium] Draft backlog item ${index + 1}.`
              ).join("\n")
            );
          }
          if (callCount === 2) {
            return makeChatResponse("Looks good.\nVERDICT: approve");
          }
          return makeChatResponse(
            Array.from(
              { length: 10 },
              (_, index) => `[medium] Final backlog item ${index + 1}.`
            ).join("\n")
          );
        },
        speakFn: () => {}
      });

      await app.execute(parseCommand("/auto"));
      const result = await app.runIdleCycle();
      const queue = await app.getQueueSnapshot();
      const systemState = await loadSystemState(rootDir);

      expect(queue.availableResourceCount).toBe(4);
      expect(queue.desiredPendingDepth).toBe(8);
      expect(result.lines[0]).toContain("topped up the queue with 8 tasks.");
      // 8 tasks are created but processNextAutoTask immediately picks one up,
      // so the queue settles at 7 pending after the idle cycle.
      expect(systemState.auto.pending.length).toBeLessThanOrEqual(8);
      expect(systemState.auto.pending.length).toBeGreaterThanOrEqual(7);
    });
  });

  test("exposes assigned resources on active tasks while work is in flight", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      const paths = getStoragePaths(rootDir);
      await mkdir(paths.systemDir, { recursive: true });
      await writeFile(
        paths.systemStatePath,
        `${JSON.stringify(
          {
            auto: {
              enabled: false,
              defaultPriority: "high",
              lastTaskId: 5,
              totalCompletedCount: 0,
              pending: [
                {
                  id: 1,
                  content: "Draft a detailed delegation plan for the queue.",
                  priority: "high",
                  createdAt: "2026-03-01T00:00:00.000Z",
                  createdBy: "test:manual",
                  status: "queued",
                  requestedResource: "workhorse"
                },
                ...Array.from({ length: 4 }, (_, index) => ({
                  id: 2 + index,
                  content: `Padding task ${index + 1}`,
                  priority: "low",
                  createdAt: "2026-03-01T00:00:00.000Z",
                  createdBy: "test:padding",
                  status: "queued"
                }))
              ],
              completed: []
            }
          },
          null,
          2
        )}\n`
      );

      let preflightInFlight = false;
      let releasePreflight: (response: Response) => void = () => {
        throw new Error("Expected a blocked preflight resolver.");
      };
      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async (input) => {
          if (String(input).endsWith("/api/tags")) {
            return new Response("{}", { status: 200 });
          }
          if (preflightInFlight) {
            return makeChatResponse("Completed the requested draft.");
          }
          return new Promise<Response>((resolve) => {
            preflightInFlight = true;
            releasePreflight = resolve;
          });
        },
        speakFn: () => {}
      });

      await app.execute(parseCommand("/auto"));
      const cyclePromise = app.runIdleCycle();

      let queue = await app.getQueueSnapshot();
      for (let attempt = 0; attempt < 100 && queue.activeTasks.length === 0; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        queue = await app.getQueueSnapshot();
      }

      expect(queue.activeTasks).toEqual([
        expect.objectContaining({
          id: 1,
          assignedResource: "workhorse"
        })
      ]);

      if (!preflightInFlight) {
        throw new Error("Expected the preflight call to be in flight.");
      }
      releasePreflight(makeChatResponse("Preflight approved."));
      await cyclePromise;
    });
  });

  test("distributes concurrent auto tasks across idle top-tier resources", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      const paths = getStoragePaths(rootDir);
      await mkdir(paths.systemDir, { recursive: true });
      await writeFile(
        paths.systemStatePath,
        `${JSON.stringify(
          {
            auto: {
              enabled: false,
              defaultPriority: "high",
              lastTaskId: 5,
              totalCompletedCount: 0,
              pending: [
                {
                  id: 1,
                  content: "Draft a detailed delegation plan for the queue.",
                  priority: "high",
                  createdAt: "2026-03-01T00:00:00.000Z",
                  createdBy: "test:manual",
                  status: "queued"
                },
                {
                  id: 2,
                  content: "Draft a detailed delegation plan for the queue.",
                  priority: "medium",
                  createdAt: "2026-03-01T00:00:00.000Z",
                  createdBy: "test:manual",
                  status: "queued"
                },
                ...Array.from({ length: 3 }, (_, index) => ({
                  id: 3 + index,
                  content: `Padding task ${index + 1}`,
                  priority: "low",
                  createdAt: "2026-03-01T00:00:00.000Z",
                  createdBy: "test:padding",
                  status: "queued"
                }))
              ],
              completed: []
            }
          },
          null,
          2
        )}\n`
      );

      const preflightResolvers: Array<(response: Response) => void> = [];
      let fetchCallCount = 0;
      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async (input) => {
          if (String(input).endsWith("/api/tags")) {
            return new Response("{}", { status: 200 });
          }
          fetchCallCount += 1;
          if (fetchCallCount <= 2) {
            return new Promise<Response>((resolve) => {
              preflightResolvers.push(resolve);
            });
          }
          return makeChatResponse("Completed the requested draft.");
        },
        speakFn: () => {}
      });

      await app.execute(parseCommand("/auto"));
      const [firstCycle, secondCycle] = [app.runIdleCycle(), app.runIdleCycle()];

      let queue = await app.getQueueSnapshot();
      for (let attempt = 0; attempt < 100 && queue.activeTasks.length < 2; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        queue = await app.getQueueSnapshot();
      }

      expect(queue.activeTasks).toHaveLength(2);
      expect(queue.activeTasks.map((task) => task.assignedResource).sort()).toEqual([
        "orchestrator",
        "workhorse"
      ]);

      preflightResolvers.forEach((resolve) => resolve(makeChatResponse("Preflight approved.")));
      await Promise.all([firstCycle, secondCycle]);
    });
  });

  test("ingests inbox documents, writes draft/final files, and moves the source document through the dropbox", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      await seedCurrentDailyWork(rootDir);
      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async () =>
          makeChatResponse(
            [
              "Document processed.",
              "WRITE[active][drafts/outline.md]",
              "# Rough Draft",
              "Working notes.",
              "ENDWRITE",
              "WRITE[outbox][finals/result.md]",
              "# Final Draft",
              "Completed deliverable.",
              "ENDWRITE"
            ].join("\n")
          ),
        speakFn: () => {}
      });

      await app.createInboxDocument("request.md", "# Request\n\nBuild a short output.");
      await app.execute(parseCommand("/auto"));
      const result = await app.runIdleCycle();
      const dropbox = await app.getDropboxSnapshot();
      const sourceOutbox = await readFile(join(rootDir, "external-memory", "outbox", "request.md"), "utf8");
      const finalOutbox = await readFile(
        join(rootDir, "external-memory", "outbox", "finals", "result.md"),
        "utf8"
      );
      const activeDraft = await readFile(
        join(rootDir, "external-memory", "active", "drafts", "outline.md"),
        "utf8"
      );

      expect(result.lines.some((line) => line.includes("Ingested inbox document"))).toBe(true);
      expect(result.lines.some((line) => line.includes("Wrote active file"))).toBe(true);
      expect(result.lines.some((line) => line.includes("Wrote outbox file"))).toBe(true);
      expect(result.lines.some((line) => line.includes("Moved source document to outbox"))).toBe(true);
      expect(dropbox.inbox).toHaveLength(0);
      expect(dropbox.active.map((entry) => entry.relativePath)).toContain("drafts/outline.md");
      expect(dropbox.outbox.map((entry) => entry.relativePath)).toEqual(
        expect.arrayContaining(["request.md", "finals/result.md"])
      );
      expect(sourceOutbox).toContain("LocalCrew-Status: outbox");
      expect(finalOutbox).toContain("LocalCrew-Status: outbox");
      expect(activeDraft).toContain("LocalCrew-Status: active");
    });
  });

  test("returns a workflow request for agent creation and persists a generated agent", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async () =>
          makeChatResponse(
            "# Reviewer\n\nSummary: Reviews delegation plans.\n\n## Mission\nInspect orchestration choices."
          ),
        speakFn: () => {}
      });

      const workflow = await app.execute(parseCommand("/agent new"));
      const created = await app.createAgentFromWorkflow({
        name: "reviewer",
        summary: "Reviews delegation plans.",
        mission: "Inspect orchestration choices.",
        style: "Direct and skeptical.",
        skills: "Review routing decisions and call out weak assumptions.",
        preferredResource: "workhorse"
      });
      const agents = await listAgents(rootDir);
      const spec = await loadAgentSpec("reviewer", rootDir);

      expect(workflow.workflowRequest?.kind).toBe("agent.create");
      expect(created.lines[0]).toBe("Created agent @reviewer.");
      expect(agents.map((agent) => agent.slug)).toEqual(["data-analyst", "reviewer"]);
      expect(spec).toContain("Summary: Reviews delegation plans.");
    });
  });

  test("chats with an agent identity and allows the agent to queue follow-up work", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      let callIndex = 0;
      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async () => {
          callIndex += 1;
          if (callIndex === 1) {
            return makeChatResponse(
              "# Reviewer\n\nSummary: Reviews delegation plans.\n\n## Mission\nInspect orchestration choices."
            );
          }
          return makeChatResponse(
            "I would test the plan against the queue.\nQUEUE[medium][workhorse]: compare two routing strategies"
          );
        },
        speakFn: () => {}
      });

      await app.createAgentFromWorkflow({
        name: "reviewer",
        summary: "Reviews delegation plans.",
        mission: "Inspect orchestration choices.",
        style: "Direct and skeptical.",
        skills: "Review routing decisions and call out weak assumptions.",
        preferredResource: "auto"
      });

      const enter = await app.execute(parseCommand("/agent reviewer"));
      const reply = await app.execute(parseCommand("Review the current orchestrator design."));
      const systemState = await loadSystemState(rootDir);

      expect(enter.lines).toEqual([
        "Entered agent mode with @reviewer. Plain messages now go to that agent identity."
      ]);
      expect(reply.lines[0]).toBe("@reviewer: I would test the plan against the queue.");
      expect(reply.lines[1]).toBe(
        "Queued #1 [medium] -> @workhorse/llama3.1:8b from @reviewer: compare two routing strategies"
      );
      expect(systemState.auto.pending).toEqual([
        expect.objectContaining({
          requestedResource: "workhorse",
          content: "compare two routing strategies"
        })
      ]);
    });
  });

  test("persists instructions, default endpoint, sound, and voice changes", async () => {
    await withTempDir(async (rootDir) => {
      const app = await LocalCrewApp.create({ rootDir, platform: "darwin" });

      await app.execute(parseCommand('/instructions @zora "Reply in one sentence."'));
      await app.execute(parseCommand("/default zora"));
      await app.execute(parseCommand("/sound off"));
      await app.execute(parseCommand("/voice @zora daniel"));

      const config = await loadConfig(rootDir);

      expect(config.endpoints.zora.instructions).toBe("Reply in one sentence.");
      expect(config.defaultEndpoint).toBe("zora");
      expect(config.soundEnabled).toBe(false);
      expect(config.endpoints.zora.voicePreset).toBe("daniel");
    });
  });

  test("reports voice and sound controls as macOS-only on other platforms", async () => {
    await withTempDir(async (rootDir) => {
      const app = await LocalCrewApp.create({ rootDir, platform: "linux" });

      const soundResult = await app.execute(parseCommand("/sound off"));
      const voiceResult = await app.execute(parseCommand("/voice list"));
      const config = await loadConfig(rootDir);

      expect(soundResult.lines[0]).toContain("available only on macOS");
      expect(voiceResult.lines[0]).toContain("available only on macOS");
      expect(config.soundEnabled).toBe(true);
      expect(config.endpoints.zora.voicePreset).toBe("zoe");
    });
  });

  test("supports dynamic participant, resource, model, and orchestrator configuration flows", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      const seenDirectModels: string[] = [];
      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async (input, init) => {
          const url = String(input);
          if (url.endsWith("/api/tags")) {
            const isHelper = url.includes("11436");
            return new Response(
              JSON.stringify({
                models: isHelper
                  ? [
                      {
                        name: "qwen2.5:0.5b",
                        details: { parameter_size: "494M", quantization_level: "Q4_K_M" }
                      },
                      {
                        name: "granite-embedding:latest",
                        details: { parameter_size: "30M", quantization_level: "F16" }
                      }
                    ]
                  : [
                      {
                        name: "llama3.1:8b",
                        details: { parameter_size: "8.0B", quantization_level: "Q4_K_M" }
                      },
                      {
                        name: "gemma3:4b",
                        details: { parameter_size: "4.3B", quantization_level: "Q4_K_M" }
                      }
                    ]
              }),
              { status: 200, headers: { "content-type": "application/json" } }
            );
          }

          const body = JSON.parse(String(init?.body ?? "{}")) as { model?: string };
          seenDirectModels.push(body.model ?? "");
          return makeChatResponse("Direct resource reply");
        },
        speakFn: () => {}
      });

      const add = await app.execute(parseCommand('/participant add reviewer workhorse "Reviewer"'));
      const nickname = await app.execute(parseCommand('/nickname @reviewer "Reviewer Prime"'));
      const bind = await app.execute(parseCommand("/bind @reviewer helper"));
      const assign = await app.execute(parseCommand("/model reviewer qwen2.5:0.5b"));
      const models = await app.execute(parseCommand("/models @reviewer"));
      const direct = await app.execute(parseCommand('/direct helper "Ping the helper" qwen2.5:0.5b'));
      const orchestrator = await app.execute(parseCommand('/orchestrator "Aster"'));
      const config = await loadConfig(rootDir);

      expect(add.lines[0]).toBe("Added participant @reviewer bound to @workhorse.");
      expect(nickname.lines[0]).toBe('Nickname for @reviewer is now Reviewer Prime.');
      expect(bind.lines[0]).toBe("@reviewer is now bound to resource @helper.");
      expect(assign.lines[0]).toBe("Model for @reviewer is now qwen2.5:0.5b.");
      expect(models.lines[0]).toBe("Models on @helper (http://127.0.0.1:11436):");
      expect(models.lines).toContain("qwen2.5:0.5b (494M, Q4_K_M)");
      expect(direct.lines[0]).toBe("@helper/qwen2.5:0.5b: Direct resource reply");
      expect(orchestrator.lines[0]).toBe("Orchestrator profile name is now Aster.");
      expect(seenDirectModels).toContain("qwen2.5:0.5b");
      expect(config.orchestratorName).toBe("Aster");
      expect(config.endpoints.reviewer).toEqual(
        expect.objectContaining({
          nickname: "Reviewer Prime",
          resourceAlias: "helper",
          model: "qwen2.5:0.5b"
        })
      );
    });
  });

  test("replaces an existing synced resource when the same device registers again", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      const app = await LocalCrewApp.create({ rootDir, speakFn: () => {} });

      const first = await app.syncResourceReport({
        alias: "studio-a",
        label: "Studio A",
        baseUrl: "http://10.0.0.50:1234",
        apiStyle: "openai",
        deviceId: "machine-1",
        hostName: "workstation",
        platform: "win32",
        defaultModel: "openai/gpt-oss-20b",
        availableModels: ["openai/gpt-oss-20b"]
      });
      const second = await app.syncResourceReport({
        alias: "studio-b",
        label: "Studio B",
        baseUrl: "http://10.0.0.50:1234",
        apiStyle: "openai",
        deviceId: "machine-1",
        hostName: "workstation",
        platform: "win32",
        defaultModel: "openai/gpt-oss-20b",
        availableModels: ["openai/gpt-oss-20b"]
      });

      const resources = await app.getResourcesSnapshot();

      expect(first.lines[0]).toContain("Added resource @studio-a from agent sync.");
      expect(second.lines[0]).toContain("Updated resource @studio-b from agent sync.");
      expect(resources.some((resource) => resource.alias === "studio-a")).toBe(false);
      expect(
        resources.some(
          (resource) =>
            resource.alias === "studio-b" &&
            resource.label === "Studio B" &&
            resource.deviceId === "machine-1"
        )
      ).toBe(true);
    });
  });

  test("renames an endpoint across config, runtime target, and stored conversation", async () => {
    await withTempDir(async (rootDir) => {
      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async () => makeChatResponse("Hello from Erin"),
        speakFn: () => {}
      });

      await app.execute(parseCommand("/chat"));
      await app.execute(parseCommand("Hello Erin"));
      await app.execute(parseCommand("/rename erin atlas"));

      const config = await loadConfig(rootDir);
      const sessions = await loadSessions(rootDir);

      expect(app.getPrompt()).toBe("chat[default:@atlas current:@atlas]> ");
      expect(config.defaultEndpoint).toBe("atlas");
      expect(config.endpoints.atlas.instructions).toContain("facilitator");
      expect(config.endpoints.atlas.instructions).toContain("Atlas");
      expect(config.endpoints.erin).toBeUndefined();
      expect(sessions.conversation.messages[0]).toEqual({
        speaker: "user",
        target: "atlas",
        content: "Hello Erin"
      });
    });
  });

  test("resets the shared conversation and keeps the current mode", async () => {
    await withTempDir(async (rootDir) => {
      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async () => makeChatResponse("Hello from Erin"),
        speakFn: () => {}
      });

      await app.execute(parseCommand("/chat"));
      await app.execute(parseCommand("Hello Erin"));
      await app.execute(parseCommand("/reset"));

      const sessions = await loadSessions(rootDir);

      expect(app.getPrompt()).toBe("chat[default:@erin current:@erin]> ");
      expect(sessions.conversation.messages).toEqual([]);
      expect(getConversationCompactedUntil(sessions)).toBe(0);
      expect(getConversationSummary(sessions)).toBe("");
    });
  });

  test("clears config, sessions, and runtime state back to the initial defaults", async () => {
    await withTempDir(async (rootDir) => {
      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async () =>
          makeChatResponse(
            "# Reviewer\n\nSummary: Reviews delegation plans.\n\n## Mission\nInspect orchestration choices."
          ),
        speakFn: () => {}
      });

      await app.execute(parseCommand('/instructions @zora "Reply in one sentence."'));
      await app.execute(parseCommand("/default zora"));
      await app.execute(parseCommand("/model sam"));
      await app.execute(parseCommand("/chat"));
      await app.execute(parseCommand("Hello Erin"));
      await app.createAgentFromWorkflow({
        name: "reviewer",
        summary: "Reviews delegation plans.",
        mission: "Inspect orchestration choices.",
        style: "Direct and skeptical.",
        skills: "Review routing decisions and call out weak assumptions.",
        preferredResource: "auto"
      });
      await app.execute(parseCommand("/auto"));
      await app.execute(parseCommand("Queue a task."));

      const result = await app.execute(parseCommand("/clear"));
      const config = await loadConfig(rootDir);
      const sessions = await loadSessions(rootDir);
      const systemState = await loadSystemState(rootDir);
      const agents = await listAgents(rootDir);
      const focusTodo = await readFile(getStoragePaths(rootDir).focusTodoPath, "utf8");

      expect(result.lines).toEqual(["Application state cleared."]);
      expect(app.getPrompt()).toBe("crew> ");
      expect(config.defaultEndpoint).toBe("erin");
      expect(config.soundEnabled).toBe(true);
      expect(config.endpoints.zora.instructions).toBe(getDefaultInstruction("zora"));
      expect(sessions.conversation.messages).toEqual([]);
      expect(getConversationCompactedUntil(sessions)).toBe(0);
      expect(getConversationSummary(sessions)).toBe("");
      expect(systemState.auto.pending).toEqual([]);
      expect(systemState.auto.completed).toEqual([]);
      expect(agents.map((agent) => agent.slug)).toEqual(["data-analyst"]);
      expect(focusTodo).toContain("Refine routing policy using measured queue pressure");
    });
  });

  test("manually compacts the shared conversation using the default endpoint", async () => {
    await withTempDir(async (rootDir) => {
      let callIndex = 0;

      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async () => {
          callIndex += 1;
          if (callIndex < 3) {
            return makeChatResponse(`Reply ${callIndex}`);
          }
          return makeChatResponse("Shared summary from the default model.");
        },
        speakFn: () => {}
      });

      await app.execute(parseCommand("First"));
      await app.execute(parseCommand("Second"));
      const result = await app.execute(parseCommand("/compact"));

      const sessions = await loadSessions(rootDir);

      expect(result.lines).toEqual(["Compacted shared conversation using @erin."]);
      expect(getConversationCompactedUntil(sessions)).toBe(4);
      expect(getConversationSummary(sessions)).toBe("Shared summary from the default model.");
    });
  });

  test("records telemetry for chat transactions", async () => {
    await withTempDir(async (rootDir) => {
      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async () =>
          makeChatResponse("Hello from Erin", {
            promptEvalCount: 15,
            evalCount: 11,
            totalDuration: 200_000_000
          }),
        speakFn: () => {}
      });

      await app.execute(parseCommand("Hello Erin"));
      const summary = await loadTelemetrySummary(rootDir);
      const recent = await readRecentAuditEvents(2, rootDir);

      expect(summary.totalEvents).toBe(1);
      expect(summary.byKind["ollama.chat"]).toBe(1);
      expect(Object.keys(summary.models)).toContain("orchestrator/llama3.1:8b");
      expect(recent[0]?.kind).toBe("ollama.chat");
      expect(recent[0]?.responseText).toBe("Hello from Erin");
    });
  });

  test("uses the wikipedia tool workflow when a model requests grounded context", async () => {
    await withTempDir(async (rootDir) => {
      let ollamaCallCount = 0;

      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async (input) => {
          const url = String(input);

          if (url.includes("w/api.php") && url.includes("list=search")) {
            return new Response(
              JSON.stringify({
                query: {
                  search: [
                    {
                      pageid: 123,
                      title: "Grace Hopper",
                      snippet: "American computer scientist and United States Navy rear admiral."
                    }
                  ]
                }
              }),
              { status: 200, headers: { "content-type": "application/json" } }
            );
          }

          if (url.includes("w/api.php") && url.includes("prop=extracts%7Cinfo")) {
            return new Response(
              JSON.stringify({
                query: {
                  pages: {
                    "123": {
                      pageid: 123,
                      title: "Grace Hopper",
                      extract:
                        "Grace Hopper was an American computer scientist, mathematician, and United States Navy rear admiral.",
                      fullurl: "https://en.wikipedia.org/wiki/Grace_Hopper"
                    }
                  }
                }
              }),
              { status: 200, headers: { "content-type": "application/json" } }
            );
          }

          ollamaCallCount += 1;
          return makeChatResponse(
            ollamaCallCount === 1 ? "WIKIPEDIA: Grace Hopper" : "Grounded answer from Erin"
          );
        },
        speakFn: () => {}
      });

      const result = await app.execute(parseCommand("Tell me about Grace Hopper."));
      const summary = await loadTelemetrySummary(rootDir);

      expect(result.lines).toEqual(["@erin: Grounded answer from Erin"]);
      expect(summary.wikipedia.calls).toBe(1);
      expect(summary.byKind["ollama.chat"]).toBe(2);
    });
  });

  test("supports queued model overrides for later auto execution", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      await seedPaddingTasks(rootDir);
      await createAgent(
        {
          name: "Reviewer",
          summary: "Reviews routing choices.",
          mission: "Inspect queue behavior.",
          style: "Direct and analytical.",
          skills: "Use metrics and queue analysis.",
          preferredResource: "workhorse"
        },
        rootDir
      );

      const requestedModels: string[] = [];
      let callCount = 0;
      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async (_input, init) => {
          const body = JSON.parse(String(init?.body)) as { model?: string };
          requestedModels.push(body.model ?? "");
          callCount += 1;

          if (callCount === 1) {
            return makeChatResponse(
              "Queue it.\nQUEUE[medium][workhorse][special-model]: benchmark the workhorse"
            );
          }

          return makeChatResponse("Completed benchmark.");
        },
        speakFn: () => {}
      });

      await app.execute(parseCommand("/agent reviewer"));
      await app.execute(parseCommand("Review the routing."));
      await app.execute(parseCommand("/auto"));
      await app.runIdleCycle();

      const state = await loadSystemState(rootDir);
      expect(state.auto.completed[0]).toEqual(
        expect.objectContaining({
          assignedResource: "workhorse",
          assignedModel: "special-model"
        })
      );
      expect(requestedModels).toContain("special-model");
    });
  });

  test("drops unsafe autonomous tasks and strips alias-like model overrides on startup", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      const paths = getStoragePaths(rootDir);
      await mkdir(paths.systemDir, { recursive: true });
      await writeFile(
        paths.systemStatePath,
        `${JSON.stringify(
          {
            auto: {
              enabled: false,
              defaultPriority: "high",
              lastTaskId: 2,
              pending: [
                {
                  id: 1,
                  content: "Deploy the `/metrics` endpoint to @orchestrator.",
                  priority: "medium",
                  createdAt: "2026-03-01T00:00:00.000Z",
                  createdBy: "orchestrator:auto-processed",
                  status: "queued",
                  requestedResource: "workhorse",
                  requestedModel: "orchestrator"
                },
                {
                  id: 2,
                  content: "Review queue pressure and summarize the result.",
                  priority: "low",
                  createdAt: "2026-03-01T00:01:00.000Z",
                  createdBy: "orchestrator:auto-processed",
                  status: "queued",
                  requestedResource: "workhorse",
                  requestedModel: "workhorse"
                },
                {
                  id: 3,
                  content: "Review queue pressure and summarize the result.",
                  priority: "low",
                  createdAt: "2026-03-01T00:02:00.000Z",
                  createdBy: "orchestrator:auto-processed",
                  status: "queued",
                  requestedResource: "erlin"
                }
              ],
              completed: []
            }
          },
          null,
          2
        )}\n`
      );

      await LocalCrewApp.create({
        rootDir,
        fetchFn: async () => makeChatResponse("ok"),
        speakFn: () => {}
      });

      const state = await loadSystemState(rootDir);
      expect(state.auto.pending).toHaveLength(2);
      expect(state.auto.pending[0]).toEqual(
        expect.objectContaining({
          id: 2,
          requestedResource: "workhorse"
        })
      );
      expect(state.auto.pending[0].requestedModel).toBe("llama3.1:8b");
      expect(state.auto.pending[1]).toEqual(
        expect.objectContaining({
          id: 3,
          content: "Review queue pressure and summarize the result."
        })
      );
      expect(state.auto.pending[1].requestedResource).toBeUndefined();
    });
  });

  test("redirects autonomous external implementation work into outbox tickets instead of queueing it", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      const paths = getStoragePaths(rootDir);
      await mkdir(paths.systemDir, { recursive: true });
      await writeFile(
        paths.systemStatePath,
        `${JSON.stringify(
          {
            auto: {
              enabled: false,
              defaultPriority: "high",
              lastTaskId: 6,
              pending: [
                {
                  id: 1,
                  content: "Review the current routing plan.",
                  priority: "high",
                  createdAt: "2026-03-01T00:00:00.000Z",
                  createdBy: "orchestrator:auto-fill",
                  status: "queued"
                },
                ...Array.from({ length: 5 }, (_, i) => ({
                  id: 2 + i,
                  content: `Padding task ${i + 1}`,
                  priority: "low",
                  createdAt: "2026-03-01T00:00:00.000Z",
                  createdBy: "test:padding",
                  status: "queued",
                }))
              ],
              completed: []
            }
          },
          null,
          2
        )}\n`
      );
      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async () =>
          makeChatResponse(
            [
              "Captured the request.",
              "WRITE[active][scripts/terminal_hud.py]",
              "print('hud')",
              "ENDWRITE",
              "QUEUE[medium][erlin]: Implement a telemetry collector API endpoint.",
              "QUEUE[low][zorin]: Review and finalize telemetry collector implementation details with Zora."
            ].join("\n")
          ),
        speakFn: () => {}
      });

      await app.execute(parseCommand("/auto"));
      const result = await app.runIdleCycle();
      const state = await loadSystemState(rootDir);
      const dropbox = await app.getDropboxSnapshot();

      expect(result.errors).toEqual([]);
      expect(result.lines.some((line) => line.includes("Redirected external file request to outbox ticket"))).toBe(true);
      expect(
        result.lines.some((line) => line.includes("Redirected external feature request to outbox ticket"))
      ).toBe(true);
      // The real task was completed; only padding tasks remain.
      expect(state.auto.pending.every((t) => t.createdBy === "test:padding")).toBe(true);
      expect(dropbox.active.map((entry) => entry.relativePath)).not.toContain("scripts/terminal_hud.py");
      expect(
        dropbox.outbox.some((entry) => entry.relativePath.startsWith("feature-requests/"))
      ).toBe(true);
    });
  });

  test("stores autonomous internal documentation in local internal memory instead of external-memory drafts", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      const paths = getStoragePaths(rootDir);
      await mkdir(paths.systemDir, { recursive: true });
      await writeFile(
        paths.systemStatePath,
        `${JSON.stringify(
          {
            auto: {
              enabled: false,
              defaultPriority: "high",
              lastTaskId: 6,
              pending: [
                {
                  id: 1,
                  content: "Summarize the recent auto failures into a compact internal note.",
                  priority: "high",
                  createdAt: "2026-03-01T00:00:00.000Z",
                  createdBy: "orchestrator:auto-fill",
                  status: "queued"
                },
                ...Array.from({ length: 5 }, (_, i) => ({
                  id: 2 + i,
                  content: `Padding task ${i + 1}`,
                  priority: "low",
                  createdAt: "2026-03-01T00:00:00.000Z",
                  createdBy: "test:padding",
                  status: "queued",
                }))
              ],
              completed: []
            }
          },
          null,
          2
        )}\n`
      );
      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async () =>
          makeChatResponse(
            [
              "Captured the note.",
              "WRITE[internal][memory/failure-summary.md]",
              "# Failure Summary",
              "",
              "- Model routing drift caused repeated failures.",
              "ENDWRITE"
            ].join("\n")
          ),
        speakFn: () => {}
      });

      await app.execute(parseCommand("/auto"));
      const result = await app.runIdleCycle();
      const dropbox = await app.getDropboxSnapshot();
      const internalFile = await readFile(
        join(rootDir, ".localcrew", "system", "secure", "orchestrator", "generated", "memory", "failure-summary.md"),
        "utf8"
      );

      expect(result.errors).toEqual([]);
      expect(result.lines.some((line) => line.includes("Wrote internal file:"))).toBe(true);
      expect(dropbox.active).toHaveLength(0);
      expect(dropbox.outbox).toHaveLength(0);
      expect(internalFile).toContain("# Failure Summary");
    });
  });

  test("updates canonical memory files through targeted UPDATE directives", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      const paths = getStoragePaths(rootDir);
      await mkdir(paths.systemDir, { recursive: true });
      await mkdir(paths.orchestratorMemoryDir, { recursive: true });
      await writeFile(paths.orchestratorMemorySummaryPath, "# Summary\n\n- Old detail\n", "utf8");
      await writeFile(
        paths.systemStatePath,
        `${JSON.stringify(
          {
            auto: {
              enabled: false,
              defaultPriority: "high",
              lastTaskId: 6,
              pending: [
                {
                  id: 1,
                  content: "Refine the summary bullet while preserving the rest of the document.",
                  priority: "high",
                  createdAt: "2026-03-01T00:00:00.000Z",
                  createdBy: "orchestrator:auto-fill",
                  status: "queued"
                },
                ...Array.from({ length: 5 }, (_, i) => ({
                  id: 2 + i,
                  content: `Padding task ${i + 1}`,
                  priority: "low",
                  createdAt: "2026-03-01T00:00:00.000Z",
                  createdBy: "test:padding",
                  status: "queued",
                }))
              ],
              completed: []
            }
          },
          null,
          2
        )}\n`
      );

      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async () =>
          makeChatResponse(
            [
              "Updated the summary.",
              "UPDATE[internal][summary.md][replace]",
              "SEARCH",
              "- Old detail",
              "ENDSEARCH",
              "CONTENT",
              "- New detail",
              "ENDCONTENT",
              "ENDUPDATE"
            ].join("\n")
          ),
        speakFn: () => {}
      });

      await app.execute(parseCommand("/auto"));
      const result = await app.runIdleCycle();
      const updatedSummary = await readFile(paths.orchestratorMemorySummaryPath, "utf8");
      const state = await loadSystemState(rootDir);

      expect(result.errors).toEqual([]);
      expect(updatedSummary).toContain("- New detail");
      expect(updatedSummary).not.toContain("- Old detail");
      expect(state.auto.completed.at(-1)?.status).toBe("completed");
    });
  });

  test("fails ambiguous UPDATE anchors instead of overwriting canonical memory", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      const paths = getStoragePaths(rootDir);
      await mkdir(paths.systemDir, { recursive: true });
      await mkdir(paths.orchestratorMemoryDir, { recursive: true });
      const originalSummary = [
        "# Summary",
        "",
        "## Section",
        "- First item",
        "",
        "## Section",
        "- Second item"
      ].join("\n");
      await writeFile(paths.orchestratorMemorySummaryPath, `${originalSummary}\n`, "utf8");
      await writeFile(
        paths.systemStatePath,
        `${JSON.stringify(
          {
            auto: {
              enabled: false,
              defaultPriority: "high",
              lastTaskId: 6,
              pending: [
                {
                  id: 1,
                  content: "Add a note under the matching section without damaging the rest of the file.",
                  priority: "high",
                  createdAt: "2026-03-01T00:00:00.000Z",
                  createdBy: "orchestrator:auto-fill",
                  status: "queued"
                },
                ...Array.from({ length: 5 }, (_, i) => ({
                  id: 2 + i,
                  content: `Padding task ${i + 1}`,
                  priority: "low",
                  createdAt: "2026-03-01T00:00:00.000Z",
                  createdBy: "test:padding",
                  status: "queued",
                }))
              ],
              completed: []
            }
          },
          null,
          2
        )}\n`
      );

      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async () =>
          makeChatResponse(
            [
              "Tried to update the summary.",
              "UPDATE[internal][summary.md][insert-after]",
              "ANCHOR",
              "## Section",
              "ENDANCHOR",
              "CONTENT",
              "- Inserted note",
              "ENDCONTENT",
              "ENDUPDATE"
            ].join("\n")
          ),
        speakFn: () => {}
      });

      await app.execute(parseCommand("/auto"));
      const result = await app.runIdleCycle();
      const updatedSummary = await readFile(paths.orchestratorMemorySummaryPath, "utf8");
      expect(result.lines.some((line) => line.includes("failed #1"))).toBe(true);
      expect(result.lines.some((line) => line.includes("artifactsVerified=no"))).toBe(true);
      expect(updatedSummary).toBe(`${originalSummary}\n`);
    });
  });

  test("supports HEADING selectors for targeted markdown inserts", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      const paths = getStoragePaths(rootDir);
      await mkdir(paths.systemDir, { recursive: true });
      await mkdir(paths.orchestratorMemoryDir, { recursive: true });
      const originalSummary = [
        "# Summary",
        "",
        "## Alpha",
        "",
        "### Shared",
        "- Alpha note",
        "",
        "## Beta",
        "",
        "### Shared",
        "- Beta note"
      ].join("\n");
      await writeFile(paths.orchestratorMemorySummaryPath, `${originalSummary}\n`, "utf8");
      await writeFile(
        paths.systemStatePath,
        `${JSON.stringify(
          {
            auto: {
              enabled: false,
              defaultPriority: "high",
              lastTaskId: 6,
              pending: [
                {
                  id: 1,
                  content: "Add a note under the beta shared heading without touching the alpha section.",
                  priority: "high",
                  createdAt: "2026-03-01T00:00:00.000Z",
                  createdBy: "orchestrator:auto-fill",
                  status: "queued"
                },
                ...Array.from({ length: 5 }, (_, i) => ({
                  id: 2 + i,
                  content: `Padding task ${i + 1}`,
                  priority: "low",
                  createdAt: "2026-03-01T00:00:00.000Z",
                  createdBy: "test:padding",
                  status: "queued",
                }))
              ],
              completed: []
            }
          },
          null,
          2
        )}\n`
      );

      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async () =>
          makeChatResponse(
            [
              "Updated the targeted section.",
              "UPDATE[internal][summary.md][insert-after]",
              "ANCHOR",
              "HEADING: Beta > Shared",
              "ENDANCHOR",
              "CONTENT",
              "- Beta addition",
              "ENDCONTENT",
              "ENDUPDATE"
            ].join("\n")
          ),
        speakFn: () => {}
      });

      await app.execute(parseCommand("/auto"));
      const result = await app.runIdleCycle();
      const updatedSummary = await readFile(paths.orchestratorMemorySummaryPath, "utf8");

      expect(result.errors).toEqual([]);
      expect(updatedSummary).toContain("- Beta addition\n- Beta note");
      expect(updatedSummary).not.toContain("- Beta addition\n- Alpha note");
    });
  });

  test("supports replace-section for markdown documents", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      const paths = getStoragePaths(rootDir);
      await mkdir(paths.systemDir, { recursive: true });
      await mkdir(paths.orchestratorMemoryDir, { recursive: true });
      const originalSummary = [
        "# Summary",
        "",
        "## Current",
        "- Old status",
        "",
        "## Next",
        "- Keep this"
      ].join("\n");
      await writeFile(paths.orchestratorMemorySummaryPath, `${originalSummary}\n`, "utf8");
      await writeFile(
        paths.systemStatePath,
        `${JSON.stringify(
          {
            auto: {
              enabled: false,
              defaultPriority: "high",
              lastTaskId: 6,
              pending: [
                {
                  id: 1,
                  content: "Refresh only the current section of the summary.",
                  priority: "high",
                  createdAt: "2026-03-01T00:00:00.000Z",
                  createdBy: "orchestrator:auto-fill",
                  status: "queued"
                },
                ...Array.from({ length: 5 }, (_, i) => ({
                  id: 2 + i,
                  content: `Padding task ${i + 1}`,
                  priority: "low",
                  createdAt: "2026-03-01T00:00:00.000Z",
                  createdBy: "test:padding",
                  status: "queued",
                }))
              ],
              completed: []
            }
          },
          null,
          2
        )}\n`
      );

      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async () =>
          makeChatResponse(
            [
              "Replaced the section.",
              "UPDATE[internal][summary.md][replace-section]",
              "SEARCH",
              "HEADING: Current",
              "ENDSEARCH",
              "CONTENT",
              "## Current",
              "- New status",
              "ENDCONTENT",
              "ENDUPDATE"
            ].join("\n")
          ),
        speakFn: () => {}
      });

      await app.execute(parseCommand("/auto"));
      const result = await app.runIdleCycle();
      const updatedSummary = await readFile(paths.orchestratorMemorySummaryPath, "utf8");

      expect(result.errors).toEqual([]);
      expect(updatedSummary).toContain("## Current\n- New status");
      expect(updatedSummary).toContain("## Next\n- Keep this");
      expect(updatedSummary).not.toContain("- Old status");
    });
  });

  test("skips vague autonomous follow-up tasks instead of queueing them", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      const paths = getStoragePaths(rootDir);
      await mkdir(paths.systemDir, { recursive: true });
      await writeFile(
        paths.systemStatePath,
        `${JSON.stringify(
          {
            auto: {
              enabled: false,
              defaultPriority: "high",
              lastTaskId: 6,
              pending: [
                {
                  id: 1,
                  content: "Review recent queue failures and suggest the next focused improvement.",
                  priority: "high",
                  createdAt: "2026-03-01T00:00:00.000Z",
                  createdBy: "orchestrator:auto-fill",
                  status: "queued"
                },
                ...Array.from({ length: 5 }, (_, i) => ({
                  id: 2 + i,
                  content: `Padding task ${i + 1}`,
                  priority: "low",
                  createdAt: "2026-03-01T00:00:00.000Z",
                  createdBy: "test:padding",
                  status: "queued",
                }))
              ],
              completed: []
            }
          },
          null,
          2
        )}\n`
      );
      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async () =>
          makeChatResponse(["Queued follow-up.", "QUEUE[medium]: implement"].join("\n")),
        speakFn: () => {}
      });

      await app.execute(parseCommand("/auto"));
      const result = await app.runIdleCycle();
      const state = await loadSystemState(rootDir);

      expect(result.errors).toEqual([]);
      expect(result.lines.some((line) => line.includes("Skipped vague autonomous task: implement"))).toBe(true);
      // Padding tasks + the completed task's follow-ups should be in pending (minus the processed high-priority one)
      expect(state.auto.pending.every((t) => t.content !== "implement")).toBe(true);
    });
  });

  test("quarantines a failed auto task and queues a safe mode recovery task", async () => {
    // Speed up inference retries so the test doesn't take 3+ seconds.
    process.env.LOCALCREW_INFERENCE_RETRY_DELAY_MS = "1";
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      const paths = getStoragePaths(rootDir);
      await mkdir(paths.systemDir, { recursive: true });
      await writeFile(
        paths.systemStatePath,
        `${JSON.stringify(
          {
            auto: {
              enabled: false,
              defaultPriority: "high",
              lastTaskId: 6,
              pending: [
                {
                  id: 1,
                  content: "Review queue routing drift after the last autonomous run.",
                  priority: "high",
                  createdAt: "2026-03-01T00:00:00.000Z",
                  createdBy: "orchestrator:auto-fill",
                  status: "queued",
                  retryCount: 1
                },
                ...Array.from({ length: 5 }, (_, i) => ({
                  id: 2 + i,
                  content: `Padding task ${i + 1}`,
                  priority: "low",
                  createdAt: "2026-03-01T00:00:00.000Z",
                  createdBy: "test:padding",
                  status: "queued",
                }))
              ],
              completed: []
            }
          },
          null,
          2
        )}\n`
      );
      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async () => {
          throw new Error("HTTP 500: upstream unavailable");
        },
        speakFn: () => {}
      });

      await app.execute(parseCommand("/auto"));
      const result = await app.runIdleCycle();
      const state = await loadSystemState(rootDir);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("Auto task #1 failed on ");
      expect(result.errors[0]).toContain("HTTP 500: upstream unavailable");
      expect(
        result.lines.some((line) =>
          line.includes("Quarantined failed auto task #1 and queued safe mode recovery task #7.")
        )
      ).toBe(true);
      expect(state.auto.completed).toHaveLength(1);
      expect(state.auto.completed[0]).toEqual(
        expect.objectContaining({
          id: 1,
          status: "completed",
          result: "FAILED: HTTP 500: upstream unavailable"
        })
      );
      expect(state.auto.pending.some((t) =>
        t.createdBy === "orchestrator:safe-mode" &&
        t.priority === "high"
      )).toBe(true);
      // Recovery tasks are no longer pinned to the orchestrator — the routing
      // engine selects the best available resource based on current load.
      expect(state.auto.pending.some((t) =>
        t.createdBy === "orchestrator:safe-mode" && t.requestedResource === undefined
      )).toBe(true);
    });
    delete process.env.LOCALCREW_INFERENCE_RETRY_DELAY_MS;
  });

  test("uses the top-tier default model instead of a tools model for autonomous structured tasks", async () => {
    await withTempDir(async (rootDir) => {
      const resources: Record<string, ResourceProfile> = {
        orchestrator: {
          alias: "orchestrator",
          label: "Local Orchestrator",
          tier: "top",
          baseUrl: "http://127.0.0.1:11434",
          defaultModel: "llama3.1:8b",
          reasoningModel: "gpt-oss:20b",
          toolsModel: "gemma3:4b",
          role: "Primary orchestration resource.",
          capabilities: ["reasoning"],
          notes: []
        },
        workhorse: {
          alias: "workhorse",
          label: "Second Device",
          tier: "top",
          baseUrl: "http://127.0.0.1:11435",
          defaultModel: "llama3.1:latest",
          toolsModel: "gemma3:4b",
          role: "Top-tier drafting resource.",
          capabilities: ["chat"],
          notes: []
        }
      };
      await saveResources(resources, rootDir);

      const requestedModels: string[] = [];
      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async (_input, init) => {
          const body = JSON.parse(String(init?.body)) as { model?: string };
          requestedModels.push(body.model ?? "");
          return makeChatResponse("Reviewed queue pressure.");
        },
        speakFn: () => {}
      });

      await app.execute(parseCommand("/auto"));
      await app.execute(parseCommand("Review queue pressure and summarize the result as JSON."));
      await app.runIdleCycle();

      expect(requestedModels).toContain("llama3.1:latest");
      expect(requestedModels).not.toContain("gemma3:4b");
    });
  });

  test("preserves headroom by downgrading heavy reasoning work to the default model on a stressed node", async () => {
    await withTempDir(async (rootDir) => {
      const resources: Record<string, ResourceProfile> = {
        orchestrator: {
          alias: "orchestrator",
          label: "Local Orchestrator",
          tier: "top",
          baseUrl: "http://127.0.0.1:11434",
          defaultModel: "llama3.1:8b",
          reasoningModel: "gpt-oss:20b",
          role: "Primary orchestration resource.",
          capabilities: ["reasoning"],
          notes: [],
          cpuLogicalCores: 10,
          ramGb: 32
        }
      };
      await saveResources(resources, rootDir);

      const requestedModels: string[] = [];
      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async (_input, init) => {
          const body = JSON.parse(String(init?.body)) as { model?: string };
          requestedModels.push(body.model ?? "");
          return makeChatResponse("Headroom preserved.");
        },
        speakFn: () => {}
      });

      await app.syncResourceReport({
        alias: "orchestrator",
        label: "Local Orchestrator",
        baseUrl: "http://127.0.0.1:11434",
        apiStyle: "ollama",
        liveMetrics: {
          loadAvg1m: 8.5,
          loadAvg5m: 8.2,
          totalMemGb: 32,
          freeMemGb: 4,
          freePct: 12.5,
          timestamp: Date.now()
        }
      });

      await app.execute(parseCommand("/auto"));
      await app.execute(parseCommand("Analyze the system architecture tradeoffs and diagnose the routing drift."));

      expect(requestedModels).toContain("llama3.1:8b");
      expect(requestedModels).not.toContain("gpt-oss:20b");
    });
  });

  test("falls back to the default model after a transient specialized-model failure in auto mode", async () => {
    process.env.LOCALCREW_INFERENCE_RETRY_DELAY_MS = "1";
    await withTempDir(async (rootDir) => {
      const resources: Record<string, ResourceProfile> = {
        orchestrator: {
          alias: "orchestrator",
          label: "Local Orchestrator",
          tier: "top",
          baseUrl: "http://127.0.0.1:11434",
          defaultModel: "llama3.1:8b",
          reasoningModel: "gpt-oss:20b",
          role: "Primary orchestration resource.",
          capabilities: ["reasoning"],
          notes: []
        }
      };
      await saveResources(resources, rootDir);

      const requestedModels: string[] = [];
      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async (_input, init) => {
          const body = JSON.parse(String(init?.body)) as { model?: string };
          requestedModels.push(body.model ?? "");
          if (body.model === "gpt-oss:20b") {
            throw new Error("HTTP 500: model overloaded");
          }
          return makeChatResponse("Fallback completed.");
        },
        speakFn: () => {}
      });

      await app.execute(parseCommand("/auto"));
      const result = await app.execute(
        parseCommand("Design a comprehensive end-to-end architecture review with tradeoff analysis.")
      );

      expect(result.errors).toEqual([]);
      expect(requestedModels).toContain("gpt-oss:20b");
      expect(requestedModels).toContain("llama3.1:8b");
      expect(requestedModels[requestedModels.length - 1]).toBe("llama3.1:8b");
    });
    delete process.env.LOCALCREW_INFERENCE_RETRY_DELAY_MS;
  });

  test("rejects loopback base URLs for synced non-orchestrator resources", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async () => makeChatResponse("ok"),
        speakFn: () => {}
      });

      await expect(
        app.syncResourceReport({
          alias: "workhorse",
          label: "Second Device",
          baseUrl: "http://127.0.0.1:11435",
          apiStyle: "ollama"
        })
      ).rejects.toThrow(/loopback base url/i);
    });
  });

  test("records delegation roles on queued collaborative follow-up tasks", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      await createAgent(
        {
          name: "Reviewer",
          summary: "Reviews routing choices.",
          mission: "Inspect queue behavior.",
          style: "Direct and analytical.",
          skills: "Use metrics and queue analysis.",
          preferredResource: "auto"
        },
        rootDir
      );

      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async () =>
          makeChatResponse(
            "Split the work.\nQUEUE[medium][workhorse]{reviewer}: critique the routing plan"
          ),
        speakFn: () => {}
      });

      await app.execute(parseCommand("/agent reviewer"));
      const reply = await app.execute(parseCommand("Review the routing."));
      const state = await loadSystemState(rootDir);

      expect(reply.lines[1]).toBe(
        "Queued #1 [medium] {reviewer} -> @workhorse/llama3.1:8b from @reviewer: critique the routing plan"
      );
      expect(state.auto.pending[0]).toEqual(
        expect.objectContaining({
          requestedResource: "workhorse",
          delegationRole: "reviewer",
          content: "critique the routing plan"
        })
      );
    });
  });

  test("returns a recoverable error for unknown endpoint aliases", async () => {
    await withTempDir(async (rootDir) => {
      const app = await LocalCrewApp.create({ rootDir });

      const invalidResult = await app.execute(parseCommand("/model nope"));
      const validResult = await app.execute(parseCommand("/model"));

      expect(invalidResult.errors).toEqual(['Unknown endpoint alias "nope".']);
      expect(validResult.lines[0]).toContain(
        "Current participant: @erin (Erin) using @orchestrator/llama3.1:8b [policy=fixed] [profile=auto]."
      );
      expect(validResult.lines[0]).toContain("Plain messages still go to @erin.");
    });
  });

  test("sets and reports model profile mode", async () => {
    await withTempDir(async (rootDir) => {
      const app = await LocalCrewApp.create({ rootDir });

      const setResult = await app.execute(parseCommand("/model profile all-llamas"));
      const getResult = await app.execute(parseCommand("/model profile"));
      const config = await loadConfig(rootDir);

      expect(setResult.lines).toEqual(["Model profile mode is now all-llamas."]);
      expect(getResult.lines).toEqual(["Model profile mode: all-llamas."]);
      expect(config.preferences?.modelProfile).toBe("all-llamas");
    });
  });
});

describe("speakText", () => {
  test("passes the selected voice and response text without a shell", () => {
    let call:
      | {
          command: string;
          args?: readonly string[];
          options?: Record<string, unknown>;
        }
      | undefined;

    speakText("Hello", {
      voice: "Reed (English (US))",
      platform: "darwin",
      spawnFn: (command, args, options) => {
        call = { command, args, options: options as Record<string, unknown> };
        return {
          on() {},
          unref() {}
        };
      }
    });

    expect(call).toEqual({
      command: "say",
      args: ["-v", "Reed (English (US))", "Hello"],
      options: {
        detached: true,
        stdio: "ignore"
      }
    });
  });

  test("warns when say exits with a voice error", () => {
    const warnings: string[] = [];

    speakText("Hello", {
      voice: "Siri",
      platform: "darwin",
      warn: (message) => warnings.push(message),
      spawnFn: () => ({
        on(event, listener) {
          if (event === "exit") {
            (listener as (code: number | null) => void)(1);
          }
        },
        unref() {}
      })
    });

    expect(warnings).toEqual(['Speech failed for voice "Siri".']);
  });
});

// ---------------------------------------------------------------------------
// Task timing: startedAt / completedAt / durationMs
// ---------------------------------------------------------------------------

describe("AutoQueueTask timing", () => {
  test("completed task has startedAt, completedAt, and durationMs set", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      await seedPaddingTasks(rootDir);
      // Each call returns the same mock response regardless of whether it is a
      // preflight or the main execution call.
      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async () => makeChatResponse("Task done."),
        speakFn: () => {}
      });

      await app.execute(parseCommand("/auto"));
      await app.execute(parseCommand("Summarise the routing policy."));
      const state = await loadSystemState(rootDir);
      const completed = state.auto.completed[0];

      expect(completed).toBeDefined();
      expect(typeof completed.startedAt).toBe("string");
      expect(typeof completed.completedAt).toBe("string");
      expect(typeof completed.durationMs).toBe("number");
      expect(completed.durationMs).toBeGreaterThanOrEqual(0);
      // completedAt must not precede startedAt
      expect(new Date(completed.completedAt!).getTime()).toBeGreaterThanOrEqual(
        new Date(completed.startedAt!).getTime()
      );
    });
  });

  test("quarantined task also records startedAt and durationMs", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      await seedPaddingTasks(rootDir);
      let callCount = 0;
      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async () => {
          callCount++;
          // Always throw after first preflight call to force a quarantine.
          // First call is the preflight (non-fatal, so task continues).
          // We throw on every call so the main execution fails.
          throw new Error("network timeout");
        },
        speakFn: () => {}
      });

      await app.execute(parseCommand("/auto"));
      await app.execute(parseCommand("Analyze all the things."));
      // First attempt retries; second attempt (via idle cycle) quarantines.
      await app.runIdleCycle();
      const state = await loadSystemState(rootDir);
      const failed = state.auto.completed[0];

      expect(failed).toBeDefined();
      expect(failed.result).toContain("FAILED:");
      expect(failed.errorMessage).toBeTruthy();
      // Timing must still be recorded even for failed tasks
      expect(typeof failed.startedAt).toBe("string");
      expect(typeof failed.completedAt).toBe("string");
      expect(typeof failed.durationMs).toBe("number");
    });
  });

  test("retries a failed task before quarantining", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      const paths = getStoragePaths(rootDir);
      await mkdir(paths.systemDir, { recursive: true });
      await writeFile(
        paths.systemStatePath,
        `${JSON.stringify(
          {
            auto: {
              enabled: false,
              defaultPriority: "high",
              lastTaskId: 6,
              pending: [
                {
                  id: 1,
                  content: "Analyze routing drift.",
                  priority: "high",
                  createdAt: "2026-03-01T00:00:00.000Z",
                  createdBy: "orchestrator:auto-fill",
                  status: "queued"
                },
                ...Array.from({ length: 5 }, (_, i) => ({
                  id: 2 + i,
                  content: `Padding task ${i + 1}`,
                  priority: "low",
                  createdAt: "2026-03-01T00:00:00.000Z",
                  createdBy: "test:padding",
                  status: "queued",
                }))
              ],
              completed: []
            }
          },
          null,
          2
        )}\n`
      );
      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async () => {
          throw new Error("network error");
        },
        speakFn: () => {}
      });

      await app.execute(parseCommand("/auto"));
      // First idle cycle: task fails and is retried (re-queued with retryCount 1).
      const firstResult = await app.runIdleCycle();
      const stateAfterRetry = await loadSystemState(rootDir);

      // Task should be re-queued, not quarantined. Padding tasks remain.
      expect(stateAfterRetry.auto.completed).toHaveLength(0);
      expect(stateAfterRetry.auto.pending.some((t) => t.retryCount === 1)).toBe(true);
      expect(firstResult.errors).toHaveLength(0);

      // Second idle cycle: task fails again and is quarantined (retries exhausted).
      const secondResult = await app.runIdleCycle();
      const stateAfterQuarantine = await loadSystemState(rootDir);

      expect(stateAfterQuarantine.auto.completed).toHaveLength(1);
      expect(stateAfterQuarantine.auto.completed[0].result).toContain("FAILED:");
      // A safe mode recovery task should be queued alongside padding tasks.
      expect(stateAfterQuarantine.auto.pending.some((t) => t.createdBy === "orchestrator:safe-mode")).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Pre-flight reasoning: verify it fires as an extra model call
// ---------------------------------------------------------------------------

describe("pre-flight task reasoning", () => {
  test("makes two model calls per task: preflight + execution", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      const calls: Array<{ url: string; body: unknown }> = [];
      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async (url, init) => {
          calls.push({ url: String(url), body: JSON.parse((init?.body as string) ?? "{}") });
          return makeChatResponse("Done.");
        },
        speakFn: () => {}
      });

      await app.execute(parseCommand("/auto"));
      await app.execute(parseCommand("Write a routing analysis."));

      // There should be at least 2 calls to the inference endpoint for one task:
      // one for the pre-flight and one for the main execution.
      const chatCalls = calls.filter((c) => c.url.includes("/api/chat"));
      expect(chatCalls.length).toBeGreaterThanOrEqual(2);
    });
  });

  test("pre-flight failure is non-fatal: task still completes", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      await seedPaddingTasks(rootDir);
      let callCount = 0;
      const app = await LocalCrewApp.create({
        rootDir,
        fetchFn: async () => {
          callCount++;
          // First call (preflight) throws; second call (main execution) succeeds.
          if (callCount === 1) {
            throw new Error("preflight network error");
          }
          return makeChatResponse("Task done despite preflight failure.");
        },
        speakFn: () => {}
      });

      await app.execute(parseCommand("/auto"));
      const result = await app.execute(parseCommand("Diagnose the queue health."));
      const state = await loadSystemState(rootDir);

      // Task should be completed successfully despite the failed preflight
      expect(state.auto.completed[0]).toBeDefined();
      expect(state.auto.completed[0].result).toContain("Task done despite preflight failure.");
      // Result lines should reflect successful completion
      expect(result.lines.some((l) => l.includes("completed"))).toBe(true);
    });
  });
});
