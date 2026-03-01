import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { loadLocalEnv } from "./env.ts";
import { loadBuiltinAgentSeeds, loadSeedFile } from "./external-memory.ts";
import { getStoragePaths } from "./storage.ts";
import { getResourceAliases, renderResourceInventory } from "./resources.ts";
import { getDefaultTelemetrySummary } from "./telemetry.ts";
import type {
  AgentCreateAnswers,
  AgentMemoryFile,
  AgentMeta,
  AutoQueueTask,
  SharedConversationState,
  SystemState,
  TaskPriority
} from "./types.ts";

const PRIORITY_ORDER: TaskPriority[] = ["high", "medium", "low"];
const ACTIVE_AUTO_DIRECTIVE_HEADING = "## Active Auto Directive";

function getEmptyConversation(): SharedConversationState {
  return {
    messages: [],
    compactedUntil: 0,
    summary: ""
  };
}

function getEmptyAgentMemory(): AgentMemoryFile {
  return {
    conversation: getEmptyConversation()
  };
}

function getDefaultSystemState(): SystemState {
  return {
    auto: {
      enabled: false,
      defaultPriority: "high",
      lastTaskId: 0,
      pending: [],
      completed: []
    }
  };
}

function normalizePriority(value: unknown): TaskPriority {
  return PRIORITY_ORDER.includes(value as TaskPriority) ? (value as TaskPriority) : "high";
}

function normalizeTask(value: unknown): AutoQueueTask | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<AutoQueueTask>;
  if (typeof candidate.id !== "number" || candidate.id < 1) {
    return null;
  }

  if (typeof candidate.content !== "string" || candidate.content.trim() === "") {
    return null;
  }

  if (typeof candidate.createdAt !== "string" || candidate.createdAt.trim() === "") {
    return null;
  }

  if (typeof candidate.createdBy !== "string" || candidate.createdBy.trim() === "") {
    return null;
  }

  return {
    id: candidate.id,
    content: candidate.content.trim(),
    priority: normalizePriority(candidate.priority),
    createdAt: candidate.createdAt,
    createdBy: candidate.createdBy,
    status: candidate.status === "completed" ? "completed" : "queued",
    ...(typeof candidate.requestedResource === "string" &&
    candidate.requestedResource.trim() !== ""
      ? { requestedResource: candidate.requestedResource }
      : {}),
    ...(typeof candidate.requestedModel === "string" && candidate.requestedModel.trim() !== ""
      ? { requestedModel: candidate.requestedModel }
      : {}),
    ...(typeof candidate.assignedResource === "string" && candidate.assignedResource.trim() !== ""
      ? { assignedResource: candidate.assignedResource }
      : {}),
    ...(typeof candidate.assignedModel === "string" && candidate.assignedModel.trim() !== ""
      ? { assignedModel: candidate.assignedModel }
      : {}),
    ...(typeof candidate.agentName === "string" && candidate.agentName.trim() !== ""
      ? { agentName: candidate.agentName }
      : {}),
    ...(typeof candidate.result === "string" ? { result: candidate.result } : {})
  };
}

function normalizeSystemState(raw: unknown): SystemState {
  if (!raw || typeof raw !== "object") {
    return getDefaultSystemState();
  }

  const candidate = raw as { auto?: unknown };
  if (!candidate.auto || typeof candidate.auto !== "object") {
    return getDefaultSystemState();
  }

  const auto = candidate.auto as Partial<SystemState["auto"]>;
  const pending = Array.isArray(auto.pending)
    ? auto.pending.map(normalizeTask).filter((task): task is AutoQueueTask => task !== null)
    : [];
  const completed = Array.isArray(auto.completed)
    ? auto.completed.map(normalizeTask).filter((task): task is AutoQueueTask => task !== null)
    : [];

  return {
    auto: {
      enabled: auto.enabled === true,
      defaultPriority: normalizePriority(auto.defaultPriority),
      lastTaskId:
        typeof auto.lastTaskId === "number" && auto.lastTaskId >= 0 ? auto.lastTaskId : 0,
      pending,
      completed
    }
  };
}

