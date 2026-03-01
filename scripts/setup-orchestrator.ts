import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { getStoragePaths } from "../src/storage.ts";
import { loadResources, saveResources, type ResourceProfile } from "../src/resources.ts";
import {
  detectLocalIpAddress,
  detectLocalMachineProfile,
  probeResourceModels
} from "../src/resource-discovery.ts";

interface SetupOptions {
  rootDir: string;
  endpointUrl: string;
  apiStyle: "ollama" | "openai";
  name: string;
  alias: string;
  label: string;
  tier: "top" | "mid" | "low";
  bindHost: string;
  publicHost?: string;
  apiPort: number;
}

function parseArgs(argv: string[]): SetupOptions {
  const detectedIp = detectLocalIpAddress();
  let rootDir = process.cwd();
  let endpointUrl = "http://127.0.0.1:11434";
  let apiStyle: "ollama" | "openai" = "ollama";
  let name = "Orchestrator";
  let alias = "orchestrator";
  let label = "Local Orchestrator";
  let tier: "top" | "mid" | "low" = "top";
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
    if (arg === "--api-style" && next && (next === "ollama" || next === "openai")) {
      apiStyle = next;
      index += 1;
      continue;
    }
    if (arg === "--name" && next) {
      name = next;
      index += 1;
      continue;
    }
    if (arg === "--alias" && next) {
      alias = next.trim().toLowerCase();
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
    name,
    alias,
    label,
    tier,
    bindHost,
    publicHost,
    apiPort
  };
}

function buildManagedEnvBlock(options: {
  setup: SetupOptions;
  machine: ReturnType<typeof detectLocalMachineProfile>;
  discovered: Awaited<ReturnType<typeof probeResourceModels>>;
}): string {
  const localUiHost =
    options.setup.publicHost && options.setup.publicHost.trim() !== ""
      ? options.setup.publicHost.trim()
      : "127.0.0.1";

  return [
    "# >>> crusty orchestrator setup >>>",
    "CRUSTY_API_ENABLED=true",
    `CRUSTY_API_BIND_HOST=${options.setup.bindHost}`,
    `CRUSTY_API_PUBLIC_HOST=${localUiHost}`,
    `CRUSTY_API_PORT=${options.setup.apiPort}`,
    `CRUSTY_ORCHESTRATOR_NAME=${options.setup.name}`,
    "CRUSTY_DEFAULT_ENDPOINT=erin",
    `CRUSTY_ORCHESTRATOR_ALIAS=${options.setup.alias}`,
    `CRUSTY_ORCHESTRATOR_LABEL=${options.setup.label}`,
    `CRUSTY_ORCHESTRATOR_TIER=${options.setup.tier}`,
    `CRUSTY_ORCHESTRATOR_BASE_URL=${options.setup.endpointUrl}`,
    `CRUSTY_ORCHESTRATOR_API_STYLE=${options.setup.apiStyle}`,
    `CRUSTY_ORCHESTRATOR_HOST_NAME=${options.machine.hostName}`,
    `CRUSTY_ORCHESTRATOR_PLATFORM=${options.machine.platform}`,
    `CRUSTY_ORCHESTRATOR_CPU_LOGICAL_CORES=${options.machine.cpuLogicalCores}`,
    `CRUSTY_ORCHESTRATOR_RAM_GB=${options.machine.ramGb}`,
    ...(options.machine.localIp ? [`CRUSTY_ORCHESTRATOR_LOCAL_IP=${options.machine.localIp}`] : []),
    ...(options.discovered.defaultModel
      ? [`CRUSTY_ORCHESTRATOR_DEFAULT_MODEL=${options.discovered.defaultModel}`]
      : []),
    ...(options.discovered.reasoningModel
      ? [`CRUSTY_ORCHESTRATOR_REASONING_MODEL=${options.discovered.reasoningModel}`]
      : []),
    ...(options.discovered.codingModel
      ? [`CRUSTY_ORCHESTRATOR_CODING_MODEL=${options.discovered.codingModel}`]
      : []),
    ...(options.discovered.toolsModel
      ? [`CRUSTY_ORCHESTRATOR_TOOLS_MODEL=${options.discovered.toolsModel}`]
      : []),
    ...(options.discovered.embeddingModel
      ? [`CRUSTY_ORCHESTRATOR_EMBEDDING_MODEL=${options.discovered.embeddingModel}`]
      : []),
    `CRUSTY_ENDPOINT_ERIN_RESOURCE=${options.setup.alias}`,
    "CRUSTY_ENDPOINT_ERIN_NICKNAME=Erin",
    ...(options.discovered.defaultModel ? [`CRUSTY_ENDPOINT_ERIN_MODEL=${options.discovered.defaultModel}`] : []),
    `CRUSTY_ENDPOINT_ZORA_RESOURCE=${options.setup.alias}`,
    "CRUSTY_ENDPOINT_ZORA_NICKNAME=Zora",
    ...(options.discovered.defaultModel ? [`CRUSTY_ENDPOINT_ZORA_MODEL=${options.discovered.defaultModel}`] : []),
    `CRUSTY_ENDPOINT_SAM_RESOURCE=${options.setup.alias}`,
    "CRUSTY_ENDPOINT_SAM_NICKNAME=Sam",
    ...(options.discovered.defaultModel ? [`CRUSTY_ENDPOINT_SAM_MODEL=${options.discovered.defaultModel}`] : []),
    `CRUSTY_ENDPOINT_PAV_RESOURCE=${options.setup.alias}`,
    "CRUSTY_ENDPOINT_PAV_NICKNAME=Pav",
    ...(options.discovered.defaultModel ? [`CRUSTY_ENDPOINT_PAV_MODEL=${options.discovered.defaultModel}`] : []),
    "# <<< crusty orchestrator setup <<<"
  ].join("\n");
}

