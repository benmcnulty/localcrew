import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { cpus, hostname, networkInterfaces, platform, totalmem } from "node:os";
import { createInterface } from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import { join, resolve } from "node:path";

function trimTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

// Best-effort zip code approximation from system timezone — no external deps.
function guessZipFromTimezone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const map = {
      "America/New_York": "10001",
      "America/Detroit": "48201",
      "America/Indiana/Indianapolis": "46201",
      "America/Chicago": "60601",
      "America/Menominee": "49858",
      "America/Denver": "80201",
      "America/Boise": "83701",
      "America/Phoenix": "85001",
      "America/Los_Angeles": "90001",
      "America/Anchorage": "99501",
      "Pacific/Honolulu": "96801",
      "America/Toronto": "M5H",
      "America/Vancouver": "V5K",
      "Europe/London": "EC1A",
      "Europe/Berlin": "10115",
      "Europe/Paris": "75001",
      "Australia/Sydney": "2000",
      "Asia/Tokyo": "100-0001"
    };
    return map[tz] ?? "";
  } catch {
    return "";
  }
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
  const storageDir = join(rootDir, ".localcrew");
  return {
    storageDir,
    resourcesPath: join(storageDir, "resources.json"),
    configPath: join(storageDir, "config.json")
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
  let nameProvided = false;
  let alias = "orchestrator";
  let label = "Local Orchestrator";
  let tier = "top";
  let bindHost = "0.0.0.0";
  let publicHost = detectedIp;
  let apiPort = 4310;
  let noStart = false;

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
      nameProvided = true;
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
      continue;
    }
    if (arg === "--no-start") {
      noStart = true;
      continue;
    }
  }

  return {
    rootDir,
    endpointUrl,
    apiStyle,
    apiKeyEnv,
    name,
    nameProvided,
    alias,
    label,
    tier,
    bindHost,
    publicHost,
    apiPort,
    noStart
  };
}

function parseEnvAssignments(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
    .reduce((accumulator, line) => {
      const separator = line.indexOf("=");
      if (separator <= 0) {
        return accumulator;
      }

      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim();
      if (key !== "") {
        accumulator[key] = value;
      }
      return accumulator;
    }, {});
}

async function loadExistingPrimaryResource(rootDir, machine) {
  const paths = getStoragePaths(rootDir);
  if (!existsSync(paths.resourcesPath)) {
    return undefined;
  }

  try {
    const rawResources = await readFile(paths.resourcesPath, "utf8");
    const parsedResources = JSON.parse(rawResources);
    const resources =
      parsedResources && typeof parsedResources.resources === "object"
        ? Object.values(parsedResources.resources)
        : [];

    const deviceId = getDeviceId(machine);
    return resources.find((resource) => {
      if (!resource || typeof resource !== "object") {
        return false;
      }

      if (typeof resource.deviceId === "string" && resource.deviceId === deviceId) {
        return true;
      }

      return resource.hostName === machine.hostName && resource.platform === machine.platform;
    });
  } catch {
    return undefined;
  }
}

async function loadExistingOrchestratorName(rootDir) {
  const paths = getStoragePaths(rootDir);

  if (existsSync(paths.configPath)) {
    try {
      const rawConfig = await readFile(paths.configPath, "utf8");
      const parsedConfig = JSON.parse(rawConfig);
      if (
        parsedConfig &&
        typeof parsedConfig === "object" &&
        typeof parsedConfig.orchestratorName === "string" &&
        parsedConfig.orchestratorName.trim() !== ""
      ) {
        return parsedConfig.orchestratorName.trim();
      }
    } catch {
      // Fall through to env-backed defaults.
    }
  }

  const envPath = join(rootDir, ".env.local");
  if (!existsSync(envPath)) {
    return undefined;
  }

  try {
    const rawEnv = await readFile(envPath, "utf8");
    const match = rawEnv.match(
      /# >>> localcrew orchestrator setup >>>([\s\S]*?)# <<< localcrew orchestrator setup <<</
    );
    const assignments = parseEnvAssignments(match ? match[1] : rawEnv);
    const configuredName = assignments.LOCALCREW_ORCHESTRATOR_NAME;
    return typeof configuredName === "string" && configuredName.trim() !== ""
      ? configuredName.trim()
      : undefined;
  } catch {
    return undefined;
  }
}