function getDefaultDirectives(): string {
  return [
    "# Erin Directives",
    "",
    "You are Erin, the orchestrator and conscience of this local agent swarm.",
    "Your job is to route work across the available inference resources, keep memory useful, and keep the system improving inside its local scope.",
    "",
    "## Core Rules",
    "",
    "- Use air for orchestration, reasoning, verification, and code-heavy work when uncertain.",
    "- Use vic for heavier general drafting and sustained generation.",
    "- Use min for routing, indexing, queue formatting, and lightweight structured outputs.",
    "- Use pav for overflow and alternate small-model perspective.",
    "- Keep tasks concrete, concise, and scoped to what this local system can actually do.",
    "- When the queue is empty, propose a brief medium/low priority self-improvement backlog for the orchestration system itself.",
    "- Agent identities are separate from devices. Devices are inference resources; agents are persistent working identities with their own specs and memory.",
    "- Track model/runtime evidence so delegation and model-switching decisions are based on measured performance instead of guesswork.",
    "- Prefer stable model assignments, but switch models when telemetry shows a clear gain in quality or throughput for the task.",
    "",
    ACTIVE_AUTO_DIRECTIVE_HEADING,
    "",
    "- In `/auto`, self-aware self-improvement is Erin's default operating stance whenever the user has not given a more urgent direct task.",
    "- Continuously review documentation, indexing, task logs, prompt guidance, delegation heuristics, queue hygiene, and memory quality for opportunities to improve the system.",
    "- Build observability that helps the user and the system understand queue health, model performance, tool effectiveness, and current focus at a glance.",
    "- Convert observations from completed work into concrete next-step tasks, roadmap updates, changelog notes, and tighter internal guidance.",
    "- Prefer improvements that make future autonomous work more coherent, reliable, efficient, and easier to verify.",
    "- Never remain idle in `/auto`: if no task is queued, create the next best internal improvement task and continue."
  ].join("\n");
}

function getDefaultRoadmap(): string {
  return [
    "# Roadmap",
    "",
    "- Refine routing policy with measured queue, latency, and model-load evidence.",
    "- Expand the terminal HUD and browser-facing API into richer observability surfaces.",
    "- Deepen agent identity creation, editing, and memory quality.",
    "- Use the data-analyst identity for recurring metrics reviews and process refinements.",
    "- Tighten structured outputs, indexing, compaction quality, and validation before promotion.",
    "- Formalize how validated internal discoveries are promoted into committed external-memory seeds."
  ].join("\n");
}

function getDefaultFocusTodo(): string {
  return [
    "# In Focus Todo",
    "",
    "- [high] Refine routing policy using measured queue pressure, latency, and model-switch costs.",
    "- [medium] Expand the browser-facing API and GUI parity plan for observability and control.",
    "- [medium] Formalize promotion from internal runtime discoveries into committed external-memory seeds."
  ].join("\n");
}

function getDefaultChangelog(): string {
  return ["# Changelog", ""].join("\n");
}

function getDefaultWorkflow(): string {
  return [
    "# Agent Creation Workflow",
    "",
    "Collect the following before creating an agent identity:",
    "- Public name",
    "- One-line summary",
    "- Mission and responsibility",
    "- Personality and response style",
    "- Tool-use and skills guidance",
    "- Preferred resource (`air`, `vic`, `min`, `pav`, or `auto`)"
  ].join("\n");
}

async function writeIfMissing(path: string, content: string): Promise<void> {
  try {
    await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
    await writeFile(path, `${content.trimEnd()}\n`, "utf8");
  }
}

async function readAgentsIndexWithoutEnsure(rootDir = process.cwd()): Promise<AgentMeta[]> {
  const paths = getStoragePaths(rootDir);
  const raw = await readFile(paths.agentsIndexPath, "utf8");
  const parsed = JSON.parse(raw) as { agents?: unknown[] };
  return Array.isArray(parsed.agents)
    ? parsed.agents.map(normalizeAgentMeta).filter((agent): agent is AgentMeta => agent !== null)
    : [];
}

