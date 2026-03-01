import { existsSync, createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createInterface } from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { cpus, homedir, hostname, networkInterfaces, platform, totalmem } from "node:os";

function trimTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function normalizeAlias(value) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "agent"
  );
}

function titleCase(value) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function detectLocalIpAddress() {
  const interfaces = networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) {
        return entry.address;
      }
    }
  }

  return undefined;
}

function detectLocalMachineProfile() {
  const localIp = detectLocalIpAddress();
  return {
    hostName: hostname(),
    platform: platform(),
    cpuLogicalCores: cpus().length,
    ramGb: Math.round((totalmem() / 1024 / 1024 / 1024) * 10) / 10,
    ...(localIp ? { localIp } : {})
  };
}

function getDeviceFingerprint(machine) {
  return [
    machine.hostName || "unknown-host",
    machine.platform || "unknown-platform",
    String(machine.cpuLogicalCores || 0),
    String(machine.ramGb || 0)
  ].join("|");
}

function getStoragePaths(rootDir) {
  const storageDir = join(rootDir, ".crusty");
  const identityDir = join(homedir(), ".crusty");
  return {
    storageDir,
    identityDir,
    deviceIdPath: join(identityDir, "agent-device-id"),
    persistentReportPath: join(identityDir, "agent-setup-report.json"),
    monitorStatePath: join(identityDir, "agent-monitor-state.json"),
    monitorLogPath: join(identityDir, "agent-monitor.log")
  };
}

function getLoopbackHosts() {
  return new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
}

function normalizeRemoteAddress(value) {
  if (!value) {
    return "";
  }

  return value.startsWith("::ffff:") ? value.slice("::ffff:".length) : value;
}

function getPlatformFirewallGuidance(platformName, port, allowedHost) {
  if (platformName === "darwin") {
    return `If the orchestrator cannot reach this agent gateway on port ${port}, allow Node or Terminal in macOS Firewall and keep access limited to your private network. Expected orchestrator host: ${allowedHost}.`;
  }

  if (platformName === "win32") {
    return `If the orchestrator cannot reach this agent gateway on port ${port}, allow node.exe through Windows Defender Firewall on Private networks only and restrict access to ${allowedHost}.`;
  }

  return `If the orchestrator cannot reach this agent gateway on port ${port}, allow TCP ${port} from ${allowedHost} only in your local firewall (for example with ufw or firewalld).`;
}

function getAuthHeaders(apiStyle, apiKeyEnv) {
  if (!apiKeyEnv) {
    return {};
  }

  const apiKey = process.env[apiKeyEnv]?.trim();
  if (!apiKey) {
    throw new Error(`The env var ${apiKeyEnv} is not set in this shell.`);
  }

  if (apiStyle === "anthropic") {
    return {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    };
  }

  return {
    authorization: `Bearer ${apiKey}`
  };
}

function pickModel(names, candidates, fallback) {
  for (const candidate of candidates) {
    const exact = names.find((name) => name.toLowerCase() === candidate.toLowerCase());
    if (exact) {
      return exact;
    }
  }

  for (const candidate of candidates) {
    const partial = names.find((name) => name.toLowerCase().includes(candidate.toLowerCase()));
    if (partial) {
      return partial;
    }
  }

  return fallback ?? names[0];
}

