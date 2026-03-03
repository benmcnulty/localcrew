import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";

import { loadLocalEnv } from "./env.ts";
import { loadBuiltinAgentSeeds, loadSeedFile } from "./external-memory.ts";
import { getOrchestratorIdentityName } from "./orchestrator-identity.ts";
import { atomicWriteFile, getStoragePaths, withFileLock } from "./storage.ts";
import { getResourceAliases, renderResourceInventory } from "./resources.ts";
import { getDefaultTelemetrySummary } from "./telemetry.ts";
import { getEmptyConversation } from "./utils.ts";
import type {
  AgentCreateAnswers,
  AgentMemoryFile,
  AgentMeta,
  AutoQueueTask,
  DailyWorkSession,
  SharedConversationState,
  SystemState,
  TaskPriority
} from "./types.ts";

const PRIORITY_ORDER: TaskPriority[] = ["high", "medium", "low"];
const ACTIVE_AUTO_DIRECTIVE_HEADING = "## Active Auto Directive";

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
    ...(typeof candidate.delegationRole === "string" && candidate.delegationRole.trim() !== ""
      ? { delegationRole: candidate.delegationRole.trim() }
      : {}),
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
    ...(typeof candidate.result === "string" ? { result: candidate.result } : {}),
    ...(typeof candidate.errorMessage === "string" && candidate.errorMessage.trim() !== ""
      ? { errorMessage: candidate.errorMessage }
      : {}),
    ...(typeof candidate.startedAt === "string" && candidate.startedAt.trim() !== ""
      ? { startedAt: candidate.startedAt }
      : {}),
    ...(typeof candidate.completedAt === "string" && candidate.completedAt.trim() !== ""
      ? { completedAt: candidate.completedAt }
      : {}),
    ...(typeof candidate.durationMs === "number" && candidate.durationMs >= 0
      ? { durationMs: candidate.durationMs }
      : {}),
    ...(typeof candidate.sourceDocumentRelativePath === "string" &&
    candidate.sourceDocumentRelativePath.trim() !== ""
      ? { sourceDocumentRelativePath: candidate.sourceDocumentRelativePath }
      : {}),
    ...(typeof candidate.sourceDocumentName === "string" &&
    candidate.sourceDocumentName.trim() !== ""
      ? { sourceDocumentName: candidate.sourceDocumentName }
      : {}),
    ...(typeof candidate.retryCount === "number" && candidate.retryCount > 0
      ? { retryCount: candidate.retryCount }
      : {}),
    ...(typeof candidate.lastFailedResource === "string" &&
    candidate.lastFailedResource.trim() !== ""
      ? { lastFailedResource: candidate.lastFailedResource }
      : {})
  };
}

function normalizeDailySession(raw: unknown): DailyWorkSession | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const candidate = raw as Partial<DailyWorkSession>;
  if (typeof candidate.startedAt !== "string" || candidate.startedAt.trim() === "") {
    return undefined;
  }
  return {
    startedAt: candidate.startedAt,
    tasksCompleted: typeof candidate.tasksCompleted === "number" ? candidate.tasksCompleted : 0,
    tasksErrored: typeof candidate.tasksErrored === "number" ? candidate.tasksErrored : 0,
    ...(typeof candidate.completedAt === "string" && candidate.completedAt.trim() !== ""
      ? { completedAt: candidate.completedAt }
      : {}),
    ...(typeof candidate.digestPath === "string" && candidate.digestPath.trim() !== ""
      ? { digestPath: candidate.digestPath }
      : {})
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
      completed,
      ...(auto.dailySession && typeof auto.dailySession === "object"
        ? { dailySession: normalizeDailySession(auto.dailySession) }
        : {})
    }
  };
}

