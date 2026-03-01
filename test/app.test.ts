import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { CrustyApp } from "../src/app.ts";
import { parseCommand } from "../src/commands.ts";
import { getDefaultInstruction, loadConfig } from "../src/config.ts";
import {
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
import type { ChatMessage } from "../src/types.ts";

async function withTempDir(run: (rootDir: string) => Promise<void>): Promise<void> {
  const rootDir = await mkdtemp(join(tmpdir(), "crusty-"));

  try {
    await run(rootDir);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

function makeChatResponse(text: string): Response {
  return new Response(JSON.stringify({ message: { content: text } }), {
    status: 200,
    headers: {
      "content-type": "application/json"
    }
  });
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
      const app = await CrustyApp.create({ rootDir, speakFn: () => {} });

      await app.execute(parseCommand("/auto"));
      const result = await app.execute(parseCommand("/status"));
      const lines = await app.getStatusLines();

      expect(result.viewerRequest).toEqual({
        kind: "status"
      });
      expect(lines.some((line) => line.includes("Auto pulse: active every"))).toBe(true);
      expect(lines.some((line) => line.includes("Top tier: @air, @vic"))).toBe(true);
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
      expect(file.content).toContain("Add telemetry capture for model latency");
    });
  });

  test("enters auto mode, queues a task, and processes it through Erin", async () => {
    await withTempDir(async (rootDir) => {
      const app = await CrustyApp.create({
        rootDir,
        fetchFn: async () =>
          makeChatResponse("Completed the orchestration task.\nQUEUE[low][pav]: sanity check the result"),
        speakFn: () => {}
      });

      await app.execute(parseCommand("/auto"));
      expect(app.shouldAutoPulse()).toBe(true);
      const result = await app.execute(parseCommand("Design a routing policy."));
      const systemState = await loadSystemState(rootDir);

      expect(result.lines[0]).toBe("Queued #1 [high]: Design a routing policy.");
      expect(result.lines[1]).toContain("Erin completed #1 [high] via air/");
      expect(result.lines[3]).toBe("Queued #2 [low] -> pav: sanity check the result");
      expect(systemState.auto.pending).toEqual([
        expect.objectContaining({
          id: 2,
          priority: "low",
          requestedResource: "pav",
          content: "sanity check the result"
        })
      ]);
      expect(systemState.auto.completed).toEqual([
        expect.objectContaining({
          id: 1,
          status: "completed"
        })
      ]);
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
      const app = await CrustyApp.create({
        rootDir,
        fetchFn: async () =>
          makeChatResponse("[medium] Tighten the queue routing rubric.\n[low] Audit stale memory summaries."),
        speakFn: () => {}
      });

      await app.execute(parseCommand("/auto"));
      const result = await app.runIdleCycle();
      const systemState = await loadSystemState(rootDir);

      expect(result.lines[0]).toBe("Erin filled the queue with 2 self-improvement tasks.");
      expect(systemState.auto.pending.map((task) => `${task.priority}:${task.content}`)).toEqual([
        "medium:Tighten the queue routing rubric.",
        "low:Audit stale memory summaries."
      ]);
    });
  });

  test("returns a workflow request for agent creation and persists a generated agent", async () => {
    await withTempDir(async (rootDir) => {
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
        preferredResource: "vic"
      });
      const agents = await listAgents(rootDir);
      const spec = await loadAgentSpec("reviewer", rootDir);

      expect(workflow.workflowRequest?.kind).toBe("agent.create");
      expect(created.lines[0]).toBe("Created agent @reviewer.");
      expect(agents.map((agent) => agent.slug)).toEqual(["reviewer"]);
      expect(spec).toContain("Summary: Reviews delegation plans.");
    });
  });

  test("chats with an agent identity and allows the agent to queue follow-up work", async () => {
    await withTempDir(async (rootDir) => {
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
            "I would test the plan against the queue.\nQUEUE[medium][vic]: compare two routing strategies"
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
        "Queued #1 [medium] -> vic from @reviewer: compare two routing strategies"
      );
      expect(systemState.auto.pending).toEqual([
        expect.objectContaining({
          requestedResource: "vic",
          content: "compare two routing strategies"
        })
      ]);
    });
  });

  test("persists instructions, default endpoint, sound, and voice changes", async () => {
    await withTempDir(async (rootDir) => {
      const app = await CrustyApp.create({ rootDir });

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
      expect(agents).toEqual([]);
      expect(focusTodo).toContain("Add telemetry capture for model latency");
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

  test("returns a recoverable error for unknown endpoint aliases", async () => {
    await withTempDir(async (rootDir) => {
      const app = await CrustyApp.create({ rootDir });

      const invalidResult = await app.execute(parseCommand("/model nope"));
      const validResult = await app.execute(parseCommand("/model"));

      expect(invalidResult.errors).toEqual(['Unknown endpoint alias "nope".']);
      expect(validResult.lines).toEqual([
        "Current participant: @erin. Plain messages still go to @erin."
      ]);
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