function promptWithPrefill(promptText, initialValue = "") {
  return new Promise((resolvePrompt) => {
    const readline = createInterface({ input, output });
    readline.setPrompt(promptText);
    readline.prompt();
    if (initialValue) {
      readline.write(initialValue);
    }
    readline.on("line", (line) => {
      readline.close();
      resolvePrompt(line.trim());
    });
  });
}

async function loadExistingPreferences(rootDir) {
  const paths = getStoragePaths(rootDir);
  if (!existsSync(paths.configPath)) {
    return {};
  }
  try {
    const raw = await readFile(paths.configPath, "utf8");
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed.preferences === "object" && parsed.preferences) ? parsed.preferences : {};
  } catch {
    return {};
  }
}

async function savePreferencesToConfig(rootDir, preferences) {
  const paths = getStoragePaths(rootDir);
  if (!existsSync(paths.configPath)) {
    return; // Config does not exist yet; it will be created on first start.
  }
  try {
    const raw = await readFile(paths.configPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return;
    }
    const next = {
      ...parsed,
      preferences: {
        ...(typeof parsed.preferences === "object" ? parsed.preferences : {}),
        ...preferences
      }
    };
    // Remove undefined values.
    for (const key of Object.keys(next.preferences)) {
      if (next.preferences[key] === undefined) {
        delete next.preferences[key];
      }
    }
    await writeFile(paths.configPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  } catch {
    // Leave config untouched if it cannot be parsed.
  }
}

async function promptYesNo(promptText, defaultYes = true) {
  const label = defaultYes ? "[Y/n]" : "[y/N]";
  const answer = await promptWithPrefill(`${promptText} ${label}: `, defaultYes ? "Y" : "N");
  if (answer === "") {
    return defaultYes;
  }
  return answer.toLowerCase().startsWith("y");
}

async function resolveSetupOptions(setup) {
  const machine = detectLocalMachineProfile();
  const existingResource = await loadExistingPrimaryResource(setup.rootDir, machine);
  const existingName = await loadExistingOrchestratorName(setup.rootDir);
  const initialName = setup.nameProvided ? setup.name : existingName ?? setup.name;
  const nextSetup = {
    ...setup,
    alias:
      setup.alias !== "orchestrator"
        ? setup.alias
        : existingResource && typeof existingResource.alias === "string" && existingResource.alias.trim() !== ""
          ? existingResource.alias.trim().toLowerCase()
          : setup.alias,
    label:
      setup.label !== "Local Orchestrator"
        ? setup.label
        : existingResource && typeof existingResource.label === "string" && existingResource.label.trim() !== ""
          ? existingResource.label.trim()
          : setup.label,
    tier:
      setup.tier !== "top"
        ? setup.tier
        : existingResource && (existingResource.tier === "top" || existingResource.tier === "mid" || existingResource.tier === "low")
          ? existingResource.tier
          : setup.tier
  };

  if (!input.isTTY || !output.isTTY) {
    return {
      ...nextSetup,
      name: initialName,
      preferences: {}
    };
  }

  console.log(
    "Name this primary device. This is the agent orchestrator profile shown in the CLI, Local UI, and future remote views."
  );
  const promptedName = await promptWithPrefill("Agent orchestrator name: ", initialName);

  // --- Preferences prompts ---
  const existingPrefs = await loadExistingPreferences(nextSetup.rootDir);

  console.log("");
  console.log("Weather & location (used for the WEATHER tool in autonomous mode).");
  const existingZip = existingPrefs.zipCode ?? existingPrefs.city ?? "";
  const hasExistingZip = existingZip.trim() !== "";
  const wantWeather = await promptYesNo(
    "Configure a weather location for the weather tool?",
    hasExistingZip || Boolean(guessZipFromTimezone())
  );
  let zipAnswer = "";
  if (wantWeather) {
    const zipDefault = existingZip || guessZipFromTimezone();
    zipAnswer = await promptWithPrefill("Zip code or city: ", zipDefault);
  }

  console.log("");
  console.log("Job opportunity surfacing — the autonomous network will search for aligned roles each session.");
  const jobDefault = existingPrefs.jobSearchEnabled !== undefined
    ? existingPrefs.jobSearchEnabled
    : true;
  const jobSearchEnabled = await promptYesNo("Include job search in daily autonomous sessions?", jobDefault);

  // --- Web Tool Authorization ---
  console.log("");
  console.log("Web Tool Authorization");
  console.log("━".repeat(22));
  console.log("Local Crew can access external web services during autonomous sessions.");
  console.log("Each tool makes outbound HTTP requests. Authorize individually:");
  const existingAuth = existingPrefs.toolAuthorization ?? {};
  const toolAuthWikipedia = await promptYesNo("  Wikipedia — factual lookups via Wikimedia API", existingAuth.wikipedia !== false);
  const toolAuthReddit = await promptYesNo("  Reddit — community discussion search", existingAuth.reddit !== false);
  const toolAuthWebSearch = await promptYesNo("  Web Search — DuckDuckGo search for news, jobs, tech", existingAuth.webSearch !== false);
  const toolAuthWeather = wantWeather || await promptYesNo("  Weather — Open-Meteo weather forecasts", existingAuth.weather !== false);
  const toolAuthBenlive = await promptYesNo("  Ben Live — content from benlive.tv project hub", existingAuth.benlive !== false);
  const toolAuthWebsite = await promptYesNo("  Website — your personal website content", existingAuth.website === true);

  // --- Port Connection ---
  console.log("");
  console.log("Port Connection (Optional)");
  console.log("━".repeat(26));
  console.log("Connect to benlive.tv/port for community feeds and inter-orchestrator");
  console.log("knowledge sharing. No data is shared without explicit commands.");
  console.log("Your orchestrator remains fully functional without Port.");
  const portDefault = existingPrefs.portRecommended === true;
  const portRecommended = await promptYesNo("  Connect to Port?", portDefault);
  if (portRecommended && !portDefault) {
    console.log("  → Sign in at benlive.tv/port, copy your device token, then run /login <token> after start.");
  }

  // --- Code Generation Agent ---
  console.log("");
  console.log("Code Generation Agent (Optional)");
  console.log("━".repeat(32));
  console.log("Authorize a premium coding agent for tasks requiring advanced code generation.");
  console.log("The orchestrator can delegate implementation work to an external CLI tool.");
  console.log("This spawns a subprocess on your machine using your logged-in account.");

  const detectedAgents = await detectSetupCodeAgents();
  if (detectedAgents.length > 0) {
    console.log(`  Detected: ${detectedAgents.join(", ")}`);
  }

  const existingCodeAgent = existingPrefs.codeAgent;
  const codeAgentDefault = existingAuth.toCode === true || Boolean(existingCodeAgent);
  const enableCodeAgent = await promptYesNo("  Enable code generation agent?", codeAgentDefault);
  let codeAgentPrefs = existingCodeAgent ? { ...existingCodeAgent } : undefined;
  if (enableCodeAgent) {
    const providerOptions = ["claude-code", "codex", "copilot", "custom"];
    const defaultProvider = existingCodeAgent?.provider ?? (detectedAgents[0] ?? "claude-code");
    const providerAnswer = await promptWithPrefill(
      `  Provider [${providerOptions.join("/")}]: `,
      defaultProvider
    );
    const provider = providerOptions.includes(providerAnswer.trim()) ? providerAnswer.trim() : defaultProvider;

    let apiKeyEnvDefault = existingCodeAgent?.apiKeyEnv ?? "";
    if (provider === "claude-code" && !apiKeyEnvDefault) apiKeyEnvDefault = "ANTHROPIC_API_KEY";
    const apiKeyAnswer = await promptWithPrefill("  API key env var (blank if CLI handles auth): ", apiKeyEnvDefault);

    const workDirDefault = existingCodeAgent?.workingDir ?? process.cwd();
    const workDirAnswer = await promptWithPrefill("  Default working directory: ", workDirDefault);

    codeAgentPrefs = {
      provider,
      ...(apiKeyAnswer.trim() ? { apiKeyEnv: apiKeyAnswer.trim() } : {}),
      workingDir: workDirAnswer.trim() || process.cwd()
    };
  }

  // Build location preferences:
  // - Weather declined → clear any existing zipCode/city so the tool hint is suppressed.
  // - Weather enabled with input → store the location as zipCode.
  // - Weather enabled but no input → leave existing values untouched (omit the key).
  const locationPrefs = !wantWeather
    ? { zipCode: undefined, city: undefined }
    : zipAnswer.trim()
      ? { zipCode: zipAnswer.trim() }
      : {};

  return {
    ...nextSetup,
    name: promptedName || initialName,
    preferences: {
      ...locationPrefs,
      jobSearchEnabled,
      toolAuthorization: {
        wikipedia: toolAuthWikipedia,
        reddit: toolAuthReddit,
        webSearch: toolAuthWebSearch,
        weather: toolAuthWeather,
        benlive: toolAuthBenlive,
        website: toolAuthWebsite,
        toCode: enableCodeAgent
      },
      ...(portRecommended ? { portRecommended: true } : {}),
      ...(enableCodeAgent && codeAgentPrefs ? { codeAgent: codeAgentPrefs } : {})
    }
  };
}

/** Detect installed coding agent CLIs using which/where. */
async function detectSetupCodeAgents() {
  const { spawn } = await import("node:child_process");
  const whichCmd = process.platform === "win32" ? "where" : "which";
  const checks = [["claude-code", "claude"], ["codex", "codex"], ["copilot", "gh"]];
  const found = [];
  for (const [label, cmd] of checks) {
    const ok = await new Promise((resolve) => {
      const child = spawn(whichCmd, [cmd], { stdio: "ignore", env: { PATH: process.env.PATH ?? "" } });
      child.on("close", (code) => resolve(code === 0));
      child.on("error", () => resolve(false));
    });
    if (ok) found.push(label);
  }
  return found;
}

function buildManagedEnvBlock({ setup, machine, discovered }) {
  const localUiHost =
    setup.publicHost && setup.publicHost.trim() !== "" ? setup.publicHost.trim() : "127.0.0.1";
  const prefs = setup.preferences ?? {};

  return [
    "# >>> localcrew orchestrator setup >>>",
    "LOCALCREW_API_ENABLED=true",
    `LOCALCREW_API_BIND_HOST=${setup.bindHost}`,
    `LOCALCREW_API_PUBLIC_HOST=${localUiHost}`,
    `LOCALCREW_API_PORT=${setup.apiPort}`,
    `LOCALCREW_ORCHESTRATOR_NAME=${setup.name}`,
    "LOCALCREW_DEFAULT_ENDPOINT=cap",
    `LOCALCREW_ORCHESTRATOR_ALIAS=${setup.alias}`,
    `LOCALCREW_ORCHESTRATOR_LABEL=${setup.label}`,
    `LOCALCREW_ORCHESTRATOR_TIER=${setup.tier}`,
    `LOCALCREW_ORCHESTRATOR_BASE_URL=${setup.endpointUrl}`,
    `LOCALCREW_ORCHESTRATOR_API_STYLE=${setup.apiStyle}`,
    ...(setup.apiKeyEnv ? [`LOCALCREW_ORCHESTRATOR_API_KEY_ENV=${setup.apiKeyEnv}`] : []),
    `LOCALCREW_ORCHESTRATOR_HOST_NAME=${machine.hostName}`,
    `LOCALCREW_ORCHESTRATOR_PLATFORM=${machine.platform}`,
    `LOCALCREW_ORCHESTRATOR_CPU_LOGICAL_CORES=${machine.cpuLogicalCores}`,
    `LOCALCREW_ORCHESTRATOR_RAM_GB=${machine.ramGb}`,
    ...(machine.localIp ? [`LOCALCREW_ORCHESTRATOR_LOCAL_IP=${machine.localIp}`] : []),
    ...(discovered.defaultModel ? [`LOCALCREW_ORCHESTRATOR_DEFAULT_MODEL=${discovered.defaultModel}`] : []),
    ...(discovered.reasoningModel
      ? [`LOCALCREW_ORCHESTRATOR_REASONING_MODEL=${discovered.reasoningModel}`]
      : []),
    ...(discovered.codingModel
      ? [`LOCALCREW_ORCHESTRATOR_CODING_MODEL=${discovered.codingModel}`]
      : []),
    ...(discovered.toolsModel
      ? [`LOCALCREW_ORCHESTRATOR_TOOLS_MODEL=${discovered.toolsModel}`]
      : []),
    ...(discovered.embeddingModel
      ? [`LOCALCREW_ORCHESTRATOR_EMBEDDING_MODEL=${discovered.embeddingModel}`]
      : []),
    `LOCALCREW_ENDPOINT_CAP_RESOURCE=${setup.alias}`,
    "LOCALCREW_ENDPOINT_CAP_NICKNAME=Cap",
    ...(discovered.defaultModel ? [`LOCALCREW_ENDPOINT_CAP_MODEL=${discovered.defaultModel}`] : []),
    `LOCALCREW_ENDPOINT_VIC_RESOURCE=${setup.alias}`,
    "LOCALCREW_ENDPOINT_VIC_NICKNAME=Vic",
    ...(discovered.defaultModel ? [`LOCALCREW_ENDPOINT_VIC_MODEL=${discovered.defaultModel}`] : []),
    `LOCALCREW_ENDPOINT_MIN_RESOURCE=${setup.alias}`,
    "LOCALCREW_ENDPOINT_MIN_NICKNAME=Min",
    ...(discovered.defaultModel ? [`LOCALCREW_ENDPOINT_MIN_MODEL=${discovered.defaultModel}`] : []),
    `LOCALCREW_ENDPOINT_PAV_RESOURCE=${setup.alias}`,
    "LOCALCREW_ENDPOINT_PAV_NICKNAME=Pav",
    ...(discovered.defaultModel ? [`LOCALCREW_ENDPOINT_PAV_MODEL=${discovered.defaultModel}`] : []),
    ...(prefs.zipCode ? [`LOCALCREW_PREFERENCES_ZIP_CODE=${prefs.zipCode}`] : []),
    ...(prefs.jobSearchEnabled !== undefined
      ? [`LOCALCREW_JOB_SEARCH_ENABLED=${prefs.jobSearchEnabled ? "true" : "false"}`]
      : []),
    "# <<< localcrew orchestrator setup <<<"
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
    /# >>> localcrew orchestrator setup >>>[\s\S]*?# <<< localcrew orchestrator setup <<<\n?/g;
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

async function syncExistingConfigName(rootDir, name) {
  const paths = getStoragePaths(rootDir);
  if (!existsSync(paths.configPath)) {
    return;
  }

  try {
    const rawConfig = await readFile(paths.configPath, "utf8");
    const parsedConfig = JSON.parse(rawConfig);
    if (!parsedConfig || typeof parsedConfig !== "object") {
      return;
    }

    const nextConfig = {
      ...parsedConfig,
      orchestratorName: name
    };
    await writeFile(paths.configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf8");
  } catch {
    // Leave existing config untouched if it cannot be parsed safely here.
  }
}

async function startLocalCrewProcess(rootDir) {
  const command = process.platform === "win32" ? "npm.cmd" : "npm";

  await new Promise((resolveStart, rejectStart) => {
    const child = spawn(command, ["run", "start"], {
      cwd: rootDir,
      stdio: "inherit"
    });

    child.on("error", rejectStart);
    child.on("exit", (code) => {
      if (typeof code === "number" && code !== 0) {
        rejectStart(new Error(`npm run start exited with code ${code}.`));
        return;
      }
      resolveStart(undefined);
    });
  });
}

async function syncResourceInventory({ setup, machine, discovered }) {
  const resources = await loadResources(setup.rootDir);
  const deviceId = getDeviceId(machine);
  for (const [alias, resource] of Object.entries(resources)) {
    if (!resource || typeof resource !== "object" || alias === setup.alias) {
      continue;
    }

    if (
      (typeof resource.deviceId === "string" && resource.deviceId === deviceId) ||
      (resource.hostName === machine.hostName && resource.platform === machine.platform)
    ) {
      delete resources[alias];
    }
  }
  resources[setup.alias] = {
    alias: setup.alias,
    label: setup.label,
    tier: setup.tier,
    baseUrl: setup.endpointUrl,
    apiStyle: setup.apiStyle,
    ...(setup.apiKeyEnv ? { apiKeyEnv: setup.apiKeyEnv } : {}),
    deviceId,
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
  const parsedSetup = parseArgs(process.argv.slice(2));
  const setup = await resolveSetupOptions(parsedSetup);
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
  await syncExistingConfigName(setup.rootDir, setup.name);

  // Write prompted preferences to config.json if it already exists.
  if (setup.preferences && Object.keys(setup.preferences).length > 0) {
    await savePreferencesToConfig(setup.rootDir, setup.preferences);
  }

  const localUiUrl = `http://127.0.0.1:${setup.apiPort}/ui`;
  const localDisplayUrl = `http://127.0.0.1:${setup.apiPort}/display`;
  const lanUiUrl =
    setup.publicHost && setup.publicHost !== "127.0.0.1"
      ? `http://${setup.publicHost}:${setup.apiPort}/ui`
      : localUiUrl;
  const lanDisplayUrl =
    setup.publicHost && setup.publicHost !== "127.0.0.1"
      ? `http://${setup.publicHost}:${setup.apiPort}/display`
      : localDisplayUrl;

  console.log("Local Crew setup complete.");
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
  if (setup.preferences) {
    if (setup.preferences.zipCode) {
      console.log(`Weather location: ${setup.preferences.zipCode}`);
    }
    if (setup.preferences.jobSearchEnabled !== undefined) {
      console.log(`Job search in auto sessions: ${setup.preferences.jobSearchEnabled ? "enabled" : "disabled"}`);
    }
  }
  console.log(`API health (after start): http://127.0.0.1:${setup.apiPort}/api/health`);
  console.log(`API status (after start): http://127.0.0.1:${setup.apiPort}/api/status`);
  console.log(`Local UI (after start): ${localUiUrl}`);
  console.log(`Billboard display (after start): ${localDisplayUrl}`);
  if (lanUiUrl !== localUiUrl) {
    console.log(`LAN health (after start): http://${setup.publicHost}:${setup.apiPort}/api/health`);
    console.log(`LAN status (after start): http://${setup.publicHost}:${setup.apiPort}/api/status`);
    console.log(`LAN UI (after start): ${lanUiUrl}`);
    console.log(`LAN billboard display (after start): ${lanDisplayUrl}`);
  }
  console.log("");
  console.log("Next steps:");
  if (setup.noStart) {
    console.log("1. Start Local Crew with: npm run start");
    console.log("2. Open the Local UI or Billboard display links above after startup.");
  } else {
    console.log("1. Local Crew will start now in this terminal.");
    console.log("2. Open the Local UI or Billboard display links above after startup.");
  }
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

  if (!setup.noStart) {
    console.log("");
    console.log("Starting Local Crew now: npm run start");
    await startLocalCrewProcess(setup.rootDir);
  }
}

main().catch((error) => {
  console.error(`Setup failed: ${error.message}`);
  process.exitCode = 1;
});