function getDefaultDirectives(rootDir = process.cwd()): string {
  const orchestratorName = getOrchestratorIdentityName(rootDir);
  return [
    `# ${orchestratorName} Directives`,
    "",
    `You are ${orchestratorName}, the orchestrator and conscience of this local agent swarm.`,
    "Your job is to route work across the available inference resources, keep memory useful, and keep the system improving inside its local scope.",
    "",
    "## Core Rules",
    "",
    "- Prefer the local orchestrator resource for reasoning, verification, ambiguity resolution, and recovery work.",
    "- Prefer the strongest available non-orchestrator top-tier resource for sustained drafting when parallel capacity is useful.",
    "- Prefer mid-tier or tools-capable resources for routing, indexing, and bookkeeping work.",
    "- Reserve low-tier resources for isolated small-context tasks and overflow.",
    "- Keep tasks concrete, narrow, and proportionate to the current installation.",
    "- Treat the local network itself as a first-order optimization target: understand resource tiers, context ceilings, load, and measured behavior before proposing broader change.",
    "- Agent identities are separate from devices. Devices are inference resources; agents are persistent working identities with their own specs and memory.",
    "- Track model/runtime evidence so delegation and model-switching decisions are based on measured performance instead of guesswork.",
    "",
    "## Memory Boundary",
    "",
    "- `external-memory/` is the committed seed layer and should contain only portable guidance, workflows, and durable patterns.",
    "- `.localcrew/` is internal local memory and may contain runtime summaries, queues, telemetry, and local experimentation.",
    "- Internal notes, summaries, diagnostics, and process artifacts generated during `/auto` belong in `.localcrew/`, not in `external-memory/active/`.",
    "- Promote only validated lessons from local memory into committed seeds after they have been reviewed and simplified.",
    "- Prefer concise summaries and stable indexes over sprawling process prose.",
    "",
    ACTIVE_AUTO_DIRECTIVE_HEADING,
    "",
    `- In \`/auto\`, self-aware self-improvement is ${orchestratorName}'s default operating stance whenever the user has not given a more urgent direct task.`,
    "- Improve internal memory quality, routing quality, observability, context budgeting, queue hygiene, and failure recovery first.",
    "- Before adding autonomous tasks, draft the plan, have the standing secondary reviewer critique it, then finalize only the narrowed approved tasks by consensus.",
    '- Apply a "measure twice, cut once" standard: prefer fewer, clearer, better-justified tasks over speculative backlogs or documentation churn.',
    "- Autonomous work may directly change only internal memory, prompt guidance, indexes, summaries, and other contained process artifacts.",
    "- Use connected resource aliases from the live resource inventory only. Contributor chat participants are a separate concept and must not be used as substitute resource aliases.",
    "- If a useful improvement would require external application, API, UI, script, source-code, or system-service work, write a detailed feature request ticket into `external-memory/outbox/feature-requests/` instead of treating it as executable autonomous work.",
    "- Never invent resource names, nicknames, or aliases. Use only the exact resource roster provided by Local Crew.",
    "- Never create or rely on ad-hoc executable scripts, daemons, or undefined system processes from `/auto`; use only approved application capabilities.",
    "- Reject vague placeholder tasks. Every autonomous task must have a clear object, scope, and expected outcome.",
    "- Use Wikipedia only for external factual knowledge, not for internal Local Crew routing, prompt, naming, or model-diagnosis questions.",
    "- Unexpected failures should trigger diagnosis, quarantine, and recovery, not repeated blind retries.",
    "- Build observability that helps the user and the system understand queue health, model performance, tool effectiveness, and current focus at a glance.",
    "- Convert observations from completed work into concrete next-step tasks, roadmap updates, changelog notes, and tighter internal guidance."
  ].join("\n");
}

function getDefaultRoadmap(): string {
  return [
    "# Roadmap",
    "",
    "- Make autonomous routing more evidence-driven through cleaner telemetry interpretation, queue awareness, and context-fit heuristics.",
    "- Improve memory quality so summaries, indexes, and directives stay compact, canonical, and resistant to long-run drift.",
    "- Expand observability through the HUD, local API, and browser GUI without weakening the internal/external memory boundary.",
    "- Strengthen safe-mode recovery so failures produce diagnosis and realignment instead of repeated derailment.",
    "- Formalize the promotion path from local discoveries in `.localcrew/` into simplified, committed `external-memory/` seeds.",
    "- Keep external feature work spec-driven through outbox tickets until it is deliberately implemented in the application layer."
  ].join("\n");
}

function getDefaultFocusTodo(): string {
  return [
    "# In Focus Todo",
    "",
    "- [high] Keep canonical resource naming, routing, and queue delegation resistant to context drift.",
    "- [medium] Tighten orchestrator summaries, indexes, and prompt guidance so long-running `/auto` sessions stay coherent.",
    "- [medium] Improve safe-mode recovery and failure diagnosis using recent audit evidence.",
    "- [low] Distill validated local lessons into simpler committed seed documents without carrying over experimental clutter."
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
    "- Preferred resource (`resource-alias` or `auto`)",
    "- Boundaries: what the agent should not do",
    "- Deliverables: what good output from this agent should look like",
    "",
    "Before saving a new agent, check:",
    "- The agent is not just a renamed device role.",
    "- The mission is narrow enough to stay coherent over time.",
    "- The skills guidance points to approved application capabilities, not ad-hoc system execution."
  ].join("\n");
}

