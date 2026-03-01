import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "bun:test";

import { startApiServer } from "../src/api-server.ts";
import { CrustyApp } from "../src/app.ts";
import { parseCommand } from "../src/commands.ts";

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

const originalApiPort = process.env.CRUSTY_API_PORT;
const originalApiHost = process.env.CRUSTY_API_HOST;

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
});

describe("API server", () => {
  test("serves status, telemetry, queue, agents, hud, UI, and write actions over HTTP", async () => {
    await withTempDir(async (rootDir) => {
      process.env.CRUSTY_API_HOST = "127.0.0.1";
      process.env.CRUSTY_API_PORT = "0";

      const app = await CrustyApp.create({
        rootDir,
        fetchFn: async () => makeChatResponse("Hello from Erin"),
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

        const [status, telemetry, queue, agents, hud, dropbox, tree, file, uiHtml] = await Promise.all([
          fetch(`${api!.url}/api/status`).then((response) => response.json()),
          fetch(`${api!.url}/api/telemetry`).then((response) => response.json()),
          fetch(`${api!.url}/api/queue`).then((response) => response.json()),
          fetch(`${api!.url}/api/agents`).then((response) => response.json()),
          fetch(`${api!.url}/api/hud?tab=metrics`).then((response) => response.json()),
          fetch(`${api!.url}/api/dropbox`).then((response) => response.json()),
          fetch(`${api!.url}/api/explore/tree`).then((response) => response.json()),
          fetch(
            `${api!.url}/api/explore/file?path=${encodeURIComponent(join(rootDir, "external-memory", "inbox", "remote.md"))}`
          ).then((response) => response.json()),
          fetch(`${api!.url}/ui`).then((response) => response.text())
        ]);

        expect(status.mode).toBe("auto");
        expect(status.telemetry.totalEvents).toBeGreaterThanOrEqual(1);
        expect(telemetry.byKind["ollama.chat"]).toBeGreaterThanOrEqual(1);
        expect(queue.pending.length + queue.completed.length).toBeGreaterThanOrEqual(1);
        expect(agents.map((agent: { slug: string }) => agent.slug)).toContain("data-analyst");
        expect(hud.tab).toBe("metrics");
        expect(Array.isArray(hud.lines)).toBe(true);
        expect(commandResponse.result.lines[0]).toContain("Remote login is not implemented");
        expect(inboxWrite.result.lines[0]).toContain("Wrote inbox document");
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
