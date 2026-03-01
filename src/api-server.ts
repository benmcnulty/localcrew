import { fork, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { CrustyApp } from "./app.ts";
import { CommandParseError, parseCommand } from "./commands.ts";
import { getEnvBoolean, getEnvNumber, getEnvString, loadLocalEnv } from "./env.ts";
import { getGuiHtml, getGuiScript, getGuiStyles } from "./gui.ts";

export interface ApiServerHandle {
  url: string;
  close(): Promise<void>;
}

interface WorkerReadyMessage {
  type: "ready";
  port: number;
}

interface WorkerErrorMessage {
  type: "error";
  message: string;
}

interface WorkerRequestMessage {
  type: "request";
  id: number;
  method: string;
  url: string;
  bodyText: string;
}

interface WorkerResponseMessage {
  type: "response";
  id: number;
  status: number;
  headers?: Record<string, string>;
  bodyText: string;
}

interface WorkerShutdownMessage {
  type: "shutdown";
}

type WorkerIncomingMessage = WorkerReadyMessage | WorkerErrorMessage | WorkerRequestMessage;
type WorkerOutgoingMessage = WorkerResponseMessage | WorkerShutdownMessage;

interface ApiRequest {
  method: string;
  url: URL;
  bodyText: string;
}

interface ApiResponsePayload {
  status: number;
  headers: Record<string, string>;
  bodyText: string;
}

function writeJson(
  response: import("node:http").ServerResponse<import("node:http").IncomingMessage>,
  statusCode: number,
  body: unknown
): void {
  const payload = jsonResponse(statusCode, body);
  response.writeHead(payload.status, payload.headers);
  response.end(payload.bodyText);
}

function normalizeHudTab(value: string | null): "status" | "queue" | "metrics" | "detail" {
  return value === "queue" || value === "metrics" || value === "detail" ? value : "status";
}

function jsonResponse(status: number, body: unknown): ApiResponsePayload {
  return {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "cache-control": "no-store"
    },
    bodyText: `${JSON.stringify(body, null, 2)}\n`
  };
}

function textResponse(
  status: number,
  bodyText: string,
  contentType: string
): ApiResponsePayload {
  return {
    status,
    headers: {
      "content-type": contentType,
      "access-control-allow-origin": "*",
      "cache-control": "no-store"
    },
    bodyText
  };
}

function parseJsonBody<T>(bodyText: string): T {
  try {
    return JSON.parse(bodyText || "{}") as T;
  } catch (error) {
    throw new Error(`Invalid JSON body: ${(error as Error).message}`);
  }
}

