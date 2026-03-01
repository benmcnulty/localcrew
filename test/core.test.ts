import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { getDefaultInstruction, loadConfig } from "../src/config.ts";
import {
  buildAgentChatMessages,
  buildAutoTaskMessages,
  buildChatMessages,
  buildQueueFillMessages,
  formatConversationTranscript
} from "../src/messages.ts";
import { loadSystemDocuments, loadSystemState } from "../src/orchestrator-store.ts";
import { chooseResourceForTask, getResourceProfilesByTier } from "../src/resources.ts";
import {
  getConversationCompactedUntil,
  getConversationMessages,
  getConversationSummary,
  getEmptySessions,
  loadSessions,
  renameConversationAlias,
  saveSessions,
  setConversationCompaction
} from "../src/session-store.ts";
import { getStoragePaths } from "../src/storage.ts";

async function withTempDir(run: (rootDir: string) => Promise<void>): Promise<void> {
  const rootDir = await mkdtemp(join(tmpdir(), "crusty-"));

  try {
    await run(rootDir);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

describe("config bootstrap", () => {
  test("creates the default config file with renamed participants and premium/enhanced default voices", async () => {
    await withTempDir(async (rootDir) => {
      const config = await loadConfig(rootDir);
      const paths = getStoragePaths(rootDir);
      const raw = await readFile(paths.configPath, "utf8");

      expect(config.defaultEndpoint).toBe("erin");
      expect(config.soundEnabled).toBe(true);
      expect(new Set(Object.values(config.endpoints).map((endpoint) => endpoint.voicePreset)).size).toBe(
        4
      );
      expect(config.endpoints.erin.voicePreset).toBe("allison");
      expect(config.endpoints.zora.voicePreset).toBe("zoe");
      expect(config.endpoints.sam.voicePreset).toBe("samantha");
      expect(config.endpoints.pav.voicePreset).toBe("evan");
      expect(config.endpoints.sam.instructions).toContain("pragmatic minimalist");
      expect(config.endpoints.pav.instructions).toContain("exploratory builder");
      expect(JSON.parse(raw).endpoints.erin.voicePreset).toBe("allison");
    });
  });

  test("upgrades previous generated voice defaults to the current premium/enhanced defaults", async () => {
    await withTempDir(async (rootDir) => {
      const paths = getStoragePaths(rootDir);
      await mkdir(paths.storageDir, { recursive: true });
      await writeFile(
        paths.configPath,
        `${JSON.stringify(
          {
            defaultEndpoint: "sam",
            soundEnabled: true,
            endpoints: {
              sam: {
                baseUrl: "http://localhost:11436",
                model: "llama3.2:1b",
                instructions: getDefaultInstruction("sam"),
                voicePreset: "sandy_us"
              }
            }
          },
          null,
          2
        )}\n`
      );

      const config = await loadConfig(rootDir);

      expect(config.endpoints.sam.voicePreset).toBe("samantha");
    });
  });

  test("upgrades the interim installed defaults to the preferred premium/enhanced set", async () => {
    await withTempDir(async (rootDir) => {
      const paths = getStoragePaths(rootDir);
      await mkdir(paths.storageDir, { recursive: true });
      await writeFile(
        paths.configPath,
        `${JSON.stringify(
          {
            defaultEndpoint: "erin",
            soundEnabled: true,
            endpoints: {
              erin: {
                baseUrl: "http://127.0.0.1:11434",
                model: "llama3.1:8b",
                instructions: getDefaultInstruction("erin"),
                voicePreset: "siri"
              },
              zora: {
                baseUrl: "http://localhost:11435",
                model: "llama3.1:latest",
                instructions: getDefaultInstruction("zora"),
                voicePreset: "zoe"
              },
              sam: {
                baseUrl: "http://localhost:11436",
                model: "llama3.2:1b",
                instructions: getDefaultInstruction("sam"),
                voicePreset: "samantha"
              },
              pav: {
                baseUrl: "http://localhost:11437",
                model: "llama3.2:1b",
                instructions: getDefaultInstruction("pav"),
                voicePreset: "daniel"
              }
            }
          },
          null,
          2
        )}\n`
      );

      const config = await loadConfig(rootDir);

      expect(config.endpoints.erin.voicePreset).toBe("allison");
      expect(config.endpoints.zora.voicePreset).toBe("zoe");
      expect(config.endpoints.sam.voicePreset).toBe("samantha");
      expect(config.endpoints.pav.voicePreset).toBe("evan");
    });
  });
});

describe("system bootstrap", () => {
  test("creates the orchestrator state and default documents", async () => {
    await withTempDir(async (rootDir) => {
      const state = await loadSystemState(rootDir);
      const docs = await loadSystemDocuments(rootDir);
      const paths = getStoragePaths(rootDir);
      const rawState = await readFile(paths.systemStatePath, "utf8");

      expect(state.auto.enabled).toBe(false);
      expect(state.auto.defaultPriority).toBe("high");
      expect(JSON.parse(rawState).auto.pending).toEqual([]);
      expect(docs.directives).toContain("Erin, the orchestrator");
      expect(docs.directives).toContain("self-aware self-improvement");
      expect(docs.inventory).toContain("air (Orchestrator / Hub)");
      expect(docs.workflow).toContain("Agent Creation Workflow");
    });
  });
});

describe("resource routing", () => {
  test("classifies available resources into top, mid, and low tiers", () => {
    const tiers = getResourceProfilesByTier();

    expect(tiers.top.map((profile) => profile.alias)).toEqual(["air", "vic"]);
    expect(tiers.mid.map((profile) => profile.alias)).toEqual(["min"]);
    expect(tiers.low.map((profile) => profile.alias)).toEqual(["pav"]);
  });

  test("routes work away from min and pav for heavier tasks", () => {
    expect(chooseResourceForTask("Draft a detailed delegation plan for the queue.")).toEqual(
      expect.objectContaining({
        alias: "vic",
        tier: "top"
      })
    );
    expect(chooseResourceForTask("Update the memory index metadata as JSON.")).toEqual(
      expect.objectContaining({
        alias: "min",
        tier: "mid"
      })
    );
    expect(chooseResourceForTask("Run a small context sanity check.")).toEqual(
      expect.objectContaining({
        alias: "pav",
        tier: "low"
      })
    );
  });
});

describe("session store", () => {
  test("stores a shared conversation and shared compaction state", async () => {
    await withTempDir(async (rootDir) => {
      const sessions = setConversationCompaction(
        {
          conversation: {
            messages: [
              {
                speaker: "user",
                target: "erin",
                content: "hello"
              }
            ],
            compactedUntil: 0,
            summary: ""
          }
        },
        {
          compactedUntil: 1,
          summary: "User greeted Erin."
        }
      );

      await saveSessions(sessions, rootDir);
      const reloaded = await loadSessions(rootDir);

      expect(getConversationMessages(reloaded)).toEqual([
        {
          speaker: "user",
          target: "erin",
          content: "hello"
        }
      ]);
      expect(getConversationCompactedUntil(reloaded)).toBe(1);
      expect(getConversationSummary(reloaded)).toBe("User greeted Erin.");
    });
  });

  test("migrates legacy per-endpoint compaction state to one shared summary", async () => {
    await withTempDir(async (rootDir) => {
      const paths = getStoragePaths(rootDir);
      await mkdir(paths.storageDir, { recursive: true });
      await writeFile(
        paths.sessionsPath,
        JSON.stringify({
          conversation: {
            messages: [],
            endpointStates: {
              erin: {
                compactedUntil: 4,
                summary: "Shared summary from @erin."
              }
            }
          }
        })
      );

      const sessions = await loadSessions(rootDir, "erin");

      expect(getConversationCompactedUntil(sessions)).toBe(4);
      expect(getConversationSummary(sessions)).toBe("Shared summary from @erin.");
    });
  });

  test("renames aliases across the stored conversation and summary", () => {
    const renamed = renameConversationAlias(
      {
        conversation: {
          messages: [
            {
              speaker: "user",
              target: "erin",
              content: "Hello"
            },
            {
              speaker: "assistant",
              endpoint: "erin",
              directedTo: "zora",
              content: "Please go next."
            }
          ],
          compactedUntil: 2,
          summary: "@erin asked @zora for a follow-up."
        }
      },
      "erin",
      "atlas"
    );

    expect(renamed.conversation.messages).toEqual([
      {
        speaker: "user",
        target: "atlas",
        content: "Hello"
      },
      {
        speaker: "assistant",
        endpoint: "atlas",
        directedTo: "zora",
        content: "Please go next."
      }
    ]);
    expect(renamed.conversation.summary).toBe("@atlas asked @zora for a follow-up.");
  });

  test("treats legacy per-endpoint session files as an empty shared conversation", async () => {
    await withTempDir(async (rootDir) => {
      const paths = getStoragePaths(rootDir);
      await mkdir(paths.storageDir, { recursive: true });
      await writeFile(
        paths.sessionsPath,
        JSON.stringify({
          sessions: {
            erin: {
              messages: [
                {
                  role: "user",
                  content: "legacy"
                }
              ]
            }
          }
        })
      );

      const sessions = await loadSessions(rootDir);

      expect(sessions).toEqual(getEmptySessions());
    });
  });
});

describe("message assembly", () => {
  test("builds a shared summary, transcript, and follow-up suggestion protocol", () => {
    expect(
      buildChatMessages({
        alias: "erin",
        participants: ["erin", "zora", "sam", "pav"],
        instructions: "Reply clearly.",
        summary: "The user is comparing endpoints.",
        recentMessages: [
          { speaker: "user", target: "erin", content: "Hello Erin" },
          {
            speaker: "assistant",
            endpoint: "erin",
            directedTo: "zora",
            content: "Please review this."
          },
          { speaker: "assistant", endpoint: "zora", content: "I am also here." }
        ],
        taskPrompt: "USER -> @erin: What do you think of Zora?"
      })
    ).toEqual([
      { role: "system", content: "Reply clearly." },
      {
        role: "system",
        content:
          'You are @erin. You are one contributor in a shared multi-model conversation with these participants: @erin, @zora, @sam, @pav. The participant names are exactly: Erin (@erin), Zora (@zora), Sam (@sam), Pav (@pav). Use exactly those names and aliases, and never invent alternate names, nicknames, or expansions. Transcript lines are labeled with their @alias and may include directed participant-to-participant lines in the form @from to @to: message. Answer only as @erin, from your own perspective. If grounded factual context from Wikipedia would materially help, end with one final line exactly in this format: WIKIPEDIA: search query If you want to suggest one directed follow-up for the user to approve, end your response with a final line exactly in this format: NEXT: @alias: message Only suggest a valid participant other than yourself, keep the NEXT message short, and omit the NEXT line when no follow-up suggestion is needed. The NEXT line is only a user-editable suggestion and is not executed automatically. Do not emit more than one WIKIPEDIA line.'
      },
      {
        role: "system",
        content: "Shared conversation summary:\nThe user is comparing endpoints."
      },
      {
        role: "system",
        content:
          "Recent conversation transcript:\nUSER -> @erin: Hello Erin\n\n@erin to @zora: Please review this.\n\n@zora: I am also here."
      },
      {
        role: "user",
        content: "USER -> @erin: What do you think of Zora?"
      }
    ]);
  });

  test("formats shared conversation transcripts with directed participant lines", () => {
    expect(
      formatConversationTranscript([
        { speaker: "user", target: "erin", content: "Hello Erin" },
        {
          speaker: "assistant",
          endpoint: "erin",
          directedTo: "zora",
          content: "Please review this."
        }
      ])
    ).toBe("USER -> @erin: Hello Erin\n\n@erin to @zora: Please review this.");
  });

  test("builds agent chat prompts with queue delegation guidance", () => {
    expect(
      buildAgentChatMessages({
        agentName: "Reviewer",
        agentSlug: "reviewer",
        preferredResource: "vic",
        spec: "# Reviewer\n\nSummary: Reviews delegation plans.",
        summary: "The agent has been evaluating queue flow.",
        recentMessages: [{ speaker: "user", target: "reviewer", content: "Review this queue." }],
        taskPrompt: "USER -> @reviewer: Review the queue."
      })
    ).toEqual([
      {
        role: "system",
        content: "# Reviewer\n\nSummary: Reviews delegation plans."
      },
      {
        role: "system",
        content:
          "You are Reviewer (@reviewer), a persistent agent identity managed by Erin, the orchestrator. Your preferred inference resource is vic. Stay aligned with your specification and maintain continuity with your private memory. If grounded factual context from Wikipedia would materially help, end with one final line exactly in this format: WIKIPEDIA: search query. If you want the orchestrator queue to take on follow-up work, end with one or more final lines exactly in the form QUEUE[medium]: task, QUEUE[low]: task, QUEUE[medium][air]: task, or QUEUE[medium][air][model-name]: task. Do not emit queue lines unless a concrete asynchronous follow-up is useful."
      },
      {
        role: "system",
        content: "Agent memory summary:\nThe agent has been evaluating queue flow."
      },
      {
        role: "system",
        content: "Recent private transcript:\nUSER -> @reviewer: Review this queue."
      },
      {
        role: "user",
        content: "USER -> @reviewer: Review the queue."
      }
    ]);
  });

  test("builds orchestrator prompts for auto tasks and queue fill", () => {
    const autoTaskMessages = buildAutoTaskMessages({
      directives: "Directives",
      inventory: "Inventory",
      roadmap: "Roadmap",
      focusTodo: "Focus",
      changelog: "Changelog",
      orchestratorSummary: "Summary",
      agents: ["@reviewer"],
      task: "Inspect the queue.",
      priority: "high",
      createdBy: "user",
      resourceAlias: "air",
      resourceRationale: "Use the strongest reasoning node."
    });

    expect(autoTaskMessages[1]).toEqual({
      role: "system",
      content:
        'You are Erin, the orchestrator identity. The selected inference resource for this task is @air. Selection rationale: Use the strongest reasoning node. You are using that resource as a tool, but you still answer as Erin. Keep outputs concise and actionable. In auto mode, your default stance is self-aware self-improvement of the local orchestration system through stronger documentation, indexing, queue hygiene, memory quality, and next-step preparation whenever the current task allows it. If grounded factual context from Wikipedia would materially help, end with one final line exactly in this format: WIKIPEDIA: search query. If useful, end with one or more final lines in the exact format QUEUE[high]: task, QUEUE[medium]: task, QUEUE[low]: task, QUEUE[medium][air]: task, or QUEUE[medium][air][model-name]: task.'
    });

    expect(autoTaskMessages.at(-1)).toEqual({
      role: "user",
      content: "Priority: high\nCreated by: user\n\nTask:\nInspect the queue."
    });

    expect(
      buildQueueFillMessages({
        directives: "Directives",
        inventory: "Inventory",
        roadmap: "Roadmap",
        focusTodo: "Focus",
        changelog: "Changelog",
        orchestratorSummary: "Summary",
        agents: ["@reviewer"]
      })[1]
    ).toEqual({
      role: "system",
      content:
        "You are Erin, the orchestrator identity. The queue is currently empty. Self-aware self-improvement of the local orchestration system is your default stance right now. Propose a brief self-improvement backlog for the local orchestration system only. If grounded factual context from Wikipedia would materially help, end with one final line exactly in this format: WIKIPEDIA: search query. Output only task lines in the exact format [medium] task or [low] task. Prefer 2-3 tasks total with at least one medium and one low. Do not output any explanation before or after the task lines."
    });
  });
});
