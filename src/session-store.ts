import { mkdir, readFile } from "node:fs/promises";

import { atomicWriteFile, getStoragePaths } from "./storage.ts";
import type {
  AssistantConversationMessage,
  ConversationMessage,
  SessionsFile,
  SharedConversationState,
  UserConversationMessage
} from "./types.ts";
import { getEmptyConversation } from "./utils.ts";

function normalizeConversationAlias(alias: string): string {
  return alias.toLowerCase();
}

export function getEmptySessions(): SessionsFile {
  return {
    conversation: getEmptyConversation()
  };
}

function normalizeUserMessage(value: unknown): UserConversationMessage {
  if (!value || typeof value !== "object") {
    throw new Error("User conversation message must be an object.");
  }

  const candidate = value as Partial<UserConversationMessage>;

  if (typeof candidate.target !== "string" || candidate.target.trim() === "") {
    throw new Error("User conversation message target must be a string.");
  }

  if (typeof candidate.content !== "string") {
    throw new Error("User conversation message content must be a string.");
  }

  return {
    speaker: "user",
    target: normalizeConversationAlias(candidate.target),
    content: candidate.content
  };
}

function normalizeAssistantMessage(value: unknown): AssistantConversationMessage {
  if (!value || typeof value !== "object") {
    throw new Error("Assistant conversation message must be an object.");
  }

  const candidate = value as Partial<AssistantConversationMessage>;

  if (typeof candidate.endpoint !== "string" || candidate.endpoint.trim() === "") {
    throw new Error("Assistant conversation message endpoint must be a string.");
  }

  if (typeof candidate.content !== "string") {
    throw new Error("Assistant conversation message content must be a string.");
  }

  const directedTo =
    typeof candidate.directedTo === "string" && candidate.directedTo.trim() !== ""
      ? normalizeConversationAlias(candidate.directedTo)
      : undefined;

  return {
    speaker: "assistant",
    endpoint: normalizeConversationAlias(candidate.endpoint),
    content: candidate.content,
    ...(directedTo ? { directedTo } : {})
  };
}

function normalizeConversationMessage(value: unknown): ConversationMessage {
  if (!value || typeof value !== "object") {
    throw new Error("Conversation message must be an object.");
  }

  const candidate = value as { speaker?: unknown };

  if (candidate.speaker === "user") {
    return normalizeUserMessage(value);
  }

  if (candidate.speaker === "assistant") {
    return normalizeAssistantMessage(value);
  }

  throw new Error("Conversation message has an invalid speaker.");
}

function normalizeLegacyCompactionState(
  endpointStates: unknown,
  preferredAlias?: string
): Pick<SharedConversationState, "compactedUntil" | "summary"> {
  if (!endpointStates || typeof endpointStates !== "object") {
    return {
      compactedUntil: 0,
      summary: ""
    };
  }

  const entries = Object.entries(endpointStates as Record<string, unknown>).map(([alias, value]) => {
    const candidate = value as Partial<{ compactedUntil: unknown; summary: unknown }>;

    return {
      alias: normalizeConversationAlias(alias),
      compactedUntil:
        typeof candidate?.compactedUntil === "number" && candidate.compactedUntil >= 0
          ? candidate.compactedUntil
          : 0,
      summary:
        typeof candidate?.summary === "string"
          ? candidate.summary
          : ""
    };
  });

  if (entries.length === 0) {
    return {
      compactedUntil: 0,
      summary: ""
    };
  }

  const preferredEntry =
    preferredAlias !== undefined
      ? entries.find((entry) => entry.alias === normalizeConversationAlias(preferredAlias))
      : undefined;

  const selectedEntry =
    preferredEntry ??
    [...entries].sort((left, right) => right.compactedUntil - left.compactedUntil)[0];

  return {
    compactedUntil: selectedEntry.compactedUntil,
    summary: selectedEntry.summary
  };
}