async function buildApiResponse(app: CrustyApp, request: ApiRequest): Promise<ApiResponsePayload> {
  if (request.method === "GET" && (request.url.pathname === "/" || request.url.pathname === "/ui")) {
    return textResponse(200, getGuiHtml(), "text/html; charset=utf-8");
  }

  if (request.method === "GET" && request.url.pathname === "/ui/app.js") {
    return textResponse(200, getGuiScript(), "text/javascript; charset=utf-8");
  }

  if (request.method === "GET" && request.url.pathname === "/ui/styles.css") {
    return textResponse(200, getGuiStyles(), "text/css; charset=utf-8");
  }

  if (request.method === "GET" && request.url.pathname === "/api/health") {
    return jsonResponse(200, { ok: true });
  }

  if (request.method === "GET" && request.url.pathname === "/api/status") {
    return jsonResponse(200, await app.getStatusSnapshot());
  }

  if (request.method === "GET" && request.url.pathname === "/api/hud") {
    const tab = normalizeHudTab(request.url.searchParams.get("tab"));
    return jsonResponse(200, {
      tab,
      lines: await app.getHudLines(tab)
    });
  }

  if (request.method === "GET" && request.url.pathname === "/api/queue") {
    return jsonResponse(200, await app.getQueueSnapshot());
  }

  if (request.method === "GET" && request.url.pathname === "/api/telemetry") {
    return jsonResponse(200, await app.getTelemetrySnapshot());
  }

  if (request.method === "GET" && request.url.pathname === "/api/audit") {
    const limit = Math.max(1, Math.min(200, Number(request.url.searchParams.get("limit") ?? "20")));
    return jsonResponse(200, await app.getAuditSnapshot(Number.isFinite(limit) ? limit : 20));
  }

  if (request.method === "GET" && request.url.pathname === "/api/agents") {
    return jsonResponse(200, await app.getAgentsSnapshot());
  }

  if (request.method === "GET" && request.url.pathname === "/api/dropbox") {
    return jsonResponse(200, await app.getDropboxSnapshot());
  }

  if (request.method === "GET" && request.url.pathname === "/api/explore/tree") {
    return jsonResponse(200, await app.getExploreTree());
  }

  if (request.method === "GET" && request.url.pathname === "/api/explore/file") {
    const path = request.url.searchParams.get("path");
    if (!path) {
      return jsonResponse(400, { error: "The path query parameter is required." });
    }

    return jsonResponse(200, await app.readExploreFile(path));
  }

  if (request.method === "POST" && request.url.pathname === "/api/command") {
    const body = parseJsonBody<{ input?: unknown }>(request.bodyText);
    if (typeof body.input !== "string" || body.input.trim() === "") {
      return jsonResponse(400, { error: "The input field is required." });
    }

    try {
      const result = await app.execute(parseCommand(body.input));
      return jsonResponse(200, { result });
    } catch (error) {
      if (error instanceof CommandParseError) {
        return jsonResponse(400, { error: error.message });
      }
      throw error;
    }
  }

  if (request.method === "POST" && request.url.pathname === "/api/edit") {
    const body = parseJsonBody<{ kind?: unknown; target?: unknown; text?: unknown }>(request.bodyText);
    if (typeof body.target !== "string" || typeof body.text !== "string") {
      return jsonResponse(400, { error: "The target and text fields are required." });
    }

    if (body.kind === "instructions") {
      return jsonResponse(200, {
        result: await app.updateInstructions(body.target, body.text)
      });
    }

    if (body.kind === "agentSpec") {
      return jsonResponse(200, {
        result: await app.updateAgentSpec(body.target, body.text)
      });
    }

    return jsonResponse(400, { error: "Unknown edit kind." });
  }

  if (request.method === "POST" && request.url.pathname === "/api/agent/create") {
    const body = parseJsonBody<{
      name?: unknown;
      summary?: unknown;
      mission?: unknown;
      style?: unknown;
      skills?: unknown;
      preferredResource?: unknown;
    }>(request.bodyText);
    return jsonResponse(200, {
      result: await app.createAgentFromWorkflow({
        name: typeof body.name === "string" ? body.name : "",
        summary: typeof body.summary === "string" ? body.summary : "",
        mission: typeof body.mission === "string" ? body.mission : "",
        style: typeof body.style === "string" ? body.style : "",
        skills: typeof body.skills === "string" ? body.skills : "",
        preferredResource: typeof body.preferredResource === "string" ? body.preferredResource : ""
      })
    });
  }

  if (request.method === "POST" && request.url.pathname === "/api/dropbox/inbox") {
    const body = parseJsonBody<{ filename?: unknown; content?: unknown }>(request.bodyText);
    if (typeof body.filename !== "string" || typeof body.content !== "string") {
      return jsonResponse(400, { error: "The filename and content fields are required." });
    }

    return jsonResponse(200, {
      result: await app.createInboxDocument(body.filename, body.content)
    });
  }

  if (request.method === "POST" && request.url.pathname === "/api/login") {
    return jsonResponse(501, {
      error: "Remote login is not implemented in local Crusty yet. See the remote portal docs and handoff spec."
    });
  }

  return jsonResponse(404, { error: "Not found." });
}

async function startNodeWorkerApi(
  app: CrustyApp,
  host: string,
  requestedPort: number,
  warn: (message: string) => void
): Promise<ApiServerHandle | null> {
  const workerPath = resolve(dirname(fileURLToPath(import.meta.url)), "api-worker.js");
  const child = fork(workerPath, [host, String(requestedPort)], {
    execPath: "node",
    stdio: ["ignore", "ignore", "ignore", "ipc"]
  });

  return await new Promise<ApiServerHandle | null>((resolveHandle) => {
    let settled = false;

    const cleanup = (): void => {
      child.off("message", onMessage);
      child.off("error", onError);
      child.off("exit", onExit);
    };

    const finish = (handle: ApiServerHandle | null): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolveHandle(handle);
    };

    const onMessage = async (message: WorkerIncomingMessage): Promise<void> => {
      if (!message || typeof message !== "object" || !("type" in message)) {
        return;
      }

      if (message.type === "request") {
        try {
          const payload = await buildApiResponse(app, {
            method: message.method,
            url: new URL(message.url, "http://localhost"),
            bodyText: message.bodyText
          });
          if (child.connected) {
            child.send({
              type: "response",
              id: message.id,
              status: payload.status,
              headers: payload.headers,
              bodyText: payload.bodyText
            } satisfies WorkerOutgoingMessage);
          }
        } catch (error) {
          if (child.connected) {
            child.send({
              type: "response",
              id: message.id,
              status: 500,
              headers: jsonResponse(500, { error: (error as Error).message }).headers,
              bodyText: jsonResponse(500, { error: (error as Error).message }).bodyText
            } satisfies WorkerOutgoingMessage);
          }
        }
        return;
      }

      if (message.type === "error") {
        warn(`HTTP API failed to start on ${host}:${requestedPort}: ${message.message}`);
        finish(null);
        return;
      }

      if (message.type === "ready") {
        finish({
          url: `http://${host}:${message.port}`,
          close: async () =>
            await new Promise<void>((resolveClose) => {
              const handleExit = (): void => {
                child.off("exit", handleExit);
                resolveClose();
              };

              child.on("exit", handleExit);
              if (child.connected) {
                child.send({ type: "shutdown" } satisfies WorkerOutgoingMessage);
                return;
              }

              resolveClose();
            })
        });
      }
    };

    const onError = (error: Error): void => {
      warn(`HTTP API failed to start on ${host}:${requestedPort}: ${error.message}`);
      finish(null);
    };

    const onExit = (code: number | null, signal: NodeJS.Signals | null): void => {
      if (settled) {
        return;
      }

      warn(
        `HTTP API failed to start on ${host}:${requestedPort}: worker exited (${signal ?? code ?? "unknown"}).`
      );
      finish(null);
    };

    child.on("message", onMessage);
    child.on("error", onError);
    child.on("exit", onExit);
  });
}

