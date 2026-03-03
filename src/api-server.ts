import { fork, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { LocalCrewApp } from "./app.ts";
import { CommandParseError, parseCommand } from "./commands.ts";
import {
  getEnvBoolean,
  getEnvNumber,
  getEnvString,
  getOptionalEnvString,
  loadLocalEnv
} from "./env.ts";
import { getDisplayHtml, getGuiHtml, getGuiScript, getGuiStyles } from "./gui.ts";

export interface ApiServerHandle {
  url: string;
  publicUrl?: string;
  close(): Promise<void>;
  pushDisplayEvent(payload: Record<string, unknown>): void;
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
  headers?: Record<string, string>;
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

interface WorkerEventPushMessage {
  type: "event-push";
  payload: Record<string, unknown>;
}

type WorkerIncomingMessage = WorkerReadyMessage | WorkerErrorMessage | WorkerRequestMessage;
type WorkerOutgoingMessage = WorkerResponseMessage | WorkerShutdownMessage | WorkerEventPushMessage;

interface ApiRequest {
  method: string;
  url: URL;
  bodyText: string;
  headers?: Record<string, string>;
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

function getCorsOrigin(): string {
  return getEnvString("LOCALCREW_API_CORS_ORIGIN", "");
}

function getApiToken(): string | undefined {
  return getOptionalEnvString("LOCALCREW_API_TOKEN");
}

function getRequestApiToken(request: ApiRequest): string {
  const authHeader = request.headers?.authorization ?? request.headers?.Authorization ?? "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  return bearerToken || (request.url.searchParams.get("token") ?? "");
}

function corsHeaders(): Record<string, string> {
  const origin = getCorsOrigin();
  if (!origin) {
    return {};
  }
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
    "access-control-allow-headers": "content-type, authorization"
  };
}

function jsonResponse(status: number, body: unknown): ApiResponsePayload {
  return {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders(),
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
      ...corsHeaders(),
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

async function buildApiResponse(
  app: LocalCrewApp,
  request: ApiRequest
): Promise<ApiResponsePayload> {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return {
      status: 204,
      headers: {
        ...corsHeaders(),
        "cache-control": "no-store"
      },
      bodyText: ""
    };
  }

  // Authenticate if LOCALCREW_API_TOKEN is configured
  const requiredToken = getApiToken();
  if (requiredToken) {
    // Skip auth for static UI assets, health check, and read-only display data
    const publicPaths = ["/", "/ui", "/ui/app.js", "/ui/styles.css", "/api/health", "/display", "/api/daily-work", "/api/events", "/api/status", "/api/queue", "/api/resources", "/api/audit"];
    if (!publicPaths.includes(request.url.pathname)) {
      if (getRequestApiToken(request) !== requiredToken) {
        return jsonResponse(401, { error: "Unauthorized. Provide a valid Bearer token." });
      }
    }
  }

  if (request.method === "GET" && (request.url.pathname === "/" || request.url.pathname === "/ui")) {
    return textResponse(200, getGuiHtml(), "text/html; charset=utf-8");
  }

  if (request.method === "GET" && request.url.pathname === "/display") {
    return textResponse(200, getDisplayHtml(), "text/html; charset=utf-8");
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

  if (request.method === "GET" && request.url.pathname === "/api/events") {
    return textResponse(200, 'data: {"type":"connected"}\n\n', "text/event-stream; charset=utf-8");
  }

  if (request.method === "GET" && request.url.pathname === "/api/status") {
    return jsonResponse(200, await app.getStatusSnapshot());
  }

  if (request.method === "GET" && request.url.pathname === "/api/daily-work") {
    return jsonResponse(200, await app.getDailyWorkSnapshot());
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

  if (request.method === "GET" && request.url.pathname === "/api/chat-config") {
    return jsonResponse(200, await app.getChatConfigSnapshot());
  }

  if (request.method === "GET" && request.url.pathname === "/api/resources") {
    return jsonResponse(200, await app.getResourcesSnapshot());
  }

  if (request.method === "GET" && request.url.pathname === "/api/participants") {
    return jsonResponse(200, await app.getParticipantsSnapshot());
  }

  if (request.method === "GET" && request.url.pathname === "/api/models") {
    const target = request.url.searchParams.get("target") ?? undefined;
    return jsonResponse(200, await app.getModelsSnapshot(target));
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

  if (request.method === "GET" && request.url.pathname === "/api/explore/search") {
    const query = request.url.searchParams.get("q");
    if (!query || query.trim().length === 0) {
      return jsonResponse(400, { error: "The q query parameter is required." });
    }
    if (query.length > 200) {
      return jsonResponse(400, { error: "Search query must be 200 characters or fewer." });
    }

    return jsonResponse(200, await app.searchExploreFiles(query));
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

    if (body.kind === "resource") {
      return jsonResponse(200, {
        result: await app.updateResourceSpec(body.target, body.text)
      });
    }

    if (body.kind === "participant") {
      return jsonResponse(200, {
        result: await app.updateParticipantSpec(body.target, body.text)
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

  if (request.method === "POST" && request.url.pathname === "/api/direct-chat") {
    const body = parseJsonBody<{ resourceAlias?: unknown; model?: unknown; message?: unknown }>(
      request.bodyText
    );
    if (typeof body.resourceAlias !== "string" || typeof body.message !== "string") {
      return jsonResponse(400, { error: "The resourceAlias and message fields are required." });
    }

    return jsonResponse(200, {
      result: await app.runDirectResourceChat(
        body.resourceAlias,
        body.message,
        typeof body.model === "string" ? body.model : undefined
      )
    });
  }

  if (request.method === "POST" && request.url.pathname === "/api/resources") {
    const body = parseJsonBody<{
      alias?: unknown;
      label?: unknown;
      baseUrl?: unknown;
      tier?: unknown;
      apiStyle?: unknown;
    }>(request.bodyText);
    if (
      typeof body.alias !== "string" ||
      typeof body.label !== "string" ||
      typeof body.baseUrl !== "string"
    ) {
      return jsonResponse(400, { error: "The alias, label, and baseUrl fields are required." });
    }

    return jsonResponse(200, {
      result: await app.addResourceFromInput(
        body.alias,
        body.label,
        body.baseUrl,
        body.tier === "top" || body.tier === "mid" || body.tier === "low" ? body.tier : "mid",
        body.apiStyle === "openai" || body.apiStyle === "anthropic"
          ? body.apiStyle
          : "ollama"
      )
    });
  }

  if (request.method === "POST" && request.url.pathname === "/api/resources/refresh") {
    const body = parseJsonBody<{ alias?: unknown }>(request.bodyText);
    if (typeof body.alias !== "string") {
      return jsonResponse(400, { error: "The alias field is required." });
    }

    return jsonResponse(200, {
      result: await app.refreshResourceFromEndpoint(body.alias)
    });
  }

  if (request.method === "POST" && request.url.pathname === "/api/resources/sync") {
    const body = parseJsonBody<{
      alias?: unknown;
      label?: unknown;
      baseUrl?: unknown;
      apiStyle?: unknown;
      apiKeyEnv?: unknown;
      deviceId?: unknown;
      tier?: unknown;
      hostName?: unknown;
      platform?: unknown;
      cpuLogicalCores?: unknown;
      ramGb?: unknown;
      gpuModel?: unknown;
      gpuCount?: unknown;
      totalVramGb?: unknown;
      maxContextTokens?: unknown;
      defaultModel?: unknown;
      reasoningModel?: unknown;
      codingModel?: unknown;
      toolsModel?: unknown;
      embeddingModel?: unknown;
      availableModels?: unknown;
      endpointVersion?: unknown;
      capabilities?: unknown;
      notes?: unknown;
    }>(request.bodyText);

    if (
      typeof body.alias !== "string" ||
      typeof body.label !== "string" ||
      typeof body.baseUrl !== "string"
    ) {
      return jsonResponse(400, { error: "The alias, label, and baseUrl fields are required." });
    }

    return jsonResponse(200, {
      result: await app.syncResourceReport({
        alias: body.alias,
        label: body.label,
        baseUrl: body.baseUrl,
        ...(body.apiStyle === "openai" || body.apiStyle === "ollama" || body.apiStyle === "anthropic"
          ? { apiStyle: body.apiStyle }
          : {}),
        ...(typeof body.apiKeyEnv === "string" ? { apiKeyEnv: body.apiKeyEnv } : {}),
        ...(typeof body.deviceId === "string" ? { deviceId: body.deviceId } : {}),
        ...(body.tier === "top" || body.tier === "mid" || body.tier === "low"
          ? { tier: body.tier }
          : {}),
        ...(typeof body.hostName === "string" ? { hostName: body.hostName } : {}),
        ...(typeof body.platform === "string" ? { platform: body.platform } : {}),
        ...(typeof body.cpuLogicalCores === "number"
          ? { cpuLogicalCores: body.cpuLogicalCores }
          : {}),
        ...(typeof body.ramGb === "number" ? { ramGb: body.ramGb } : {}),
        ...(typeof body.gpuModel === "string" ? { gpuModel: body.gpuModel } : {}),
        ...(typeof body.gpuCount === "number" ? { gpuCount: body.gpuCount } : {}),
        ...(typeof body.totalVramGb === "number" ? { totalVramGb: body.totalVramGb } : {}),
        ...(typeof body.maxContextTokens === "number"
          ? { maxContextTokens: body.maxContextTokens }
          : {}),
        ...(typeof body.defaultModel === "string" ? { defaultModel: body.defaultModel } : {}),
        ...(typeof body.reasoningModel === "string" ? { reasoningModel: body.reasoningModel } : {}),
        ...(typeof body.codingModel === "string" ? { codingModel: body.codingModel } : {}),
        ...(typeof body.toolsModel === "string" ? { toolsModel: body.toolsModel } : {}),
        ...(typeof body.embeddingModel === "string"
          ? { embeddingModel: body.embeddingModel }
          : {}),
        ...(Array.isArray(body.availableModels)
          ? {
              availableModels: body.availableModels.filter(
                (entry): entry is string => typeof entry === "string" && entry.trim() !== ""
              )
            }
          : {}),
        ...(typeof body.endpointVersion === "string"
          ? { endpointVersion: body.endpointVersion }
          : {}),
        ...(Array.isArray(body.capabilities)
          ? {
              capabilities: body.capabilities.filter(
                (entry): entry is string => typeof entry === "string" && entry.trim() !== ""
              )
            }
          : {}),
        ...(Array.isArray(body.notes)
          ? {
              notes: body.notes.filter(
                (entry): entry is string => typeof entry === "string" && entry.trim() !== ""
              )
            }
          : {})
      })
    });
  }

  if (request.method === "POST" && request.url.pathname === "/api/participants") {
    const body = parseJsonBody<{ alias?: unknown; resourceAlias?: unknown; nickname?: unknown }>(
      request.bodyText
    );
    if (typeof body.alias !== "string" || typeof body.resourceAlias !== "string") {
      return jsonResponse(400, { error: "The alias and resourceAlias fields are required." });
    }

    return jsonResponse(200, {
      result: await app.addParticipantFromInput(
        body.alias,
        body.resourceAlias,
        typeof body.nickname === "string" ? body.nickname : undefined
      )
    });
  }

  if (request.method === "POST" && request.url.pathname === "/api/orchestrator") {
    const body = parseJsonBody<{ name?: unknown }>(request.bodyText);
    if (typeof body.name !== "string") {
      return jsonResponse(400, { error: "The name field is required." });
    }

    return jsonResponse(200, {
      result: await app.updateOrchestratorProfileName(body.name)
    });
  }

  if (request.method === "DELETE" && request.url.pathname === "/api/resources") {
    const alias = request.url.searchParams.get("alias");
    if (!alias) {
      return jsonResponse(400, { error: "The alias query parameter is required." });
    }

    return jsonResponse(200, {
      result: await app.removeResourceConfig(alias)
    });
  }

  if (request.method === "DELETE" && request.url.pathname === "/api/participants") {
    const alias = request.url.searchParams.get("alias");
    if (!alias) {
      return jsonResponse(400, { error: "The alias query parameter is required." });
    }

    return jsonResponse(200, {
      result: await app.removeParticipantConfig(alias)
    });
  }

  if (request.method === "POST" && request.url.pathname === "/api/login") {
    return jsonResponse(501, {
      error: "Remote login is not implemented in Local Crew yet. See the remote portal docs and handoff spec."
    });
  }

  return jsonResponse(404, { error: "Not found." });
}

async function startNodeWorkerApi(
  app: LocalCrewApp,
  bindHost: string,
  requestedPort: number,
  localHost: string,
  publicHost: string | undefined,
  warn: (message: string) => void
): Promise<ApiServerHandle | null> {
  const workerPath = resolve(dirname(fileURLToPath(import.meta.url)), "api-worker.js");
  const child = fork(workerPath, [bindHost, String(requestedPort)], {
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
            bodyText: message.bodyText,
            headers: message.headers
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
        warn(`HTTP API failed to start on ${bindHost}:${requestedPort}: ${message.message}`);
        finish(null);
        return;
      }

      if (message.type === "ready") {
        finish({
          url: `http://${localHost}:${message.port}`,
          ...(publicHost && publicHost !== localHost
            ? { publicUrl: `http://${publicHost}:${message.port}` }
            : {}),
          pushDisplayEvent: (payload: Record<string, unknown>): void => {
            if (child.connected) {
              child.send({ type: "event-push", payload } satisfies WorkerOutgoingMessage);
            }
          },
          close: async () =>
            await new Promise<void>((resolveClose) => {
              let timeout: ReturnType<typeof setTimeout> | null = null;
              const handleExit = (): void => {
                if (timeout) {
                  clearTimeout(timeout);
                }
                child.off("exit", handleExit);
                resolveClose();
              };

              child.on("exit", handleExit);
              if (child.connected) {
                child.send({ type: "shutdown" } satisfies WorkerOutgoingMessage);
                timeout = setTimeout(() => {
                  if (!child.killed) {
                    child.kill();
                  }
                }, 500);
                return;
              }

              resolveClose();
            })
        });
      }
    };

    const onError = (error: Error): void => {
      warn(`HTTP API failed to start on ${bindHost}:${requestedPort}: ${error.message}`);
      finish(null);
    };

    const onExit = (code: number | null, signal: NodeJS.Signals | null): void => {
      if (settled) {
        return;
      }

      warn(
        `HTTP API failed to start on ${bindHost}:${requestedPort}: worker exited (${signal ?? code ?? "unknown"}).`
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
  app: LocalCrewApp,
  warn: (message: string) => void
): ApiServerHandle | null {
  const originalFetch = globalThis.fetch;
  if (typeof originalFetch !== "function") {
    return null;
  }

  const origin = `http://localcrew-local-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}.invalid`;
  const wrappedFetch: typeof fetch = async (input, init) => {
    const request = input instanceof Request && init === undefined ? input : new Request(input, init);
    const url = new URL(request.url);

    if (url.origin !== origin) {
      return await originalFetch(input, init);
    }

    try {
      const reqHeaders: Record<string, string> = {};
      request.headers.forEach((value, key) => {
        reqHeaders[key] = value;
      });
      const payload = await buildApiResponse(app, {
        method: request.method,
        url,
        bodyText: await request.text(),
        headers: reqHeaders
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
    pushDisplayEvent: () => {},
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
  app: LocalCrewApp,
  options: {
    rootDir?: string;
    warn?: (message: string) => void;
  } = {}
): Promise<ApiServerHandle | null> {
  const rootDir = options.rootDir ?? process.cwd();
  const warn = options.warn ?? (() => {});
  loadLocalEnv(rootDir);

  if (!getEnvBoolean("LOCALCREW_API_ENABLED", true)) {
    return null;
  }

  const bindHost = getEnvString("LOCALCREW_API_BIND_HOST", getEnvString("LOCALCREW_API_HOST", "127.0.0.1"));
  const localHost = bindHost === "0.0.0.0" || bindHost === "::" ? "127.0.0.1" : bindHost;
  const publicHost = getEnvString("LOCALCREW_API_PUBLIC_HOST", localHost);
  const requestedPort = getEnvNumber("LOCALCREW_API_PORT", 4310);
  const bunRuntime = (globalThis as { Bun?: object }).Bun;
  if (bunRuntime) {
    if (requestedPort === 0) {
      return startVirtualApiServer(app, warn);
    }

    const handle = await startNodeWorkerApi(app, bindHost, requestedPort, localHost, publicHost, warn);
    if (handle) {
      return handle;
    }

    return startVirtualApiServer(app, warn);
  }

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${localHost}:${requestedPort}`);
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
      const reqHeaders: Record<string, string> = {};
      for (const [key, value] of Object.entries(request.headers)) {
        if (typeof value === "string") {
          reqHeaders[key] = value;
        }
      }
      const payload = await buildApiResponse(app, {
        method: request.method ?? "GET",
        url,
        bodyText,
        headers: reqHeaders
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
  let lastErrorMessage = "Unknown error.";

  listeningServer = await new Promise<Server | null>((resolve) => {
    const handleError = (error: Error): void => {
      lastErrorMessage = error.message;
      server.off("listening", handleListening);
      resolve(null);
    };
    const handleListening = (): void => {
      server.off("error", handleError);
      resolve(server);
    };

    server.once("error", handleError);
    server.once("listening", handleListening);
    server.listen(requestedPort, bindHost);
  });

  if (!listeningServer) {
    warn(`HTTP API failed to start on ${bindHost}:${requestedPort}: ${lastErrorMessage}`);
    return null;
  }

  const address = listeningServer.address();
  const port = typeof address === "object" && address ? address.port : requestedPort;
  return {
    url: `http://${localHost}:${port}`,
    ...(publicHost && publicHost !== localHost ? { publicUrl: `http://${publicHost}:${port}` } : {}),
    pushDisplayEvent: () => {},
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
