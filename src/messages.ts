import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ChatMessage, ConversationMessage } from "./types.ts";
import { budgetContextBlocks } from "./utils.ts";
import { composePromptBlock, loadPromptComponent } from "./prompt-loader.ts";

/**
 * Extracts a domain tag from a task content prefix.
 * Matches patterns like "{domain:RESEARCH}" → "research".
 */
export function parseTaskDomain(content: string): string | null {
  const m = content.match(/^\{domain:([A-Z]+)\}\s*/i);
  return m ? m[1].toLowerCase() : null;
}

/**
 * Reads the agent identity spec file for a given domain from
 * external-memory/agents/{domain}.md and returns its contents as a
 * system-prompt string. Returns empty string if the file is not found.
 */
export async function buildAgentIdentityBlock(domain: string, rootDir: string): Promise<string> {
  try {
    const filePath = join(rootDir, "external-memory", "agents", `${domain}.md`);
    const content = await readFile(filePath, "utf8");
    return content.trim();
  } catch {
    return "";
  }
}

function formatConversationLine(message: ConversationMessage): string {
  if (message.speaker === "user") {
    return `USER -> @${message.target}: ${message.content}`;
  }

  if (message.directedTo) {
    return `@${message.endpoint} to @${message.directedTo}: ${message.content}`;
  }

  return `@${message.endpoint}: ${message.content}`;
}

export function formatConversationTranscript(messages: ReadonlyArray<ConversationMessage>): string {
  return messages.map(formatConversationLine).join("\n\n");
}

// ---------------------------------------------------------------------------
// Inline fallbacks — used when component files are not present.
// These preserve existing behavior when external-memory/prompts/ is absent.
// ---------------------------------------------------------------------------

const FALLBACK_GROUNDING = [
  'If grounded factual context from Wikipedia would materially help, end with one final line exactly in this format: WIKIPEDIA: search query. Use Wikipedia only for external factual knowledge, not for local routing, prompt, naming, resource, or model-diagnosis decisions. Do not emit more than one WIKIPEDIA line.',
  'If focused real-world community experience or technical solutions from Reddit would materially help, end with one final line exactly in this format: REDDIT: search query. Use Reddit only for specific technical topics, not for internal Local Crew decisions. Do not emit more than one REDDIT line.',
  'If current web search results for news, jobs, software engineering, or AI engineering topics would materially help, end with one final line exactly in this format: SEARCH[topic]: search query, where topic is one of: news, jobs, software-engineering, ai-engineering. Use web search only for current real-world information, not for internal Local Crew decisions. Do not emit more than one SEARCH line.',
  'WEATHER_PLACEHOLDER',
  'If content from benlive.tv (the project home base with developer updates, blog posts, and platform information) would help, end with one final line exactly in this format: BENLIVE: topic or /path. Do not emit more than one BENLIVE line.',
  'If content from the user personal website would help (requires /preferences website configuration), end with one final line exactly in this format: WEBSITE: topic or /path. Do not emit more than one WEBSITE line.'
].join(' ');

const FALLBACK_WEATHER_LINE = 'If current weather information would help, end with one final line exactly in this format: WEATHER: location (city name or zip code), or just WEATHER: to use the configured default location. Do not emit more than one WEATHER line.';

const FALLBACK_QUEUE = [
  'If you want the orchestrator queue to take on follow-up work, end with one or more final lines exactly in the form QUEUE[medium]: task, QUEUE[low]: task, QUEUE[medium][resource-alias]: task, QUEUE[medium][resource-alias][model-name]: task, or add an optional role tag such as QUEUE[medium][resource-alias]{reviewer}: task.',
  'Use only the exact installed resource aliases provided by Local Crew for any QUEUE line. If you are unsure which resource to target, omit the alias and let Local Crew route it automatically.',
  'Do not emit queue lines unless a concrete asynchronous follow-up is useful.'
].join(' ');

