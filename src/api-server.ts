import { fork, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { CrustyApp } from "./app.ts";
import { getEnvBoolean, getEnvNumber, getEnvString, loadLocalEnv } from "./env.ts";

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
  url: string;
}

interface WorkerResponseMessage {
  type: "response";
  id: number;
  status: number;
  body: unknown;
}

interface WorkerShutdownMessage {
  type: "shutdown";
}

type WorkerIncomingMessage = WorkerReadyMessage | WorkerErrorMessage | WorkerRequestMessage;
type WorkerOutgoingMessage = WorkerResponseMessage | WorkerShutdownMessage;

function writeJson(
  response: import("node:http").ServerResponse<import("node:http").IncomingMessage>,
  statusCode: number,
  body: unknown
): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "cache-control": "no-store"
  });
  response.end(`${JSON.stringify(body, null, 2)}\n`);
}

function normalizeHudTab(value: string | null): "status" | "queue" | "metrics" | "detail" {
  return value === "queue" || value === "metrics" || value === "detail" ? value : "status";
}

async function buildApiPayload(app: CrustyApp, requestUrl: URL): Promise<{ status: number; body: unknown }> {
  if (requestUrl.pathname === "/api/health") {
    return { status: 200, body: { ok: true } };
  }

  if (requestUrl.pathname === "/api/status") {
    return { status: 200, body: await app.getStatusSnapshot() };
  }

  if (requestUrl.pathname === "/api/hud") {
    const tab = normalizeHudTab(requestUrl.searchParams.get("tab"));
    return {
      status: 200,
      body: {
        tab,
        lines: await app.getHudLines(tab)
      }
    };
  }

  if (requestUrl.pathname === "/api/queue") {
    return { status: 200, body: await app.getQueueSnapshot() };
  }

  if (requestUrl.pathname === "/api/telemetry") {
    return { status: 200, body: await app.getTelemetrySnapshot() };
  }

  if (requestUrl.pathname === "/api/audit") {
    const limit = Math.max(1, Math.min(200, Number(requestUrl.searchParams.get("limit") ?? "20")));
    return {
      status: 200,
      body: await app.getAuditSnapshot(Number.isFinite(limit) ? limit : 20)
    };
  }

  if (requestUrl.pathname === "/api/agents") {
    return { status: 200, body: await app.getAgentsSnapshot() };
  }

  return { status: 404, body: { error: "Not found." } };
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
          const payload = await buildApiPayload(app, new URL(message.url, "http://localhost"));
          if (child.connected) {
            child.send({
              type: "response",
              id: message.id,
              status: payload.status,
              body: payload.body
            } satisfies WorkerOutgoingMessage);
          }
        } catch (error) {
          if (child.connected) {
            child.send({
              type: "response",
              id: message.id,
              status: 500,
              body: { error: (error as Error).message }
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
  return new Response(`${JSON.stringify(body, null, 2)}\n`, {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "cache-control": "no-store"
    }
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

    if (request.method !== "GET") {
      return buildJsonResponse(405, { error: "Method not allowed." });
    }

    try {
      const payload = await buildApiPayload(app, url);
      return buildJsonResponse(payload.status, payload.body);
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
    if (request.method !== "GET") {
      writeJson(response, 405, { error: "Method not allowed." });
      return;
    }

    try {
      const url = new URL(request.url ?? "/", `http://${host}:${requestedPort}`);
      const payload = await buildApiPayload(app, url);
      writeJson(response, payload.status, payload.body);
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
