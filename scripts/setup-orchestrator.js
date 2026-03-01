import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { cpus, hostname, networkInterfaces, platform, totalmem } from "node:os";
import { join, resolve } from "node:path";

function trimTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
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

function getDeviceId(machine) {
  return [
    machine.hostName || "unknown-host",
    machine.platform || "unknown-platform",
    String(machine.cpuLogicalCores || 0),
    String(machine.ramGb || 0)
  ].join("|");
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

function getStoragePaths(rootDir) {
  const storageDir = join(rootDir, ".crusty");
  return {
    storageDir,
    resourcesPath: join(storageDir, "resources.json")
  };
}

function normalizeAlias(value) {
  return value.trim().toLowerCase();
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

function parseArgs(argv) {
  const detectedIp = detectLocalIpAddress();
  let rootDir = process.cwd();
  let endpointUrl = "http://127.0.0.1:11434";
  let apiStyle = "ollama";
  let apiKeyEnv;
  let name = "Orchestrator";
  let alias = "orchestrator";
  let label = "Local Orchestrator";
  let tier = "top";
  let bindHost = "0.0.0.0";
  let publicHost = detectedIp;
  let apiPort = 4310;

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
    if (arg === "--name" && next) {
      name = next;
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
    if (arg === "--bind-host" && next) {
      bindHost = next;
      index += 1;
      continue;
    }
    if (arg === "--public-host" && next) {
      publicHost = next;
      index += 1;
      continue;
    }
    if (arg === "--port" && next) {
      const parsed = Number(next);
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error(`Invalid --port value "${next}".`);
      }
      apiPort = parsed;
      index += 1;
    }
  }

  return {
    rootDir,
    endpointUrl,
    apiStyle,
    apiKeyEnv,
    name,
    alias,
    label,
    tier,
    bindHost,
    publicHost,
    apiPort
  };
}

function buildManagedEnvBlock({ setup, machine, discovered }) {
  const localUiHost =
    setup.publicHost && setup.publicHost.trim() !== "" ? setup.publicHost.trim() : "127.0.0.1";

  return [
    "# >>> crusty orchestrator setup >>>",
    "CRUSTY_API_ENABLED=true",
    `CRUSTY_API_BIND_HOST=${setup.bindHost}`,
    `CRUSTY_API_PUBLIC_HOST=${localUiHost}`,
    `CRUSTY_API_PORT=${setup.apiPort}`,
    `CRUSTY_ORCHESTRATOR_NAME=${setup.name}`,
    "CRUSTY_DEFAULT_ENDPOINT=erin",
    `CRUSTY_ORCHESTRATOR_ALIAS=${setup.alias}`,
    `CRUSTY_ORCHESTRATOR_LABEL=${setup.label}`,
    `CRUSTY_ORCHESTRATOR_TIER=${setup.tier}`,
    `CRUSTY_ORCHESTRATOR_BASE_URL=${setup.endpointUrl}`,
    `CRUSTY_ORCHESTRATOR_API_STYLE=${setup.apiStyle}`,
    ...(setup.apiKeyEnv ? [`CRUSTY_ORCHESTRATOR_API_KEY_ENV=${setup.apiKeyEnv}`] : []),
    `CRUSTY_ORCHESTRATOR_HOST_NAME=${machine.hostName}`,
    `CRUSTY_ORCHESTRATOR_PLATFORM=${machine.platform}`,
    `CRUSTY_ORCHESTRATOR_CPU_LOGICAL_CORES=${machine.cpuLogicalCores}`,
    `CRUSTY_ORCHESTRATOR_RAM_GB=${machine.ramGb}`,
    ...(machine.localIp ? [`CRUSTY_ORCHESTRATOR_LOCAL_IP=${machine.localIp}`] : []),
    ...(discovered.defaultModel ? [`CRUSTY_ORCHESTRATOR_DEFAULT_MODEL=${discovered.defaultModel}`] : []),
    ...(discovered.reasoningModel
      ? [`CRUSTY_ORCHESTRATOR_REASONING_MODEL=${discovered.reasoningModel}`]
      : []),
    ...(discovered.codingModel
      ? [`CRUSTY_ORCHESTRATOR_CODING_MODEL=${discovered.codingModel}`]
      : []),
    ...(discovered.toolsModel
      ? [`CRUSTY_ORCHESTRATOR_TOOLS_MODEL=${discovered.toolsModel}`]
      : []),
    ...(discovered.embeddingModel
      ? [`CRUSTY_ORCHESTRATOR_EMBEDDING_MODEL=${discovered.embeddingModel}`]
      : []),
    `CRUSTY_ENDPOINT_ERIN_RESOURCE=${setup.alias}`,
    "CRUSTY_ENDPOINT_ERIN_NICKNAME=Erin",
    ...(discovered.defaultModel ? [`CRUSTY_ENDPOINT_ERIN_MODEL=${discovered.defaultModel}`] : []),
    `CRUSTY_ENDPOINT_ZORA_RESOURCE=${setup.alias}`,
    "CRUSTY_ENDPOINT_ZORA_NICKNAME=Zora",
    ...(discovered.defaultModel ? [`CRUSTY_ENDPOINT_ZORA_MODEL=${discovered.defaultModel}`] : []),
    `CRUSTY_ENDPOINT_SAM_RESOURCE=${setup.alias}`,
    "CRUSTY_ENDPOINT_SAM_NICKNAME=Sam",
    ...(discovered.defaultModel ? [`CRUSTY_ENDPOINT_SAM_MODEL=${discovered.defaultModel}`] : []),
    `CRUSTY_ENDPOINT_PAV_RESOURCE=${setup.alias}`,
    "CRUSTY_ENDPOINT_PAV_NICKNAME=Pav",
    ...(discovered.defaultModel ? [`CRUSTY_ENDPOINT_PAV_MODEL=${discovered.defaultModel}`] : []),
    "# <<< crusty orchestrator setup <<<"
  ].join("\n");
}

async function writeManagedEnv(rootDir, block) {
  await mkdir(rootDir, { recursive: true });
  const envPath = join(rootDir, ".env.local");
  const nextBlock = `${block.trimEnd()}\n`;

  if (!existsSync(envPath)) {
    await writeFile(envPath, nextBlock, "utf8");
    return envPath;
  }

  const previous = await readFile(envPath, "utf8");
  const pattern =
    /# >>> crusty orchestrator setup >>>[\s\S]*?# <<< crusty orchestrator setup <<<\n?/g;
  const next = pattern.test(previous)
    ? previous.replace(pattern, nextBlock)
    : `${previous.trimEnd()}\n\n${nextBlock}`;
  await writeFile(envPath, next, "utf8");
  return envPath;
}

async function loadResources(rootDir) {
  const paths = getStoragePaths(rootDir);
  await mkdir(paths.storageDir, { recursive: true });
  if (!existsSync(paths.resourcesPath)) {
    return {};
  }

  const raw = await readFile(paths.resourcesPath, "utf8");
  const parsed = JSON.parse(raw);
  return parsed && typeof parsed.resources === "object" ? parsed.resources : {};
}

async function saveResources(resources, rootDir) {
  const paths = getStoragePaths(rootDir);
  await mkdir(paths.storageDir, { recursive: true });
  await writeFile(paths.resourcesPath, `${JSON.stringify({ resources }, null, 2)}\n`, "utf8");
}

async function syncResourceInventory({ setup, machine, discovered }) {
  const resources = await loadResources(setup.rootDir);
  resources[setup.alias] = {
    alias: setup.alias,
    label: setup.label,
    tier: setup.tier,
    baseUrl: setup.endpointUrl,
    apiStyle: setup.apiStyle,
    ...(setup.apiKeyEnv ? { apiKeyEnv: setup.apiKeyEnv } : {}),
    deviceId: getDeviceId(machine),
    hostName: machine.hostName,
    platform: machine.platform,
    cpuLogicalCores: machine.cpuLogicalCores,
    ramGb: machine.ramGb,
    defaultModel: discovered.defaultModel ?? "llama3.1:8b",
    ...(discovered.reasoningModel ? { reasoningModel: discovered.reasoningModel } : {}),
    ...(discovered.codingModel ? { codingModel: discovered.codingModel } : {}),
    ...(discovered.toolsModel ? { toolsModel: discovered.toolsModel } : {}),
    ...(discovered.embeddingModel ? { embeddingModel: discovered.embeddingModel } : {}),
    availableModels: discovered.availableModels,
    ...(discovered.endpointVersion ? { endpointVersion: discovered.endpointVersion } : {}),
    lastRefreshedAt: new Date().toISOString(),
    role: "Primary orchestration resource for local planning, routing, and verification.",
    capabilities: [
      "planning",
      "chat",
      ...(discovered.reasoningModel ? ["reasoning"] : []),
      ...(discovered.codingModel ? ["code generation"] : []),
      ...(discovered.toolsModel ? ["structured tool output"] : []),
      ...(discovered.embeddingModel ? ["embeddings"] : [])
    ],
    notes: [
      "Bootstrapped by the orchestrator setup script.",
      "Bring additional agent devices online with node scripts/setup-agent.js from those systems."
    ]
  };

  await saveResources(resources, setup.rootDir);
  return getStoragePaths(setup.rootDir).resourcesPath;
}

async function main() {
  const setup = parseArgs(process.argv.slice(2));
  const machine = detectLocalMachineProfile();
  const discovered = await probeResourceModels(
    setup.endpointUrl,
    setup.apiStyle,
    setup.apiKeyEnv
  );
  const envPath = await writeManagedEnv(
    setup.rootDir,
    buildManagedEnvBlock({
      setup,
      machine,
      discovered
    })
  );
  const resourcesPath = await syncResourceInventory({
    setup,
    machine,
    discovered
  });

  const localUiUrl = `http://127.0.0.1:${setup.apiPort}/ui`;
  const lanUiUrl =
    setup.publicHost && setup.publicHost !== "127.0.0.1"
      ? `http://${setup.publicHost}:${setup.apiPort}/ui`
      : localUiUrl;

  console.log("Crusty setup complete.");
  console.log(`Repo root: ${setup.rootDir}`);
  console.log(`Managed env: ${envPath}`);
  console.log(`Resource inventory: ${resourcesPath}`);
  console.log(`Agent orchestrator profile: ${setup.name}`);
  console.log(`Inference endpoint: ${setup.endpointUrl} (${setup.apiStyle})`);
  if (setup.apiKeyEnv) {
    console.log(`API key env: ${setup.apiKeyEnv}`);
  }
  console.log(`Local host name: ${machine.hostName}`);
  console.log(`Platform: ${machine.platform}`);
  if (machine.localIp) {
    console.log(`Detected LAN IP: ${machine.localIp}`);
  }
  console.log(`CPU threads: ${machine.cpuLogicalCores}`);
  console.log(`RAM: ${machine.ramGb} GB`);
  console.log(
    `Discovered models: ${
      discovered.availableModels.length > 0 ? discovered.availableModels.join(", ") : "(none)"
    }`
  );
  console.log(`Selected default model: ${discovered.defaultModel ?? "(none)"}`);
  console.log(`API health (after start): http://127.0.0.1:${setup.apiPort}/api/health`);
  console.log(`API status (after start): http://127.0.0.1:${setup.apiPort}/api/status`);
  console.log(`Local UI (after start): ${localUiUrl}`);
  if (lanUiUrl !== localUiUrl) {
    console.log(`LAN health (after start): http://${setup.publicHost}:${setup.apiPort}/api/health`);
    console.log(`LAN status (after start): http://${setup.publicHost}:${setup.apiPort}/api/status`);
    console.log(`LAN UI (after start): ${lanUiUrl}`);
  }
  console.log("");
  console.log("Next steps:");
  console.log("1. Start Crusty with: npm run start");
  console.log("2. Open the Local UI link above after startup.");
  console.log("3. Remember this orchestrator address for agent setup:");
  console.log(`   ${setup.publicHost ?? machine.localIp ?? "the LAN IP shown above"}`);
  console.log("4. On the next agent device, run: node scripts/setup-agent.js");
  console.log(
    "   The agent prompt pre-fills the first three IP numbers from the local network."
  );
  if (setup.publicHost) {
    const numbers = setup.publicHost.split(".");
    const lastNumber = numbers.length === 4 ? numbers[3] : "the final number";
    const prefix =
      numbers.length === 4 ? `${numbers[0]}.${numbers[1]}.${numbers[2]}.` : "the local subnet";
    console.log(
      `   Check that the prompt starts with ${prefix} and enter or confirm ${lastNumber} as the final number.`
    );
  } else {
    console.log(
      "   Enter or confirm the final number of the orchestrator IP shown above before continuing."
    );
  }
  console.log("5. Review and refresh agent resources later with /resource refresh <alias> when models change.");
}

main().catch((error) => {
  console.error(`Setup failed: ${error.message}`);
  process.exitCode = 1;
});