async function probeResourceModels(baseUrl, apiStyle, apiKeyEnv) {
  const headers = getAuthHeaders(apiStyle, apiKeyEnv);

  if (apiStyle === "openai" || apiStyle === "anthropic") {
    const response = await fetch(`${trimTrailingSlash(baseUrl)}/v1/models`, {
      headers
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const body = await response.json();
    const availableModels = Array.isArray(body.data)
      ? body.data
          .map((entry) => (typeof entry?.id === "string" ? entry.id.trim() : ""))
          .filter(Boolean)
      : [];

    return {
      availableModels,
      defaultModel: pickModel(availableModels, ["gpt-4", "llama", "qwen", "gemma"], availableModels[0]),
      reasoningModel: pickModel(availableModels, ["gpt-4", "gpt-oss", "reason"], availableModels[0]),
      codingModel: pickModel(availableModels, ["coder", "code", "qwen"], undefined),
      toolsModel: pickModel(availableModels, ["tool", "json", "gemma", "qwen"], undefined),
      embeddingModel: pickModel(availableModels, ["embed"], undefined)
    };
  }

  const [versionResponse, tagsResponse] = await Promise.all([
    fetch(`${trimTrailingSlash(baseUrl)}/api/version`, { headers }),
    fetch(`${trimTrailingSlash(baseUrl)}/api/tags`, { headers })
  ]);

  if (!tagsResponse.ok) {
    throw new Error(`HTTP ${tagsResponse.status}: ${await tagsResponse.text()}`);
  }

  const version = versionResponse.ok ? await versionResponse.json() : {};
  const tags = await tagsResponse.json();
  const availableModels = Array.isArray(tags.models)
    ? tags.models
        .map((entry) => (typeof entry?.name === "string" ? entry.name.trim() : ""))
        .filter(Boolean)
    : [];

  return {
    availableModels,
    ...(typeof version.version === "string" ? { endpointVersion: version.version } : {}),
    defaultModel: pickModel(
      availableModels,
      ["llama3.1:8b", "llama3.1:latest", "llama3.2:3b", "llama3.2:latest", "gemma3:4b"],
      availableModels[0]
    ),
    reasoningModel: pickModel(availableModels, ["gpt-oss:20b", "reason"], availableModels[0]),
    codingModel: pickModel(availableModels, ["coder", "code"], undefined),
    toolsModel: pickModel(availableModels, ["gemma", "qwen", "tool"], undefined),
    embeddingModel: pickModel(availableModels, ["embed"], undefined)
  };
}

function autoTier(profile) {
  if (profile.ramGb >= 24 || profile.cpuLogicalCores >= 16) {
    return "top";
  }
  if (profile.ramGb >= 12 || profile.cpuLogicalCores >= 8) {
    return "mid";
  }
  return "low";
}

function parseSubnetPrefix(ipAddress) {
  if (!ipAddress) {
    return "";
  }

  const octets = ipAddress.split(".");
  if (octets.length !== 4) {
    return "";
  }

  return `${octets[0]}.${octets[1]}.${octets[2]}.`;
}

function parseArgs(argv) {
  let rootDir = process.cwd();
  let endpointUrl = "http://127.0.0.1:11434";
  let apiStyle = "ollama";
  let alias;
  let nickname;
  let tier;
  let orchestratorUrl;
  let apiKeyEnv;
  let agentPort;
  let once = false;
  let gpuModel;
  let gpuCount;
  let totalVramGb;
  let maxContextTokens;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--root" && next) {
      rootDir = resolve(next);
      index += 1;
      continue;
    }
    if (arg === "--host" && next) {
      endpointUrl = next;
      index += 1;
      continue;
    }
    if (
      arg === "--api-style" &&
      next &&
      (next === "ollama" || next === "openai" || next === "anthropic")
    ) {
      apiStyle = next;
      index += 1;
      continue;
    }
    if (arg === "--api-key-env" && next) {
      apiKeyEnv = next.trim();
      index += 1;
      continue;
    }
    if (arg === "--agent-port" && next) {
      agentPort = Number(next);
      index += 1;
      continue;
    }
    if (arg === "--alias" && next) {
      alias = normalizeAlias(next);
      index += 1;
      continue;
    }
    if (arg === "--nickname" && next) {
      nickname = next.trim();
      index += 1;
      continue;
    }
    if (arg === "--tier" && next && (next === "top" || next === "mid" || next === "low")) {
      tier = next;
      index += 1;
      continue;
    }
    if (arg === "--orchestrator" && next) {
      orchestratorUrl = next;
      index += 1;
      continue;
    }
    if (arg === "--once") {
      once = true;
      continue;
    }
    if (arg === "--gpu-model" && next) {
      gpuModel = next;
      index += 1;
      continue;
    }
    if (arg === "--gpu-count" && next) {
      gpuCount = Number(next);
      index += 1;
      continue;
    }
    if (arg === "--vram-gb" && next) {
      totalVramGb = Number(next);
      index += 1;
      continue;
    }
    if (arg === "--max-context" && next) {
      maxContextTokens = Number(next);
      index += 1;
    }
  }

  return {
    rootDir,
    endpointUrl,
    apiStyle,
    apiKeyEnv,
    agentPort,
    alias,
    nickname,
    tier,
    orchestratorUrl,
    gpuModel,
    gpuCount,
    totalVramGb,
    maxContextTokens,
    once
  };
}

