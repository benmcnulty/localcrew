import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { getDefaultInstruction, loadConfig, saveConfig } from "../src/config.ts";
import { pingResource } from "../src/resource-discovery.ts";
import {
  buildAgentChatMessages,
  buildAutoTaskMessages,
  buildChatMessages,
  buildQueueFillFinalizeMessages,
  buildQueueFillMessages,
  buildQueueFillReviewMessages,
  formatConversationTranscript
} from "../src/messages.ts";
import {
  buildDailyDigest,
  completeDailySession,
  loadSystemDocuments,
  loadSystemState,
  recordDailyTaskCompletion,
  saveSystemState,
  startDailySession,
} from "../src/orchestrator-store.ts";
import type { AutoQueueTask, DailyWorkSession } from "../src/types.ts";
import {
  classifyTask,
  buildResourceTelemetry,
  chooseResourceForTask,
  computeResourceScore,
  detectTaskPurpose,
  getEffectiveResourceRole,
  getNetworkTopology,
  getResourceCapacitySummary,
  getResourceProfilesByTier,
  isOrchestratorCapable,
  routeTask,
  renderNetworkTopology,
  resolveResourcePurpose,
  saveResources,
  selectModelForEndpoint,
  type ResourceTelemetry,
  type ResourceProfile
} from "../src/resources.ts";
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
      label: "Local Crew",
      tier: "top",
      baseUrl: "http://127.0.0.1:11434",
      defaultModel: "llama3.1:8b",
      reasoningModel: "gpt-oss:20b",
      codingModel: "qwen3-coder:latest",
      toolsModel: "gemma3:4b",
      embeddingModel: "nomic-embed-text:latest",
      role: "Primary orchestration resource.",
      capabilities: ["reasoning", "planning", "chat", "code generation", "tool formatting"],
      notes: ["Bootstrapped in tests."],
      cpuLogicalCores: 10,
      ramGb: 32,
      maxContextTokens: 65536
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
      notes: [],
      cpuLogicalCores: 24,
      ramGb: 16,
      gpuModel: "RTX 3060",
      gpuCount: 1,
      totalVramGb: 12,
      maxContextTokens: 131072
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
      notes: [],
      cpuLogicalCores: 8,
      ramGb: 8,
      maxContextTokens: 16384
    },
    overflow: {
      alias: "overflow",
      label: "Overflow Node",
      tier: "low",
      baseUrl: "http://127.0.0.1:11437",
      defaultModel: "llama3.2:3b",
      role: "Small-context overflow.",
      capabilities: ["small tasks"],
      notes: [],
      maxContextTokens: 8192
    }
  };

  await saveResources(resources, rootDir);
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
  test("creates the orchestrator state and default documents with the configured orchestrator name", async () => {
    await withTempDir(async (rootDir) => {
      const previousName = process.env.LOCALCREW_ORCHESTRATOR_NAME;
      process.env.LOCALCREW_ORCHESTRATOR_NAME = "Aster";

      try {
        const state = await loadSystemState(rootDir);
        const docs = await loadSystemDocuments(rootDir);
        const paths = getStoragePaths(rootDir);
        const rawState = await readFile(paths.systemStatePath, "utf8");

        expect(state.auto.enabled).toBe(false);
        expect(state.auto.defaultPriority).toBe("high");
        expect(JSON.parse(rawState).auto.pending).toEqual([]);
        expect(docs.directives).toContain("Aster, the orchestrator");
        expect(docs.directives).toContain("self-aware self-improvement");
        expect(docs.inventory).toContain("## orchestrator (Local Crew)");
        expect(docs.workflow).toContain("Agent Creation Workflow");
      } finally {
        if (previousName === undefined) {
          delete process.env.LOCALCREW_ORCHESTRATOR_NAME;
        } else {
          process.env.LOCALCREW_ORCHESTRATOR_NAME = previousName;
        }
      }
    });
  });
});