async function seedBuiltinAgents(rootDir = process.cwd()): Promise<void> {
  const paths = getStoragePaths(rootDir);
  const seeds = await loadBuiltinAgentSeeds(rootDir);
  if (seeds.length === 0) {
    return;
  }

  const agents = await readAgentsIndexWithoutEnsure(rootDir);
  let changed = false;

  for (const seed of seeds) {
    if (agents.some((agent) => agent.slug === seed.slug)) {
      continue;
    }

    const now = new Date().toISOString();
    const meta: AgentMeta = {
      slug: seed.slug,
      name: seed.name,
      summary: seed.summary,
      preferredResource: seed.preferredResource,
      createdAt: now,
      updatedAt: now
    };

    const agentDir = getAgentDir(rootDir, seed.slug);
    await mkdir(agentDir, { recursive: true });
    await writeFile(getAgentMetaPath(rootDir, seed.slug), `${JSON.stringify(meta, null, 2)}\n`, "utf8");
    await writeFile(getAgentSpecPath(rootDir, seed.slug), `${seed.spec.trimEnd()}\n`, "utf8");
    await writeFile(
      getAgentMemoryPath(rootDir, seed.slug),
      `${JSON.stringify(getEmptyAgentMemory(), null, 2)}\n`,
      "utf8"
    );
    await writeFile(
      getAgentMemoryIndexPath(rootDir, seed.slug),
      `${JSON.stringify({ updatedAt: now, summary: "", recentMessages: [] }, null, 2)}\n`,
      "utf8"
    );
    agents.push(meta);
    changed = true;
  }

  if (changed) {
    await writeFile(paths.agentsIndexPath, `${JSON.stringify({ agents }, null, 2)}\n`, "utf8");
  }
}

async function ensureDocumentContains(
  path: string,
  requiredMarker: string,
  appendix: string
): Promise<void> {
  const existing = await readFile(path, "utf8");
  if (existing.includes(requiredMarker)) {
    return;
  }

  await writeFile(path, `${existing.trimEnd()}\n\n${appendix.trim()}\n`, "utf8");
}

