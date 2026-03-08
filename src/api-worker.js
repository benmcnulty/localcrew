import { createServer } from "node:http";

const host = process.argv[2] ?? "127.0.0.1";
const requestedPort = Number(process.argv[3] ?? "4310");
let nextRequestId = 0;
const pendingResponses = new Map();
const sseConnections = new Set();

function getApiToken() {
  const legacyTokenKey = `${"C"}RUSTY_API_TOKEN`;
  return process.env.LOCALCREW_API_TOKEN?.trim() || process.env[legacyTokenKey]?.trim() || "";
}

function getRequestApiToken(request, reqUrl) {
  const authHeader = request.headers.authorization || request.headers.Authorization || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  return bearerToken;
}

function writeJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(`${JSON.stringify(body, null, 2)}\n`);
}

const server = createServer((request, response) => {
  if (!process.send) {
    writeJson(response, 500, { error: "IPC channel unavailable." });
    return;
  }

  const remoteAddress = request.socket?.remoteAddress || "";
  const isLocalAddress = (() => {
    const raw = String(remoteAddress).trim().toLowerCase();
    const normalized = raw.startsWith("::ffff:") ? raw.slice(7) : raw;
    if (!normalized) return false;
    if (normalized === "::1") return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
    if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
    const match = normalized.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!match) return false;
    const octets = match.slice(1).map(Number);
    if (octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) return false;
    return (
      octets[0] === 10 ||
      octets[0] === 127 ||
      (octets[0] === 169 && octets[1] === 254) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168)
    );
  })();
  const allowAnyNetwork = (process.env.LOCALCREW_API_NETWORK_SCOPE || "").trim().toLowerCase() === "any";
  if (!allowAnyNetwork && !isLocalAddress) {
    writeJson(response, 403, { error: "Forbidden. Local Crew only serves local-network clients by default." });
    return;
  }

  // SSE connections are handled locally — no IPC round-trip needed.
  const reqUrl = new URL(request.url ?? "/", "http://localhost");
  if (reqUrl.pathname === "/api/events") {
    // No auth check — SSE events are public for unauthenticated billboard access.
    response.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "connection": "keep-alive",
      "x-accel-buffering": "no"
    });
    response.flushHeaders?.();
    response.write("data: {\"type\":\"connected\"}\n\n");
    sseConnections.add(response);
    request.on("close", () => { sseConnections.delete(response); });
    return;
  }

  const chunks = [];
  request.on("data", (chunk) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });
  request.on("end", () => {
    const requestId = ++nextRequestId;
    pendingResponses.set(requestId, response);
    const reqHeaders = {};
    for (const [key, value] of Object.entries(request.headers)) {
      if (typeof value === "string") {
        reqHeaders[key] = value;
      }
    }
    process.send({
      type: "request",
      id: requestId,
      method: request.method ?? "GET",
      url: request.url ?? "/",
      bodyText: Buffer.concat(chunks).toString("utf8"),
      headers: reqHeaders,
      remoteAddress
    });
  });
  request.on("error", (error) => {
    writeJson(response, 500, { error: error.message });
  });
});

process.on("message", (message) => {
  if (!message || typeof message !== "object" || !("type" in message)) {
    return;
  }

  if (message.type === "response") {
    const response = pendingResponses.get(message.id);
    if (!response) {
      return;
    }

    pendingResponses.delete(message.id);
    response.writeHead(message.status, message.headers || {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    });
    response.end(message.bodyText);
    return;
  }

  if (message.type === "event-push") {
    const eventData = `data: ${JSON.stringify(message.payload)}\n\n`;
    for (const res of sseConnections) {
      try {
        res.write(eventData);
      } catch {
        sseConnections.delete(res);
      }
    }
    return;
  }

  if (message.type === "shutdown") {
    for (const res of sseConnections) {
      try { res.end(); } catch { /* ignore */ }
    }
    sseConnections.clear();
    for (const response of pendingResponses.values()) {
      writeJson(response, 503, { error: "API server shutting down." });
    }
    pendingResponses.clear();
    if (typeof server.closeAllConnections === "function") {
      server.closeAllConnections();
    }
    server.close(() => {
      process.exit(0);
    });
  }
});

process.on("disconnect", () => {
  if (typeof server.closeAllConnections === "function") {
    server.closeAllConnections();
  }
  server.close(() => {
    process.exit(0);
  });
});

server.on("error", (error) => {
  if (process.send) {
    process.send({
      type: "error",
      message: error.message
    });
  }
});

server.listen(requestedPort, host, () => {
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : requestedPort;
  if (process.send) {
    process.send({
      type: "ready",
      port
    });
  }
});
