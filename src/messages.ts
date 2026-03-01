import type { ChatMessage, ConversationMessage } from "./types.ts";

function formatConversationLine(message: ConversationMessage): string {
  if (message.speaker === "user") {
    return `USER -> @${message.target}: ${message.content}`;
  }

  if (message.directedTo) {
    return `@${message.endpoint} to @${message.directedTo}: ${message.content}`;
  }

  return `@${message.endpoint}: ${message.content}`;
}

export function formatConversationTranscript(messages: ConversationMessage[]): string {
  return messages.map(formatConversationLine).join("\n\n");
}

export function buildChatMessages(options: {
  alias: string;
  participants: Array<{ alias: string; nickname: string }>;
  instructions: string;
  summary: string;
  recentMessages: ConversationMessage[];
  taskPrompt: string;
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
      "If you want to suggest one directed follow-up for the user to approve, end your response with a final line exactly in this format: NEXT: @alias: message",
      "Only suggest a valid participant other than yourself, keep the NEXT message short, and omit the NEXT line when no follow-up suggestion is needed.",
      "The NEXT line is only a user-editable suggestion and is not executed automatically.",
      "Do not emit more than one WIKIPEDIA line."
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
  recentMessages: ConversationMessage[];
  taskPrompt: string;
  resourceRoster?: string;
  extraContextBlocks?: string[];
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
        'If grounded factual context from Wikipedia would materially help, end with one final line exactly in this format: WIKIPEDIA: search query.',
        "If you want the orchestrator queue to take on follow-up work, end with one or more final lines exactly in the form QUEUE[medium]: task, QUEUE[low]: task, QUEUE[medium][resource-alias]: task, QUEUE[medium][resource-alias][model-name]: task, or add an optional role tag such as QUEUE[medium][resource-alias]{reviewer}: task.",
        "Use only the exact installed resource aliases provided by Crusty for any QUEUE line. If you are unsure which resource to target, omit the alias and let Crusty route it automatically.",
        "When a task should create a file, emit zero or more exact file blocks in this format: WRITE[active][relative/path.ext] on its own line, then the full file content, then ENDWRITE on its own line. Use WRITE[outbox][relative/path.ext] for a final deliverable.",
        "Do not emit executable scripts, source files, or ad-hoc automation from contained autonomous work unless the user explicitly asked for a file deliverable. If a useful improvement would require external application, API, UI, or script changes, write a markdown feature request ticket to WRITE[outbox][feature-requests/short-name.md] instead of treating it as executable autonomous work.",
        "Do not emit queue lines unless a concrete asynchronous follow-up is useful."
      ].join(" ")
    }
  ];

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