export async function ensureSystemLayout(rootDir = process.cwd()): Promise<void> {
  loadLocalEnv(rootDir);
  const paths = getStoragePaths(rootDir);
  await mkdir(paths.systemDir, { recursive: true });
  await mkdir(paths.secureDir, { recursive: true });
  await mkdir(paths.orchestratorDir, { recursive: true });
  await mkdir(paths.orchestratorMemoryDir, { recursive: true });
  await mkdir(paths.telemetryDir, { recursive: true });
  await mkdir(paths.agentsDir, { recursive: true });

  await writeIfMissing(paths.systemStatePath, JSON.stringify(getDefaultSystemState(), null, 2));
  await writeIfMissing(
    paths.directivesPath,
    await loadSeedFile("orchestrator/directives.md", getDefaultDirectives(), rootDir)
  );
  await writeIfMissing(
    paths.roadmapPath,
    await loadSeedFile("orchestrator/roadmap.md", getDefaultRoadmap(), rootDir)
  );
  await writeIfMissing(
    paths.focusTodoPath,
    await loadSeedFile("orchestrator/focus-todo.md", getDefaultFocusTodo(), rootDir)
  );
  await writeIfMissing(paths.changelogPath, getDefaultChangelog());
  await writeIfMissing(paths.deviceInventoryPath, renderResourceInventory(rootDir));
  await writeIfMissing(
    paths.agentWorkflowPath,
    await loadSeedFile("orchestrator/agent-new-workflow.md", getDefaultWorkflow(), rootDir)
  );
  await writeIfMissing(
    paths.telemetrySummaryPath,
    JSON.stringify(getDefaultTelemetrySummary(), null, 2)
  );
  await writeIfMissing(paths.auditLogPath, "");
  await writeIfMissing(
    paths.orchestratorMemoryIndexPath,
    JSON.stringify({ updatedAt: null, activeAgents: [], queueDepth: 0 }, null, 2)
  );
  await writeIfMissing(
    paths.orchestratorMemorySummaryPath,
    "# Orchestrator Memory\n\nPersistent orchestrator summaries and notes live here.\n"
  );
  await writeIfMissing(paths.agentsIndexPath, JSON.stringify({ agents: [] }, null, 2));
  await ensureDocumentContains(
    paths.directivesPath,
    ACTIVE_AUTO_DIRECTIVE_HEADING,
    [
      ACTIVE_AUTO_DIRECTIVE_HEADING,
      "",
      "- In `/auto`, self-aware self-improvement is Erin's default operating stance whenever the user has not given a more urgent direct task.",
      "- Continuously review documentation, indexing, task logs, prompt guidance, delegation heuristics, queue hygiene, and memory quality for opportunities to improve the system.",
      "- Convert observations from completed work into concrete next-step tasks, roadmap updates, changelog notes, and tighter internal guidance.",
      "- Prefer improvements that make future autonomous work more coherent, reliable, efficient, and easier to verify.",
      "- Never remain idle in `/auto`: if no task is queued, create the next best internal improvement task and continue."
    ].join("\n")
  );
  await ensureDocumentContains(
    paths.directivesPath,
    "- Track model/runtime evidence so delegation and model-switching decisions are based on measured performance instead of guesswork.",
    [
      "## Telemetry And Model Policy",
      "",
      "- Track model/runtime evidence so delegation and model-switching decisions are based on measured performance instead of guesswork.",
      "- Prefer stable model assignments, but switch models when telemetry shows a clear gain in quality or throughput for the task.",
      "- Build observability that helps the user and the system understand queue health, model performance, tool effectiveness, and current focus at a glance."
    ].join("\n")
  );
  await ensureDocumentContains(
    paths.roadmapPath,
    "- Add runtime telemetry, task analytics, and per-model performance history.",
    [
      "- Add runtime telemetry, task analytics, and per-model performance history.",
      "- Add a dedicated data-analyst agent identity for metrics review and routing refinements.",
      "- Build a richer terminal HUD and prepare a browser GUI with parity for observability and control."
    ].join("\n")
  );
  await ensureDocumentContains(
    paths.focusTodoPath,
    "- [high] Add telemetry capture for model latency, token counts, and queue outcomes.",
    [
      "- [high] Add telemetry capture for model latency, token counts, and queue outcomes.",
      "- [medium] Design a data-analyst agent identity that distills metrics into routing refinements.",
      "- [medium] Specify a terminal HUD and browser GUI parity plan."
    ].join("\n")
  );
  await seedBuiltinAgents(rootDir);
}

export async function loadSystemState(rootDir = process.cwd()): Promise<SystemState> {
  loadLocalEnv(rootDir);
  const paths = getStoragePaths(rootDir);
  await ensureSystemLayout(rootDir);

  try {
    const raw = await readFile(paths.systemStatePath, "utf8");
    const normalized = normalizeSystemState(JSON.parse(raw));
    await saveSystemState(normalized, rootDir);
    return normalized;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`System state is not valid JSON: ${error.message}`);
    }

    throw error;
  }
}