function buildJsonResponse(status: number, body: unknown): Response {
  const payload = jsonResponse(status, body);
  return new Response(payload.bodyText, {
    status: payload.status,
    headers: payload.headers
  });
}

function buildFetchResponse(payload: ApiResponsePayload): Response {
  return new Response(payload.bodyText, {
    status: payload.status,
    headers: payload.headers
  });
}

function startVirtualApiServer(
  app: CrustyApp,
  warn: (message: string) => void
): ApiServerHandle | null {
  const originalFetch = globalThis.fetch;
  if (typeof originalFetch !== "function") {
    return null;
  }

  const origin = `http://crusty-local-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}.invalid`;
  const wrappedFetch: typeof fetch = async (input, init) => {
    const request = input instanceof Request && init === undefined ? input : new Request(input, init);
    const url = new URL(request.url);

    if (url.origin !== origin) {
      return await originalFetch(input, init);
    }

    try {
      const payload = await buildApiResponse(app, {
        method: request.method,
        url,
        bodyText: await request.text()
      });
      return buildFetchResponse(payload);
    } catch (error) {
      return buildJsonResponse(500, { error: (error as Error).message });
    }
  };

  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: wrappedFetch
  });

  warn(`HTTP API socket unavailable. Using in-process API transport at ${origin}.`);
  return {
    url: origin,
    close: async () => {
      Object.defineProperty(globalThis, "fetch", {
        configurable: true,
        writable: true,
        value: originalFetch
      });
    }
  };
}

export async function startApiServer(
  app: CrustyApp,
  options: {
    rootDir?: string;
    warn?: (message: string) => void;
  } = {}
): Promise<ApiServerHandle | null> {
  const rootDir = options.rootDir ?? process.cwd();
  const warn = options.warn ?? (() => {});
  loadLocalEnv(rootDir);

  if (!getEnvBoolean("CRUSTY_API_ENABLED", true)) {
    return null;
  }

  const host = getEnvString("CRUSTY_API_HOST", "127.0.0.1");
  const requestedPort = getEnvNumber("CRUSTY_API_PORT", 4310);
  const bunRuntime = (globalThis as { Bun?: object }).Bun;
  if (bunRuntime) {
    const handle = await startNodeWorkerApi(app, host, requestedPort, warn);
    if (handle) {
      return handle;
    }

    return startVirtualApiServer(app, warn);
  }

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${host}:${requestedPort}`);
      const bodyText = await new Promise<string>((resolveBody, rejectBody) => {
        const chunks: Buffer[] = [];
        request.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        request.on("end", () => {
          resolveBody(Buffer.concat(chunks).toString("utf8"));
        });
        request.on("error", rejectBody);
      });
      const payload = await buildApiResponse(app, {
        method: request.method ?? "GET",
        url,
        bodyText
      });
      response.writeHead(payload.status, payload.headers);
      response.end(payload.bodyText);
    } catch (error) {
      writeJson(response, 500, {
        error: (error as Error).message
      });
    }
  });

  let listeningServer: Server | null = null;
  let lastError: Error | null = null;

  listeningServer = await new Promise<Server | null>((resolve) => {
    const handleError = (error: Error): void => {
      lastError = error;
      server.off("listening", handleListening);
      resolve(null);
    };
    const handleListening = (): void => {
      server.off("error", handleError);
      resolve(server);
    };

    server.once("error", handleError);
    server.once("listening", handleListening);
    server.listen(requestedPort, host);
  });

  if (!listeningServer) {
    warn(
      `HTTP API failed to start on ${host}:${requestedPort}: ${lastError?.message ?? "Unknown error."}`
    );
    return null;
  }

  const address = listeningServer.address();
  const port = typeof address === "object" && address ? address.port : requestedPort;
  return {
    url: `http://${host}:${port}`,
    close: async () =>
      new Promise<void>((resolve, reject) => {
        listeningServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      })
  };
}