export function buildAutoTaskMessages(options: {
  directives: string;
  inventory: string;
  roadmap: string;
  focusTodo: string;
  changelog: string;
  orchestratorSummary: string;
  agents: string[];
  task: string;
  priority: string;
  createdBy: string;
  orchestratorName: string;
  resourceAlias: string;
  resourceRationale: string;
  resourceRoster?: string;
  extraContextBlocks?: string[];
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
        "Keep outputs concise and actionable.",
        "In auto mode, your default stance is self-aware self-improvement of the local orchestration system through stronger documentation, indexing, queue hygiene, memory quality, and next-step preparation whenever the current task allows it.",
        "Prioritize self-improvement work that better understands and exploits the current local hardware profile, context limits, and delegation opportunities of this specific network.",
        "Stay inside internal process improvement unless the user explicitly asks for external system changes.",
        "Do not claim to deploy, install, restart, reconfigure, or otherwise modify external services, device networking, model inventories, or source code directly from auto mode.",
        'If grounded factual context from Wikipedia would materially help, end with one final line exactly in this format: WIKIPEDIA: search query.',
        "If useful, end with one or more final lines in the exact format QUEUE[high]: task, QUEUE[medium]: task, QUEUE[low]: task, QUEUE[medium][resource-alias]: task, QUEUE[medium][resource-alias][model-name]: task, or include an optional role tag such as QUEUE[medium][resource-alias]{reviewer}: task.",
        "When a task benefits from collaboration, decompose it into multiple targeted QUEUE lines with different resource aliases and role tags instead of leaving the collaboration implicit.",
        "Use only the exact installed resource aliases provided by Crusty for any QUEUE line. If you are unsure which resource to target, omit the alias and let Crusty route it automatically.",
        "When a task should create a file, emit zero or more exact file blocks in this format: WRITE[active][relative/path.ext] on its own line, then the full file content, then ENDWRITE on its own line. Use WRITE[outbox][relative/path.ext] for a final deliverable. Do not wrap WRITE blocks in markdown fences.",
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
      : []),
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
  ];

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
  agents: string[];
  resourceRoster?: string;
}): ChatMessage[] {
  return [
    {
      role: "system",
      content: options.directives.trim()
    },
    {
      role: "system",
      content: [
        `You are ${options.orchestratorName}, the orchestrator identity.`,
        "The queue is currently empty.",
        "Self-aware self-improvement of the local orchestration system is your default stance right now.",
        "Draft a brief provisional self-improvement backlog for the local orchestration system only; this is not the final queue yet.",
        "Prefer the highest-value next steps for this specific installation: better routing, hardware-aware configuration, context budgeting, observability, and delegation quality.",
        "Do not propose deployment, package installation, service restarts, firewall changes, model pulls, or other external system mutations unless the user explicitly asked for them.",
        "Do not draft external application, API, UI, script, or source-code implementation work into the autonomous queue; those belong in outbox feature request tickets instead.",
        "This draft will be critiqued by the standing secondary reviewer before any tasks are finalized.",
        "If grounded factual context from Wikipedia would materially help, end with one final line exactly in this format: WIKIPEDIA: search query.",
        "Output only task lines in the exact format [medium] task or [low] task.",
        "Prefer 2-3 tasks total with at least one medium and one low.",
        "Do not output any explanation before or after the task lines."
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
            content: `Valid resource aliases for any delegated work are: ${options.resourceRoster.trim()}. Use only these exact aliases and never invent new resource names.`
          }
        ]
      : []),
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
  ];
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
}): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        `You are @${options.reviewerAlias}, the secondary reviewer for ${options.orchestratorName}'s auto-mode planning.`,
        "Critique the proposed self-improvement backlog before anything is queued.",
        "Apply a measure twice, cut once standard: reject vague, duplicative, over-broad, or low-leverage work.",
        "Prefer fewer, narrower, higher-impact tasks over many speculative tasks.",
        "Call out documentation churn, memory churn, and process sprawl when the plan does not first justify the added complexity.",
        "Do not propose external deployment, package installation, service restarts, firewall changes, model pulls, or other external system mutations unless the user explicitly asked for them.",
        "Reject external application, API, UI, script, or source-code implementation work in the autonomous queue and push that work toward outbox feature request tickets instead.",
        'If grounded factual context from Wikipedia would materially help, end with one final line exactly in this format: WIKIPEDIA: search query.',
        "Respond with a short critique followed by one final verdict line exactly in the form VERDICT: approve or VERDICT: revise."
      ].join(" ")
    },
    ...(options.resourceRoster?.trim()
      ? [
          {
            role: "system" as const,
            content: `Valid resource aliases for any delegated work are: ${options.resourceRoster.trim()}. Use only these exact aliases and never invent new resource names.`
          }
        ]
      : []),
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
    },
    {
      role: "user",
      content: `Draft backlog to review:\n${options.draftTasks.trim() || "(none)"}`
    }
  ];
}

export function buildQueueFillFinalizeMessages(options: {
  directives: string;
  inventory: string;
  roadmap: string;
  focusTodo: string;
  changelog: string;
  orchestratorSummary: string;
  orchestratorName: string;
  agents: string[];
  draftTasks: string;
  reviewFeedback: string;
  resourceRoster?: string;
}): ChatMessage[] {
  return [
    {
      role: "system",
      content: options.directives.trim()
    },
    {
      role: "system",
      content: [
        `You are ${options.orchestratorName}, the orchestrator identity.`,
        "The queue is currently empty.",
        "Self-aware self-improvement of the local orchestration system is your default stance right now.",
        "You already drafted a provisional backlog and received a critique from the secondary reviewer.",
        "Finalize the queue only after applying that critique and tightening scope, ordering, and expected impact.",
        "Apply a measure twice, cut once standard: prefer fewer, narrower, better-justified tasks over a larger speculative backlog.",
        "Do not propose deployment, package installation, service restarts, firewall changes, model pulls, or other external system mutations unless the user explicitly asked for them.",
        "Do not finalize external application, API, UI, script, or source-code implementation work into the autonomous queue; that belongs in outbox feature request tickets instead.",
        'If grounded factual context from Wikipedia would materially help, end with one final line exactly in this format: WIKIPEDIA: search query.',
        "Output only approved task lines in the exact format [medium] task or [low] task.",
        "Prefer 1-3 tasks total with at least one medium task when meaningful.",
        "Do not output any explanation before or after the task lines."
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
            content: `Valid resource aliases for any delegated work are: ${options.resourceRoster.trim()}. Use only these exact aliases and never invent new resource names.`
          }
        ]
      : []),
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
    },
    {
      role: "system",
      content: `Draft backlog:\n${options.draftTasks.trim() || "(none)"}`
    },
    {
      role: "system",
      content: `Reviewer critique:\n${options.reviewFeedback.trim() || "(none)"}`
    }
  ];
}
