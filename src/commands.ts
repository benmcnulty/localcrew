import type { Command, FollowUpRequest } from "./types.ts";

const SMART_DOUBLE_OPEN = "\u201C";
const SMART_DOUBLE_CLOSE = "\u201D";
const SMART_SINGLE_OPEN = "\u2018";
const SMART_SINGLE_CLOSE = "\u2019";

const QUOTE_PAIRS = new Map<string, string>([
  ['"', '"'],
  ["'", "'"],
  [SMART_DOUBLE_OPEN, SMART_DOUBLE_CLOSE],
  [SMART_SINGLE_OPEN, SMART_SINGLE_CLOSE]
]);

function usage(command: string): string {
  switch (command) {
    case "/chat":
      return "Usage: /chat";
    case "/group":
      return "Usage: /group";
    case "/auto":
      return "Usage: /auto";
    case "/stop":
      return "Usage: /stop";
    case "/status":
      return "Usage: /status";
    case "/hud":
      return "Usage: /hud";
    case "/explore":
      return "Usage: /explore";
    case "/login":
      return "Usage: /login";
    case "/end":
      return "Usage: /end";
    case "/help":
      return "Usage: /help";
    case "/priority":
      return "Usage: /priority [high|medium|low]";
    case "/agent":
      return "Usage: /agent list | /agent new | /agent edit <name> | /agent <name>";
    case "/model":
      return "Usage: /model [alias]";
    case "/default":
      return "Usage: /default [alias]";
    case "/rename":
      return "Usage: /rename <oldAlias> <newAlias>";
    case "/sound":
      return "Usage: /sound [on|off]";
    case "/voice":
      return "Usage: /voice [@alias] [preset|list]";
    case "/instructions":
      return 'Usage: /instructions [@alias] ["text"]';
    case "/compact":
      return "Usage: /compact";
    case "/clear":
      return "Usage: /clear";
    case "/reset":
      return "Usage: /reset";
    case "/exit":
      return "Usage: /exit";
    default:
      return "Unknown command.";
  }
}

function normalizeAlias(alias: string): string {
  return alias.trim().replace(/^@/, "").toLowerCase();
}

function isAliasToken(value: string): boolean {
  return value.startsWith("@");
}

function parseBooleanToggle(value: string): boolean | undefined {
  if (value === "on") {
    return true;
  }

  if (value === "off") {
    return false;
  }

  return undefined;
}

function parsePriority(value: string): "high" | "medium" | "low" | undefined {
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }

  return undefined;
}

function unwrapQuotedText(value: string): string {
  const trimmedValue = value.trim();
  const pairs: Array<[string, string]> = [
    ['"', '"'],
    ["'", "'"],
    [SMART_DOUBLE_OPEN, SMART_DOUBLE_CLOSE],
    [SMART_SINGLE_OPEN, SMART_SINGLE_CLOSE]
  ];

  for (const [open, close] of pairs) {
    if (trimmedValue.startsWith(open) && trimmedValue.endsWith(close) && trimmedValue.length >= 2) {
      return trimmedValue.slice(open.length, trimmedValue.length - close.length);
    }
  }

  return trimmedValue;
}

export class CommandParseError extends Error {}

export function tokenizeInput(input: string): string[] {
  const tokens: string[] = [];
  let buffer = "";
  let closingQuote: string | null = null;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (closingQuote) {
      if (char === "\\") {
        index += 1;
        if (index >= input.length) {
          throw new CommandParseError("Trailing escape inside quoted string.");
        }
        buffer += input[index];
        continue;
      }

      if (char === closingQuote) {
        closingQuote = null;
        continue;
      }

      buffer += char;
      continue;
    }

    if (/\s/.test(char)) {
      if (buffer) {
        tokens.push(buffer);
        buffer = "";
      }
      continue;
    }

    if (char === "\\") {
      index += 1;
      if (index >= input.length) {
        throw new CommandParseError("Trailing escape in command.");
      }
      buffer += input[index];
      continue;
    }

    const nextQuote = QUOTE_PAIRS.get(char);
    if (nextQuote) {
      closingQuote = nextQuote;
      continue;
    }

    buffer += char;
  }

  if (closingQuote) {
    throw new CommandParseError("Unterminated quoted string.");
  }

  if (buffer) {
    tokens.push(buffer);
  }

  return tokens;
}