function promptWithPrefill(promptText, initialValue = "") {
  return new Promise((resolve) => {
    const readline = createInterface({ input, output });
    readline.setPrompt(promptText);
    readline.prompt();
    if (initialValue) {
      readline.write(initialValue);
    }
    readline.on("line", (line) => {
      readline.close();
      resolve(line.trim());
    });
  });
}

async function readExistingAgentReport(rootDir) {
  const paths = getStoragePaths(rootDir);
  const candidates = [paths.persistentReportPath, join(paths.storageDir, "agent-setup-report.json")];

  for (const candidate of candidates) {
    if (!existsSync(candidate)) {
      continue;
    }

    try {
      const raw = await readFile(candidate, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch {
      // Ignore unreadable prior reports and continue.
    }
  }

  return undefined;
}

function getGatewayPort(options, existingReport) {
  if (typeof options.agentPort === "number" && Number.isFinite(options.agentPort)) {
    return options.agentPort;
  }

  if (
    existingReport &&
    typeof existingReport.gatewayPort === "number" &&
    Number.isFinite(existingReport.gatewayPort)
  ) {
    return existingReport.gatewayPort;
  }

  return 4311;
}

function getAdvertisedBaseUrl(machine, gatewayPort, localEndpoint) {
  if (!machine.localIp) {
    return trimTrailingSlash(localEndpoint);
  }

  return `http://${machine.localIp}:${gatewayPort}`;
}

function getPromptSeedOrchestratorIp(existingReport, machine) {
  if (existingReport && typeof existingReport.orchestratorUrl === "string") {
    try {
      return new URL(existingReport.orchestratorUrl).hostname;
    } catch {
      // Fall through to subnet prefix.
    }
  }

  return parseSubnetPrefix(machine.localIp);
}

async function promptForSetup(options, machine, existingReport) {
  let nickname = options.nickname;

  if (!nickname && input.isTTY && output.isTTY) {
    const initialNickname =
      existingReport && typeof existingReport.label === "string" && existingReport.label.trim() !== ""
        ? existingReport.label.trim()
        : titleCase(machine.hostName);
    nickname = await promptWithPrefill("Nickname: ", initialNickname);
  }

  return {
    nickname
  };
}

async function verifyOrchestratorConnection(orchestratorUrl) {
  const trimmedBase = orchestratorUrl.replace(/\/+$/, "");
  const healthUrl = `${trimmedBase}/api/health`;
  const statusUrl = `${trimmedBase}/api/status`;

  let healthResponse;
  try {
    healthResponse = await fetch(healthUrl);
  } catch (error) {
    throw new Error(
      `Could not reach orchestrator at ${trimmedBase}. Check that Crusty is running on the orchestrator, the IP is correct, and inbound TCP 4310 is allowed. Original error: ${error.message}`
    );
  }

  if (!healthResponse.ok) {
    throw new Error(`Orchestrator health check failed with HTTP ${healthResponse.status}.`);
  }

  return {
    baseUrl: trimmedBase,
    healthUrl,
    statusUrl,
    orchestratorHost: new URL(trimmedBase).hostname
  };
}

async function resolveVerifiedOrchestratorUrl(initialUrl, machine, existingReport) {
  if (initialUrl) {
    return {
      orchestratorUrl: initialUrl,
      verification: await verifyOrchestratorConnection(initialUrl)
    };
  }

  if (!input.isTTY || !output.isTTY) {
    return {
      orchestratorUrl: undefined,
      verification: undefined
    };
  }

  const promptSeed = getPromptSeedOrchestratorIp(existingReport, machine);
  while (true) {
    if (promptSeed.includes(".")) {
      console.log(
        `Enter the orchestrator IP. This prompt starts with ${promptSeed}; confirm or edit the final number.`
      );
    } else {
      console.log(
        "Enter the full orchestrator IP address shown during orchestrator setup before continuing."
      );
    }
    const orchestratorIp = await promptWithPrefill("Orchestrator IP: ", promptSeed);
    if (!orchestratorIp) {
      return {
        orchestratorUrl: undefined,
        verification: undefined
      };
    }

    const orchestratorUrl = `http://${orchestratorIp}:4310`;
    console.log(`Testing orchestrator connection: ${orchestratorUrl}/api/health`);
    try {
      const verification = await verifyOrchestratorConnection(orchestratorUrl);
      console.log(`Verified orchestrator connection: ${verification.healthUrl}`);
      return {
        orchestratorUrl,
        verification
      };
    } catch (error) {
      console.error(`Connection test failed: ${error.message}`);
      console.error("Please confirm the orchestrator IP and try again, or press Enter to skip sync.");
    }
  }
}

async function writeLocalReport(rootDir, report) {
  const paths = getStoragePaths(rootDir);
  await mkdir(paths.storageDir, { recursive: true });
  await mkdir(paths.identityDir, { recursive: true });
  const reportPath = join(paths.storageDir, "agent-setup-report.json");
  const payload = `${JSON.stringify(report, null, 2)}\n`;
  await writeFile(reportPath, payload, "utf8");
  await writeFile(paths.persistentReportPath, payload, "utf8");
  return reportPath;
}

async function getStableDeviceId(rootDir, machine) {
  const paths = getStoragePaths(rootDir);

  try {
    const existing = (await readFile(paths.deviceIdPath, "utf8")).trim();
    if (existing) {
      return existing;
    }
  } catch {
    // Fall through and create a new ID.
  }

  const deviceId = `agent-${randomUUID()}`;
  try {
    await mkdir(paths.identityDir, { recursive: true });
    await writeFile(paths.deviceIdPath, `${deviceId}\n`, "utf8");
    return deviceId;
  } catch {
    return `agent-${getDeviceFingerprint(machine)}`;
  }
}

async function syncToOrchestrator(orchestratorUrl, report) {
  const trimmedBase = orchestratorUrl.replace(/\/+$/, "");
  let syncResponse;
  try {
    syncResponse = await fetch(`${trimmedBase}/api/resources/sync`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(report)
    });
  } catch (error) {
    throw new Error(
      `The orchestrator health check passed but resource sync failed while posting to ${trimmedBase}/api/resources/sync. Original error: ${error.message}`
    );
  }

  const payload = await syncResponse.json();
  if (!syncResponse.ok) {
    throw new Error(payload.error ?? `Resource sync failed with HTTP ${syncResponse.status}.`);
  }

  return payload.result?.lines?.join(" ") ?? "Resource sync complete.";
}

async function writeMonitorState(rootDir, state) {
  const paths = getStoragePaths(rootDir);
  await mkdir(paths.identityDir, { recursive: true });
  await writeFile(paths.monitorStatePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

async function logMonitorLine(rootDir, line) {
  const paths = getStoragePaths(rootDir);
  await mkdir(paths.identityDir, { recursive: true });
  const nextLine = `[${new Date().toISOString()}] ${line}\n`;
  await appendFile(paths.monitorLogPath, nextLine, "utf8");
  console.log(nextLine.trimEnd());
}

async function collectRequestBody(request) {
  return await new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    request.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    request.on("end", () => {
      resolveBody(chunks.length > 0 ? Buffer.concat(chunks) : undefined);
    });
    request.on("error", rejectBody);
  });
}

function getProxyHeaders(requestHeaders, apiStyle, apiKeyEnv) {
  const headers = {};
  const contentType = requestHeaders["content-type"];
  if (typeof contentType === "string" && contentType.trim() !== "") {
    headers["content-type"] = contentType;
  }

  return {
    ...headers,
    ...getAuthHeaders(apiStyle, apiKeyEnv)
  };
}

function isAllowedProxyPath(pathname, apiStyle) {
  const ollamaPaths = new Set([
    "/api/version",
    "/api/tags",
    "/api/chat",
    "/api/ps",
    "/api/show",
    "/api/pull",
    "/api/delete"
  ]);
  const openAiPaths = new Set(["/v1/models", "/v1/chat/completions"]);
  const anthropicPaths = new Set(["/v1/models", "/v1/messages"]);

  if (apiStyle === "ollama") {
    return ollamaPaths.has(pathname);
  }

  if (apiStyle === "anthropic") {
    return anthropicPaths.has(pathname);
  }

  return openAiPaths.has(pathname);
}

async function startAgentGateway(context) {
  const { rootDir, localEndpoint, apiStyle, apiKeyEnv, machine, allowedHost, gatewayPort } = context;

  const server = createServer(async (request, response) => {
    const remoteAddress = normalizeRemoteAddress(request.socket.remoteAddress);
    const allowedRemoteHosts = new Set([
      allowedHost,
      machine.localIp ?? "",
      ...getLoopbackHosts()
    ]);

    if (!allowedRemoteHosts.has(remoteAddress)) {
      response.writeHead(403, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          error: `Access denied for ${remoteAddress || "unknown remote host"}. This agent gateway only accepts the configured orchestrator host.`
        })
      );
      return;
    }

    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    if (!isAllowedProxyPath(requestUrl.pathname, apiStyle)) {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: `Unsupported agent gateway path ${requestUrl.pathname}.` }));
      return;
    }

    try {
      const body = await collectRequestBody(request);
      const targetUrl = `${trimTrailingSlash(localEndpoint)}${requestUrl.pathname}${requestUrl.search}`;
      const proxied = await fetch(targetUrl, {
        method: request.method,
        headers: getProxyHeaders(request.headers, apiStyle, apiKeyEnv),
        body
      });
      const responseBody = Buffer.from(await proxied.arrayBuffer());
      const responseContentType = proxied.headers.get("content-type") ?? "application/json";
      response.writeHead(proxied.status, { "content-type": responseContentType });
      response.end(responseBody);
    } catch (error) {
      await logMonitorLine(rootDir, `Gateway proxy error: ${error.message}`);
      response.writeHead(502, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: `Agent gateway proxy failed: ${error.message}` }));
    }
  });

  let boundPort;
  let lastError;
  for (let candidatePort = gatewayPort; candidatePort < gatewayPort + 5; candidatePort += 1) {
    try {
      boundPort = await new Promise((resolvePort, rejectPort) => {
        const handleError = (error) => {
          server.off("listening", handleListening);
          rejectPort(error);
        };
        const handleListening = () => {
          server.off("error", handleError);
          const address = server.address();
          if (!address || typeof address === "string") {
            rejectPort(new Error("Agent gateway did not return a numeric listen port."));
            return;
          }
          resolvePort(address.port);
        };

        server.once("error", handleError);
        server.once("listening", handleListening);
        server.listen(candidatePort, "0.0.0.0");
      });
      break;
    } catch (error) {
      lastError = error;
      if (server.listening) {
        await new Promise((resolveClose) => server.close(resolveClose));
      }
      if (error?.code !== "EADDRINUSE") {
        break;
      }
    }
  }

  if (typeof boundPort !== "number") {
    throw new Error(
      `Unable to start the agent gateway. ${lastError?.message ?? "Unknown listen error."} ${getPlatformFirewallGuidance(machine.platform, gatewayPort, allowedHost)}`
    );
  }

  await logMonitorLine(
    rootDir,
    `Agent gateway listening on http://${machine.localIp ?? "127.0.0.1"}:${boundPort} and restricted to ${allowedHost}.`
  );
  await logMonitorLine(rootDir, getPlatformFirewallGuidance(machine.platform, boundPort, allowedHost));
  return {
    server,
    port: boundPort
  };
}