async function writeIfMissing(path: string, content: string): Promise<void> {
  try {
    await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
    await atomicWriteFile(path, `${content.trimEnd()}\n`);
  }
}

async function replaceGeneratedOrchestratorIdentityText(
  rootDir: string,
  path: string
): Promise<void> {
  const orchestratorName = getOrchestratorIdentityName(rootDir);

  try {
    const current = await readFile(path, "utf8");
    const next = current
      .replace(/^# .+ Directives$/m, `# ${orchestratorName} Directives`)
      .replace(
        /^You are (?:.+?, )?the orchestrator and conscience of this local agent swarm\.$/m,
        `You are ${orchestratorName}, the orchestrator and conscience of this local agent swarm.`
      )
      .replace(
        /^- In `\/auto`, self-aware self-improvement is (?:.+?'s|the orchestrator's) default operating stance whenever the user has not given a more urgent direct task\.$/m,
        `- In \`/auto\`, self-aware self-improvement is ${orchestratorName}'s default operating stance whenever the user has not given a more urgent direct task.`
      );

    if (next !== current) {
      await atomicWriteFile(path, next);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
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
    await atomicWriteFile(getAgentMetaPath(rootDir, seed.slug), `${JSON.stringify(meta, null, 2)}\n`);
    await atomicWriteFile(getAgentSpecPath(rootDir, seed.slug), `${seed.spec.trimEnd()}\n`);
    await atomicWriteFile(
      getAgentMemoryPath(rootDir, seed.slug),
      `${JSON.stringify(getEmptyAgentMemory(), null, 2)}\n`,
    );
    await atomicWriteFile(
      getAgentMemoryIndexPath(rootDir, seed.slug),
      `${JSON.stringify({ updatedAt: now, summary: "", recentMessages: [] }, null, 2)}\n`,
    );
    agents.push(meta);
    changed = true;
  }

  if (changed) {
    await atomicWriteFile(paths.agentsIndexPath, `${JSON.stringify({ agents }, null, 2)}\n`);
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

  await atomicWriteFile(path, `${existing.trimEnd()}\n\n${appendix.trim()}\n`);
}

export async function ensureSystemLayout(rootDir = process.cwd()): Promise<void> {
  loadLocalEnv(rootDir);
  const paths = getStoragePaths(rootDir);
  await mkdir(paths.systemDir, { recursive: true });
  await mkdir(paths.secureDir, { recursive: true });
  await mkdir(paths.orchestratorDir, { recursive: true });
  await mkdir(paths.orchestratorGeneratedDir, { recursive: true });
  await mkdir(paths.orchestratorMemoryDir, { recursive: true });
  await mkdir(paths.telemetryDir, { recursive: true });
  await mkdir(paths.agentsDir, { recursive: true });

  await writeIfMissing(paths.systemStatePath, JSON.stringify(getDefaultSystemState(), null, 2));
  await writeIfMissing(
    paths.directivesPath,
    await loadSeedFile("orchestrator/directives.md", getDefaultDirectives(rootDir), rootDir)
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
    [
      "# Orchestrator Memory",
      "",
      "- Keep only compact durable summaries here.",
      "- Record canonical connected resource names, current operating boundaries, and the most important active heuristics.",
      "- Distinguish connected inference resources from contributor chat participants; do not infer one roster from the other.",
      "- Do not duplicate changelog detail or speculative implementation plans."
    ].join("\n")
  );
  await writeIfMissing(paths.agentsIndexPath, JSON.stringify({ agents: [] }, null, 2));
  await replaceGeneratedOrchestratorIdentityText(rootDir, paths.directivesPath);
  await ensureDocumentContains(
    paths.directivesPath,
    ACTIVE_AUTO_DIRECTIVE_HEADING,
    [
      ACTIVE_AUTO_DIRECTIVE_HEADING,
      "",
      `- In \`/auto\`, self-aware self-improvement is ${getOrchestratorIdentityName(rootDir)}'s default operating stance whenever the user has not given a more urgent direct task.`,
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
    "- Refine routing policy with measured queue, latency, and model-load evidence.",
    [
      "- Refine routing policy with measured queue, latency, and model-load evidence.",
      "- Use the data-analyst identity for recurring metrics reviews and process refinements.",
      "- Expand the terminal HUD and browser-facing API into richer observability surfaces."
    ].join("\n")
  );
  await ensureDocumentContains(
    paths.focusTodoPath,
    "- [high] Refine routing policy using measured queue pressure, latency, and model-switch costs.",
    [
      "- [high] Refine routing policy using measured queue pressure, latency, and model-switch costs.",
      "- [medium] Expand the browser-facing API and GUI parity plan for observability and control.",
      "- [medium] Formalize promotion from internal runtime discoveries into committed external-memory seeds."
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
  await atomicWriteFile(paths.systemStatePath, `${JSON.stringify(state, null, 2)}\n`);
}

/** Maximum number of recent changelog lines to keep in prompt context. */
const CHANGELOG_TAIL_LINES = 60;

/**
 * Return the header plus the most recent entries when the changelog grows
 * beyond CHANGELOG_TAIL_LINES, so unbounded growth does not inflate prompts.
 */
function tailChangelog(raw: string): string {
  const lines = raw.split("\n");
  if (lines.length <= CHANGELOG_TAIL_LINES) {
    return raw;
  }
  // Keep the "# Changelog" header (first non-empty lines) and tail the rest.
  const headerEnd = lines.findIndex((l, i) => i > 0 && l.startsWith("- "));
  const header = headerEnd > 0 ? lines.slice(0, headerEnd) : [];
  const body = headerEnd > 0 ? lines.slice(headerEnd) : lines;
  const truncated = body.slice(Math.max(0, body.length - CHANGELOG_TAIL_LINES));
  return [...header, `(${body.length - truncated.length} older entries omitted)`, ...truncated].join("\n");
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
    changelog: tailChangelog(changelog),
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

  await atomicWriteFile(paths.focusTodoPath, `${lines.trimEnd()}\n`);
}

export async function appendChangelogEntry(
  entry: string,
  rootDir = process.cwd()
): Promise<void> {
  const paths = getStoragePaths(rootDir);
  await ensureSystemLayout(rootDir);
  await withFileLock(paths.changelogPath, async () => {
    const previous = await readFile(paths.changelogPath, "utf8");
    const timestamp = new Date().toISOString();
    const next = `${previous.trimEnd()}\n- ${timestamp} ${entry}\n`;
    await atomicWriteFile(paths.changelogPath, next);
  });
}

/**
 * Start a new daily work session. Returns the session object that should
 * be stored on `systemState.auto.dailySession`.
 */
export function startDailySession(): DailyWorkSession {
  return {
    startedAt: new Date().toISOString(),
    tasksCompleted: 0,
    tasksErrored: 0,
  };
}

/**
 * Record a completed task in the daily session.
 */
export function recordDailyTaskCompletion(
  session: DailyWorkSession,
  errored: boolean
): DailyWorkSession {
  return {
    ...session,
    tasksCompleted: session.tasksCompleted + (errored ? 0 : 1),
    tasksErrored: session.tasksErrored + (errored ? 1 : 0),
  };
}

/**
 * Mark the daily session as complete.
 */
export function completeDailySession(
  session: DailyWorkSession,
  digestPath?: string
): DailyWorkSession {
  return {
    ...session,
    completedAt: new Date().toISOString(),
    digestPath,
  };
}

/**
 * Build the Daily Digest markdown document content from the completed daily
 * work session and the recently completed auto queue tasks.
 */
export function buildDailyDigest(options: {
  session: DailyWorkSession;
  completedTasks: AutoQueueTask[];
  orchestratorName: string;
  orchestratorSummary: string;
  focusTodo: string;
  customDirective?: string;
}): string {
  const now = new Date();
  const dateLabel = now.toISOString().slice(0, 10);
  const sessionStart = new Date(options.session.startedAt);
  const durationMs = now.getTime() - sessionStart.getTime();
  const durationMinutes = Math.round(durationMs / 60_000);

  const lines: string[] = [
    `# Daily Digest — ${dateLabel}`,
    "",
    `**Orchestrator:** ${options.orchestratorName}`,
    `**Session started:** ${options.session.startedAt}`,
    `**Duration:** ${durationMinutes} minutes`,
    `**Tasks completed:** ${options.session.tasksCompleted}`,
    `**Tasks errored:** ${options.session.tasksErrored}`,
    "",
  ];

  if (options.customDirective) {
    lines.push(
      "## Digest Directive",
      "",
      options.customDirective,
      "",
    );
  }

  lines.push("## Completed Tasks", "");
  if (options.completedTasks.length === 0) {
    lines.push("No tasks completed during this session.", "");
  } else {
    for (const task of options.completedTasks) {
      const resource = task.assignedResource ? ` (@${task.assignedResource})` : "";
      const model = task.assignedModel ? ` [${task.assignedModel}]` : "";
      const duration = task.durationMs ? ` (${Math.round(task.durationMs / 1000)}s)` : "";
      const status = task.errorMessage ? " ⚠️ errored" : " ✓";
      lines.push(`- **#${task.id}** [${task.priority}]${status}${resource}${model}${duration}`);
      lines.push(`  ${task.content}`);
      if (task.errorMessage) {
        lines.push(`  Error: ${task.errorMessage}`);
      }
    }
    lines.push("");
  }

  if (options.orchestratorSummary.trim()) {
    lines.push("## Orchestrator Summary", "", options.orchestratorSummary.trim(), "");
  }

  if (options.focusTodo.trim()) {
    lines.push("## Current Focus", "", options.focusTodo.trim(), "");
  }

  return lines.join("\n");
}

export async function updateOrchestratorIndex(options: {
  queueDepth: number;
  activeAgents: string[];
  connectedResources?: string[];
  recentAutoSummary?: {
    completedCount: number;
    failureCount: number;
    modelUsage: Array<{ key: string; count: number }>;
    failureReasons: Array<{ reason: string; count: number }>;
  };
  rootDir?: string;
}): Promise<void> {
  const paths = getStoragePaths(options.rootDir);
  await ensureSystemLayout(options.rootDir);
  await atomicWriteFile(
    paths.orchestratorMemoryIndexPath,
    `${JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        queueDepth: options.queueDepth,
        activeAgents: options.activeAgents,
        ...(options.connectedResources ? { connectedResources: options.connectedResources } : {}),
        ...(options.recentAutoSummary ? { recentAutoSummary: options.recentAutoSummary } : {})
      },
      null,
      2
    )}\n`
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
  await atomicWriteFile(paths.agentsIndexPath, `${JSON.stringify({ agents }, null, 2)}\n`);
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
    "QUEUE[medium][resource-alias]: concise task"
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
  await atomicWriteFile(getAgentMetaPath(rootDir, slug), `${JSON.stringify(meta, null, 2)}\n`);
  await atomicWriteFile(
    getAgentSpecPath(rootDir, slug),
    `${(generatedSpec?.trim() || buildAgentSpec(answers)).trimEnd()}\n`,
  );
  await atomicWriteFile(
    getAgentMemoryPath(rootDir, slug),
    `${JSON.stringify(getEmptyAgentMemory(), null, 2)}\n`
  );
  await atomicWriteFile(
    getAgentMemoryIndexPath(rootDir, slug),
    `${JSON.stringify({ updatedAt: now, summary: "", recentMessages: [] }, null, 2)}\n`
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

  await atomicWriteFile(getAgentSpecPath(rootDir, normalizedSlug), `${text.trimEnd()}\n`);
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
  await atomicWriteFile(
    getAgentMetaPath(rootDir, normalizedSlug),
    `${JSON.stringify(updatedMeta, null, 2)}\n`
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
  await atomicWriteFile(
    getAgentMemoryPath(rootDir, normalizedSlug),
    `${JSON.stringify(memory, null, 2)}\n`
  );

  const recentMessages = memory.conversation.messages.slice(-5).map((message) =>
    message.speaker === "user"
      ? `USER -> @${message.target}: ${message.content}`
      : message.directedTo
        ? `@${message.endpoint} to @${message.directedTo}: ${message.content}`
        : `@${message.endpoint}: ${message.content}`
  );

  await atomicWriteFile(
    getAgentMemoryIndexPath(rootDir, normalizedSlug),
    `${JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        summary: memory.conversation.summary,
        recentMessages
      },
      null,
      2
    )}\n`
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