export function parseDirectedMessage(
  input: string
): { fromAlias: string; toAlias: string; text: string } | null {
  const match = input
    .trim()
    .match(/^@([a-z0-9_-]+)\s+to\s+@([a-z0-9_-]+)\s*:\s*(.+)$/i);

  if (!match) {
    return null;
  }

  return {
    fromAlias: normalizeAlias(match[1]),
    toAlias: normalizeAlias(match[2]),
    text: unwrapQuotedText(match[3]).trim()
  };
}

export function extractAddressedMessage(
  input: string
): { alias?: string; text: string } {
  const trimmedInput = input.trim();
  if (!trimmedInput.startsWith("@")) {
    return {
      text: trimmedInput
    };
  }

  const firstSpaceIndex = trimmedInput.indexOf(" ");
  if (firstSpaceIndex === -1) {
    return {
      alias: normalizeAlias(trimmedInput),
      text: ""
    };
  }

  return {
    alias: normalizeAlias(trimmedInput.slice(0, firstSpaceIndex)),
    text: trimmedInput.slice(firstSpaceIndex + 1).trim()
  };
}

export function formatDirectedMessageInput(request: FollowUpRequest): string {
  return `@${request.fromAlias} to @${request.toAlias}: "${request.message.replaceAll('"', '\\"')}"`;
}