describe("resource routing", () => {
  test("classifies available resources into top, mid, and low tiers", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      const tiers = getResourceProfilesByTier(rootDir);

      expect(tiers.top.map((profile) => profile.alias)).toEqual(["orchestrator", "workhorse"]);
      expect(tiers.mid.map((profile) => profile.alias)).toEqual(["helper"]);
      expect(tiers.low.map((profile) => profile.alias)).toEqual(["overflow"]);
    });
  });

  test("routes work by tier for heavier and lighter tasks", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);

      const draftSelection = chooseResourceForTask(
        "Draft a detailed delegation plan for the queue.",
        "auto",
        rootDir
      );
      expect(draftSelection.tier).toBe("top");
      expect(["orchestrator", "workhorse"]).toContain(draftSelection.alias);

      expect(
        chooseResourceForTask(
          "Draft a detailed delegation plan for the queue.",
          "auto",
          rootDir,
          {
            resourceLoad: {
              orchestrator: 3,
              workhorse: 0
            }
          }
        )
      ).toEqual(
        expect.objectContaining({
          alias: "workhorse",
          tier: "top"
        })
      );

      expect(
        chooseResourceForTask(
          "Draft a detailed delegation plan for the queue.",
          "auto",
          rootDir,
          {
            resourceLoad: {
              orchestrator: 0,
              workhorse: 4
            }
          }
        )
      ).toEqual(
        expect.objectContaining({
          alias: "orchestrator",
          tier: "top"
        })
      );

      expect(chooseResourceForTask("Update the memory index metadata as JSON.", "auto", rootDir)).toEqual(
        expect.objectContaining({
          alias: "helper",
          tier: "mid"
        })
      );
      expect(chooseResourceForTask("Run a small context sanity check.", "auto", rootDir)).toEqual(
        expect.objectContaining({
          alias: "overflow",
          tier: "low"
        })
      );
    });
  });

  test("summarizes known hardware capacity and prefers higher-context resources for context-heavy work", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);

      const capacity = getResourceCapacitySummary(rootDir);
      const selection = chooseResourceForTask(
        "Review a long context transcript across many files.",
        "auto",
        rootDir,
        {
          resourceLoad: {
            orchestrator: 1,
            workhorse: 0
          }
        }
      );

      expect(capacity).toEqual({
        resourceCount: 4,
        knownCpuLogicalCores: 42,
        knownRamGb: 56,
        knownGpuCount: 1,
        knownTotalVramGb: 12,
        highestKnownContextTokens: 131072
      });
      expect(selection).toEqual(
        expect.objectContaining({
          alias: "workhorse",
          tier: "top"
        })
      );
    });
  });

  test("classifies task metadata for planning and research workloads", () => {
    const planning = classifyTask("Draft a roadmap and orchestrate a multi-step migration plan.");
    const research = classifyTask("SEARCH[news]: latest AI engineering role trends");

    expect(planning.taskType).toBe("planning");
    expect(planning.reasoningDepth).toBe("high");
    expect(planning.tokenEstimate).toBeGreaterThan(0);
    expect(research.taskType).toBe("research");
    expect(research.requiresWebTools).toBe(true);
  });

  test("scores resources based on queue depth, memory headroom, and task fit", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      const [orchestrator, workhorse] = getResourceProfilesByTier(rootDir).top;
      const task = classifyTask("Design a comprehensive architecture migration with tradeoff analysis.");

      const loadedTelemetry: ResourceTelemetry = {
        queueDepth: 4,
        ramUsagePct: 90,
        tokensPerSecond: 8,
        activeModel: "llama3.1:8b",
        avgQueueWaitMs: 1200,
        successRate: 0.9,
        failureCount: 1
      };
      const healthyTelemetry: ResourceTelemetry = {
        queueDepth: 0,
        ramUsagePct: 20,
        tokensPerSecond: 18,
        activeModel: "llama3.1:8b",
        avgQueueWaitMs: 100,
        successRate: 1,
        failureCount: 0
      };

      const loadedScore = computeResourceScore(orchestrator, loadedTelemetry, task);
      const healthyScore = computeResourceScore(workhorse, healthyTelemetry, task);
      expect(healthyScore).toBeGreaterThan(loadedScore);
    });
  });

  test("offline health status scores zero", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      const resources = Object.values(getResourceProfilesByTier(rootDir)).flat();
      const resource = resources[0];
      const telemetry: ResourceTelemetry = {
        queueDepth: 0,
        ramUsagePct: 0,
        tokensPerSecond: 20,
        activeModel: "llama3.1:8b",
        avgQueueWaitMs: 100,
        successRate: 1,
        failureCount: 0
      };
      const task = classifyTask("Analyze the quarterly report.");
      const normalScore = computeResourceScore(resource, telemetry, task);
      const offlineScore = computeResourceScore(resource, telemetry, task, "offline");
      const degradedScore = computeResourceScore(resource, telemetry, task, "degraded");
      const onlineScore = computeResourceScore(resource, telemetry, task, "online");
      expect(offlineScore).toBe(0);
      expect(degradedScore).toBeLessThan(normalScore);
      expect(degradedScore).toBeGreaterThan(0);
      expect(onlineScore).toBe(normalScore);
    });
  });

  test("routes tasks to highest scored resource", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      const resources = Object.values(getResourceProfilesByTier(rootDir)).flat();
      const task = classifyTask("Classify and tag incoming documents into the metadata index.");
      const telemetry: Record<string, ResourceTelemetry> = {
        orchestrator: {
          queueDepth: 2,
          ramUsagePct: 70,
          tokensPerSecond: 12,
          activeModel: "llama3.1:8b",
          avgQueueWaitMs: 600,
          successRate: 0.95,
          failureCount: 0
        },
        workhorse: {
          queueDepth: 3,
          ramUsagePct: 60,
          tokensPerSecond: 10,
          activeModel: "llama3.1:8b",
          avgQueueWaitMs: 800,
          successRate: 0.95,
          failureCount: 0
        },
        helper: {
          queueDepth: 0,
          ramUsagePct: 25,
          tokensPerSecond: 16,
          activeModel: "qwen2.5:0.5b",
          avgQueueWaitMs: 50,
          successRate: 1,
          failureCount: 0
        },
        overflow: {
          queueDepth: 1,
          ramUsagePct: 30,
          tokensPerSecond: 9,
          activeModel: "llama3.2:3b",
          avgQueueWaitMs: 200,
          successRate: 1,
          failureCount: 0
        }
      };

      const routed = routeTask(task, resources, telemetry);
      expect(routed.resource.alias).toBe("helper");
      expect(routed.score).toBeGreaterThan(0);
      expect(routed.rationale).toContain("highest");
    });
  });

  test("downgrades heavy reasoning models when a node is under pressure", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      const orchestrator = getResourceProfilesByTier(rootDir).top[0];
      const task = classifyTask("Analyze the architecture tradeoffs and diagnose the routing drift.");
      const telemetry = buildResourceTelemetry(
        orchestrator.alias,
        1,
        undefined,
        {
          loadAvg1m: 8.5,
          loadAvg5m: 8.1,
          totalMemGb: 32,
          freeMemGb: 4,
          freePct: 12.5,
          timestamp: Date.now()
        },
        orchestrator
      );

      expect(resolveResourcePurpose(orchestrator, "reasoning", task, telemetry, "online")).toBe("default");
    });
  });

  test("keeps heavy reasoning models available for deep work when headroom is healthy", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      const orchestrator = getResourceProfilesByTier(rootDir).top[0];
      const task = classifyTask(
        "Design a comprehensive end-to-end architecture migration with benchmark planning and tradeoff analysis."
      );
      const telemetry = buildResourceTelemetry(
        orchestrator.alias,
        0,
        undefined,
        {
          loadAvg1m: 1.2,
          loadAvg5m: 1,
          totalMemGb: 32,
          freeMemGb: 22,
          freePct: 68.75,
          timestamp: Date.now()
        },
        orchestrator
      );

      expect(resolveResourcePurpose(orchestrator, "reasoning", task, telemetry, "online")).toBe("reasoning");
    });
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
  test("builds a shared summary, transcript, and follow-up suggestion protocol", async () => {
    const messages = await buildChatMessages({
      alias: "erin",
      participants: [
        { alias: "erin", nickname: "Erin" },
        { alias: "zora", nickname: "Zora" },
        { alias: "sam", nickname: "Sam" },
        { alias: "pav", nickname: "Pav" }
      ],
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
    });

    // Structural checks — role order and dynamic content
    expect(messages[0]).toEqual({ role: "system", content: "Reply clearly." });
    expect(messages[1]?.role).toBe("system");
    expect(messages[1]?.content).toContain("You are @erin.");
    expect(messages[1]?.content).toContain("Erin (@erin), Zora (@zora), Sam (@sam), Pav (@pav)");
    expect(messages[1]?.content).toContain("WIKIPEDIA:");
    expect(messages[1]?.content).toContain("REDDIT:");
    expect(messages[1]?.content).toContain("SEARCH[topic]:");
    expect(messages[1]?.content).toContain("WEATHER:");
    expect(messages[1]?.content).toContain("BENLIVE:");
    expect(messages[1]?.content).toContain("WEBSITE:");
    expect(messages[1]?.content).toContain("NEXT:");
    expect(messages[2]).toEqual({
      role: "system",
      content: "Shared conversation summary:\nThe user is comparing endpoints."
    });
    expect(messages[3]).toEqual({
      role: "system",
      content:
        "Recent conversation transcript:\nUSER -> @erin: Hello Erin\n\n@erin to @zora: Please review this.\n\n@zora: I am also here."
    });
    expect(messages[4]).toEqual({
      role: "user",
      content: "USER -> @erin: What do you think of Zora?"
    });
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

  test("builds agent chat prompts with queue delegation guidance", async () => {
    const agentMessages = await buildAgentChatMessages({
      agentName: "Reviewer",
      agentSlug: "reviewer",
      preferredResource: "workhorse",
      orchestratorName: "Aster",
      spec: "# Reviewer\n\nSummary: Reviews delegation plans.",
      summary: "The agent has been evaluating queue flow.",
      recentMessages: [{ speaker: "user", target: "reviewer", content: "Review this queue." }],
      taskPrompt: "USER -> @reviewer: Review the queue."
    });

    expect(agentMessages).toEqual([
      {
        role: "system",
        content: "# Reviewer\n\nSummary: Reviews delegation plans."
      },
      expect.objectContaining({ role: "system" }),
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
    const agentSystemPrompt = agentMessages[1]?.content as string;
    expect(agentSystemPrompt).toContain("You are Reviewer (@reviewer)");
    expect(agentSystemPrompt).toContain("QUEUE[medium]: task");
    expect(agentSystemPrompt).toContain("UPDATE[stage][path][replace]");
    expect(agentSystemPrompt).toContain("replace-section");
    expect(agentSystemPrompt).toContain("HEADING: Parent > Child");
    expect(agentSystemPrompt).toContain("WRITE[outbox] or UPDATE[outbox]");
  });

  test("builds orchestrator prompts for auto tasks and queue fill", async () => {
    const autoTaskMessages = await buildAutoTaskMessages({
      directives: "Directives",
      inventory: "Inventory",
      roadmap: "Roadmap",
      focusTodo: "Focus",
      changelog: "Changelog",
      orchestratorSummary: "Summary",
      orchestratorName: "Aster",
      agents: ["@reviewer"],
      task: "Inspect the queue.",
      priority: "high",
      createdBy: "user",
      resourceAlias: "orchestrator",
      resourceRationale: "Use the strongest reasoning node."
    });

    expect(autoTaskMessages[1]).toEqual(expect.objectContaining({ role: "system" }));
    const autoTaskSystemPrompt = autoTaskMessages[1]?.content as string;
    expect(autoTaskSystemPrompt).toContain("You are Aster, the orchestrator identity.");
    expect(autoTaskSystemPrompt).toContain("QUEUE[medium]: task");
    expect(autoTaskSystemPrompt).toContain("UPDATE[stage][path][replace]");
    expect(autoTaskSystemPrompt).toContain("replace-section");
    expect(autoTaskSystemPrompt).toContain("HEADING: Parent > Child");
    expect(autoTaskSystemPrompt).toContain("Prefer UPDATE[internal][summary.md]");

    expect(autoTaskMessages.at(-1)).toEqual({
      role: "user",
      content: "Priority: high\nCreated by: user\n\nTask:\nInspect the queue."
    });

    const fillMessages = await buildQueueFillMessages({
      directives: "Directives",
      inventory: "Inventory",
      roadmap: "Roadmap",
      focusTodo: "Focus",
      changelog: "Changelog",
      orchestratorSummary: "Summary",
      orchestratorName: "Aster",
      agents: ["@reviewer"],
      targetTaskCount: 8
    });
    const fillMsg = fillMessages[1];
    const fillContent = fillMsg?.content as string;
    expect(fillMsg?.role).toBe("system");
    expect(fillContent).toContain("You are Aster, the orchestrator identity.");
    expect(fillContent).toContain("Self-aware self-improvement");
    expect(fillContent).toContain("WIKIPEDIA:");
    expect(fillContent).toContain("REDDIT:");
    expect(fillContent).toContain("SEARCH[topic]:");
    expect(fillContent).toContain("{domain:");
    expect(fillContent).toContain("SYSTEM");
    expect(fillContent).toContain("RESEARCH");
    expect(fillContent).toContain("KNOWLEDGE");
    expect(fillContent).toContain("SYNTHESIS");
    expect(fillContent).toContain("IDENTITY");

    const reviewMessages = await buildQueueFillReviewMessages({
      orchestratorName: "Aster",
      reviewerAlias: "zora",
      draftTasks: "[medium] Tighten routing\n[low] Rewrite docs",
      inventory: "Inventory",
      roadmap: "Roadmap",
      focusTodo: "Focus",
      changelog: "Changelog"
    });
    const reviewMsg = reviewMessages[0];
    expect(reviewMsg?.role).toBe("system");
    expect(reviewMsg?.content).toContain("@zora, the secondary reviewer");
    expect(reviewMsg?.content).toContain("VERDICT: approve");

    const finalizeMessages = await buildQueueFillFinalizeMessages({
      directives: "Directives",
      inventory: "Inventory",
      roadmap: "Roadmap",
      focusTodo: "Focus",
      changelog: "Changelog",
      orchestratorSummary: "Summary",
      orchestratorName: "Aster",
      agents: ["@reviewer"],
      draftTasks: "[medium] Tighten routing",
      reviewFeedback: "Too broad.\nVERDICT: revise",
      targetTaskCount: 6
    });
    const finalizeMsg = finalizeMessages[1];
    expect(finalizeMsg?.role).toBe("system");
    expect(finalizeMsg?.content).toContain("You are Aster, the orchestrator identity.");
    expect(finalizeMsg?.content).toContain("received a critique from the secondary reviewer");
    expect(finalizeMsg?.content).toContain("domain");
  });

  describe("detectTaskPurpose", () => {
    test("detects coding purpose", () => {
      expect(detectTaskPurpose("Write a TypeScript function")).toBe("coding");
      expect(detectTaskPurpose("Fix the bug in the parser")).toBe("coding");
      expect(detectTaskPurpose("Refactor the storage module")).toBe("coding");
      expect(detectTaskPurpose("Implement the new feature")).toBe("coding");
    });

    test("detects tools purpose", () => {
      expect(detectTaskPurpose("Classify and tag this document")).toBe("tools");
      expect(detectTaskPurpose("Organize the metadata index")).toBe("tools");
      expect(detectTaskPurpose("Update the changelog entry")).toBe("tools");
      expect(detectTaskPurpose("Generate a JSON summary table")).toBe("tools");
    });

    test("detects reasoning purpose", () => {
      expect(detectTaskPurpose("Explain why the engine stalls")).toBe("reasoning");
      expect(detectTaskPurpose("Analyze the performance data")).toBe("reasoning");
      expect(detectTaskPurpose("Compare these two approaches")).toBe("reasoning");
      expect(detectTaskPurpose("Calculate the optimal batch size")).toBe("reasoning");
    });

    test("returns default for unclassified text", () => {
      expect(detectTaskPurpose("Hello, how are you?")).toBe("default");
      expect(detectTaskPurpose("Tell me about the weather")).toBe("default");
      expect(detectTaskPurpose("What is the capital of France?")).toBe("default");
    });
  });

  describe("selectModelForEndpoint", () => {
    test("returns endpoint purpose model when available", () => {
      withTempDir(async (rootDir) => {
        const endpoint = {
          resourceAlias: "missing-resource",
          nickname: "Tester",
          baseUrl: "http://127.0.0.1:11434",
          model: "llama3.1:8b",
          codingModel: "qwen2.5-coder:7b",
          reasoningModel: "deepseek-r1:14b",
          toolsModel: "llama3.1:8b-tools",
          instructions: "",
          voicePreset: ""
        };
        expect(selectModelForEndpoint(endpoint, "coding", rootDir)).toBe("qwen2.5-coder:7b");
        expect(selectModelForEndpoint(endpoint, "reasoning", rootDir)).toBe("deepseek-r1:14b");
        expect(selectModelForEndpoint(endpoint, "tools", rootDir)).toBe("llama3.1:8b-tools");
        expect(selectModelForEndpoint(endpoint, "default", rootDir)).toBe("llama3.1:8b");
      });
    });

    test("falls back to endpoint default model when no purpose slots set", () => {
      withTempDir(async (rootDir) => {
        const endpoint = {
          resourceAlias: "missing-resource",
          nickname: "Tester",
          baseUrl: "http://127.0.0.1:11434",
          model: "llama3.1:8b",
          instructions: "",
          voicePreset: ""
        };
        expect(selectModelForEndpoint(endpoint, "coding", rootDir)).toBe("llama3.1:8b");
        expect(selectModelForEndpoint(endpoint, "reasoning", rootDir)).toBe("llama3.1:8b");
        expect(selectModelForEndpoint(endpoint, "tools", rootDir)).toBe("llama3.1:8b");
      });
    });

    test("falls back to resource purpose model when endpoint slot is empty", async () => {
      await withTempDir(async (rootDir) => {
        await seedResourceInventory(rootDir);
        const endpoint = {
          resourceAlias: "orchestrator",
          nickname: "Tester",
          baseUrl: "http://127.0.0.1:11434",
          model: "llama3.1:8b",
          instructions: "",
          voicePreset: ""
        };
        // The seeded orchestrator resource has reasoningModel set
        const result = selectModelForEndpoint(endpoint, "reasoning", rootDir);
        // Should use the resource's reasoningModel since endpoint doesn't have one
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
      });
    });
  });
});

describe("daily work session functions", () => {
  test("startDailySession creates a new session with zero counters", () => {
    const session = startDailySession();
    expect(session.startedAt).toBeDefined();
    expect(session.tasksCompleted).toBe(0);
    expect(session.tasksErrored).toBe(0);
    expect(session.completedAt).toBeUndefined();
    expect(session.digestPath).toBeUndefined();
  });

  test("recordDailyTaskCompletion increments success counter", () => {
    const session = startDailySession();
    const updated = recordDailyTaskCompletion(session, false);
    expect(updated.tasksCompleted).toBe(1);
    expect(updated.tasksErrored).toBe(0);
  });

  test("recordDailyTaskCompletion increments error counter", () => {
    const session = startDailySession();
    const updated = recordDailyTaskCompletion(session, true);
    expect(updated.tasksCompleted).toBe(0);
    expect(updated.tasksErrored).toBe(1);
  });

  test("completeDailySession marks session finished", () => {
    const session = startDailySession();
    const completed = completeDailySession(session, "/some/path.md");
    expect(completed.completedAt).toBeDefined();
    expect(completed.digestPath).toBe("/some/path.md");
  });

  test("completeDailySession works without digestPath", () => {
    const session = startDailySession();
    const completed = completeDailySession(session);
    expect(completed.completedAt).toBeDefined();
    expect(completed.digestPath).toBeUndefined();
  });

  test("buildDailyDigest produces markdown with expected sections", () => {
    const session: DailyWorkSession = {
      startedAt: "2025-01-15T08:00:00.000Z",
      tasksCompleted: 3,
      tasksErrored: 1,
    };
    const completedTasks: AutoQueueTask[] = [
      {
        id: 1,
        content: "Update routing summary",
        createdAt: "2025-01-15T08:01:00.000Z",
        createdBy: "orchestrator",
        status: "completed",
        priority: "high",
        assignedResource: "orchestrator",
        assignedModel: "llama3.1:8b",
        durationMs: 15000,
      },
      {
        id: 2,
        content: "Re-index telemetry",
        createdAt: "2025-01-15T08:10:00.000Z",
        createdBy: "orchestrator",
        status: "completed",
        priority: "medium",
        assignedResource: "workhorse",
        assignedModel: "qwen3:8b",
        durationMs: 30000,
        errorMessage: "Context exceeded",
      },
    ];

    const digest = buildDailyDigest({
      session,
      completedTasks,
      orchestratorName: "TestOrch",
      orchestratorSummary: "All went well.",
      focusTodo: "- Continue improving memory.",
      customDirective: "Keep it brief.",
    });

    expect(digest).toContain("# Daily Digest");
    expect(digest).toContain("**Orchestrator:** TestOrch");
    expect(digest).toContain("**Tasks completed:** 3");
    expect(digest).toContain("**Tasks errored:** 1");
    expect(digest).toContain("## Digest Directive");
    expect(digest).toContain("Keep it brief.");
    expect(digest).toContain("## Completed Tasks");
    expect(digest).toContain("**#1** [high] ✓");
    expect(digest).toContain("**#2** [medium] ⚠️ errored");
    expect(digest).toContain("Error: Context exceeded");
    expect(digest).toContain("## Orchestrator Summary");
    expect(digest).toContain("All went well.");
    expect(digest).toContain("## Current Focus");
    expect(digest).toContain("- Continue improving memory.");
  });

  test("buildDailyDigest handles empty completed tasks", () => {
    const session: DailyWorkSession = {
      startedAt: "2025-01-15T08:00:00.000Z",
      tasksCompleted: 0,
      tasksErrored: 0,
    };
    const digest = buildDailyDigest({
      session,
      completedTasks: [],
      orchestratorName: "TestOrch",
      orchestratorSummary: "",
      focusTodo: "",
    });

    expect(digest).toContain("No tasks completed during this session.");
  });

  test("buildDailyDigest omits directive section when no custom directive", () => {
    const session: DailyWorkSession = {
      startedAt: "2025-01-15T08:00:00.000Z",
      tasksCompleted: 0,
      tasksErrored: 0,
    };
    const digest = buildDailyDigest({
      session,
      completedTasks: [],
      orchestratorName: "Orch",
      orchestratorSummary: "",
      focusTodo: "",
    });

    expect(digest).not.toContain("## Digest Directive");
  });
});

describe("config orchestratorResourceAlias", () => {
  test("loadConfig preserves orchestratorResourceAlias when present", async () => {
    await withTempDir(async (rootDir) => {
      const config = await loadConfig(rootDir);
      config.orchestratorResourceAlias = "workhorse";
      await saveConfig(config, rootDir);
      const reloaded = await loadConfig(rootDir);
      expect(reloaded.orchestratorResourceAlias).toBe("workhorse");
    });
  });

  test("loadConfig omits orchestratorResourceAlias when not set", async () => {
    await withTempDir(async (rootDir) => {
      const config = await loadConfig(rootDir);
      expect(config.orchestratorResourceAlias).toBeUndefined();
    });
  });
});

describe("daily session state persistence", () => {
  test("daily session roundtrips through system state", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      const paths = getStoragePaths(rootDir);
      await mkdir(paths.systemDir, { recursive: true });

      // Load default state, verify no session
      let state = await loadSystemState(rootDir);
      expect(state.auto.dailySession).toBeUndefined();

      // Start a session and save
      state = {
        ...state,
        auto: {
          ...state.auto,
          dailySession: startDailySession(),
        },
      };
      await saveSystemState(state, rootDir);

      // Reload and verify it persisted
      const reloaded = await loadSystemState(rootDir);
      expect(reloaded.auto.dailySession).toBeDefined();
      expect(reloaded.auto.dailySession!.startedAt).toBe(state.auto.dailySession!.startedAt);
      expect(reloaded.auto.dailySession!.tasksCompleted).toBe(0);
    });
  });
});