const FALLBACK_WRITE = [
  'When a task should create a brand new file or intentionally replace an entire document, emit zero or more exact file blocks in this format: WRITE[internal][relative/path.ext], WRITE[active][relative/path.ext], or WRITE[outbox][relative/path.ext] on its own line, then the full file content, then ENDWRITE on its own line. Do not wrap WRITE blocks in markdown fences.',
  'When a task should update an existing document, prefer UPDATE blocks instead of rewriting the whole file. Valid forms are: UPDATE[stage][path][replace] with SEARCH...ENDSEARCH and CONTENT...ENDCONTENT blocks for exact text replacement, UPDATE[stage][path][replace-section] with SEARCH...ENDSEARCH where SEARCH is HEADING: Parent > Child and CONTENT...ENDCONTENT for full markdown section replacement, UPDATE[stage][path][insert-after] with ANCHOR...ENDANCHOR and CONTENT...ENDCONTENT blocks, UPDATE[stage][path][insert-before] with ANCHOR...ENDANCHOR and CONTENT...ENDCONTENT blocks, or UPDATE[stage][path][append|prepend] with CONTENT...ENDCONTENT, then ENDUPDATE.',
  'Use WRITE[internal] or UPDATE[internal] for local memory/process artifacts that belong inside `.localcrew/`. Use WRITE[active] or UPDATE[active] only for drafts tied to a user-supplied external dropbox document. Use WRITE[outbox] or UPDATE[outbox] for user-facing deliverables and external feature request tickets.',
  'For markdown documents, prefer HEADING: Parent > Child selectors in SEARCH or ANCHOR blocks instead of brittle raw text. Local Crew maintains copyable heading references in `.localcrew/system/secure/orchestrator/navigation/document-sitemap.md` and per-document outline sidecars under `.localcrew/system/secure/orchestrator/navigation/outlines/`.'
].join(' ');

const FALLBACK_NEXT = [
  'If you want to suggest one directed follow-up for the user to approve, end your response with a final line exactly in this format: NEXT: @alias: message.',
  'Only suggest a valid participant other than yourself, keep the NEXT message short, and omit the NEXT line when no follow-up suggestion is needed.',
  'The NEXT line is only a user-editable suggestion and is not executed automatically.'
].join(' ');