export async function saveSystemState(
  state: SystemState,
  rootDir = process.cwd()
): Promise<void> {
  const paths = getStoragePaths(rootDir);
  await ensureSystemLayout(rootDir);
  await writeFile(paths.systemStatePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export async function loadSystemDocuments(rootDir = process.cwd()): Promise<{
  directives: string;
  roadmap: string;
  focusTodo: string;
  changelog: string;
  inventory: string;
  workflow: string;
  orchestratorSummary: string;
}> {
  const paths = getStoragePaths(rootDir);
  await ensureSystemLayout(rootDir);

  const [directives, roadmap, focusTodo, changelog, inventory, workflow, orchestratorSummary] =
    await Promise.all([
      readFile(paths.directivesPath, "utf8"),
      readFile(paths.roadmapPath, "utf8"),
      readFile(paths.focusTodoPath, "utf8"),
      readFile(paths.changelogPath, "utf8"),
      readFile(paths.deviceInventoryPath, "utf8"),
      readFile(paths.agentWorkflowPath, "utf8"),
      readFile(paths.orchestratorMemorySummaryPath, "utf8")
    ]);

  return {
    directives,
    roadmap,
    focusTodo,
    changelog,
    inventory,
    workflow,
    orchestratorSummary
  };
}

export async function saveFocusTodo(
  tasks: AutoQueueTask[],
  rootDir = process.cwd()
): Promise<void> {
  const paths = getStoragePaths(rootDir);
  await ensureSystemLayout(rootDir);

  const lines =
    tasks.length === 0
      ? getDefaultFocusTodo()
      : [
          "# In Focus Todo",
          "",
          ...tasks.map((task) => `- [${task.priority}] #${task.id} ${task.content}`)
        ].join("\n");

  await writeFile(paths.focusTodoPath, `${lines.trimEnd()}\n`, "utf8");
}

export async function appendChangelogEntry(
  entry: string,
  rootDir = process.cwd()
): Promise<void> {
  const paths = getStoragePaths(rootDir);
  await ensureSystemLayout(rootDir);
  const previous = await readFile(paths.changelogPath, "utf8");
  const timestamp = new Date().toISOString();
  const next = `${previous.trimEnd()}\n- ${timestamp} ${entry}\n`;
  await writeFile(paths.changelogPath, next, "utf8");
}

export async function updateOrchestratorIndex(options: {
  queueDepth: number;
  activeAgents: string[];
  rootDir?: string;
}): Promise<void> {
  const paths = getStoragePaths(options.rootDir);
  await ensureSystemLayout(options.rootDir);
  await writeFile(
    paths.orchestratorMemoryIndexPath,
    `${JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        queueDepth: options.queueDepth,
        activeAgents: options.activeAgents
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

function getAgentDir(rootDir: string, slug: string): string {
  return join(getStoragePaths(rootDir).agentsDir, slug.toLowerCase());
}

function getAgentMetaPath(rootDir: string, slug: string): string {
  return join(getAgentDir(rootDir, slug), "meta.json");
}

function getAgentSpecPath(rootDir: string, slug: string): string {
  return join(getAgentDir(rootDir, slug), "spec.md");
}

function getAgentMemoryPath(rootDir: string, slug: string): string {
  return join(getAgentDir(rootDir, slug), "memory.json");
}

function getAgentMemoryIndexPath(rootDir: string, slug: string): string {
  return join(getAgentDir(rootDir, slug), "memory-index.json");
}

function normalizeAgentMeta(value: unknown): AgentMeta | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<AgentMeta>;
  if (
    typeof candidate.slug !== "string" ||
    typeof candidate.name !== "string" ||
    typeof candidate.summary !== "string" ||
    typeof candidate.createdAt !== "string" ||
    typeof candidate.updatedAt !== "string"
  ) {
    return null;
  }

  const preferredResource =
    typeof candidate.preferredResource === "string" ? candidate.preferredResource : "auto";

  return {
    slug: candidate.slug.toLowerCase(),
    name: candidate.name,
    summary: candidate.summary,
    preferredResource,
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt
  };
}

async function loadAgentsIndex(rootDir = process.cwd()): Promise<AgentMeta[]> {
  const paths = getStoragePaths(rootDir);
  await ensureSystemLayout(rootDir);
  const raw = await readFile(paths.agentsIndexPath, "utf8");
  const parsed = JSON.parse(raw) as { agents?: unknown[] };
  return Array.isArray(parsed.agents)
    ? parsed.agents.map(normalizeAgentMeta).filter((agent): agent is AgentMeta => agent !== null)
    : [];
}

async function saveAgentsIndex(agents: AgentMeta[], rootDir = process.cwd()): Promise<void> {
  const paths = getStoragePaths(rootDir);
  await ensureSystemLayout(rootDir);
  await writeFile(paths.agentsIndexPath, `${JSON.stringify({ agents }, null, 2)}\n`, "utf8");
}

export async function listAgents(rootDir = process.cwd()): Promise<AgentMeta[]> {
  const agents = await loadAgentsIndex(rootDir);
  return [...agents].sort((left, right) => left.slug.localeCompare(right.slug));
}

export function normalizeAgentSlug(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  return slug.replace(/^-+|-+$/g, "");
}

export function isValidPreferredResource(resource: string, rootDir = process.cwd()): boolean {
  return resource === "auto" || getResourceAliases(rootDir).includes(resource);
}

function buildAgentSpec(answers: AgentCreateAnswers): string {
  return [
    `# ${answers.name}`,
    "",
    `Summary: ${answers.summary}`,
    "",
    "## Mission",
    answers.mission,
    "",
    "## Personality And Response Guidance",
    answers.style,
    "",
    "## Tool Use And Skills Training",
    answers.skills,
    "",
    "## Preferred Resource",
    answers.preferredResource,
    "",
    "## Queue Delegation Guidance",
    "When a concrete asynchronous follow-up should be delegated to the orchestrator queue, end with one or more lines in this format:",
    "QUEUE[medium]: concise task",
    "QUEUE[low]: concise task",
    "Or, when a specific device should be requested explicitly:",
    "QUEUE[medium][air]: concise task"
  ].join("\n");
}

export async function createAgent(
  answers: AgentCreateAnswers,
  rootDir = process.cwd(),
  generatedSpec?: string
): Promise<AgentMeta> {
  const slug = normalizeAgentSlug(answers.name);
  if (!slug) {
    throw new Error("Agent name must include letters or numbers.");
  }

  const agents = await loadAgentsIndex(rootDir);
  if (agents.some((agent) => agent.slug === slug)) {
    throw new Error(`Agent "${slug}" already exists.`);
  }

  const now = new Date().toISOString();
  const meta: AgentMeta = {
    slug,
    name: answers.name.trim(),
    summary: answers.summary.trim(),
    preferredResource: answers.preferredResource,
    createdAt: now,
    updatedAt: now
  };

  const agentDir = getAgentDir(rootDir, slug);
  await mkdir(agentDir, { recursive: true });
  await writeFile(getAgentMetaPath(rootDir, slug), `${JSON.stringify(meta, null, 2)}\n`, "utf8");
  await writeFile(
    getAgentSpecPath(rootDir, slug),
    `${(generatedSpec?.trim() || buildAgentSpec(answers)).trimEnd()}\n`,
    "utf8"
  );
  await writeFile(
    getAgentMemoryPath(rootDir, slug),
    `${JSON.stringify(getEmptyAgentMemory(), null, 2)}\n`,
    "utf8"
  );
  await writeFile(
    getAgentMemoryIndexPath(rootDir, slug),
    `${JSON.stringify({ updatedAt: now, summary: "", recentMessages: [] }, null, 2)}\n`,
    "utf8"
  );

  await saveAgentsIndex([...agents, meta], rootDir);
  return meta;
}

export async function loadAgentMeta(slug: string, rootDir = process.cwd()): Promise<AgentMeta> {
  const agents = await loadAgentsIndex(rootDir);
  const agent = agents.find((entry) => entry.slug === normalizeAgentSlug(slug));
  if (!agent) {
    throw new Error(`Unknown agent "${slug}".`);
  }
  return agent;
}

export async function loadAgentSpec(slug: string, rootDir = process.cwd()): Promise<string> {
  const normalizedSlug = normalizeAgentSlug(slug);
  await loadAgentMeta(normalizedSlug, rootDir);
  return readFile(getAgentSpecPath(rootDir, normalizedSlug), "utf8");
}

export async function saveAgentSpec(
  slug: string,
  text: string,
  rootDir = process.cwd()
): Promise<AgentMeta> {
  const normalizedSlug = normalizeAgentSlug(slug);
  const agents = await loadAgentsIndex(rootDir);
  const targetIndex = agents.findIndex((agent) => agent.slug === normalizedSlug);
  if (targetIndex === -1) {
    throw new Error(`Unknown agent "${slug}".`);
  }

  await writeFile(getAgentSpecPath(rootDir, normalizedSlug), `${text.trimEnd()}\n`, "utf8");
  const updatedSummaryLine =
    text
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.startsWith("Summary:")) ?? `Summary: ${agents[targetIndex].summary}`;
  const updatedSummary = updatedSummaryLine.replace(/^Summary:\s*/i, "").trim();
  const updatedMeta: AgentMeta = {
    ...agents[targetIndex],
    summary: updatedSummary || agents[targetIndex].summary,
    updatedAt: new Date().toISOString()
  };
  const nextAgents = [...agents];
  nextAgents[targetIndex] = updatedMeta;
  await writeFile(
    getAgentMetaPath(rootDir, normalizedSlug),
    `${JSON.stringify(updatedMeta, null, 2)}\n`,
    "utf8"
  );
  await saveAgentsIndex(nextAgents, rootDir);
  return updatedMeta;
}

function normalizeAgentMemory(raw: unknown): AgentMemoryFile {
  if (!raw || typeof raw !== "object") {
    return getEmptyAgentMemory();
  }

  const conversation = (raw as { conversation?: unknown }).conversation;
  if (!conversation || typeof conversation !== "object") {
    return getEmptyAgentMemory();
  }

  const candidate = conversation as Partial<SharedConversationState>;

  return {
    conversation: {
      messages: Array.isArray(candidate.messages) ? candidate.messages : [],
      compactedUntil:
        typeof candidate.compactedUntil === "number" && candidate.compactedUntil >= 0
          ? candidate.compactedUntil
          : 0,
      summary: typeof candidate.summary === "string" ? candidate.summary : ""
    }
  };
}

export async function loadAgentMemory(
  slug: string,
  rootDir = process.cwd()
): Promise<AgentMemoryFile> {
  const normalizedSlug = normalizeAgentSlug(slug);
  await loadAgentMeta(normalizedSlug, rootDir);

  try {
    const raw = await readFile(getAgentMemoryPath(rootDir, normalizedSlug), "utf8");
    const memory = normalizeAgentMemory(JSON.parse(raw));
    await saveAgentMemory(normalizedSlug, memory, rootDir);
    return memory;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      const memory = getEmptyAgentMemory();
      await saveAgentMemory(normalizedSlug, memory, rootDir);
      return memory;
    }

    if (error instanceof SyntaxError) {
      throw new Error(`Agent memory for "${slug}" is not valid JSON: ${error.message}`);
    }

    throw error;
  }
}

