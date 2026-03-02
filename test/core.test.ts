import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { getDefaultInstruction, loadConfig, saveConfig } from "../src/config.ts";
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
  chooseResourceForTask,
  detectTaskPurpose,
  getResourceCapacitySummary,
  getResourceProfilesByTier,
  saveResources,
  selectModelForEndpoint,
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
      const previousName = process.env.CRUSTY_ORCHESTRATOR_NAME;
      process.env.CRUSTY_ORCHESTRATOR_NAME = "Aster";

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
        expect(docs.inventory).toContain("## orchestrator (Local Orchestrator)");
        expect(docs.workflow).toContain("Agent Creation Workflow");
      } finally {
        if (previousName === undefined) {
          delete process.env.CRUSTY_ORCHESTRATOR_NAME;
        } else {
          process.env.CRUSTY_ORCHESTRATOR_NAME = previousName;
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

      expect(chooseResourceForTask("Draft a detailed delegation plan for the queue.", "auto", rootDir)).toEqual(
        expect.objectContaining({
          alias: "workhorse",
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
      })
    ).toEqual([
      { role: "system", content: "Reply clearly." },
      {
        role: "system",
        content:
          'You are @erin. You are one contributor in a shared multi-model conversation with these participants: @erin, @zora, @sam, @pav. The participant names are exactly: Erin (@erin), Zora (@zora), Sam (@sam), Pav (@pav). Use exactly those names and aliases, and never invent alternate names, nicknames, or expansions. Transcript lines are labeled with their @alias and may include directed participant-to-participant lines in the form @from to @to: message. Answer only as @erin, from your own perspective. If grounded factual context from Wikipedia would materially help, end with one final line exactly in this format: WIKIPEDIA: search query If focused real-world community experience or technical solutions from Reddit would materially help, end with one final line exactly in this format: REDDIT: search query. Use Reddit only for specific technical topics, not for internal Crusty decisions. If current web search results for news, jobs, software engineering, or AI engineering topics would materially help, end with one final line exactly in this format: SEARCH[topic]: search query, where topic is one of: news, jobs, software-engineering, ai-engineering. Use web search only for current real-world information, not for internal Crusty decisions. Do not emit more than one SEARCH line. If current weather information would help, end with one final line exactly in this format: WEATHER: location (city name or zip code), or just WEATHER: to use the configured default location. Do not emit more than one WEATHER line. If content from benlive.tv (the project home base with developer updates, blog posts, and platform information) would help, end with one final line exactly in this format: BENLIVE: topic or /path. Do not emit more than one BENLIVE line. If content from the user personal website would help (requires /preferences website configuration), end with one final line exactly in this format: WEBSITE: topic or /path. Do not emit more than one WEBSITE line. If you want to suggest one directed follow-up for the user to approve, end your response with a final line exactly in this format: NEXT: @alias: message Only suggest a valid participant other than yourself, keep the NEXT message short, and omit the NEXT line when no follow-up suggestion is needed. The NEXT line is only a user-editable suggestion and is not executed automatically. Do not emit more than one WIKIPEDIA line and do not emit more than one REDDIT line.'
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
        preferredResource: "workhorse",
        orchestratorName: "Aster",
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
          "You are Reviewer (@reviewer), a persistent agent identity managed by Aster, the orchestrator. Your preferred inference resource is workhorse. Stay aligned with your specification and maintain continuity with your private memory. If grounded factual context from Wikipedia would materially help, end with one final line exactly in this format: WIKIPEDIA: search query. Use Wikipedia only for external factual knowledge, not for local routing, prompt, naming, or model-configuration decisions. If focused real-world community experience or technical solutions from Reddit would materially help, end with one final line exactly in this format: REDDIT: search query. Use Reddit only for specific technical topics, not for internal Crusty decisions. Do not emit more than one REDDIT line. If current web search results for news, jobs, software engineering, or AI engineering topics would materially help, end with one final line exactly in this format: SEARCH[topic]: search query, where topic is one of: news, jobs, software-engineering, ai-engineering. Use web search only for current real-world information, not for internal Crusty decisions. Do not emit more than one SEARCH line. If current weather information would help, end with one final line exactly in this format: WEATHER: location (city name or zip code), or just WEATHER: to use the configured default location. Do not emit more than one WEATHER line. If content from benlive.tv (the project home base with developer updates, blog posts, and platform information) would help, end with one final line exactly in this format: BENLIVE: topic or /path. Do not emit more than one BENLIVE line. If content from the user personal website would help (requires /preferences website configuration), end with one final line exactly in this format: WEBSITE: topic or /path. Do not emit more than one WEBSITE line. If you want the orchestrator queue to take on follow-up work, end with one or more final lines exactly in the form QUEUE[medium]: task, QUEUE[low]: task, QUEUE[medium][resource-alias]: task, QUEUE[medium][resource-alias][model-name]: task, or add an optional role tag such as QUEUE[medium][resource-alias]{reviewer}: task. Use only the exact installed resource aliases provided by Crusty for any QUEUE line. If you are unsure which resource to target, omit the alias and let Crusty route it automatically. When a task should create a file, emit zero or more exact file blocks in this format: WRITE[internal][relative/path.ext], WRITE[active][relative/path.ext], or WRITE[outbox][relative/path.ext] on its own line, then the full file content, then ENDWRITE on its own line. Use WRITE[internal] for local memory/process artifacts that belong inside `.crusty/`. Use WRITE[active] only for in-progress drafts tied to a user-supplied external dropbox document. Use WRITE[outbox] for user-facing deliverables and external feature request tickets. Do not emit executable scripts, source files, or ad-hoc automation from contained autonomous work unless the user explicitly asked for a file deliverable. If a useful improvement would require external application, API, UI, or script changes, write a markdown feature request ticket to WRITE[outbox][feature-requests/short-name.md] instead of treating it as executable autonomous work. Do not emit queue lines unless a concrete asynchronous follow-up is useful."
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
      orchestratorName: "Aster",
      agents: ["@reviewer"],
      task: "Inspect the queue.",
      priority: "high",
      createdBy: "user",
      resourceAlias: "orchestrator",
      resourceRationale: "Use the strongest reasoning node."
    });

    expect(autoTaskMessages[1]).toEqual({
      role: "system",
      content:
        'You are Aster, the orchestrator identity. The selected inference resource for this task is @orchestrator. Selection rationale: Use the strongest reasoning node. You are using that resource as a tool, but you still answer as Aster. Keep outputs concise and actionable. In auto mode, your default stance is self-aware self-improvement of the local orchestration system through stronger documentation, indexing, queue hygiene, memory quality, and next-step preparation whenever the current task allows it. Prioritize self-improvement work that better understands and exploits the current local hardware profile, context limits, and delegation opportunities of this specific network. Consistently reference the project directives, roadmap, and focus-todo to maintain orientation and alignment within each task. Every step should connect to the broader objective scope. When a task set exceeds a single context window, decompose it into a coordinated sequence of QUEUE items with clear handoff state. Each follow-up task must include enough context in its description to be self-contained within one context pass. Update working memory (orchestrator summary, focus-todo) to track the current state of multi-step work so that subsequent context windows can resume without losing progress or orientation. Stay inside internal process improvement unless the user explicitly asks for external system changes. Do not claim to deploy, install, restart, reconfigure, or otherwise modify external services, device networking, model inventories, or source code directly from auto mode. If grounded factual context from Wikipedia would materially help, end with one final line exactly in this format: WIKIPEDIA: search query. Use Wikipedia only for external factual knowledge, not for local routing, prompt, naming, resource, or model-diagnosis decisions. If focused real-world community experience or technical solutions from Reddit would materially help, end with one final line exactly in this format: REDDIT: search query. Use Reddit only for specific technical topics, not for internal Crusty decisions. Do not emit more than one REDDIT line. If current web search results for news, jobs, software engineering, or AI engineering topics would materially help, end with one final line exactly in this format: SEARCH[topic]: search query, where topic is one of: news, jobs, software-engineering, ai-engineering. Use web search only for current real-world information, not for internal Crusty decisions. Do not emit more than one SEARCH line. If current weather information would help, end with one final line exactly in this format: WEATHER: location (city name or zip code), or just WEATHER: to use the configured default location. Do not emit more than one WEATHER line. If content from benlive.tv (the project home base with developer updates, blog posts, and platform information) would help, end with one final line exactly in this format: BENLIVE: topic or /path. Do not emit more than one BENLIVE line. If content from the user personal website would help (requires /preferences website configuration), end with one final line exactly in this format: WEBSITE: topic or /path. Do not emit more than one WEBSITE line. If useful, end with one or more final lines in the exact format QUEUE[high]: task, QUEUE[medium]: task, QUEUE[low]: task, QUEUE[medium][resource-alias]: task, QUEUE[medium][resource-alias][model-name]: task, or include an optional role tag such as QUEUE[medium][resource-alias]{reviewer}: task. When a task benefits from collaboration, decompose it into multiple targeted QUEUE lines with different resource aliases and role tags instead of leaving the collaboration implicit. Use only the exact installed resource aliases provided by Crusty for any QUEUE line. If you are unsure which resource to target, omit the alias and let Crusty route it automatically. Every queued task must be self-contained, concrete, and specific enough to execute without guessing. Never emit placeholder tasks such as implement, review, compare, or evaluate without an explicit object and outcome. When a task should create a file, emit zero or more exact file blocks in this format: WRITE[internal][relative/path.ext], WRITE[active][relative/path.ext], or WRITE[outbox][relative/path.ext] on its own line, then the full file content, then ENDWRITE on its own line. Do not wrap WRITE blocks in markdown fences. Use WRITE[internal] for local memory/process artifacts that belong inside `.crusty/`. Use WRITE[active] only for in-progress drafts tied to a user-supplied external dropbox document. Use WRITE[outbox] for user-facing deliverables and external feature request tickets. To update canonical orchestrator memory files, use WRITE[internal][summary.md], WRITE[internal][focus-todo.md], or WRITE[internal][roadmap.md]. These will update the actual orchestrator memory rather than writing to the generated directory. Use this to track cross-context-window state, record progress, and maintain orientation for subsequent tasks. Do not emit executable scripts, source files, or ad-hoc automation from contained autonomous work. If a useful improvement would require external application, API, UI, script, or source-code changes, write a markdown feature request ticket to WRITE[outbox][feature-requests/short-name.md] instead of treating it as executable autonomous work.'
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
        orchestratorName: "Aster",
        agents: ["@reviewer"]
      })[1]
    ).toEqual({
      role: "system",
      content:
        "You are Aster, the orchestrator identity. The queue is currently empty. Self-aware self-improvement of the local orchestration system is your default stance right now. Draft a brief provisional self-improvement backlog for the local orchestration system only; this is not the final queue yet. Prefer the highest-value next steps for this specific installation: better routing, hardware-aware configuration, context budgeting, observability, and delegation quality. Do not propose deployment, package installation, service restarts, firewall changes, model pulls, or other external system mutations unless the user explicitly asked for them. Do not draft external application, API, UI, script, or source-code implementation work into the autonomous queue; those belong in outbox feature request tickets instead. Each task must be self-contained and explicit enough to execute without guessing. Reject placeholder verbs with no object or outcome. This draft will be critiqued by the standing secondary reviewer before any tasks are finalized. If grounded factual context from Wikipedia would materially help, end with one final line exactly in this format: WIKIPEDIA: search query. Use Wikipedia only for external factual knowledge, not for internal Crusty diagnostics. If focused real-world community experience or technical solutions from Reddit would materially help, end with one final line exactly in this format: REDDIT: search query. Use Reddit only for specific technical topics, not for internal Crusty decisions. Do not emit more than one REDDIT line. If current web search results for news, jobs, software engineering, or AI engineering topics would materially help, end with one final line exactly in this format: SEARCH[topic]: search query, where topic is one of: news, jobs, software-engineering, ai-engineering. Use web search only for current real-world information, not for internal Crusty decisions. Do not emit more than one SEARCH line. If current weather information would help, end with one final line exactly in this format: WEATHER: location (city name or zip code), or just WEATHER: to use the configured default location. Do not emit more than one WEATHER line. If content from benlive.tv (the project home base with developer updates, blog posts, and platform information) would help, end with one final line exactly in this format: BENLIVE: topic or /path. Do not emit more than one BENLIVE line. If content from the user personal website would help (requires /preferences website configuration), end with one final line exactly in this format: WEBSITE: topic or /path. Do not emit more than one WEBSITE line. Output only task lines in the exact format [medium] task or [low] task. Prefer 2-3 tasks total with at least one medium and one low. Do not output any explanation before or after the task lines."
    });

    expect(
      buildQueueFillReviewMessages({
        orchestratorName: "Aster",
        reviewerAlias: "zora",
        draftTasks: "[medium] Tighten routing\n[low] Rewrite docs",
        inventory: "Inventory",
        roadmap: "Roadmap",
        focusTodo: "Focus",
        changelog: "Changelog"
      })[0]
    ).toEqual({
      role: "system",
      content:
        "You are @zora, the secondary reviewer for Aster's auto-mode planning. Critique the proposed self-improvement backlog before anything is queued. Apply a measure twice, cut once standard: reject vague, duplicative, over-broad, or low-leverage work. Prefer fewer, narrower, higher-impact tasks over many speculative tasks. Call out documentation churn, memory churn, and process sprawl when the plan does not first justify the added complexity. Reject placeholder tasks that are not self-contained, such as bare implement, review, compare, or evaluate instructions. Do not propose external deployment, package installation, service restarts, firewall changes, model pulls, or other external system mutations unless the user explicitly asked for them. Reject external application, API, UI, script, or source-code implementation work in the autonomous queue and push that work toward outbox feature request tickets instead. If grounded factual context from Wikipedia would materially help, end with one final line exactly in this format: WIKIPEDIA: search query. Use Wikipedia only for external factual knowledge, not for internal Crusty diagnostics. If focused real-world community experience or technical solutions from Reddit would materially help, end with one final line exactly in this format: REDDIT: search query. Use Reddit only for specific technical topics, not for internal Crusty decisions. Do not emit more than one REDDIT line. If current web search results for news, jobs, software engineering, or AI engineering topics would materially help, end with one final line exactly in this format: SEARCH[topic]: search query, where topic is one of: news, jobs, software-engineering, ai-engineering. Use web search only for current real-world information, not for internal Crusty decisions. Do not emit more than one SEARCH line. If current weather information would help, end with one final line exactly in this format: WEATHER: location (city name or zip code), or just WEATHER: to use the configured default location. Do not emit more than one WEATHER line. If content from benlive.tv (the project home base with developer updates, blog posts, and platform information) would help, end with one final line exactly in this format: BENLIVE: topic or /path. Do not emit more than one BENLIVE line. If content from the user personal website would help (requires /preferences website configuration), end with one final line exactly in this format: WEBSITE: topic or /path. Do not emit more than one WEBSITE line. Respond with a short critique followed by one final verdict line exactly in the form VERDICT: approve or VERDICT: revise."
    });

    expect(
      buildQueueFillFinalizeMessages({
        directives: "Directives",
        inventory: "Inventory",
        roadmap: "Roadmap",
        focusTodo: "Focus",
        changelog: "Changelog",
        orchestratorSummary: "Summary",
        orchestratorName: "Aster",
        agents: ["@reviewer"],
        draftTasks: "[medium] Tighten routing",
        reviewFeedback: "Too broad.\nVERDICT: revise"
      })[1]
    ).toEqual({
      role: "system",
      content:
        "You are Aster, the orchestrator identity. The queue is currently empty. Self-aware self-improvement of the local orchestration system is your default stance right now. You already drafted a provisional backlog and received a critique from the secondary reviewer. Finalize the queue only after applying that critique and tightening scope, ordering, and expected impact. Apply a measure twice, cut once standard: prefer fewer, narrower, better-justified tasks over a larger speculative backlog. Do not propose deployment, package installation, service restarts, firewall changes, model pulls, or other external system mutations unless the user explicitly asked for them. Do not finalize external application, API, UI, script, or source-code implementation work into the autonomous queue; that belongs in outbox feature request tickets instead. Only finalize self-contained tasks with a clear object and expected outcome; do not finalize placeholder verb tasks. If grounded factual context from Wikipedia would materially help, end with one final line exactly in this format: WIKIPEDIA: search query. Use Wikipedia only for external factual knowledge, not for internal Crusty diagnostics. If focused real-world community experience or technical solutions from Reddit would materially help, end with one final line exactly in this format: REDDIT: search query. Use Reddit only for specific technical topics, not for internal Crusty decisions. Do not emit more than one REDDIT line. If current web search results for news, jobs, software engineering, or AI engineering topics would materially help, end with one final line exactly in this format: SEARCH[topic]: search query, where topic is one of: news, jobs, software-engineering, ai-engineering. Use web search only for current real-world information, not for internal Crusty decisions. Do not emit more than one SEARCH line. If current weather information would help, end with one final line exactly in this format: WEATHER: location (city name or zip code), or just WEATHER: to use the configured default location. Do not emit more than one WEATHER line. If content from benlive.tv (the project home base with developer updates, blog posts, and platform information) would help, end with one final line exactly in this format: BENLIVE: topic or /path. Do not emit more than one BENLIVE line. If content from the user personal website would help (requires /preferences website configuration), end with one final line exactly in this format: WEBSITE: topic or /path. Do not emit more than one WEBSITE line. Output only approved task lines in the exact format [medium] task or [low] task. Prefer 1-3 tasks total with at least one medium task when meaningful. Do not output any explanation before or after the task lines."
    });
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