/** Build the grounding block for a given builder, applying the weather conditional. */
async function buildGroundingBlock(
  weatherEnabled: boolean | undefined,
  rootDir?: string
): Promise<string> {
  const fallback = weatherEnabled !== false
    ? FALLBACK_GROUNDING.replace('WEATHER_PLACEHOLDER', FALLBACK_WEATHER_LINE)
    : FALLBACK_GROUNDING.replace(' WEATHER_PLACEHOLDER', '');

  const block = await loadPromptComponent(
    "components/tools/grounding.md",
    fallback,
    rootDir
  );
  return block
    .replace(/\{\{#if weatherEnabled\}\}([\s\S]*?)\{\{\/if\}\}/g, (_m, inner) =>
      weatherEnabled !== false ? inner : ""
    )
    .trim();
}

export async function buildChatMessages(options: {
  alias: string;
  participants: ReadonlyArray<{ alias: string; nickname: string }>;
  instructions: string;
  summary: string;
  recentMessages: ReadonlyArray<ConversationMessage>;
  taskPrompt: string;
  weatherEnabled?: boolean;
  rootDir?: string;
}): Promise<ChatMessage[]> {
  const outgoing: ChatMessage[] = [];
  const trimmedInstructions = options.instructions.trim();
  const participantRoster = options.participants
    .map((participant) => `${participant.nickname} (@${participant.alias})`)
    .join(", ");
  const participantList = options.participants
    .map((participant) => `@${participant.alias}`)
    .join(", ");

  if (trimmedInstructions) {
    outgoing.push({
      role: "system",
      content: trimmedInstructions
    });
  }

  const identityBlock = await composePromptBlock(
    ["components/identity/orchestrator-chat.md"],
    {
      alias: options.alias,
      participantList,
      participantRoster
    },
    {},
    { "components/identity/orchestrator-chat.md": `You are @${options.alias}. You are one contributor in a shared multi-model conversation with these participants: ${participantList}. The participant names are exactly: ${participantRoster}. Use exactly those names and aliases, and never invent alternate names, nicknames, or expansions. Transcript lines are labeled with their @alias and may include directed participant-to-participant lines in the form @from to @to: message. Answer only as @${options.alias}, from your own perspective.` },
    options.rootDir
  );

  const groundingBlock = await buildGroundingBlock(options.weatherEnabled, options.rootDir);

  const nextBlock = await loadPromptComponent(
    "components/tools/next.md",
    FALLBACK_NEXT,
    options.rootDir
  );

  outgoing.push({
    role: "system",
    content: [identityBlock, groundingBlock, nextBlock].filter(Boolean).join(" ")
  });

  const trimmedSummary = options.summary.trim();
  if (trimmedSummary) {
    outgoing.push({
      role: "system",
      content: `Shared conversation summary:\n${trimmedSummary}`
    });
  }

  if (options.recentMessages.length > 0) {
    outgoing.push({
      role: "system",
      content: `Recent conversation transcript:\n${formatConversationTranscript(
        options.recentMessages
      )}`
    });
  }

  outgoing.push({
    role: "user",
    content: options.taskPrompt
  });

  return outgoing;
}

export async function buildAgentChatMessages(options: {
  agentName: string;
  agentSlug: string;
  preferredResource: string;
  orchestratorName: string;
  spec: string;
  summary: string;
  recentMessages: ReadonlyArray<ConversationMessage>;
  taskPrompt: string;
  resourceRoster?: string;
  extraContextBlocks?: string[];
  currentDateTime?: string;
  weatherEnabled?: boolean;
  rootDir?: string;
}): Promise<ChatMessage[]> {
  const identityFallback = `You are ${options.agentName} (@${options.agentSlug}), a persistent agent identity managed by ${options.orchestratorName}, the orchestrator. Your preferred inference resource is ${options.preferredResource}. Stay aligned with your specification and maintain continuity with your private memory.`;

  const [identityBlock, groundingBlock, queueBlock, writeBlock] = await Promise.all([
    composePromptBlock(
      ["components/identity/agent.md"],
      {
        agentName: options.agentName,
        agentSlug: options.agentSlug,
        orchestratorName: options.orchestratorName,
        preferredResource: options.preferredResource
      },
      {},
      { "components/identity/agent.md": identityFallback },
      options.rootDir
    ),
    buildGroundingBlock(options.weatherEnabled, options.rootDir),
    loadPromptComponent("components/tools/queue.md", FALLBACK_QUEUE, options.rootDir),
    loadPromptComponent("components/tools/write.md", FALLBACK_WRITE, options.rootDir)
  ]);

  const agentGuidance = [
    identityBlock,
    groundingBlock,
    queueBlock,
    writeBlock,
    "Use WRITE[internal] or UPDATE[internal] for local memory/process artifacts that belong inside `.localcrew/`. Use WRITE[active] or UPDATE[active] only for drafts tied to a user-supplied external dropbox document. Use WRITE[outbox] or UPDATE[outbox] for user-facing deliverables and external feature request tickets.",
    "For markdown documents, prefer HEADING: Parent > Child selectors in SEARCH or ANCHOR blocks instead of brittle raw text. Local Crew maintains copyable heading references in `.localcrew/system/secure/orchestrator/navigation/document-sitemap.md` and per-document outline sidecars under `.localcrew/system/secure/orchestrator/navigation/outlines/`.",
    "Do not emit executable scripts, source files, or ad-hoc automation from contained autonomous work unless the user explicitly asked for a file deliverable. If a useful improvement would require external application, API, UI, or script changes, write a markdown feature request ticket to WRITE[outbox][feature-requests/short-name.md] instead of treating it as executable autonomous work."
  ].filter(Boolean).join(" ");

  const outgoing: ChatMessage[] = [
    {
      role: "system",
      content: options.spec.trim()
    },
    {
      role: "system",
      content: agentGuidance
    }
  ];

  if (options.currentDateTime) {
    outgoing.push({
      role: "system",
      content: `Current date and time: ${options.currentDateTime}`
    });
  }

  if (options.resourceRoster?.trim()) {
    outgoing.push({
      role: "system",
      content: `Valid resource aliases for QUEUE lines: ${options.resourceRoster.trim()}. Use only these exact aliases and never invent new resource names.`
    });
  }

  if (options.summary.trim()) {
    outgoing.push({
      role: "system",
      content: `Agent memory summary:\n${options.summary.trim()}`
    });
  }

  if (options.recentMessages.length > 0) {
    outgoing.push({
      role: "system",
      content: `Recent private transcript:\n${formatConversationTranscript(options.recentMessages)}`
    });
  }

  for (const block of options.extraContextBlocks ?? []) {
    if (!block.trim()) {
      continue;
    }

    outgoing.push({
      role: "system",
      content: block.trim()
    });
  }

  outgoing.push({
    role: "user",
    content: options.taskPrompt
  });

  return outgoing;
}

export async function buildTaskPreflightMessages(options: {
  orchestratorName: string;
  task: string;
  priority: string;
  directives: string;
  inventory: string;
  currentDateTime?: string;
  rootDir?: string;
}): Promise<ChatMessage[]> {
  const identityFallback = `You are ${options.orchestratorName}, reasoning carefully before acting. You are about to execute an autonomous task. Before acting, produce a brief structured pre-flight analysis using the exact format below. Be concise — 1-2 sentences per section, no padding.`;
  const preflightOutputFallback = "GOAL: What this task should accomplish and what a successful output looks like. CONSTRAINTS: Key boundaries from the directives that apply here (e.g. no external changes, no source-code mutations). RISKS: The most likely failure mode or quality trap for this specific task. APPROACH: The specific steps or output structure you intend to use. Output only these four labeled sections. Do not begin executing the task.";

  const [identityBlock, preflightOutputBlock] = await Promise.all([
    composePromptBlock(
      ["components/identity/orchestrator-preflight.md"],
      { orchestratorName: options.orchestratorName },
      {},
      { "components/identity/orchestrator-preflight.md": identityFallback },
      options.rootDir
    ),
    loadPromptComponent(
      "components/format/preflight-output.md",
      preflightOutputFallback,
      options.rootDir
    )
  ]);

  return [
    {
      role: "system",
      content: [identityBlock, preflightOutputBlock].filter(Boolean).join(" ")
    },
    ...(options.currentDateTime
      ? [{ role: "system" as const, content: `Current date and time: ${options.currentDateTime}` }]
      : []),
    {
      role: "system",
      content: `Core directives summary:\n${options.directives.trim().slice(0, 800)}`
    },
    {
      role: "system",
      content: `Resource inventory:\n${options.inventory.trim().slice(0, 600)}`
    },
    {
      role: "user",
      content: [`Priority: ${options.priority}`, "", "Task:", options.task].join("\n")
    }
  ];
}

export async function buildAutoTaskMessages(options: {
  directives: string;
  inventory: string;
  roadmap: string;
  focusTodo: string;
  changelog: string;
  orchestratorSummary: string;
  agents: ReadonlyArray<string>;
  task: string;
  priority: string;
  createdBy: string;
  orchestratorName: string;
  resourceAlias: string;
  resourceRationale: string;
  resourceRoster?: string;
  extraContextBlocks?: string[];
  currentDateTime?: string;
  maxContextTokens?: number;
  dailySessionContext?: string;
  weatherEnabled?: boolean;
  performanceSummary?: string;
  rootDir?: string;
}): Promise<ChatMessage[]> {
  const identityFallback = `You are ${options.orchestratorName}, the orchestrator identity. The selected inference resource for this task is @${options.resourceAlias}. Selection rationale: ${options.resourceRationale} You are using that resource as a tool, but you still answer as ${options.orchestratorName}.${options.maxContextTokens ? ` This resource has a context window of approximately ${options.maxContextTokens.toLocaleString()} tokens. Keep your reasoning and output proportionate to this limit. If a task is too large for one context pass, break it into smaller follow-up QUEUE items that each fit comfortably.` : ""}`;

  const [identityBlock, autoModeBlock, groundingBlock, queueBlock, writeBlock, containmentBlock, canonicalMemoryBlock] = await Promise.all([
    composePromptBlock(
      ["components/identity/orchestrator-auto.md"],
      {
        orchestratorName: options.orchestratorName,
        resourceAlias: options.resourceAlias,
        resourceRationale: options.resourceRationale,
        maxContextTokens: options.maxContextTokens?.toLocaleString()
      },
      { hasContextLimit: !!options.maxContextTokens },
      { "components/identity/orchestrator-auto.md": identityFallback },
      options.rootDir
    ),
    loadPromptComponent("components/stance/auto-mode.md", "Keep outputs concise and actionable. In auto mode, your default stance is self-aware self-improvement of the local orchestration system.", options.rootDir),
    buildGroundingBlock(options.weatherEnabled, options.rootDir),
    loadPromptComponent("components/tools/queue.md", FALLBACK_QUEUE, options.rootDir),
    loadPromptComponent("components/tools/write.md", FALLBACK_WRITE, options.rootDir),
    loadPromptComponent("components/guardrails/containment.md", "Stay inside internal process improvement unless the user explicitly asks for external system changes.", options.rootDir),
    loadPromptComponent("components/format/canonical-memory.md", "To update canonical orchestrator memory files, use WRITE[internal][summary.md], WRITE[internal][focus-todo.md], WRITE[internal][roadmap.md], or WRITE[internal][daily-work.md] only when regenerating the whole file. Prefer UPDATE[internal] variants for targeted revisions.", options.rootDir)
  ]);

  const taskQualityBlock = "Every queued task must be self-contained, concrete, and specific enough to execute without guessing. Never emit placeholder tasks such as implement, review, compare, or evaluate without an explicit object and outcome. When a task benefits from collaboration, decompose it into multiple targeted QUEUE lines with different resource aliases and role tags instead of leaving the collaboration implicit. Do not emit executable scripts, source files, or ad-hoc automation from contained autonomous work. If a useful improvement would require external application, API, UI, script, or source-code changes, write a markdown feature request ticket to WRITE[outbox][feature-requests/short-name.md] instead of treating it as executable autonomous work.";

  const systemBlock = [
    identityBlock,
    autoModeBlock,
    containmentBlock,
    groundingBlock,
    queueBlock,
    writeBlock,
    taskQualityBlock,
    canonicalMemoryBlock
  ].filter(Boolean).join(" ");

  const outgoing: ChatMessage[] = [
    {
      role: "system",
      content: options.directives.trim()
    },
    {
      role: "system",
      content: systemBlock
    },
    {
      role: "system",
      content: `Available agents: ${options.agents.length > 0 ? options.agents.join(", ") : "(none)"}`
    },
    ...(options.resourceRoster?.trim()
      ? [
          {
            role: "system" as const,
            content: `Valid resource aliases for QUEUE lines: ${options.resourceRoster.trim()}. Use only these exact aliases and never invent new resource names.`
          }
        ]
      : [])
  ];

  // Context-budgeted reference documents: prioritize directives and
  // current state over historical changelog when context is limited.
  const contextBlocks = [
    { label: "Orchestrator memory summary", content: options.orchestratorSummary.trim() || "(none)" },
    { label: "In-focus todo", content: options.focusTodo.trim() },
    { label: "Roadmap", content: options.roadmap.trim() },
    { label: "Resource inventory", content: options.inventory.trim() },
    { label: "Recent changelog", content: options.changelog.trim(), minChars: 300 },
    { label: "Performance summary", content: options.performanceSummary?.trim() || "", minChars: 100 },
  ];

  if (options.maxContextTokens && options.maxContextTokens > 0) {
    const baselineChars = outgoing.reduce(
      (sum, msg) => sum + msg.content.length,
      0
    );
    const taskChars = options.task.length + 200;
    const extraChars = (options.extraContextBlocks ?? []).reduce(
      (sum, block) => sum + block.length,
      0
    );
    const usedTokens = Math.ceil((baselineChars + taskChars + extraChars) / 4);
    const availableTokens = Math.max(
      2000,
      Math.floor(options.maxContextTokens * 0.8) - usedTokens
    );

    const budgeted = budgetContextBlocks(contextBlocks, availableTokens);
    for (const block of budgeted.blocks) {
      outgoing.push({
        role: "system",
        content: `${block.label}:\n${block.content}`
      });
    }
    if (budgeted.dropped.length > 0) {
      outgoing.push({
        role: "system",
        content: `[Context budget: dropped ${budgeted.dropped.join(", ")} to fit within ${options.maxContextTokens.toLocaleString()} token limit]`
      });
    }
  } else {
    for (const block of contextBlocks) {
      outgoing.push({
        role: "system",
        content: `${block.label}:\n${block.content}`
      });
    }
  }

  if (options.currentDateTime) {
    outgoing.push({
      role: "system",
      content: `Current date and time: ${options.currentDateTime}`
    });
  }

  if (options.dailySessionContext) {
    outgoing.push({
      role: "system",
      content: options.dailySessionContext
    });
  }

  for (const block of options.extraContextBlocks ?? []) {
    if (!block.trim()) {
      continue;
    }

    outgoing.push({
      role: "system",
      content: block.trim()
    });
  }

  outgoing.push({
    role: "user",
    content: [
      `Priority: ${options.priority}`,
      `Created by: ${options.createdBy}`,
      "",
      "Task:",
      options.task
    ].join("\n")
  });

  return outgoing;
}

export async function buildQueueFillMessages(options: {
  directives: string;
  inventory: string;
  roadmap: string;
  focusTodo: string;
  changelog: string;
  orchestratorSummary: string;
  orchestratorName: string;
  agents: ReadonlyArray<string>;
  resourceRoster?: string;
  currentDateTime?: string;
  recentCompletedTopics?: ReadonlyArray<string>;
  targetTaskCount?: number;
  weatherEnabled?: boolean;
  rootDir?: string;
}): Promise<ChatMessage[]> {
  const targetTaskCount = options.targetTaskCount ?? 8;

  const finalizerFallback = `You are ${options.orchestratorName}, the orchestrator identity.`;
  const [finalizerBlock, queueDraftBlock, domainTaxonomyBlock, groundingBlock] = await Promise.all([
    composePromptBlock(
      ["components/identity/finalizer.md"],
      { orchestratorName: options.orchestratorName },
      {},
      { "components/identity/finalizer.md": finalizerFallback },
      options.rootDir
    ),
    loadPromptComponent("components/stance/queue-draft.md", "The queue is running low and needs a fresh batch of work. Self-aware self-improvement of the local orchestration system is your default stance right now.", options.rootDir),
    loadPromptComponent("components/format/domain-taxonomy.md", "SYSTEM: Routing quality. RESEARCH: Career context. KNOWLEDGE: Learning content. SYNTHESIS: Pattern extraction. IDENTITY: Agent development.", options.rootDir),
    buildGroundingBlock(options.weatherEnabled, options.rootDir)
  ]);

  const taskOutputFormat = `Output only task lines in the exact format {domain:SYSTEM} [high] task, {domain:SYSTEM} [medium] task, or {domain:SYSTEM} [low] task. Generate exactly ${targetTaskCount} tasks. Keep the batch diverse across SYSTEM, RESEARCH, KNOWLEDGE, SYNTHESIS, and IDENTITY. If the target count is at least 5, include every domain at least once; otherwise choose the highest-value mix without duplicating topics. Distribute requestedResource assignments explicitly so every resource alias in the inventory receives work when capacity allows. Include at least one high-priority task. Do not output any explanation before or after the task lines.`;

  const systemContent = [
    finalizerBlock,
    queueDraftBlock,
    groundingBlock,
    domainTaxonomyBlock,
    taskOutputFormat
  ].filter(Boolean).join(" ");

  const outgoing: ChatMessage[] = [
    {
      role: "system",
      content: options.directives.trim()
    },
    {
      role: "system",
      content: systemContent
    },
    {
      role: "system",
      content: `Available agents: ${options.agents.length > 0 ? options.agents.join(", ") : "(none)"}`
    }
  ];

  if (options.resourceRoster?.trim()) {
    outgoing.push({
      role: "system",
      content: `Valid resource aliases for any delegated work are: ${options.resourceRoster.trim()}. Use only these exact aliases and never invent new resource names.`
    });
  }

  outgoing.push(
    {
      role: "system",
      content: `Orchestrator memory summary:\n${options.orchestratorSummary.trim() || "(none)"}`
    },
    {
      role: "system",
      content: `Roadmap:\n${options.roadmap.trim()}`
    },
    {
      role: "system",
      content: `In-focus todo:\n${options.focusTodo.trim()}`
    },
    {
      role: "system",
      content: `Recent changelog:\n${options.changelog.trim()}`
    },
    {
      role: "system",
      content: `Resource inventory:\n${options.inventory.trim()}`
    }
  );

  if (options.recentCompletedTopics && options.recentCompletedTopics.length > 0) {
    outgoing.push({
      role: "system",
      content: `RECENTLY COMPLETED WORK (do NOT propose tasks that duplicate or rephrase these):\n${options.recentCompletedTopics.map((t, i) => `${i + 1}. ${t}`).join("\n")}`
    });
  }

  if (options.currentDateTime) {
    outgoing.push({
      role: "system",
      content: `Current date and time: ${options.currentDateTime}`
    });
  }

  return outgoing;
}

export async function buildQueueFillReviewMessages(options: {
  orchestratorName: string;
  reviewerAlias: string;
  draftTasks: string;
  inventory: string;
  roadmap: string;
  focusTodo: string;
  changelog: string;
  resourceRoster?: string;
  currentDateTime?: string;
  weatherEnabled?: boolean;
  rootDir?: string;
}): Promise<ChatMessage[]> {
  const reviewerFallback = `You are @${options.reviewerAlias}, the secondary reviewer for ${options.orchestratorName}'s auto-mode planning.`;
  const reviewStanceFallback = "Critique the proposed self-improvement backlog before anything is queued. Apply a measure twice, cut once standard: reject vague, duplicative, over-broad, or low-leverage work. Respond with a short critique followed by one final verdict line exactly in the form VERDICT: approve or VERDICT: revise.";

  const [reviewerBlock, reviewStanceBlock, groundingBlock] = await Promise.all([
    composePromptBlock(
      ["components/identity/reviewer.md"],
      {
        reviewerAlias: options.reviewerAlias,
        orchestratorName: options.orchestratorName
      },
      {},
      { "components/identity/reviewer.md": reviewerFallback },
      options.rootDir
    ),
    loadPromptComponent("components/stance/queue-review.md", reviewStanceFallback, options.rootDir),
    buildGroundingBlock(options.weatherEnabled, options.rootDir)
  ]);

  const outgoing: ChatMessage[] = [
    {
      role: "system",
      content: [reviewerBlock, reviewStanceBlock, groundingBlock].filter(Boolean).join(" ")
    }
  ];

  if (options.resourceRoster?.trim()) {
    outgoing.push({
      role: "system",
      content: `Valid resource aliases for any delegated work are: ${options.resourceRoster.trim()}. Use only these exact aliases and never invent new resource names.`
    });
  }

  outgoing.push(
    {
      role: "system",
      content: `Roadmap:\n${options.roadmap.trim()}`
    },
    {
      role: "system",
      content: `In-focus todo:\n${options.focusTodo.trim()}`
    },
    {
      role: "system",
      content: `Recent changelog:\n${options.changelog.trim()}`
    },
    {
      role: "system",
      content: `Resource inventory:\n${options.inventory.trim()}`
    }
  );

  if (options.currentDateTime) {
    outgoing.push({
      role: "system",
      content: `Current date and time: ${options.currentDateTime}`
    });
  }

  outgoing.push({
    role: "user",
    content: `Draft backlog to review:\n${options.draftTasks.trim() || "(none)"}`
  });

  return outgoing;
}

export async function buildQueueFillFinalizeMessages(options: {
  directives: string;
  inventory: string;
  roadmap: string;
  focusTodo: string;
  changelog: string;
  orchestratorSummary: string;
  orchestratorName: string;
  agents: ReadonlyArray<string>;
  draftTasks: string;
  reviewFeedback: string;
  resourceRoster?: string;
  currentDateTime?: string;
  targetTaskCount?: number;
  weatherEnabled?: boolean;
  rootDir?: string;
}): Promise<ChatMessage[]> {
  const targetTaskCount = options.targetTaskCount ?? 6;

  const finalizerFallback = `You are ${options.orchestratorName}, the orchestrator identity.`;
  const [finalizerBlock, finalizationStanceBlock, groundingBlock] = await Promise.all([
    composePromptBlock(
      ["components/identity/finalizer.md"],
      { orchestratorName: options.orchestratorName },
      {},
      { "components/identity/finalizer.md": finalizerFallback },
      options.rootDir
    ),
    loadPromptComponent("components/stance/queue-finalize.md", "The queue is running low — finalize a substantive batch to keep all resources busy. Self-aware self-improvement of the local orchestration system is your default stance right now.", options.rootDir),
    buildGroundingBlock(options.weatherEnabled, options.rootDir)
  ]);

  const taskOutputFormat = `Output only approved task lines in the exact format [high] task, [medium] task, or [low] task, with each task prefixed by its domain tag (e.g. {domain:SYSTEM}). Finalize exactly ${targetTaskCount} tasks from the approved draft. If the target count is at least 5, preserve coverage across SYSTEM, RESEARCH, KNOWLEDGE, SYNTHESIS, and IDENTITY; otherwise choose the highest-value mix. Ensure every available resource receives work when capacity allows. Maintain the priority mix (at least one high, majority medium). Reject any task without a clear outcome; keep the batch substantive enough to sustain parallel execution across all connected devices without any device going idle between cycles. Do not output any explanation before or after the task lines.`;

  const systemContent = [
    finalizerBlock,
    finalizationStanceBlock,
    groundingBlock,
    taskOutputFormat
  ].filter(Boolean).join(" ");

  const outgoing: ChatMessage[] = [
    {
      role: "system",
      content: options.directives.trim()
    },
    {
      role: "system",
      content: systemContent
    },
    {
      role: "system",
      content: `Available agents: ${options.agents.length > 0 ? options.agents.join(", ") : "(none)"}`
    }
  ];

  if (options.resourceRoster?.trim()) {
    outgoing.push({
      role: "system",
      content: `Valid resource aliases for any delegated work are: ${options.resourceRoster.trim()}. Use only these exact aliases and never invent new resource names.`
    });
  }

  outgoing.push(
    {
      role: "system",
      content: `Orchestrator memory summary:\n${options.orchestratorSummary.trim() || "(none)"}`
    },
    {
      role: "system",
      content: `Roadmap:\n${options.roadmap.trim()}`
    },
    {
      role: "system",
      content: `In-focus todo:\n${options.focusTodo.trim()}`
    },
    {
      role: "system",
      content: `Recent changelog:\n${options.changelog.trim()}`
    },
    {
      role: "system",
      content: `Resource inventory:\n${options.inventory.trim()}`
    }
  );

  if (options.currentDateTime) {
    outgoing.push({
      role: "system",
      content: `Current date and time: ${options.currentDateTime}`
    });
  }

  outgoing.push(
    {
      role: "system",
      content: `Draft backlog:\n${options.draftTasks.trim() || "(none)"}`
    },
    {
      role: "system",
      content: `Reviewer critique:\n${options.reviewFeedback.trim() || "(none)"}`
    }
  );

  return outgoing;
}