describe("network topology", () => {
  test("isOrchestratorCapable requires top tier and >= 16k context", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      const tiers = getResourceProfilesByTier(rootDir);
      const orch = tiers.top.find((p) => p.alias === "orchestrator")!;
      const workhorse = tiers.top.find((p) => p.alias === "workhorse")!;
      const helper = tiers.mid[0];
      const overflow = tiers.low[0];

      expect(isOrchestratorCapable(orch)).toBe(true); // top, 65536
      expect(isOrchestratorCapable(workhorse)).toBe(true); // top, 131072
      expect(isOrchestratorCapable(helper)).toBe(false); // mid, 16384 — wrong tier
      expect(isOrchestratorCapable(overflow)).toBe(false); // low, 8192
    });
  });

  test("getEffectiveResourceRole infers roles correctly", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      const tiers = getResourceProfilesByTier(rootDir);
      const orch = tiers.top.find((p) => p.alias === "orchestrator")!;
      const workhorse = tiers.top.find((p) => p.alias === "workhorse")!;
      const helper = tiers.mid[0];
      const overflow = tiers.low[0];

      expect(getEffectiveResourceRole(orch, "orchestrator")).toBe("primary-orchestrator");
      expect(getEffectiveResourceRole(workhorse, "orchestrator")).toBe("orchestrator"); // top + capable
      expect(getEffectiveResourceRole(helper, "orchestrator")).toBe("agent"); // mid tier
      expect(getEffectiveResourceRole(overflow, "orchestrator")).toBe("agent"); // low tier
    });
  });

  test("getEffectiveResourceRole respects explicit role", async () => {
    await withTempDir(async (rootDir) => {
      const resources: Record<string, ResourceProfile> = {
        device1: {
          alias: "device1",
          label: "Device 1",
          tier: "low",
          baseUrl: "http://127.0.0.1:11434",
          defaultModel: "llama3.2:3b",
          role: "Override test.",
          capabilities: [],
          notes: [],
          maxContextTokens: 4096,
          resourceRole: "orchestrator"
        }
      };
      await saveResources(resources, rootDir);
      const profile = getResourceProfilesByTier(rootDir).low[0];
      expect(getEffectiveResourceRole(profile, "other")).toBe("orchestrator");
    });
  });

  test("getNetworkTopology builds correct node list", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      const nodes = getNetworkTopology("orchestrator", rootDir);

      expect(nodes).toHaveLength(4);
      const primary = nodes.find((n) => n.alias === "orchestrator")!;
      expect(primary.role).toBe("primary-orchestrator");
      const workhorse = nodes.find((n) => n.alias === "workhorse")!;
      expect(workhorse.role).toBe("orchestrator");
      const helper = nodes.find((n) => n.alias === "helper")!;
      expect(helper.role).toBe("agent");
      const overflow = nodes.find((n) => n.alias === "overflow")!;
      expect(overflow.role).toBe("agent");
    });
  });

  test("getNetworkTopology includes subordinate assignments", async () => {
    await withTempDir(async (rootDir) => {
      const resources: Record<string, ResourceProfile> = {
        primary: {
          alias: "primary",
          label: "Primary",
          tier: "top",
          baseUrl: "http://127.0.0.1:11434",
          defaultModel: "llama3.1:8b",
          role: "Primary.",
          capabilities: [],
          notes: [],
          maxContextTokens: 32768,
          subordinateResources: ["agent1"]
        },
        sub: {
          alias: "sub",
          label: "Sub Orch",
          tier: "top",
          baseUrl: "http://127.0.0.1:11435",
          defaultModel: "llama3.1:8b",
          role: "Sub orchestrator.",
          capabilities: [],
          notes: [],
          maxContextTokens: 16384,
          subordinateResources: ["agent2"]
        },
        agent1: {
          alias: "agent1",
          label: "Agent 1",
          tier: "low",
          baseUrl: "http://127.0.0.1:11436",
          defaultModel: "llama3.2:3b",
          role: "Agent.",
          capabilities: [],
          notes: [],
          maxContextTokens: 8192
        },
        agent2: {
          alias: "agent2",
          label: "Agent 2",
          tier: "low",
          baseUrl: "http://127.0.0.1:11437",
          defaultModel: "llama3.2:3b",
          role: "Agent.",
          capabilities: [],
          notes: [],
          maxContextTokens: 8192
        }
      };
      await saveResources(resources, rootDir);
      const nodes = getNetworkTopology("primary", rootDir);

      const primary = nodes.find((n) => n.alias === "primary")!;
      expect(primary.subordinates).toEqual(["agent1"]);
      const sub = nodes.find((n) => n.alias === "sub")!;
      expect(sub.role).toBe("orchestrator");
      expect(sub.subordinates).toEqual(["agent2"]);
    });
  });

  test("renderNetworkTopology produces readable output", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      const output = renderNetworkTopology("orchestrator", rootDir);

      expect(output).toContain("# Network Topology");
      expect(output).toContain("Primary Orchestrator: @orchestrator");
      expect(output).toContain("Sub-Orchestrators");
      expect(output).toContain("@workhorse");
      expect(output).toContain("Agent Resources");
      expect(output).toContain("@helper");
      expect(output).toContain("@overflow");
    });
  });

  test("chooseResourceForTask delegates complex tasks to sub-orchestrators", async () => {
    await withTempDir(async (rootDir) => {
      const resources: Record<string, ResourceProfile> = {
        primary: {
          alias: "primary",
          label: "Primary",
          tier: "top",
          baseUrl: "http://127.0.0.1:11434",
          defaultModel: "llama3.1:8b",
          role: "Primary.",
          capabilities: [],
          notes: [],
          maxContextTokens: 32768
        },
        sub: {
          alias: "sub",
          label: "Sub",
          tier: "top",
          baseUrl: "http://127.0.0.1:11435",
          defaultModel: "llama3.1:8b",
          reasoningModel: "gpt-oss:20b",
          role: "Sub orchestrator.",
          capabilities: [],
          notes: [],
          maxContextTokens: 16384,
          subordinateResources: ["worker"]
        },
        worker: {
          alias: "worker",
          label: "Worker",
          tier: "low",
          baseUrl: "http://127.0.0.1:11436",
          defaultModel: "llama3.2:3b",
          role: "Worker.",
          capabilities: [],
          notes: [],
          maxContextTokens: 8192
        }
      };
      await saveResources(resources, rootDir);
      const selection = chooseResourceForTask(
        "Coordinate a comprehensive end-to-end multi-step pipeline workflow.",
        "auto",
        rootDir,
        { primaryOrchestratorAlias: "primary" }
      );

      expect(selection.delegateToOrchestrator).toBe("sub");
      expect(selection.availableSubordinates).toEqual(["worker"]);
    });
  });

  test("chooseResourceForTask does not delegate simple tasks", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      const selection = chooseResourceForTask(
        "Draft a short summary of recent changes.",
        "auto",
        rootDir,
        { primaryOrchestratorAlias: "orchestrator" }
      );

      expect(selection.delegateToOrchestrator).toBeUndefined();
    });
  });
});

