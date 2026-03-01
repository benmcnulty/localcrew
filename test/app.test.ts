import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { CrustyApp } from "../src/app.ts";
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
import { loadTelemetrySummary, readRecentAuditEvents } from "../src/telemetry.ts";
import type { ChatMessage } from "../src/types.ts";

async function withTempDir(run: (rootDir: string) => Promise<void>): Promise<void> {
  const rootDir = await mkdtemp(join(tmpdir(), "crusty-"));

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

describe("CrustyApp", () => {
  test("routes command-mode plain messages to the default endpoint", async () => {
    await withTempDir(async (rootDir) => {
      const seenBodies: Array<{ messages?: ChatMessage[] }> = [];
      const app = await CrustyApp.create({
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
      const app = await CrustyApp.create({
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
      const app = await CrustyApp.create({
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
      const app = await CrustyApp.create({
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
      const app = await CrustyApp.create({
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

      const app = await CrustyApp.create({
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
      const app = await CrustyApp.create({ rootDir });
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
      const app = await CrustyApp.create({ rootDir });
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
      const app = await CrustyApp.create({ rootDir, speakFn: () => {} });

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
      const app = await CrustyApp.create({
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

  test("returns an explore viewer request and reads internal files safely", async () => {
    await withTempDir(async (rootDir) => {
      const app = await CrustyApp.create({ rootDir, speakFn: () => {} });
      const result = await app.execute(parseCommand("/explore"));
      const tree = await app.getExploreTree();
      const file = await app.readExploreFile(getStoragePaths(rootDir).focusTodoPath);

      expect(result.viewerRequest).toEqual({
        kind: "explore"
      });
      expect(tree.lines.some((line) => line.includes("focus-todo.md"))).toBe(true);
      expect(file.content).toContain("Refine routing policy using measured queue pressure");
    });
  });

  test("enters auto mode, queues a task, and processes it through the configured orchestrator identity", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      const previousName = process.env.CRUSTY_ORCHESTRATOR_NAME;
      process.env.CRUSTY_ORCHESTRATOR_NAME = "Aster";
      const app = await CrustyApp.create({
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
        expect(result.lines[1]).toContain("Aster completed #1 [high] via orchestrator/");
        expect(result.lines[3]).toBe("Queued #2 [low] -> overflow: sanity check the result");
        expect(systemState.auto.pending).toEqual([
          expect.objectContaining({
            id: 2,
            priority: "low",
            requestedResource: "overflow",
            content: "sanity check the result"
          })
        ]);
        expect(systemState.auto.completed).toEqual([
          expect.objectContaining({
            id: 1,
            status: "completed"
          })
        ]);
      } finally {
        if (previousName === undefined) {
          delete process.env.CRUSTY_ORCHESTRATOR_NAME;
        } else {
          process.env.CRUSTY_ORCHESTRATOR_NAME = previousName;
        }
      }
    });
  });

  test("stops auto mode without clearing the queue state", async () => {
    await withTempDir(async (rootDir) => {
      const app = await CrustyApp.create({ rootDir, speakFn: () => {} });

      await app.execute(parseCommand("/auto"));
      const stop = await app.execute(parseCommand("/stop"));
      const state = await loadSystemState(rootDir);

      expect(stop.lines).toEqual(["Auto mode stopped."]);
      expect(app.isAutoMode()).toBe(false);
      expect(app.shouldAutoPulse()).toBe(false);
      expect(app.getPrompt()).toBe("crusty> ");
      expect(state.auto.enabled).toBe(false);
    });
  });

  test("fills the auto queue on an idle cycle when it is empty", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      const previousName = process.env.CRUSTY_ORCHESTRATOR_NAME;
      process.env.CRUSTY_ORCHESTRATOR_NAME = "Aster";
      const app = await CrustyApp.create({
        rootDir,
        fetchFn: async () =>
          makeChatResponse("[medium] Tighten the queue routing rubric.\n[low] Audit stale memory summaries."),
        speakFn: () => {}
      });

      try {
        await app.execute(parseCommand("/auto"));
        const result = await app.runIdleCycle();
        const systemState = await loadSystemState(rootDir);

        expect(result.lines[0]).toBe("Aster filled the queue with 2 self-improvement tasks.");
        expect(systemState.auto.pending.map((task) => `${task.priority}:${task.content}`)).toEqual([
          "medium:Tighten the queue routing rubric.",
          "low:Audit stale memory summaries."
        ]);
      } finally {
        if (previousName === undefined) {
          delete process.env.CRUSTY_ORCHESTRATOR_NAME;
        } else {
          process.env.CRUSTY_ORCHESTRATOR_NAME = previousName;
        }
      }
    });
  });

  test("ingests inbox documents, writes draft/final files, and moves the source document through the dropbox", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      const app = await CrustyApp.create({
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
      expect(sourceOutbox).toContain("Crusty-Status: outbox");
      expect(finalOutbox).toContain("Crusty-Status: outbox");
      expect(activeDraft).toContain("Crusty-Status: active");
    });
  });

  test("returns a workflow request for agent creation and persists a generated agent", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      const app = await CrustyApp.create({
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
      const app = await CrustyApp.create({
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
        "Queued #1 [medium] -> workhorse from @reviewer: compare two routing strategies"
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
      const app = await CrustyApp.create({ rootDir, platform: "darwin" });

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
      const app = await CrustyApp.create({ rootDir, platform: "linux" });

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
      const app = await CrustyApp.create({
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

  test("renames an endpoint across config, runtime target, and stored conversation", async () => {
    await withTempDir(async (rootDir) => {
      const app = await CrustyApp.create({
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
      const app = await CrustyApp.create({
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
      const app = await CrustyApp.create({
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
      expect(app.getPrompt()).toBe("crusty> ");
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

      const app = await CrustyApp.create({
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
      const app = await CrustyApp.create({
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

      const app = await CrustyApp.create({
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
      const app = await CrustyApp.create({
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

      const app = await CrustyApp.create({
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
        "Queued #1 [medium] {reviewer} -> workhorse from @reviewer: critique the routing plan"
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
      const app = await CrustyApp.create({ rootDir });

      const invalidResult = await app.execute(parseCommand("/model nope"));
      const validResult = await app.execute(parseCommand("/model"));

      expect(invalidResult.errors).toEqual(['Unknown endpoint alias "nope".']);
      expect(validResult.lines[0]).toContain(
        "Current participant: @erin (Erin) using @orchestrator/llama3.1:8b."
      );
      expect(validResult.lines[0]).toContain("Plain messages still go to @erin.");
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
            listener(1);
          }
        },
        unref() {}
      })
    });

    expect(warnings).toEqual(['Speech failed for voice "Siri".']);
  });
});
