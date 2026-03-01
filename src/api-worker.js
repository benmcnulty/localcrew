import { createServer } from "node:http";

const host = process.argv[2] ?? "127.0.0.1";
const requestedPort = Number(process.argv[3] ?? "4310");
let nextRequestId = 0;
const pendingResponses = new Map();

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
      headers: reqHeaders
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

  if (message.type === "shutdown") {
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