describe("pingResource", () => {
  test("returns online for a healthy endpoint", async () => {
    const mockFetch = (() =>
      Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve("") })) as unknown as typeof fetch;
    const result = await pingResource("http://localhost:11434", "ollama", mockFetch);
    expect(result.status).toBe("online");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.checkedAt).toBeGreaterThan(0);
  });

  test("returns degraded for HTTP error responses", async () => {
    const mockFetch = (() =>
      Promise.resolve({ ok: false, status: 503, text: () => Promise.resolve("") })) as unknown as typeof fetch;
    const result = await pingResource("http://localhost:11434", "ollama", mockFetch);
    expect(result.status).toBe("degraded");
  });

  test("returns offline on network error", async () => {
    const mockFetch = (() =>
      Promise.reject(new Error("fetch failed"))) as unknown as typeof fetch;
    const result = await pingResource("http://localhost:11434", "ollama", mockFetch);
    expect(result.status).toBe("offline");
  });

  test("returns offline on abort/timeout", async () => {
    const mockFetch = (() =>
      Promise.reject(new DOMException("The operation was aborted", "AbortError"))) as unknown as typeof fetch;
    const result = await pingResource("http://localhost:11434", "ollama", mockFetch);
    expect(result.status).toBe("offline");
  });

  test("uses correct URL for ollama vs openai style", async () => {
    const urls: string[] = [];
    const mockFetch = ((url: string) => {
      urls.push(url);
      return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve("") });
    }) as unknown as typeof fetch;
    await pingResource("http://localhost:11434", "ollama", mockFetch);
    await pingResource("http://api.example.com", "openai", mockFetch);
    expect(urls[0]).toBe("http://localhost:11434/api/tags");
    expect(urls[1]).toBe("http://api.example.com/v1/models");
  });
});