function normalizeSessions(raw: unknown, preferredAlias?: string): SessionsFile {
  if (!raw || typeof raw !== "object") {
    return getEmptySessions();
  }

  const candidate = raw as {
    conversation?: unknown;
    sessions?: unknown;
  };

  if (!candidate.conversation || typeof candidate.conversation !== "object") {
    return getEmptySessions();
  }

  const conversation = candidate.conversation as {
    messages?: unknown;
    compactedUntil?: unknown;
    summary?: unknown;
    endpointStates?: unknown;
  };

  const messages = Array.isArray(conversation.messages)
    ? conversation.messages.map(normalizeConversationMessage)
    : [];

  const legacyCompaction = normalizeLegacyCompactionState(
    conversation.endpointStates,
    preferredAlias
  );

  return {
    conversation: {
      messages,
      compactedUntil:
        typeof conversation.compactedUntil === "number" && conversation.compactedUntil >= 0
          ? conversation.compactedUntil
          : legacyCompaction.compactedUntil,
      summary:
        typeof conversation.summary === "string"
          ? conversation.summary
          : legacyCompaction.summary
    }
  };
}

export async function saveSessions(
  sessions: SessionsFile,
  rootDir = process.cwd()
): Promise<void> {
  const paths = getStoragePaths(rootDir);
  await mkdir(paths.storageDir, { recursive: true });
  await atomicWriteFile(paths.sessionsPath, `${JSON.stringify(sessions, null, 2)}\n`);
}

export async function loadSessions(
  rootDir = process.cwd(),
  preferredAlias?: string
): Promise<SessionsFile> {
  const paths = getStoragePaths(rootDir);
  await mkdir(paths.storageDir, { recursive: true });

  try {
    const raw = await readFile(paths.sessionsPath, "utf8");
    const normalized = normalizeSessions(JSON.parse(raw), preferredAlias);
    await saveSessions(normalized, rootDir);
    return normalized;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      const sessions = getEmptySessions();
      await saveSessions(sessions, rootDir);
      return sessions;
    }

    if (error instanceof SyntaxError) {
      throw new Error(`Sessions file is not valid JSON: ${error.message}`);
    }

    throw error;
  }
}

export function getConversationMessages(sessions: SessionsFile): ConversationMessage[] {
  return sessions.conversation.messages;
}

export function setConversationMessages(
  sessions: SessionsFile,
  messages: ConversationMessage[]
): SessionsFile {
  return {
    conversation: {
      ...sessions.conversation,
      messages
    }
  };
}

export function appendConversationMessages(
  sessions: SessionsFile,
  messages: ConversationMessage[]
): SessionsFile {
  return setConversationMessages(sessions, [
    ...getConversationMessages(sessions),
    ...messages
  ]);
}

export function getConversationSummary(sessions: SessionsFile): string {
  return sessions.conversation.summary;
}

export function getConversationCompactedUntil(sessions: SessionsFile): number {
  return sessions.conversation.compactedUntil;
}

export function setConversationCompaction(
  sessions: SessionsFile,
  compaction: Pick<SharedConversationState, "compactedUntil" | "summary">
): SessionsFile {
  return {
    conversation: {
      ...sessions.conversation,
      compactedUntil: compaction.compactedUntil,
      summary: compaction.summary
    }
  };
}

export function renameConversationAlias(
  sessions: SessionsFile,
  oldAlias: string,
  newAlias: string
): SessionsFile {
  const normalizedOldAlias = oldAlias.toLowerCase();
  const normalizedNewAlias = newAlias.toLowerCase();

  return {
    conversation: {
      ...sessions.conversation,
      messages: sessions.conversation.messages.map((message) => {
        if (message.speaker === "user") {
          return {
            ...message,
            target: message.target === normalizedOldAlias ? normalizedNewAlias : message.target
          };
        }

        return {
          ...message,
          endpoint: message.endpoint === normalizedOldAlias ? normalizedNewAlias : message.endpoint,
          directedTo:
            message.directedTo === normalizedOldAlias ? normalizedNewAlias : message.directedTo
        };
      }),
      summary: sessions.conversation.summary.replaceAll(
        `@${normalizedOldAlias}`,
        `@${normalizedNewAlias}`
      )
    }
  };
}

export function resetConversation(sessions: SessionsFile): SessionsFile {
  return {
    conversation: getEmptyConversation()
  };
}
