import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "bun:test";

import { startApiServer } from "../src/api-server.ts";
import { CrustyApp } from "../src/app.ts";
import { parseCommand } from "../src/commands.ts";
import { saveResources, type ResourceProfile } from "../src/resources.ts";

async function withTempDir(run: (rootDir: string) => Promise<void>): Promise<void> {
  const rootDir = await mkdtemp(join(tmpdir(), "crusty-"));

  try {
    await run(rootDir);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

function makeChatResponse(text: string): Response {
  return new Response(
    JSON.stringify({
      message: { content: text },
      prompt_eval_count: 10,
      eval_count: 8,
      total_duration: 100_000_000
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json"
      }
    }
  );
}

async function seedResourceInventory(rootDir: string): Promise<void> {
  const resources: Record<string, ResourceProfile> = {
    orchestrator: {
      alias: "orchestrator",
      label: "Local Orchestrator",
      tier: "top",
      baseUrl: "http://127.0.0.1:11434",
      defaultModel: "llama3.1:8b",
      role: "Primary orchestration resource.",
      capabilities: ["reasoning", "planning", "chat"],
      notes: []
    },
    workhorse: {
      alias: "workhorse",
      label: "Second Device",
      tier: "top",
      baseUrl: "http://127.0.0.1:11435",
      defaultModel: "llama3.1:8b",
      role: "Top-tier drafting resource.",
      capabilities: ["chat", "drafting"],
      notes: []
    },
    helper: {
      alias: "helper",
      label: "Structured Helper",
      tier: "mid",
      baseUrl: "http://127.0.0.1:11436",
      defaultModel: "qwen2.5:0.5b",
      role: "Structured and indexing support.",
      capabilities: ["routing", "indexing"],
      notes: []
    }
  };

  await saveResources(resources, rootDir);
}

const originalApiPort = process.env.CRUSTY_API_PORT;
const originalApiHost = process.env.CRUSTY_API_HOST;
const originalApiBindHost = process.env.CRUSTY_API_BIND_HOST;
const originalApiPublicHost = process.env.CRUSTY_API_PUBLIC_HOST;

afterEach(() => {
  if (originalApiPort === undefined) {
    delete process.env.CRUSTY_API_PORT;
  } else {
    process.env.CRUSTY_API_PORT = originalApiPort;
  }

  if (originalApiHost === undefined) {
    delete process.env.CRUSTY_API_HOST;
  } else {
    process.env.CRUSTY_API_HOST = originalApiHost;
  }

  if (originalApiBindHost === undefined) {
    delete process.env.CRUSTY_API_BIND_HOST;
  } else {
    process.env.CRUSTY_API_BIND_HOST = originalApiBindHost;
  }

  if (originalApiPublicHost === undefined) {
    delete process.env.CRUSTY_API_PUBLIC_HOST;
  } else {
    process.env.CRUSTY_API_PUBLIC_HOST = originalApiPublicHost;
  }
});

describe("API server", () => {
  test("serves status, telemetry, queue, agents, hud, UI, and write actions over HTTP", async () => {
    await withTempDir(async (rootDir) => {
      process.env.CRUSTY_API_HOST = "127.0.0.1";
      process.env.CRUSTY_API_PORT = "0";
      process.env.CRUSTY_API_BIND_HOST = "127.0.0.1";
      await seedResourceInventory(rootDir);

      const app = await CrustyApp.create({
        rootDir,
        fetchFn: async (input) => {
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
                      }
                    ]
                  : [
                      {
                        name: "llama3.1:8b",
                        details: { parameter_size: "8.0B", quantization_level: "Q4_K_M" }
                      }
                    ]
              }),
              { status: 200, headers: { "content-type": "application/json" } }
            );
          }

          return makeChatResponse("Hello from Erin");
        },
        speakFn: () => {}
      });

      await app.execute(parseCommand("Hello Erin"));
      await app.execute(parseCommand("/auto"));
      await app.execute(parseCommand("Queue telemetry analysis."));

      const api = await startApiServer(app, { rootDir });
      expect(api).not.toBeNull();

      try {
        const commandResponse = await fetch(`${api!.url}/api/command`, {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({ input: "/login" })
        }).then((response) => response.json());

        const inboxWrite = await fetch(`${api!.url}/api/dropbox/inbox`, {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({ filename: "remote.md", content: "# Remote spec" })
        }).then((response) => response.json());

        const resourceAdd = await fetch(`${api!.url}/api/resources`, {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            alias: "overflow",
            label: "Overflow Node",
            baseUrl: "http://127.0.0.1:11437",
            tier: "low"
          })
        }).then((response) => response.json());
        const resourceRefresh = await fetch(`${api!.url}/api/resources/refresh`, {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            alias: "overflow"
          })
        }).then((response) => response.json());
        const resourceSync = await fetch(`${api!.url}/api/resources/sync`, {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            alias: "studio",
            label: "LM Studio",
            baseUrl: "http://127.0.0.1:1234",
            apiStyle: "openai",
            apiKeyEnv: "OPENAI_API_KEY",
            deviceId: "studio-device-1",
            tier: "mid",
            hostName: "studio-box",
            platform: "linux",
            cpuLogicalCores: 12,
            ramGb: 32,
            availableModels: ["openai/gpt-oss-20b", "text-embedding-model"],
            defaultModel: "openai/gpt-oss-20b",
            toolsModel: "openai/gpt-oss-20b",
            embeddingModel: "text-embedding-model"
          })
        }).then((response) => response.json());
        const participantAdd = await fetch(`${api!.url}/api/participants`, {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            alias: "reviewer",
            resourceAlias: "helper",
            nickname: "Reviewer"
          })
        }).then((response) => response.json());
        const participantEdit = await fetch(`${api!.url}/api/edit`, {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            kind: "participant",
            target: "reviewer",
            text: JSON.stringify({
              nickname: "Reviewer Prime",
              resourceAlias: "helper",
              model: "qwen2.5:0.5b"
            })
          })
        }).then((response) => response.json());
        const orchestratorRename = await fetch(`${api!.url}/api/orchestrator`, {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({ name: "Aster" })
        }).then((response) => response.json());

        const [
          status,
          telemetry,
          queue,
          agents,
          hud,
          chatConfig,
          resources,
          participants,
          models,
          dropbox,
          tree,
          file,
          uiHtml
        ] = await Promise.all([
          fetch(`${api!.url}/api/status`).then((response) => response.json()),
          fetch(`${api!.url}/api/telemetry`).then((response) => response.json()),
          fetch(`${api!.url}/api/queue`).then((response) => response.json()),
          fetch(`${api!.url}/api/agents`).then((response) => response.json()),
          fetch(`${api!.url}/api/hud?tab=metrics`).then((response) => response.json()),
          fetch(`${api!.url}/api/chat-config`).then((response) => response.json()),
          fetch(`${api!.url}/api/resources`).then((response) => response.json()),
          fetch(`${api!.url}/api/participants`).then((response) => response.json()),
          fetch(`${api!.url}/api/models?target=%40reviewer`).then((response) => response.json()),
          fetch(`${api!.url}/api/dropbox`).then((response) => response.json()),
          fetch(`${api!.url}/api/explore/tree`).then((response) => response.json()),
          fetch(
            `${api!.url}/api/explore/file?path=${encodeURIComponent(join(rootDir, "external-memory", "inbox", "remote.md"))}`
          ).then((response) => response.json()),
          fetch(`${api!.url}/ui`).then((response) => response.text())
        ]);
        const directChat = await fetch(`${api!.url}/api/direct-chat`, {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            resourceAlias: "helper",
            model: "qwen2.5:0.5b",
            message: "Ping helper"
          })
        }).then((response) => response.json());
        const overflowDelete = await fetch(`${api!.url}/api/resources?alias=overflow`, {
          method: "DELETE"
        }).then((response) => response.json());
        const participantDelete = await fetch(`${api!.url}/api/participants?alias=reviewer`, {
          method: "DELETE"
        }).then((response) => response.json());

        expect(status.mode).toBe("auto");
        expect(status.orchestratorName).toBe("Aster");
        expect(status.telemetry.totalEvents).toBeGreaterThanOrEqual(1);
        expect(telemetry.byKind["ollama.chat"]).toBeGreaterThanOrEqual(1);
        expect(queue.pending.length + queue.completed.length).toBeGreaterThanOrEqual(1);
        expect(agents.map((agent: { slug: string }) => agent.slug)).toContain("data-analyst");
        expect(hud.tab).toBe("metrics");
        expect(Array.isArray(hud.lines)).toBe(true);
        expect(chatConfig.orchestratorName).toBe("Aster");
        expect(commandResponse.result.lines[0]).toContain("Remote login is not implemented");
        expect(inboxWrite.result.lines[0]).toContain("Wrote inbox document");
        expect(resourceAdd.result.lines[0]).toContain("Added resource @overflow");
        expect(resourceRefresh.result.lines[0]).toContain("Refreshed @overflow");
        expect(resourceSync.result.lines[0]).toContain("Added resource @studio from agent sync.");
        expect(participantAdd.result.lines[0]).toContain("Added participant @reviewer");
        expect(participantEdit.result.lines[0]).toContain("Updated participant @reviewer.");
        expect(orchestratorRename.result.lines[0]).toContain("Orchestrator profile name is now Aster.");
        expect(resources.some((resource: { alias: string }) => resource.alias === "overflow")).toBe(true);
        expect(
          resources.some(
            (resource: { alias: string; apiStyle?: string; apiKeyEnv?: string; deviceId?: string }) =>
              resource.alias === "studio" &&
              resource.apiStyle === "openai" &&
              resource.apiKeyEnv === "OPENAI_API_KEY" &&
              resource.deviceId === "studio-device-1"
          )
        ).toBe(true);
        expect(participants).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              alias: "reviewer",
              nickname: "Reviewer Prime",
              resourceAlias: "helper",
              model: "qwen2.5:0.5b"
            })
          ])
        );
        expect(models.resourceAlias).toBe("helper");
        expect(models.models.map((model: { name: string }) => model.name)).toContain("qwen2.5:0.5b");
        expect(directChat.result.lines[0]).toBe("@helper/qwen2.5:0.5b: Hello from Erin");
        expect(overflowDelete.result.lines[0]).toContain("Removed resource @overflow.");
        expect(participantDelete.result.lines[0]).toContain("Removed participant @reviewer.");
        expect(dropbox.inbox.map((entry: { relativePath: string }) => entry.relativePath)).toContain("remote.md");
        expect(tree.lines.some((line: string) => line.includes("external-memory"))).toBe(true);
        expect(file.content).toContain("Crusty-Status: inbox");
        expect(uiHtml).toContain("Local prototype UI");
      } finally {
        await api!.close();
      }
    });
  });
});