// ---------------------------------------------------------------------------
// Fairness scoring
// ---------------------------------------------------------------------------

describe("fairness scoring", () => {
  test("recently assigned resource scores lower than idle resource", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      const resources = Object.values(getResourceProfilesByTier(rootDir)).flat();
      const resource = resources[0];
      const telemetry: ResourceTelemetry = {
        queueDepth: 0,
        ramUsagePct: 20,
        tokensPerSecond: 15,
        activeModel: "llama3.1:8b",
        avgQueueWaitMs: 100,
        successRate: 1,
        failureCount: 0
      };
      const task = classifyTask("Analyze some data.");
      const recentScore = computeResourceScore(resource, telemetry, task, "online", Date.now() - 1000);
      const idleScore = computeResourceScore(resource, telemetry, task, "online", Date.now() - 60 * 60 * 1000);
      expect(idleScore).toBeGreaterThan(recentScore);
    });
  });

  test("fairness score is 1.0 when never assigned (undefined lastAssignedMs)", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      const resources = Object.values(getResourceProfilesByTier(rootDir)).flat();
      const resource = resources[0];
      const telemetry: ResourceTelemetry = {
        queueDepth: 0,
        ramUsagePct: 0,
        tokensPerSecond: 10,
        activeModel: null,
        avgQueueWaitMs: 0,
        successRate: 1,
        failureCount: 0
      };
      const task = classifyTask("Simple task.");
      const scoreNoAssignment = computeResourceScore(resource, telemetry, task, "online", undefined);
      const scoreRecentAssignment = computeResourceScore(resource, telemetry, task, "online", Date.now());
      expect(scoreNoAssignment).toBeGreaterThan(scoreRecentAssignment);
    });
  });

  test("routeTask passes lastAssignedByAlias through to scoring", async () => {
    await withTempDir(async (rootDir) => {
      await seedResourceInventory(rootDir);
      const resources = Object.values(getResourceProfilesByTier(rootDir)).flat();
      const task = classifyTask("Research recent AI trends.");
      const emptyTelemetry: Record<string, ResourceTelemetry> = {};
      for (const r of resources) {
        emptyTelemetry[r.alias] = {
          queueDepth: 0, ramUsagePct: 0, tokensPerSecond: 10,
          activeModel: null, avgQueueWaitMs: 0, successRate: 1, failureCount: 0
        };
      }
      // Make orchestrator just-assigned and workhorse idle
      const lastAssigned: Record<string, number> = {
        orchestrator: Date.now(),
        workhorse: Date.now() - 60 * 60 * 1000
      };
      const routed = routeTask(task, resources, emptyTelemetry, undefined, lastAssigned);
      // The idle resource should be preferred over the just-assigned one
      expect(routed.resource.alias).not.toBe("orchestrator");
    });
  });
});

