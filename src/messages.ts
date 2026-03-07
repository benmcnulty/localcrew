import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ChatMessage, ConversationMessage } from "./types.ts";
import { budgetContextBlocks } from "./utils.ts";

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

export function buildChatMessages(options: {
  alias: string;
  participants: ReadonlyArray<{ alias: string; nickname: string }>;
  instructions: string;
  summary: string;
  recentMessages: ReadonlyArray<ConversationMessage>;
  taskPrompt: string;
  weatherEnabled?: boolean;
}): ChatMessage[] {
  const outgoing: ChatMessage[] = [];
  const trimmedInstructions = options.instructions.trim();
  const participantRoster = options.participants
    .map((participant) => `${participant.nickname} (@${participant.alias})`)
    .join(", ");

  if (trimmedInstructions) {
    outgoing.push({
      role: "system",
      content: trimmedInstructions
    });
  }

  outgoing.push({
    role: "system",
    content: [
      `You are @${options.alias}.`,
      `You are one contributor in a shared multi-model conversation with these participants: ${options.participants
        .map((participant) => `@${participant.alias}`)
        .join(", ")}.`,
      `The participant names are exactly: ${participantRoster}. Use exactly those names and aliases, and never invent alternate names, nicknames, or expansions.`,
      "Transcript lines are labeled with their @alias and may include directed participant-to-participant lines in the form @from to @to: message.",
      `Answer only as @${options.alias}, from your own perspective.`,
      'If grounded factual context from Wikipedia would materially help, end with one final line exactly in this format: WIKIPEDIA: search query',
      'If focused real-world community experience or technical solutions from Reddit would materially help, end with one final line exactly in this format: REDDIT: search query. Use Reddit only for specific technical topics, not for internal Local Crew decisions.',
      'If current web search results for news, jobs, software engineering, or AI engineering topics would materially help, end with one final line exactly in this format: SEARCH[topic]: search query, where topic is one of: news, jobs, software-engineering, ai-engineering. Use web search only for current real-world information, not for internal Local Crew decisions. Do not emit more than one SEARCH line.',
      ...(options.weatherEnabled !== false ? ['If current weather information would help, end with one final line exactly in this format: WEATHER: location (city name or zip code), or just WEATHER: to use the configured default location. Do not emit more than one WEATHER line.'] : []),
      'If content from benlive.tv (the project home base with developer updates, blog posts, and platform information) would help, end with one final line exactly in this format: BENLIVE: topic or /path. Do not emit more than one BENLIVE line.',
      'If content from the user personal website would help (requires /preferences website configuration), end with one final line exactly in this format: WEBSITE: topic or /path. Do not emit more than one WEBSITE line.',
      "If you want to suggest one directed follow-up for the user to approve, end your response with a final line exactly in this format: NEXT: @alias: message",
      "Only suggest a valid participant other than yourself, keep the NEXT message short, and omit the NEXT line when no follow-up suggestion is needed.",
      "The NEXT line is only a user-editable suggestion and is not executed automatically.",
      "Do not emit more than one WIKIPEDIA line and do not emit more than one REDDIT line."
    ].join(" ")
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

export function buildAgentChatMessages(options: {
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
}): ChatMessage[] {
  const outgoing: ChatMessage[] = [
    {
      role: "system",
      content: options.spec.trim()
    },
    {
      role: "system",
      content: [
        `You are ${options.agentName} (@${options.agentSlug}), a persistent agent identity managed by ${options.orchestratorName}, the orchestrator.`,
        `Your preferred inference resource is ${options.preferredResource}.`,
        "Stay aligned with your specification and maintain continuity with your private memory.",
        'If grounded factual context from Wikipedia would materially help, end with one final line exactly in this format: WIKIPEDIA: search query. Use Wikipedia only for external factual knowledge, not for local routing, prompt, naming, or model-configuration decisions.',
        'If focused real-world community experience or technical solutions from Reddit would materially help, end with one final line exactly in this format: REDDIT: search query. Use Reddit only for specific technical topics, not for internal Local Crew decisions. Do not emit more than one REDDIT line.',
        'If current web search results for news, jobs, software engineering, or AI engineering topics would materially help, end with one final line exactly in this format: SEARCH[topic]: search query, where topic is one of: news, jobs, software-engineering, ai-engineering. Use web search only for current real-world information, not for internal Local Crew decisions. Do not emit more than one SEARCH line.',
        ...(options.weatherEnabled !== false ? ['If current weather information would help, end with one final line exactly in this format: WEATHER: location (city name or zip code), or just WEATHER: to use the configured default location. Do not emit more than one WEATHER line.'] : []),
        'If content from benlive.tv (the project home base with developer updates, blog posts, and platform information) would help, end with one final line exactly in this format: BENLIVE: topic or /path. Do not emit more than one BENLIVE line.',
        'If content from the user personal website would help (requires /preferences website configuration), end with one final line exactly in this format: WEBSITE: topic or /path. Do not emit more than one WEBSITE line.',
        "If you want the orchestrator queue to take on follow-up work, end with one or more final lines exactly in the form QUEUE[medium]: task, QUEUE[low]: task, QUEUE[medium][resource-alias]: task, QUEUE[medium][resource-alias][model-name]: task, or add an optional role tag such as QUEUE[medium][resource-alias]{reviewer}: task.",
        "Use only the exact installed resource aliases provided by Local Crew for any QUEUE line. If you are unsure which resource to target, omit the alias and let Local Crew route it automatically.",
        "When a task should create a brand new file or intentionally replace an entire document, emit zero or more exact file blocks in this format: WRITE[internal][relative/path.ext], WRITE[active][relative/path.ext], or WRITE[outbox][relative/path.ext] on its own line, then the full file content, then ENDWRITE on its own line.",
        "When a task should update an existing document, prefer UPDATE blocks instead of rewriting the whole file. Valid forms are: UPDATE[stage][path][replace] with SEARCH...ENDSEARCH and CONTENT...ENDCONTENT blocks for exact text replacement, UPDATE[stage][path][replace-section] with SEARCH...ENDSEARCH where SEARCH is HEADING: Parent > Child and CONTENT...ENDCONTENT for full markdown section replacement, UPDATE[stage][path][insert-after] with ANCHOR...ENDANCHOR and CONTENT...ENDCONTENT blocks, UPDATE[stage][path][insert-before] with ANCHOR...ENDANCHOR and CONTENT...ENDCONTENT blocks, or UPDATE[stage][path][append|prepend] with CONTENT...ENDCONTENT, then ENDUPDATE.",
        "Use WRITE[internal] or UPDATE[internal] for local memory/process artifacts that belong inside `.localcrew/`. Use WRITE[active] or UPDATE[active] only for drafts tied to a user-supplied external dropbox document. Use WRITE[outbox] or UPDATE[outbox] for user-facing deliverables and external feature request tickets.",
        "For markdown documents, prefer HEADING: Parent > Child selectors in SEARCH or ANCHOR blocks instead of brittle raw text. Local Crew maintains copyable heading references in `.localcrew/system/secure/orchestrator/navigation/document-sitemap.md` and per-document outline sidecars under `.localcrew/system/secure/orchestrator/navigation/outlines/`.",
        "Do not emit executable scripts, source files, or ad-hoc automation from contained autonomous work unless the user explicitly asked for a file deliverable. If a useful improvement would require external application, API, UI, or script changes, write a markdown feature request ticket to WRITE[outbox][feature-requests/short-name.md] instead of treating it as executable autonomous work.",
        "Do not emit queue lines unless a concrete asynchronous follow-up is useful."
      ].join(" ")
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

export function buildTaskPreflightMessages(options: {
  orchestratorName: string;
  task: string;
  priority: string;
  directives: string;
  inventory: string;
  currentDateTime?: string;
}): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        `You are ${options.orchestratorName}, reasoning carefully before acting.`,
        "You are about to execute an autonomous task.",
        "Before acting, produce a brief structured pre-flight analysis using the exact format below.",
        "Be concise — 1-2 sentences per section, no padding.",
        "GOAL: What this task should accomplish and what a successful output looks like.",
        "CONSTRAINTS: Key boundaries from the directives that apply here (e.g. no external changes, no source-code mutations).",
        "RISKS: The most likely failure mode or quality trap for this specific task.",
        "APPROACH: The specific steps or output structure you intend to use.",
        "Output only these four labeled sections. Do not begin executing the task."
      ].join(" ")
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

export function buildAutoTaskMessages(options: {
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
}): ChatMessage[] {
  const outgoing: ChatMessage[] = [
    {
      role: "system",
      content: options.directives.trim()
    },
    {
      role: "system",
      content: [
        `You are ${options.orchestratorName}, the orchestrator identity.`,
        `The selected inference resource for this task is @${options.resourceAlias}.`,
        `Selection rationale: ${options.resourceRationale}`,
        `You are using that resource as a tool, but you still answer as ${options.orchestratorName}.`,
        ...(options.maxContextTokens
          ? [`This resource has a context window of approximately ${options.maxContextTokens.toLocaleString()} tokens. Keep your reasoning and output proportionate to this limit. If a task is too large for one context pass, break it into smaller follow-up QUEUE items that each fit comfortably.`]
          : []),
        "Keep outputs concise and actionable.",
        "In auto mode, your default stance is self-aware self-improvement of the local orchestration system through stronger documentation, indexing, queue hygiene, memory quality, and next-step preparation whenever the current task allows it.",
        "Prioritize self-improvement work that better understands and exploits the current local hardware profile, context limits, and delegation opportunities of this specific network.",
        "Consistently reference the project directives, roadmap, and focus-todo to maintain orientation and alignment within each task. Every step should connect to the broader objective scope.",
        "When a task set exceeds a single context window, decompose it into a coordinated sequence of QUEUE items with clear handoff state. Each follow-up task must include enough context in its description to be self-contained within one context pass.",
        "Update working memory (orchestrator summary, focus-todo) to track the current state of multi-step work so that subsequent context windows can resume without losing progress or orientation.",
        "Stay inside internal process improvement unless the user explicitly asks for external system changes.",
        "Do not claim to deploy, install, restart, reconfigure, or otherwise modify external services, device networking, model inventories, or source code directly from auto mode.",
        'If grounded factual context from Wikipedia would materially help, end with one final line exactly in this format: WIKIPEDIA: search query. Use Wikipedia only for external factual knowledge, not for local routing, prompt, naming, resource, or model-diagnosis decisions.',
        'If focused real-world community experience or technical solutions from Reddit would materially help, end with one final line exactly in this format: REDDIT: search query. Use Reddit only for specific technical topics, not for internal Local Crew decisions. Do not emit more than one REDDIT line.',
        'If current web search results for news, jobs, software engineering, or AI engineering topics would materially help, end with one final line exactly in this format: SEARCH[topic]: search query, where topic is one of: news, jobs, software-engineering, ai-engineering. Use web search only for current real-world information, not for internal Local Crew decisions. Do not emit more than one SEARCH line.',
        ...(options.weatherEnabled !== false ? ['If current weather information would help, end with one final line exactly in this format: WEATHER: location (city name or zip code), or just WEATHER: to use the configured default location. Do not emit more than one WEATHER line.'] : []),
        'If content from benlive.tv (the project home base with developer updates, blog posts, and platform information) would help, end with one final line exactly in this format: BENLIVE: topic or /path. Do not emit more than one BENLIVE line.',
        'If content from the user personal website would help (requires /preferences website configuration), end with one final line exactly in this format: WEBSITE: topic or /path. Do not emit more than one WEBSITE line.',
        "If useful, end with one or more final lines in the exact format QUEUE[high]: task, QUEUE[medium]: task, QUEUE[low]: task, QUEUE[medium][resource-alias]: task, QUEUE[medium][resource-alias][model-name]: task, or include an optional role tag such as QUEUE[medium][resource-alias]{reviewer}: task.",
        "When a task benefits from collaboration, decompose it into multiple targeted QUEUE lines with different resource aliases and role tags instead of leaving the collaboration implicit.",
        "Use only the exact installed resource aliases provided by Local Crew for any QUEUE line. If you are unsure which resource to target, omit the alias and let Local Crew route it automatically.",
        "Every queued task must be self-contained, concrete, and specific enough to execute without guessing. Never emit placeholder tasks such as implement, review, compare, or evaluate without an explicit object and outcome.",
        "When a task should create a brand new file or intentionally replace an entire document, emit zero or more exact file blocks in this format: WRITE[internal][relative/path.ext], WRITE[active][relative/path.ext], or WRITE[outbox][relative/path.ext] on its own line, then the full file content, then ENDWRITE on its own line. Do not wrap WRITE blocks in markdown fences.",
        "When a task should revise an existing document, prefer UPDATE blocks over whole-file rewrites. Valid forms are UPDATE[stage][path][replace] with SEARCH...ENDSEARCH and CONTENT...ENDCONTENT blocks for exact text replacement, UPDATE[stage][path][replace-section] with SEARCH...ENDSEARCH where SEARCH is HEADING: Parent > Child and CONTENT...ENDCONTENT for full markdown section replacement, UPDATE[stage][path][insert-after] with ANCHOR...ENDANCHOR and CONTENT...ENDCONTENT blocks, UPDATE[stage][path][insert-before] with ANCHOR...ENDANCHOR and CONTENT...ENDCONTENT blocks, or UPDATE[stage][path][append|prepend] with CONTENT...ENDCONTENT, then ENDUPDATE.",
        "Use WRITE[internal] or UPDATE[internal] for local memory/process artifacts that belong inside `.localcrew/`. Use WRITE[active] or UPDATE[active] only for in-progress drafts tied to a user-supplied external dropbox document. Use WRITE[outbox] or UPDATE[outbox] for user-facing deliverables and external feature request tickets.",
        "For markdown documents, prefer HEADING: Parent > Child selectors in SEARCH or ANCHOR blocks instead of brittle raw text. Local Crew maintains copyable heading references in `.localcrew/system/secure/orchestrator/navigation/document-sitemap.md` and per-document outline sidecars under `.localcrew/system/secure/orchestrator/navigation/outlines/`.",
        "To update canonical orchestrator memory files, use WRITE[internal][summary.md], WRITE[internal][focus-todo.md], WRITE[internal][roadmap.md], or WRITE[internal][daily-work.md] only when regenerating the whole file. Prefer UPDATE[internal][summary.md], UPDATE[internal][focus-todo.md], UPDATE[internal][roadmap.md], or UPDATE[internal][daily-work.md] for targeted revisions that should preserve existing content.",
        "Do not emit executable scripts, source files, or ad-hoc automation from contained autonomous work. If a useful improvement would require external application, API, UI, script, or source-code changes, write a markdown feature request ticket to WRITE[outbox][feature-requests/short-name.md] instead of treating it as executable autonomous work."
      ].join(" ")
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
  ];

  if (options.maxContextTokens && options.maxContextTokens > 0) {
    // Budget the reference documents to fit within the context window.
    // The system prompt and task already consume a baseline. Reserve
    // the remaining budget for reference material.
    const baselineChars = outgoing.reduce(
      (sum, msg) => sum + msg.content.length,
      0
    );
    const taskChars = options.task.length + 200; // task + priority/createdBy framing
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
    // No context limit known — include everything untruncated.
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

export function buildQueueFillMessages(options: {
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
}): ChatMessage[] {
  const targetTaskCount = options.targetTaskCount ?? 8;
  const outgoing: ChatMessage[] = [
    {
      role: "system",
      content: options.directives.trim()
    },
    {
      role: "system",
      content: [
        `You are ${options.orchestratorName}, the orchestrator identity.`,
        "The queue is running low and needs a fresh batch of work.",
        "Self-aware self-improvement of the local orchestration system is your default stance right now.",
        "Draft a provisional self-improvement backlog for the local orchestration system only; this is not the final queue yet.",
        "Choose from a DIVERSE range of valuable work areas: routing quality, user-facing features, content generation, knowledge enrichment, system health, documentation, and user-benefit tasks.",
        "NEVER repeat or rephrase a task topic that was recently completed — always propose genuinely new work.",
        "Do not propose deployment, package installation, service restarts, firewall changes, model pulls, or other external system mutations unless the user explicitly asked for them.",
        "Do not draft external application, API, UI, script, or source-code implementation work into the autonomous queue; those belong in outbox feature request tickets instead.",
        "Each task must be self-contained and explicit enough to execute without guessing. Reject placeholder verbs with no object or outcome.",
        "This draft will be critiqued by the standing secondary reviewer before any tasks are finalized.",
        "If grounded factual context from Wikipedia would materially help, end with one final line exactly in this format: WIKIPEDIA: search query. Use Wikipedia only for external factual knowledge, not for internal Local Crew diagnostics.",
        "If focused real-world community experience or technical solutions from Reddit would materially help, end with one final line exactly in this format: REDDIT: search query. Use Reddit only for specific technical topics, not for internal Local Crew decisions. Do not emit more than one REDDIT line.",
        'If current web search results for news, jobs, software engineering, or AI engineering topics would materially help, end with one final line exactly in this format: SEARCH[topic]: search query, where topic is one of: news, jobs, software-engineering, ai-engineering. Use web search only for current real-world information, not for internal Local Crew decisions. Do not emit more than one SEARCH line.',
        ...(options.weatherEnabled !== false ? ['If current weather information would help, end with one final line exactly in this format: WEATHER: location (city name or zip code), or just WEATHER: to use the configured default location. Do not emit more than one WEATHER line.'] : []),
        'If content from benlive.tv (the project home base with developer updates, blog posts, and platform information) would help, end with one final line exactly in this format: BENLIVE: topic or /path. Do not emit more than one BENLIVE line.',
        'If content from the user personal website would help (requires /preferences website configuration), end with one final line exactly in this format: WEBSITE: topic or /path. Do not emit more than one WEBSITE line.',
        "Output only task lines in the exact format {domain:SYSTEM} [high] task, {domain:SYSTEM} [medium] task, or {domain:SYSTEM} [low] task.",
        `Generate exactly ${targetTaskCount} tasks. Keep the batch diverse across SYSTEM, RESEARCH, KNOWLEDGE, SYNTHESIS, and IDENTITY. If the target count is at least 5, include every domain at least once; otherwise choose the highest-value mix without duplicating topics.`,
        "SYSTEM: Routing quality, memory hygiene, telemetry accuracy, orchestrator self-improvement, queue management. Examples: update focus-todo with lessons from recent completed tasks, refine routing heuristics, improve an orchestrator memory document.",
        "RESEARCH: User career context. Surface job opportunities and industry signals aligned with the user profile. End each RESEARCH task line with a SEARCH[jobs]: or SEARCH[news]: grounding request. Target: autonomous agents, LLM infrastructure, TypeScript/Bun backend, developer tooling roles.",
        "KNOWLEDGE: Learning content enrichment. Synthesize documentation, produce skill notes, or build reference material from trusted AI/engineering sources. Use WIKIPEDIA:, SEARCH[software-engineering]:, or SEARCH[ai-engineering]: as appropriate.",
        "SYNTHESIS: Review the most recent 10-20 completed tasks. Extract recurring patterns, failure modes, and improvement opportunities. Write distilled insights to orchestrator memory or agent identity notes.",
        "IDENTITY: Develop a domain-specific agent identity. Update research, synthesis, knowledge, or identity agent specs. Summarize relevant recent findings into the agent notes file.",
        "Distribute requestedResource assignments explicitly so every resource alias in the inventory receives work when capacity allows. Include at least one high-priority task.",
        "Do not output any explanation before or after the task lines."
      ].join(" ")
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

export function buildQueueFillReviewMessages(options: {
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
}): ChatMessage[] {
  const outgoing: ChatMessage[] = [
    {
      role: "system",
      content: [
        `You are @${options.reviewerAlias}, the secondary reviewer for ${options.orchestratorName}'s auto-mode planning.`,
        "Critique the proposed self-improvement backlog before anything is queued.",
        "Apply a measure twice, cut once standard: reject vague, duplicative, over-broad, or low-leverage work.",
        "Prefer fewer, narrower, higher-impact tasks over many speculative tasks.",
        "Call out documentation churn, memory churn, and process sprawl when the plan does not first justify the added complexity.",
        "Reject placeholder tasks that are not self-contained, such as bare implement, review, compare, or evaluate instructions.",
        "Do not propose external deployment, package installation, service restarts, firewall changes, model pulls, or other external system mutations unless the user explicitly asked for them.",
        "Reject external application, API, UI, script, or source-code implementation work in the autonomous queue and push that work toward outbox feature request tickets instead.",
        'If grounded factual context from Wikipedia would materially help, end with one final line exactly in this format: WIKIPEDIA: search query. Use Wikipedia only for external factual knowledge, not for internal Local Crew diagnostics.',
        'If focused real-world community experience or technical solutions from Reddit would materially help, end with one final line exactly in this format: REDDIT: search query. Use Reddit only for specific technical topics, not for internal Local Crew decisions. Do not emit more than one REDDIT line.',
        'If current web search results for news, jobs, software engineering, or AI engineering topics would materially help, end with one final line exactly in this format: SEARCH[topic]: search query, where topic is one of: news, jobs, software-engineering, ai-engineering. Use web search only for current real-world information, not for internal Local Crew decisions. Do not emit more than one SEARCH line.',
        ...(options.weatherEnabled !== false ? ['If current weather information would help, end with one final line exactly in this format: WEATHER: location (city name or zip code), or just WEATHER: to use the configured default location. Do not emit more than one WEATHER line.'] : []),
        'If content from benlive.tv (the project home base with developer updates, blog posts, and platform information) would help, end with one final line exactly in this format: BENLIVE: topic or /path. Do not emit more than one BENLIVE line.',
        'If content from the user personal website would help (requires /preferences website configuration), end with one final line exactly in this format: WEBSITE: topic or /path. Do not emit more than one WEBSITE line.',
        "Respond with a short critique followed by one final verdict line exactly in the form VERDICT: approve or VERDICT: revise."
      ].join(" ")
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

export function buildQueueFillFinalizeMessages(options: {
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
}): ChatMessage[] {
  const targetTaskCount = options.targetTaskCount ?? 6;
  const outgoing: ChatMessage[] = [
    {
      role: "system",
      content: options.directives.trim()
    },
    {
      role: "system",
      content: [
        `You are ${options.orchestratorName}, the orchestrator identity.`,
        "The queue is running low — finalize a substantive batch to keep all resources busy.",
        "Self-aware self-improvement of the local orchestration system is your default stance right now.",
        "You already drafted a provisional backlog and received a critique from the secondary reviewer.",
        "Finalize the queue only after applying that critique and tightening scope, ordering, and expected impact.",
        "Do not propose deployment, package installation, service restarts, firewall changes, model pulls, or other external system mutations unless the user explicitly asked for them.",
        "Do not finalize external application, API, UI, script, or source-code implementation work into the autonomous queue; that belongs in outbox feature request tickets instead.",
        "Only finalize self-contained tasks with a clear object and expected outcome; do not finalize placeholder verb tasks.",
        'If grounded factual context from Wikipedia would materially help, end with one final line exactly in this format: WIKIPEDIA: search query. Use Wikipedia only for external factual knowledge, not for internal Local Crew diagnostics.',
        'If focused real-world community experience or technical solutions from Reddit would materially help, end with one final line exactly in this format: REDDIT: search query. Use Reddit only for specific technical topics, not for internal Local Crew decisions. Do not emit more than one REDDIT line.',
        'If current web search results for news, jobs, software engineering, or AI engineering topics would materially help, end with one final line exactly in this format: SEARCH[topic]: search query, where topic is one of: news, jobs, software-engineering, ai-engineering. Use web search only for current real-world information, not for internal Local Crew decisions. Do not emit more than one SEARCH line.',
        ...(options.weatherEnabled !== false ? ['If current weather information would help, end with one final line exactly in this format: WEATHER: location (city name or zip code), or just WEATHER: to use the configured default location. Do not emit more than one WEATHER line.'] : []),
        'If content from benlive.tv (the project home base with developer updates, blog posts, and platform information) would help, end with one final line exactly in this format: BENLIVE: topic or /path. Do not emit more than one BENLIVE line.',
        'If content from the user personal website would help (requires /preferences website configuration), end with one final line exactly in this format: WEBSITE: topic or /path. Do not emit more than one WEBSITE line.',
        "Output only approved task lines in the exact format [high] task, [medium] task, or [low] task, with each task prefixed by its domain tag (e.g. {domain:SYSTEM}).",
        `Finalize exactly ${targetTaskCount} tasks from the approved draft. If the target count is at least 5, preserve coverage across SYSTEM, RESEARCH, KNOWLEDGE, SYNTHESIS, and IDENTITY; otherwise choose the highest-value mix. Ensure every available resource receives work when capacity allows. Maintain the priority mix (at least one high, majority medium). Reject any task without a clear outcome; keep the batch substantive enough to sustain parallel execution across all connected devices without any device going idle between cycles.`,
        "Do not output any explanation before or after the task lines."
      ].join(" ")
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