async function isEndpointHealthy(baseUrl, apiStyle, apiKeyEnv) {
  try {
    if (apiStyle === "ollama") {
      const response = await fetch(`${trimTrailingSlash(baseUrl)}/api/version`);
      return response.ok;
    }

    const headers = getAuthHeaders(apiStyle, apiKeyEnv);
    const response = await fetch(`${trimTrailingSlash(baseUrl)}/v1/models`, { headers });
    return response.ok;
  } catch {
    return false;
  }
}

function startOllamaServe(rootDir) {
  const command = process.platform === "win32" ? "ollama.exe" : "ollama";
  const child = spawn(command, ["serve"], {
    stdio: ["ignore", "pipe", "pipe"]
  });
  const paths = getStoragePaths(rootDir);
  const logStream = createWriteStream(paths.monitorLogPath, {
    flags: "a"
  });
  const prefix = `[${new Date().toISOString()}] [ollama-serve]`;

  child.stdout?.on("data", (chunk) => {
    const text = chunk.toString();
    logStream.write(`${prefix} ${text}`);
  });
  child.stderr?.on("data", (chunk) => {
    const text = chunk.toString();
    logStream.write(`${prefix} ${text}`);
  });
  child.on("close", () => {
    logStream.end();
  });

  return child;
}

async function runAgentMonitor(context) {
  const {
    rootDir,
    localEndpoint,
    apiStyle,
    apiKeyEnv,
    orchestratorUrl,
    buildReport,
    machine,
    gatewayPort,
    allowedHost
  } = context;
  let localServerProcess;
  let lastSyncSignature = "";
  let lastSyncAt = 0;
  const gateway = await startAgentGateway({
    rootDir,
    localEndpoint,
    apiStyle,
    apiKeyEnv,
    machine,
    allowedHost,
    gatewayPort
  });

  await logMonitorLine(
    rootDir,
    apiStyle === "ollama"
      ? "Agent monitor active. Watching local Ollama health, model changes, and orchestrator sync."
      : "Agent monitor active. Watching endpoint health, model changes, and orchestrator sync."
  );

  while (true) {
    const healthy = await isEndpointHealthy(localEndpoint, apiStyle, apiKeyEnv);
    const nextState = {
      updatedAt: new Date().toISOString(),
      apiStyle,
      localEndpoint,
      gatewayUrl: `http://${machine.localIp ?? "127.0.0.1"}:${gateway.port}`,
      allowedHost,
      healthy,
      childPid: localServerProcess?.pid ?? null,
      orchestratorUrl: orchestratorUrl ?? null,
      lastSyncAt: lastSyncAt > 0 ? new Date(lastSyncAt).toISOString() : null
    };

    if (!healthy && apiStyle === "ollama" && !localServerProcess) {
      try {
        await logMonitorLine(rootDir, `Local Ollama is not responding at ${localEndpoint}; starting \`ollama serve\`.`);
        localServerProcess = startOllamaServe(rootDir);
      } catch (error) {
        await logMonitorLine(rootDir, `Failed to start local Ollama: ${error.message}`);
      }
    }

    if (localServerProcess && localServerProcess.exitCode !== null) {
      await logMonitorLine(rootDir, `Local Ollama monitor process exited with code ${localServerProcess.exitCode}.`);
      localServerProcess = undefined;
    }

    if (healthy && orchestratorUrl) {
      try {
        const discovered = await probeResourceModels(localEndpoint, apiStyle, apiKeyEnv);
        const report = await buildReport(discovered);
        const signature = JSON.stringify({
          alias: report.alias,
          baseUrl: report.baseUrl,
          models: report.availableModels
        });
        if (signature !== lastSyncSignature || Date.now() - lastSyncAt > 5 * 60 * 1000) {
          const syncSummary = await syncToOrchestrator(orchestratorUrl, report);
          lastSyncSignature = signature;
          lastSyncAt = Date.now();
          await logMonitorLine(rootDir, `Monitor sync: ${syncSummary}`);
        }
      } catch (error) {
        await logMonitorLine(rootDir, `Monitor sync failed: ${error.message}`);
      }
    }

    await writeMonitorState(rootDir, nextState);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 15000));
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const machine = detectLocalMachineProfile();
  const existingReport = await readExistingAgentReport(options.rootDir);
  const verifiedOrchestrator = await resolveVerifiedOrchestratorUrl(
    options.orchestratorUrl,
    machine,
    existingReport
  );
  const prompted = await promptForSetup(options, machine, existingReport);
  const localEndpoint = trimTrailingSlash(options.endpointUrl);
  const gatewayPort = getGatewayPort(options, existingReport);
  const advertisedBaseUrl = getAdvertisedBaseUrl(machine, gatewayPort, localEndpoint);
  const discovered = await probeResourceModels(
    localEndpoint,
    options.apiStyle,
    options.apiKeyEnv
  );
  const nickname = prompted.nickname || titleCase(machine.hostName);
  const alias =
    options.alias ??
    (existingReport && typeof existingReport.alias === "string" && existingReport.alias.trim() !== ""
      ? normalizeAlias(existingReport.alias)
      : normalizeAlias(machine.hostName));
  const tier = options.tier ?? autoTier(machine);
  const deviceId = await getStableDeviceId(options.rootDir, machine);

  const buildReport = async (latestDiscovered = discovered) => ({
    alias,
    label: nickname,
    baseUrl: advertisedBaseUrl,
    apiStyle: options.apiStyle,
    ...(options.apiKeyEnv ? { apiKeyEnv: options.apiKeyEnv } : {}),
    deviceId,
    tier,
    hostName: machine.hostName,
    platform: machine.platform,
    cpuLogicalCores: machine.cpuLogicalCores,
    ramGb: machine.ramGb,
    ...(options.gpuModel ? { gpuModel: options.gpuModel } : {}),
    ...(typeof options.gpuCount === "number" && Number.isFinite(options.gpuCount)
      ? { gpuCount: options.gpuCount }
      : {}),
    ...(typeof options.totalVramGb === "number" && Number.isFinite(options.totalVramGb)
      ? { totalVramGb: options.totalVramGb }
      : {}),
    ...(typeof options.maxContextTokens === "number" && Number.isFinite(options.maxContextTokens)
      ? { maxContextTokens: options.maxContextTokens }
      : {}),
    ...(latestDiscovered.defaultModel ? { defaultModel: latestDiscovered.defaultModel } : {}),
    ...(latestDiscovered.reasoningModel ? { reasoningModel: latestDiscovered.reasoningModel } : {}),
    ...(latestDiscovered.codingModel ? { codingModel: latestDiscovered.codingModel } : {}),
    ...(latestDiscovered.toolsModel ? { toolsModel: latestDiscovered.toolsModel } : {}),
    ...(latestDiscovered.embeddingModel ? { embeddingModel: latestDiscovered.embeddingModel } : {}),
    availableModels: latestDiscovered.availableModels,
    ...(latestDiscovered.endpointVersion ? { endpointVersion: latestDiscovered.endpointVersion } : {}),
    gatewayPort,
    capabilities: [
      "chat",
      ...(latestDiscovered.reasoningModel ? ["reasoning"] : []),
      ...(latestDiscovered.codingModel ? ["code generation"] : []),
      ...(latestDiscovered.toolsModel ? ["structured output"] : []),
      ...(latestDiscovered.embeddingModel ? ["embeddings"] : [])
    ],
    notes: [
      "Synced from setup-agent.",
      "Refresh this agent later if models or endpoint settings change."
    ],
    localEndpoint,
    ...(verifiedOrchestrator.orchestratorUrl
      ? { orchestratorUrl: verifiedOrchestrator.orchestratorUrl }
      : {})
  });
  const report = await buildReport();

  const reportPath = await writeLocalReport(options.rootDir, report);

  console.log("Crusty agent setup complete.");
  console.log(`Repo root: ${options.rootDir}`);
  console.log(`Local report: ${reportPath}`);
  console.log(`Device nickname: ${nickname}`);
  console.log(`Agent alias: @${alias}`);
  console.log(`Device ID: ${deviceId}`);
  console.log(`Local endpoint: ${localEndpoint}`);
  console.log(`Advertised endpoint: ${advertisedBaseUrl}`);
  console.log(`Detected host name: ${machine.hostName}`);
  if (machine.localIp) {
    console.log(`Detected LAN IP: ${machine.localIp}`);
  }
  console.log(`Platform: ${machine.platform}`);
  console.log(`CPU threads: ${machine.cpuLogicalCores}`);
  console.log(`RAM: ${machine.ramGb} GB`);
  console.log(`API style: ${options.apiStyle}`);
  if (options.apiKeyEnv) {
    console.log(`API key env: ${options.apiKeyEnv}`);
  }
  console.log(`Suggested tier: ${tier}`);
  console.log(
    `Discovered models: ${
      discovered.availableModels.length > 0 ? discovered.availableModels.join(", ") : "(none)"
    }`
  );
  console.log("");
  console.log("Verified configuration:");
  console.log(`- Device nickname: ${nickname}`);
  console.log(`- Agent alias: @${alias}`);
  console.log(`- Device ID: ${deviceId}`);
  console.log(`- Local endpoint: ${localEndpoint}`);
  console.log(`- Advertised endpoint: ${advertisedBaseUrl}`);
  console.log(`- API style: ${options.apiStyle}`);
  if (options.apiKeyEnv) {
    console.log(`- API key env: ${options.apiKeyEnv}`);
  }
  console.log(`- Suggested tier: ${tier}`);
  if (verifiedOrchestrator.verification) {
    console.log(`- Orchestrator: ${verifiedOrchestrator.verification.baseUrl}`);
    console.log(`- Orchestrator health: ${verifiedOrchestrator.verification.healthUrl}`);
    console.log(`- Orchestrator status: ${verifiedOrchestrator.verification.statusUrl}`);
    console.log(`- Allowed orchestrator host: ${verifiedOrchestrator.verification.orchestratorHost}`);
  } else {
    console.log("- Orchestrator sync: skipped");
  }

  if (!verifiedOrchestrator.orchestratorUrl) {
    console.log("Sync skipped. Re-run with --orchestrator http://host:4310 or add the resource manually.");
    return;
  }

  console.log(
    `Attempting orchestrator sync: ${verifiedOrchestrator.orchestratorUrl.replace(/\/+$/, "")}/api/resources/sync`
  );
  const syncSummary = await syncToOrchestrator(verifiedOrchestrator.orchestratorUrl, report);
  console.log(`Orchestrator sync: ${syncSummary}`);

  if (options.once) {
    if (options.once) {
      console.log(
        `One-shot setup complete. For secure persistent access, rerun without --once so the agent gateway can stay online at ${advertisedBaseUrl}.`
      );
    }
    return;
  }

  console.log("Agent monitor: running. Leave this terminal open to keep watching the local Ollama service.");
  await runAgentMonitor({
    rootDir: options.rootDir,
    localEndpoint,
    apiStyle: options.apiStyle,
    apiKeyEnv: options.apiKeyEnv,
    orchestratorUrl: verifiedOrchestrator.orchestratorUrl,
    buildReport,
    machine,
    gatewayPort,
    allowedHost: verifiedOrchestrator.verification?.orchestratorHost ?? "127.0.0.1"
  });
}

main().catch((error) => {
  console.error(`Setup failed: ${error.message}`);
  process.exitCode = 1;
});
