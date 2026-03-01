import type { Command, FollowUpRequest } from "./types.ts";
import { normalizeAlias } from "./utils.ts";

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
    case "/participant":
      return 'Usage: /participant list | /participant add <alias> <resourceAlias> ["nickname"] | /participant edit <alias> | /participant remove <alias>';
    case "/resource":
      return 'Usage: /resource list | /resource add <alias> "<label>" <baseUrl> [top|mid|low] [ollama|openai|anthropic] | /resource edit <alias> | /resource refresh <alias> | /resource remove <alias>';
    case "/models":
      return "Usage: /models [resourceAlias|@participantAlias]";
    case "/direct":
      return 'Usage: /direct <resourceAlias> "<message>" [model]';
    case "/model":
      return "Usage: /model [alias] | /model <alias> <model>";
    case "/default":
      return "Usage: /default [alias]";
    case "/nickname":
      return 'Usage: /nickname [@alias] ["name"]';
    case "/bind":
      return "Usage: /bind [@alias] [resourceAlias]";
    case "/orchestrator":
      return 'Usage: /orchestrator ["name"]';
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

function parseTier(value: string): "top" | "mid" | "low" | undefined {
  if (value === "top" || value === "mid" || value === "low") {
    return value;
  }

  return undefined;
}

function parseApiStyle(value: string): "ollama" | "openai" | "anthropic" | undefined {
  if (value === "ollama" || value === "openai" || value === "anthropic") {
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
    case "/participant":
      if (rest.length === 1 && rest[0].toLowerCase() === "list") {
        return { type: "participant.list" };
      }
      if (rest.length >= 3 && rest[0].toLowerCase() === "add") {
        return {
          type: "participant.add",
          alias: normalizeAlias(rest[1]),
          resourceAlias: normalizeAlias(rest[2]),
          ...(rest[3] ? { nickname: rest.slice(3).join(" ") } : {})
        };
      }
      if (rest.length === 2 && rest[0].toLowerCase() === "edit") {
        return {
          type: "participant.edit",
          alias: normalizeAlias(rest[1])
        };
      }
      if (rest.length === 2 && rest[0].toLowerCase() === "remove") {
        return {
          type: "participant.remove",
          alias: normalizeAlias(rest[1])
        };
      }
      throw new CommandParseError(usage("/participant"));
    case "/resource":
      if (rest.length === 1 && rest[0].toLowerCase() === "list") {
        return { type: "resource.list" };
      }
      if (rest.length >= 4 && rest.length <= 6 && rest[0].toLowerCase() === "add") {
        const tier = rest[4] ? parseTier(rest[4].toLowerCase()) : undefined;
        const apiStyle = rest[5]
          ? parseApiStyle(rest[5].toLowerCase())
          : rest[4] && !tier
            ? parseApiStyle(rest[4].toLowerCase())
            : undefined;
        if (rest[4] && !tier && !apiStyle) {
          throw new CommandParseError(usage("/resource"));
        }
        if (rest[5] && !apiStyle) {
          throw new CommandParseError(usage("/resource"));
        }
        return {
          type: "resource.add",
          alias: normalizeAlias(rest[1]),
          label: rest[2],
          baseUrl: rest[3],
          ...(tier ? { tier } : {}),
          ...(apiStyle ? { apiStyle } : {})
        };
      }
      if (rest.length === 2 && rest[0].toLowerCase() === "edit") {
        return {
          type: "resource.edit",
          alias: normalizeAlias(rest[1])
        };
      }
      if (rest.length === 2 && rest[0].toLowerCase() === "refresh") {
        return {
          type: "resource.refresh",
          alias: normalizeAlias(rest[1])
        };
      }
      if (rest.length === 2 && rest[0].toLowerCase() === "remove") {
        return {
          type: "resource.remove",
          alias: normalizeAlias(rest[1])
        };
      }
      throw new CommandParseError(usage("/resource"));
    case "/models":
      if (rest.length > 1) {
        throw new CommandParseError(usage("/models"));
      }
      return {
        type: "models.list",
        ...(rest[0] ? { target: rest[0] } : {})
      };
    case "/direct":
      if (rest.length < 2 || rest.length > 3) {
        throw new CommandParseError(usage("/direct"));
      }
      return {
        type: "directChat",
        resourceAlias: normalizeAlias(rest[0]),
        text: rest[1],
        ...(rest[2] ? { model: rest[2] } : {})
      };
    case "/model":
      if (rest.length === 0) {
        return { type: "model.get" };
      }
      if (rest.length === 1) {
        return {
          type: "model.set",
          alias: normalizeAlias(rest[0])
        };
      }
      return {
        type: "model.assign",
        alias: normalizeAlias(rest[0]),
        model: rest.slice(1).join(" ")
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
    case "/nickname":
      if (rest.length === 0) {
        return { type: "nickname.get" };
      }
      if (rest.length === 1) {
        if (isAliasToken(rest[0])) {
          return {
            type: "nickname.get",
            alias: normalizeAlias(rest[0])
          };
        }
        return {
          type: "nickname.set",
          nickname: rest[0]
        };
      }
      if (rest.length === 2 && isAliasToken(rest[0])) {
        return {
          type: "nickname.set",
          alias: normalizeAlias(rest[0]),
          nickname: rest[1]
        };
      }
      throw new CommandParseError(usage("/nickname"));
    case "/bind":
      if (rest.length === 0) {
        return { type: "bind.get" };
      }
      if (rest.length === 1) {
        if (isAliasToken(rest[0])) {
          return {
            type: "bind.get",
            alias: normalizeAlias(rest[0])
          };
        }
        return {
          type: "bind.set",
          resourceAlias: normalizeAlias(rest[0])
        };
      }
      if (rest.length === 2 && isAliasToken(rest[0])) {
        return {
          type: "bind.set",
          alias: normalizeAlias(rest[0]),
          resourceAlias: normalizeAlias(rest[1])
        };
      }
      throw new CommandParseError(usage("/bind"));
    case "/orchestrator":
      if (rest.length === 0) {
        return { type: "orchestrator.get" };
      }
      return {
        type: "orchestrator.set",
        name: rest.join(" ")
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