async function writeManagedEnv(rootDir: string, block: string): Promise<string> {
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

async function syncResourceInventory(options: {
  setup: SetupOptions;
  machine: ReturnType<typeof detectLocalMachineProfile>;
  discovered: Awaited<ReturnType<typeof probeResourceModels>>;
}): Promise<string> {
  const resources = loadResources(options.setup.rootDir);
  const profile: ResourceProfile = {
    alias: options.setup.alias,
    label: options.setup.label,
    tier: options.setup.tier,
    baseUrl: options.setup.endpointUrl,
    apiStyle: options.setup.apiStyle,
    hostName: options.machine.hostName,
    platform: options.machine.platform,
    cpuLogicalCores: options.machine.cpuLogicalCores,
    ramGb: options.machine.ramGb,
    defaultModel: options.discovered.defaultModel ?? "llama3.1:8b",
    ...(options.discovered.reasoningModel ? { reasoningModel: options.discovered.reasoningModel } : {}),
    ...(options.discovered.codingModel ? { codingModel: options.discovered.codingModel } : {}),
    ...(options.discovered.toolsModel ? { toolsModel: options.discovered.toolsModel } : {}),
    ...(options.discovered.embeddingModel ? { embeddingModel: options.discovered.embeddingModel } : {}),
    availableModels: options.discovered.availableModels,
    ...(options.discovered.endpointVersion
      ? { endpointVersion: options.discovered.endpointVersion }
      : {}),
    lastRefreshedAt: new Date().toISOString(),
    role: "Primary orchestration resource for local planning, routing, and verification.",
    capabilities: [
      "planning",
      "chat",
      ...(options.discovered.reasoningModel ? ["reasoning"] : []),
      ...(options.discovered.codingModel ? ["code generation"] : []),
      ...(options.discovered.toolsModel ? ["structured tool output"] : []),
      ...(options.discovered.embeddingModel ? ["embeddings"] : [])
    ],
    notes: [
      "Bootstrapped by the orchestrator setup script.",
      "Bring additional devices online with bun run setup:node from those systems."
    ]
  };

  await saveResources({ ...resources, [profile.alias]: profile }, options.setup.rootDir);
  return getStoragePaths(options.setup.rootDir).resourcesPath;
}

async function main(): Promise<void> {
  const setup = parseArgs(process.argv.slice(2));
  const machine = detectLocalMachineProfile();
  const discovered = await probeResourceModels(setup.endpointUrl, setup.apiStyle);
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

  console.log("Crusty orchestrator setup complete.");
  console.log(`Repo root: ${setup.rootDir}`);
  console.log(`Managed env: ${envPath}`);
  console.log(`Resource inventory: ${resourcesPath}`);
  console.log(`Orchestrator profile: ${setup.name}`);
  console.log(`Inference endpoint: ${setup.endpointUrl} (${setup.apiStyle})`);
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
  console.log(`Local UI (after start): ${localUiUrl}`);
  if (lanUiUrl !== localUiUrl) {
    console.log(`LAN UI (after start): ${lanUiUrl}`);
  }
  console.log("");
  console.log("Next steps:");
  console.log("1. Start Crusty with: bun run start");
  console.log("2. Open the Local UI link above after startup.");
  console.log(
    `3. On the next device, run: bun run setup:node --orchestrator http://${setup.publicHost ?? "127.0.0.1"}:${setup.apiPort}`
  );
  console.log("4. Review and refresh devices later with /resource refresh <alias> when models change.");
}

main().catch((error) => {
  console.error(`Setup failed: ${(error as Error).message}`);
  process.exitCode = 1;
});