export async function saveAgentMemory(
  slug: string,
  memory: AgentMemoryFile,
  rootDir = process.cwd()
): Promise<void> {
  const normalizedSlug = normalizeAgentSlug(slug);
  await writeFile(
    getAgentMemoryPath(rootDir, normalizedSlug),
    `${JSON.stringify(memory, null, 2)}\n`,
    "utf8"
  );

  const recentMessages = memory.conversation.messages.slice(-5).map((message) =>
    message.speaker === "user"
      ? `USER -> @${message.target}: ${message.content}`
      : message.directedTo
        ? `@${message.endpoint} to @${message.directedTo}: ${message.content}`
        : `@${message.endpoint}: ${message.content}`
  );

  await writeFile(
    getAgentMemoryIndexPath(rootDir, normalizedSlug),
    `${JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        summary: memory.conversation.summary,
        recentMessages
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

export async function resetAgentMemory(
  slug: string,
  rootDir = process.cwd()
): Promise<void> {
  await saveAgentMemory(slug, getEmptyAgentMemory(), rootDir);
}

export async function clearSystemState(rootDir = process.cwd()): Promise<void> {
  const paths = getStoragePaths(rootDir);
  await rm(paths.systemDir, { recursive: true, force: true });
  await ensureSystemLayout(rootDir);
}

export async function getAgentWorkflowLines(rootDir = process.cwd()): Promise<string[]> {
  const paths = getStoragePaths(rootDir);
  await ensureSystemLayout(rootDir);
  const workflow = await readFile(paths.agentWorkflowPath, "utf8");
  return workflow
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}