export function parseCommand(input: string): Command {
  const trimmedInput = input.trim();

  if (!trimmedInput) {
    throw new CommandParseError("Enter a command.");
  }

  if (!trimmedInput.startsWith("/")) {
    const directedMessage = parseDirectedMessage(trimmedInput);
    if (directedMessage) {
      if (!directedMessage.text) {
        throw new CommandParseError('Usage: @from to @to: "message"');
      }

      return {
        type: "crosstalk",
        fromAlias: directedMessage.fromAlias,
        toAlias: directedMessage.toAlias,
        text: directedMessage.text
      };
    }

    const addressedMessage = extractAddressedMessage(trimmedInput);
    if (addressedMessage.alias) {
      return {
        type: "message",
        alias: addressedMessage.alias,
        text: addressedMessage.text
      };
    }

    return {
      type: "message",
      text: trimmedInput
    };
  }

  const tokens = tokenizeInput(trimmedInput);
  const [name, ...rest] = tokens;

  switch (name) {
    case "/chat":
      if (rest.length > 0) {
        throw new CommandParseError(usage("/chat"));
      }
      return { type: "chatMode" };
    case "/group":
      if (rest.length > 0) {
        throw new CommandParseError(usage("/group"));
      }
      return { type: "groupMode" };
    case "/auto":
      if (rest.length > 0) {
        throw new CommandParseError(usage("/auto"));
      }
      return { type: "autoMode" };
    case "/stop":
      if (rest.length > 0) {
        throw new CommandParseError(usage("/stop"));
      }
      return { type: "stopAuto" };
    case "/status":
      if (rest.length > 0) {
        throw new CommandParseError(usage("/status"));
      }
      return { type: "status" };
    case "/hud":
      if (rest.length > 0) {
        throw new CommandParseError(usage("/hud"));
      }
      return { type: "hud" };
    case "/explore":
      if (rest.length > 0) {
        throw new CommandParseError(usage("/explore"));
      }
      return { type: "explore" };
    case "/login":
      if (rest.length > 0) {
        throw new CommandParseError(usage("/login"));
      }
      return { type: "login" };
    case "/end":
      if (rest.length > 0) {
        throw new CommandParseError(usage("/end"));
      }
      return { type: "endMode" };
    case "/help":
      if (rest.length > 0) {
        throw new CommandParseError(usage("/help"));
      }
      return { type: "help" };
    case "/priority":
      if (rest.length === 0) {
        return { type: "priority.get" };
      }
      if (rest.length !== 1) {
        throw new CommandParseError(usage("/priority"));
      }
      {
        const priority = parsePriority(rest[0].toLowerCase());
        if (!priority) {
          throw new CommandParseError(usage("/priority"));
        }
        return { type: "priority.set", priority };
      }
    case "/agent":
      if (rest.length === 0) {
        throw new CommandParseError(usage("/agent"));
      }
      if (rest.length === 1) {
        const subcommand = rest[0].toLowerCase();
        if (subcommand === "list") {
          return { type: "agent.list" };
        }
        if (subcommand === "new") {
          return { type: "agent.new" };
        }
        return {
          type: "agent.chat",
          name: normalizeAlias(rest[0])
        };
      }
      if (rest.length === 2 && rest[0].toLowerCase() === "edit") {
        return {
          type: "agent.edit",
          name: normalizeAlias(rest[1])
        };
      }
      throw new CommandParseError(usage("/agent"));
    case "/model":
      if (rest.length === 0) {
        return { type: "model.get" };
      }
      if (rest.length !== 1) {
        throw new CommandParseError(usage("/model"));
      }
      return {
        type: "model.set",
        alias: normalizeAlias(rest[0])
      };
    case "/default":
      if (rest.length === 0) {
        return { type: "default.get" };
      }
      if (rest.length !== 1) {
        throw new CommandParseError(usage("/default"));
      }
      return {
        type: "default.set",
        alias: normalizeAlias(rest[0])
      };
    case "/rename":
      if (rest.length !== 2) {
        throw new CommandParseError(usage("/rename"));
      }
      return {
        type: "rename",
        fromAlias: normalizeAlias(rest[0]),
        toAlias: normalizeAlias(rest[1])
      };
    case "/sound":
      if (rest.length === 0) {
        return { type: "sound.toggle" };
      }
      if (rest.length !== 1) {
        throw new CommandParseError(usage("/sound"));
      }
      {
        const enabled = parseBooleanToggle(rest[0].toLowerCase());
        if (enabled === undefined) {
          throw new CommandParseError(usage("/sound"));
        }
        return {
          type: "sound.set",
          enabled
        };
      }
    case "/voice":
      if (rest.length === 0) {
        return { type: "voice.get" };
      }

      if (rest.length === 1) {
        if (rest[0].toLowerCase() === "list") {
          return { type: "voice.list" };
        }
        if (isAliasToken(rest[0])) {
          return {
            type: "voice.get",
            alias: normalizeAlias(rest[0])
          };
        }
        return {
          type: "voice.set",
          preset: rest[0]
        };
      }

      if (rest.length === 2 && isAliasToken(rest[0])) {
        return {
          type: "voice.set",
          alias: normalizeAlias(rest[0]),
          preset: rest[1]
        };
      }

      throw new CommandParseError(usage("/voice"));
    case "/instructions":
      if (rest.length === 0) {
        return { type: "instructions.edit" };
      }

      if (rest.length === 1) {
        if (isAliasToken(rest[0])) {
          return {
            type: "instructions.edit",
            alias: normalizeAlias(rest[0])
          };
        }

        return {
          type: "instructions.set",
          text: rest[0]
        };
      }

      if (isAliasToken(rest[0])) {
        return {
          type: "instructions.set",
          alias: normalizeAlias(rest[0]),
          text: rest.slice(1).join(" ").trim()
        };
      }

      throw new CommandParseError(usage("/instructions"));
    case "/compact":
      if (rest.length > 0) {
        throw new CommandParseError(usage("/compact"));
      }
      return { type: "compact" };
    case "/clear":
      if (rest.length > 0) {
        throw new CommandParseError(usage("/clear"));
      }
      return { type: "clear" };
    case "/reset":
      if (rest.length > 0) {
        throw new CommandParseError(usage("/reset"));
      }
      return { type: "reset" };
    case "/exit":
      if (rest.length > 0) {
        throw new CommandParseError(usage("/exit"));
      }
      return { type: "exit" };
    default:
      throw new CommandParseError(`Unknown command "${name}".`);
  }
}