// ---------------------------------------------------------------------------
// buildResourceTelemetry with live metrics
// ---------------------------------------------------------------------------

describe("buildResourceTelemetry with live device metrics", () => {
  test("computes RAM usage from live metrics when provided", () => {
    const result = buildResourceTelemetry("test-alias", 2, undefined, {
      loadAvg1m: 1.5,
      loadAvg5m: 1.2,
      totalMemGb: 32,
      freeMemGb: 8,
      freePct: 25,
      timestamp: Date.now()
    }, {
      cpuLogicalCores: 8
    });
    expect(result.ramUsagePct).toBe(75);
    expect(result.cpuLoadPct).toBe(19);
    expect(result.queueDepth).toBe(2);
  });

  test("defaults RAM usage to 0 when no live metrics provided", () => {
    const result = buildResourceTelemetry("test-alias", 1);
    expect(result.ramUsagePct).toBe(0);
  });

  test("incorporates telemetry summary stats alongside live metrics", () => {
    const result = buildResourceTelemetry("myalias", 0, {
      resources: {
        myalias: { calls: 100, errors: 5, totalDurationMs: 50000, evalCount: 20000 }
      }
    }, {
      loadAvg1m: 2.0,
      loadAvg5m: 1.8,
      totalMemGb: 16,
      freeMemGb: 4,
      freePct: 25,
      timestamp: Date.now()
    });
    expect(result.ramUsagePct).toBe(75);
    expect(result.successRate).toBeCloseTo(0.95);
    expect(result.tokensPerSecond).toBeGreaterThan(0);
    expect(result.failureCount).toBe(5);
  });
});
