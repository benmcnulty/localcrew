/**
 * Minimal HTTP server that serves the GUI HTML pages for Playwright testing.
 * Does NOT require the full LocalCrewApp or REPL — just the static HTML/CSS/JS.
 *
 * Usage: bun run scripts/test-gui-server.ts
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { getGuiHtml, getGuiStyles, getGuiScript, getDisplayHtml } from "../src/gui.ts";

const PORT = 4399;

// Mock API responses for testing
const mockStatus = {
  orchestratorName: "TestCrew",
  mode: "command",
  auto: { busy: false, pendingCount: 3, completedCount: 12 },
  nextTask: { content: "Analyze market trends" },
  lastCompleted: { content: "Generate weekly report" },
  telemetry: { totalEvents: 42, totalTokens: 15000 },
  activeResources: ["cap", "zora"],
};

const mockResources = [
  { alias: "cap", label: "Primary GPU", baseUrl: "http://localhost:11434", tier: "top", apiStyle: "ollama", models: ["llama3.2"], hardware: { vram: "24GB" } },
  { alias: "zora", label: "Backup CPU", baseUrl: "http://10.0.0.2:11434", tier: "mid", apiStyle: "ollama", models: ["mistral"], hardware: { vram: "8GB" } },
];

const mockParticipants = [
  { alias: "erin", nickname: "Erin", resource: "cap", model: "llama3.2", instructions: "Helpful assistant" },
  { alias: "zora", nickname: "Zora", resource: "zora", model: "mistral", instructions: "Creative writer" },
];

const mockQueue = {
  pending: [
    { id: 1, content: "Analyze market trends", priority: "normal" },
    { id: 2, content: "Write documentation", priority: "low" },
    { id: 3, content: "Review code changes", priority: "high" },
  ],
  completed: [
    { id: 0, content: "Generate weekly report", completedAt: new Date().toISOString() },
  ],
};

const mockHealth = { ok: true };

const mockAudit = {
  recentEvents: [
    { type: "task-complete", timestamp: new Date().toISOString(), content: "Generated report" },
    { type: "task-start", timestamp: new Date().toISOString(), content: "Analyzing data" },
  ],
  totalEvents: 42,
  totalTokens: 15000,
};

const mockDailyWork = {
  available: true,
  stale: false,
  updatedAt: new Date().toISOString(),
  content: "# Daily Work Briefing\n\n## Summary\nAll systems operational. 12 tasks completed today.\n\n## Key Metrics\n- **Token throughput**: 15,000 tokens processed\n- **Active resources**: 2 online\n- **Queue depth**: 3 pending tasks\n\n## Completed Tasks\n- Generate weekly report\n- Process incoming documents\n- Update knowledge base",
};

const mockTopology = "Primary Orchestrator: TestCrew\n  ├── cap (top) — Primary GPU\n  └── zora (mid) — Backup CPU";

const mockTree = {
  tree: [
    { path: "system/", type: "directory" },
    { path: "system/state.json", type: "file" },
    { path: "external-memory/", type: "directory" },
    { path: "external-memory/README.md", type: "file" },
  ],
};

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const path = url.pathname;

  // Helper to set CORS headers (Bun's node:http types lack setHeader)
  const setCors = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = res as any;
    r.setHeader("Access-Control-Allow-Origin", "*");
    r.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    r.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  };
  setCors();

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Static GUI pages
  if (path === "/" || path === "/ui") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(getGuiHtml());
    return;
  }
  if (path === "/display") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(getDisplayHtml());
    return;
  }
  if (path === "/ui/app.js") {
    res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
    res.end(getGuiScript());
    return;
  }
  if (path === "/ui/styles.css") {
    res.writeHead(200, { "Content-Type": "text/css; charset=utf-8" });
    res.end(getGuiStyles());
    return;
  }

  // Mock API endpoints
  if (path === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(mockHealth));
    return;
  }
  if (path === "/api/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(mockStatus));
    return;
  }
  if (path === "/api/resources") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(mockResources));
    return;
  }
  if (path === "/api/participants") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(mockParticipants));
    return;
  }
  if (path === "/api/queue") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(mockQueue));
    return;
  }
  if (path === "/api/audit") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(mockAudit));
    return;
  }
  if (path === "/api/daily-work") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(mockDailyWork));
    return;
  }
  if (path === "/api/topology") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ output: mockTopology }));
    return;
  }
  if (path === "/api/explore/tree") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(mockTree));
    return;
  }
  if (path === "/api/chat-config") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ participants: mockParticipants, resources: mockResources }));
    return;
  }
  if (path === "/api/dropbox") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ inbox: [], active: [], outbox: [] }));
    return;
  }
  if (path.startsWith("/api/view/")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ output: "Mock view data for " + path }));
    return;
  }
  if (path === "/api/hud") {
    const tab = url.searchParams.get("tab") || "status";
    const mockLines: Record<string, string[]> = {
      status: ["Mode: command", "Resources: 2 online", "Queue: 3 pending"],
      queue: ["Pending: 3 tasks", "1. Analyze market trends", "2. Write documentation", "3. Review code changes"],
      metrics: ["Events: 42", "Tokens: 15,000", "Uptime: 2h 30m"],
      detail: ["Orchestrator: TestCrew", "Resources: cap (top), zora (mid)"],
    };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ lines: mockLines[tab] || ["No data for tab: " + tab] }));
    return;
  }
  if (path === "/api/models") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ models: ["llama3.2", "mistral", "phi3"] }));
    return;
  }
  if (path === "/api/events") {
    // SSE endpoint — send initial state then keep alive
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });
    const stateEvent = JSON.stringify({
      type: "state",
      orchestratorName: mockStatus.orchestratorName,
      mode: mockStatus.mode,
      auto: mockStatus.auto,
      nextTask: mockStatus.nextTask,
      lastCompleted: mockStatus.lastCompleted,
      activeResources: mockStatus.activeResources,
      telemetry: mockStatus.telemetry,
    });
    res.write(`data: ${stateEvent}\n\n`);
    return;
  }

  // Generic POST handler — return success for any command/form submission
  if (req.method === "POST") {
    let body = "";
    req.on("data", (chunk: unknown) => { body += String(chunk); });
    req.on("end", () => {
      let parsed: Record<string, string> = {};
      try { parsed = JSON.parse(body); } catch {}
      const input = parsed.input ?? "";

      // Special test commands that trigger modals
      if (input === "/test-edit") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          result: {
            lines: ["Opening edit modal..."],
            errors: [],
            editRequest: {
              prompt: "Edit resource configuration",
              initialText: '{\n  "alias": "cap",\n  "tier": "top",\n  "label": "Primary GPU"\n}',
            },
          },
        }));
        return;
      }

      if (input === "/test-workflow") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          result: {
            lines: ["Opening workflow modal..."],
            errors: [],
            workflowRequest: {
              introLines: ["Create a new agent to join your crew."],
              questions: [
                { key: "name", prompt: "Agent name" },
                { key: "role", prompt: "Agent role or specialty" },
              ],
            },
          },
        }));
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ result: { lines: ["Command executed successfully"], errors: [] } }));
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`GUI test server running at http://127.0.0.1:${PORT}`);
  console.log(`  Admin UI:   http://127.0.0.1:${PORT}/`);
  console.log(`  Display UI: http://127.0.0.1:${PORT}/display`);
  console.log(`  Health:     http://127.0.0.1:${PORT}/api/health`);
});
