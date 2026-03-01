import { mkdir, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { join, resolve } from "node:path";
import { cpus, hostname, networkInterfaces, platform, totalmem } from "node:os";

function trimTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function normalizeAlias(value) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "node"
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

async function probeResourceModels(baseUrl, apiStyle) {
  if (apiStyle === "openai") {
    const response = await fetch(`${trimTrailingSlash(baseUrl)}/v1/models`);
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
    fetch(`${trimTrailingSlash(baseUrl)}/api/version`),
    fetch(`${trimTrailingSlash(baseUrl)}/api/tags`)
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

function getStoragePaths(rootDir) {
  const storageDir = join(rootDir, ".crusty");
  return {
    storageDir
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

function parseArgs(argv) {
  let rootDir = process.cwd();
  let endpointUrl = "http://127.0.0.1:11434";
  let apiStyle = "ollama";
  let alias;
  let label;
  let tier;
  let orchestratorUrl;
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
    if (arg === "--api-style" && next && (next === "ollama" || next === "openai")) {
      apiStyle = next;
      index += 1;
      continue;
    }
    if (arg === "--alias" && next) {
      alias = normalizeAlias(next);
      index += 1;
      continue;
    }
    if (arg === "--label" && next) {
      label = next;
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
    alias,
    label,
    tier,
    orchestratorUrl,
    gpuModel,
    gpuCount,
    totalVramGb,
    maxContextTokens
  };
}

async function promptForOrchestratorUrl(initial) {
  if (initial || !input.isTTY || !output.isTTY) {
    return initial;
  }

  const readline = createInterface({ input, output });
  try {
    const answer = (await readline.question("Orchestrator API base URL (blank to skip sync)> ")).trim();
    return answer || undefined;
  } finally {
    readline.close();
  }
}

async function writeLocalReport(rootDir, report) {
  const paths = getStoragePaths(rootDir);
  await mkdir(paths.storageDir, { recursive: true });
  const reportPath = join(paths.storageDir, "node-setup-report.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}

async function syncToOrchestrator(orchestratorUrl, report) {
  const trimmedBase = orchestratorUrl.replace(/\/+$/, "");
  const healthResponse = await fetch(`${trimmedBase}/api/health`);
  if (!healthResponse.ok) {
    throw new Error(`Orchestrator health check failed with HTTP ${healthResponse.status}.`);
  }

  const syncResponse = await fetch(`${trimmedBase}/api/resources/sync`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(report)
  });

  const payload = await syncResponse.json();
  if (!syncResponse.ok) {
    throw new Error(payload.error ?? `Resource sync failed with HTTP ${syncResponse.status}.`);
  }

  return payload.result?.lines?.join(" ") ?? "Resource sync complete.";
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const machine = detectLocalMachineProfile();
  const discovered = await probeResourceModels(options.endpointUrl, options.apiStyle);
  const alias = options.alias ?? normalizeAlias(machine.hostName);
  const label = options.label ?? `${titleCase(alias)} Node`;
  const tier = options.tier ?? autoTier(machine);
  const orchestratorUrl = await promptForOrchestratorUrl(options.orchestratorUrl);

  const report = {
    alias,
    label,
    baseUrl: options.endpointUrl,
    apiStyle: options.apiStyle,
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
    ...(discovered.defaultModel ? { defaultModel: discovered.defaultModel } : {}),
    ...(discovered.reasoningModel ? { reasoningModel: discovered.reasoningModel } : {}),
    ...(discovered.codingModel ? { codingModel: discovered.codingModel } : {}),
    ...(discovered.toolsModel ? { toolsModel: discovered.toolsModel } : {}),
    ...(discovered.embeddingModel ? { embeddingModel: discovered.embeddingModel } : {}),
    availableModels: discovered.availableModels,
    ...(discovered.endpointVersion ? { endpointVersion: discovered.endpointVersion } : {}),
    capabilities: [
      "chat",
      ...(discovered.reasoningModel ? ["reasoning"] : []),
      ...(discovered.codingModel ? ["code generation"] : []),
      ...(discovered.toolsModel ? ["structured output"] : []),
      ...(discovered.embeddingModel ? ["embeddings"] : [])
    ],
    notes: [
      "Synced from setup:node.",
      "Refresh this node later if models or endpoint settings change."
    ]
  };

  const reportPath = await writeLocalReport(options.rootDir, report);

  console.log("Crusty node setup complete.");
  console.log(`Repo root: ${options.rootDir}`);
  console.log(`Local report: ${reportPath}`);
  console.log(`Detected host name: ${machine.hostName}`);
  if (machine.localIp) {
    console.log(`Detected LAN IP: ${machine.localIp}`);
  }
  console.log(`Platform: ${machine.platform}`);
  console.log(`CPU threads: ${machine.cpuLogicalCores}`);
  console.log(`RAM: ${machine.ramGb} GB`);
  console.log(`Endpoint: ${options.endpointUrl} (${options.apiStyle})`);
  console.log(`Suggested resource alias: @${alias}`);
  console.log(`Suggested tier: ${tier}`);
  console.log(
    `Discovered models: ${
      discovered.availableModels.length > 0 ? discovered.availableModels.join(", ") : "(none)"
    }`
  );

  if (!orchestratorUrl) {
    console.log("Sync skipped. Re-run with --orchestrator http://host:4310 or add the resource manually.");
    return;
  }

  const syncSummary = await syncToOrchestrator(orchestratorUrl, report);
  console.log(`Orchestrator sync: ${syncSummary}`);
}

main().catch((error) => {
  console.error(`Setup failed: ${error.message}`);
  process.exitCode = 1;
});
