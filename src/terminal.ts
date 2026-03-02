/**
 * Terminal styling, formatting, and interactive input helpers.
 *
 * Provides ANSI color/style primitives, OSC 8 clickable hyperlinks,
 * status line rendering, command completions, and a styled startup banner.
 *
 * All color functions gracefully degrade to plain text when the output
 * stream is not a TTY or when `NO_COLOR` is set.
 */

import { stdout } from "node:process";

// ---------------------------------------------------------------------------
// Color support detection
// ---------------------------------------------------------------------------

let colorEnabled: boolean | undefined;

function detectColorSupport(): boolean {
  if (process.env.NO_COLOR !== undefined) return false;
  if (process.env.FORCE_COLOR !== undefined) return true;
  return stdout.isTTY === true;
}

export function supportsColor(): boolean {
  if (colorEnabled === undefined) colorEnabled = detectColorSupport();
  return colorEnabled;
}

/** Override color detection (useful for tests). */
export function setColorEnabled(value: boolean): void {
  colorEnabled = value;
}

// ---------------------------------------------------------------------------
// ANSI styling primitives
// ---------------------------------------------------------------------------

function wrap(code: string, resetCode: string, text: string): string {
  return supportsColor() ? `\u001b[${code}m${text}\u001b[${resetCode}m` : text;
}

export function bold(text: string): string { return wrap("1", "22", text); }
export function dim(text: string): string { return wrap("2", "22", text); }
export function italic(text: string): string { return wrap("3", "23", text); }
export function underline(text: string): string { return wrap("4", "24", text); }

export function red(text: string): string { return wrap("31", "39", text); }
export function green(text: string): string { return wrap("32", "39", text); }
export function yellow(text: string): string { return wrap("33", "39", text); }
export function blue(text: string): string { return wrap("34", "39", text); }
export function magenta(text: string): string { return wrap("35", "39", text); }
export function cyan(text: string): string { return wrap("36", "39", text); }
export function white(text: string): string { return wrap("37", "39", text); }
export function gray(text: string): string { return wrap("90", "39", text); }

// ---------------------------------------------------------------------------
// Semantic helpers
// ---------------------------------------------------------------------------

/** Colored status dot: ● */
export function dot(color: "green" | "red" | "yellow" | "cyan" | "gray"): string {
  const colorFn = { green, red, yellow, cyan, gray }[color];
  return colorFn("●");
}

/** Styled section header for CLI output. */
export function heading(text: string): string {
  return bold(cyan(text));
}

/** Style a label:value pair. */
export function labelValue(label: string, value: string): string {
  return `${dim(label + ":")} ${value}`;
}

/** Error message styling. */
export function errorText(text: string): string {
  return bold(red("✘")) + " " + red(text);
}

/** Success message styling. */
export function successText(text: string): string {
  return bold(green("✔")) + " " + green(text);
}

/** Warning message styling. */
export function warnText(text: string): string {
  return bold(yellow("⚠")) + " " + yellow(text);
}

// ---------------------------------------------------------------------------
// OSC 8 clickable hyperlinks
// ---------------------------------------------------------------------------

/**
 * Wrap text in an OSC 8 hyperlink so it is clickable in supporting terminals
 * (iTerm2, Windows Terminal, many modern Linux terminals).
 * Falls back to `text (url)` when not in a TTY.
 */
export function link(text: string, url: string): string {
  if (!supportsColor()) return `${text} (${url})`;
  return `\u001b]8;;${url}\u001b\\${text}\u001b]8;;\u001b\\`;
}

/**
 * Format a URL as a clickable link where the URL is the display text.
 */
export function clickableUrl(url: string): string {
  return link(url, url);
}

// ---------------------------------------------------------------------------
// Startup banner
// ---------------------------------------------------------------------------

export interface BannerOptions {
  orchestratorName: string;
  mode: string;
  resourceCount: number;
  apiUrl?: string;
  publicUrl?: string;
  uiUrl?: string;
  publicUiUrl?: string;
  displayUrl?: string;
  publicDisplayUrl?: string;
}

/**
 * Renders a styled startup banner with box-drawing characters, clickable URLs,
 * and resource status. Returns an array of styled lines.
 */
export function renderBanner(options: BannerOptions): string[] {
  const {
    orchestratorName,
    mode,
    resourceCount,
    apiUrl,
    publicUrl,
    uiUrl,
    publicUiUrl,
    displayUrl,
    publicDisplayUrl,
  } = options;

  const titleArt = bold(cyan("  ╔═╗┬─┐┬ ┬┌─┐┌┬┐┬ ┬"));
  const titleArt2 = bold(cyan("  ║  ├┬┘│ │└─┐ │ └┬┘"));
  const titleArt3 = bold(cyan("  ╚═╝┴└─└─┘└─┘ ┴  ┴ "));

  const statusDot = resourceCount > 0 ? dot("green") : dot("yellow");
  const resourceLabel = resourceCount === 1
    ? `${resourceCount} resource`
    : `${resourceCount} resources`;

  const lines: string[] = [
    "",
    titleArt,
    titleArt2,
    titleArt3,
    "",
    `  ${dim("Orchestrator")}  ${bold(white(orchestratorName))}`,
    `  ${dim("Mode")}          ${mode}`,
    `  ${dim("Resources")}     ${statusDot} ${resourceLabel}`,
  ];

  if (uiUrl) {
    lines.push("");
    lines.push(`  ${dim("Local UI")}      ${clickableUrl(uiUrl)}`);
    if (publicUiUrl && publicUiUrl !== uiUrl) {
      lines.push(`  ${dim("LAN UI")}        ${clickableUrl(publicUiUrl)}`);
    }
  }

  if (displayUrl) {
    lines.push(`  ${dim("Billboard")}     ${clickableUrl(displayUrl)}`);
    if (publicDisplayUrl && publicDisplayUrl !== displayUrl) {
      lines.push(`  ${dim("Billboard LAN")} ${clickableUrl(publicDisplayUrl)}`);
    }
  }

  if (apiUrl) {
    lines.push(`  ${dim("API")}           ${clickableUrl(apiUrl + "/api/status")}`);
    if (publicUrl && publicUrl !== apiUrl) {
      lines.push(`  ${dim("API LAN")}       ${clickableUrl(publicUrl + "/api/status")}`);
    }
  }

  lines.push("");
  lines.push(
    `  ${dim("─".repeat(46))}`
  );

  if (resourceCount <= 1) {
    lines.push(
      `  ${warnText("Single resource — run")} ${bold("node scripts/setup-agent.js")} ${warnText("on next device")}`
    );
  } else {
    lines.push(
      `  ${successText(`Ready with ${resourceLabel}`)}`
    );
  }

  lines.push(`  ${dim("Type")} ${bold("/help")} ${dim("for commands or")} ${bold("Tab")} ${dim("to autocomplete")}`);
  lines.push("");

  return lines;
}

// ---------------------------------------------------------------------------
// Styled prompt builder
// ---------------------------------------------------------------------------

export interface PromptState {
  mode: string;
  currentEndpoint: string;
  defaultEndpoint: string;
  currentAgent?: string;
  queueDepth: number;
  priority: string;
  autoBusy: boolean;
  resourceCount: number;
}

/**
 * Build a richly styled prompt string with mode color-coding and compact status.
 */
export function buildStyledPrompt(state: PromptState): string {
  if (!supportsColor()) {
    return buildPlainPrompt(state);
  }

  switch (state.mode) {
    case "chat":
      return `${dim("[")}${cyan("chat")} ${dim("@")}${white(state.currentEndpoint)}${dim("]")}${cyan("›")} `;
    case "group":
      return `${dim("[")}${magenta("group")} ${dim("@")}${white(state.currentEndpoint)}${dim("]")}${magenta("›")} `;
    case "auto": {
      const statusDot = state.autoBusy ? dot("yellow") : dot("green");
      return `${dim("[")}${yellow("auto")} ${statusDot} ${dim("q:")}${white(String(state.queueDepth))} ${dim("p:")}${state.priority}${dim("]")}${yellow("›")} `;
    }
    case "agent":
      return `${dim("[")}${blue("agent")} ${dim("@")}${white(state.currentAgent ?? "unknown")}${dim("]")}${blue("›")} `;
    default:
      return `${bold(cyan("crusty"))}${dim("›")} `;
  }
}

function buildPlainPrompt(state: PromptState): string {
  switch (state.mode) {
    case "chat":
      return `[chat @${state.currentEndpoint}]› `;
    case "group":
      return `[group @${state.currentEndpoint}]› `;
    case "auto":
      return `[auto ${state.autoBusy ? "busy" : "idle"} q:${state.queueDepth} p:${state.priority}]› `;
    case "agent":
      return `[agent @${state.currentAgent ?? "unknown"}]› `;
    default:
      return "crusty› ";
  }
}

// ---------------------------------------------------------------------------
// Compact status bar (printed above the prompt)
// ---------------------------------------------------------------------------

export interface StatusBarState {
  mode: string;
  resourceCount: number;
  queuePending: number;
  queueCompleted: number;
  autoBusy: boolean;
  autoEnabled: boolean;
  orchestratorName: string;
}

/**
 * Render a single-line status bar printed above the prompt on each interaction.
 */
export function renderStatusBar(state: StatusBarState): string {
  if (!supportsColor()) {
    return `── ${state.orchestratorName} | mode:${state.mode} | resources:${state.resourceCount} | queue:${state.queuePending}/${state.queueCompleted} ──`;
  }

  const modeBadge =
    state.mode === "auto"
      ? yellow(bold(" AUTO "))
      : state.mode === "chat"
        ? cyan(bold(" CHAT "))
        : state.mode === "group"
          ? magenta(bold(" GROUP "))
          : state.mode === "agent"
            ? blue(bold(" AGENT "))
            : dim(" CMD ");

  const autoPulse = state.autoEnabled
    ? (state.autoBusy ? ` ${dot("yellow")} busy` : ` ${dot("green")} idle`)
    : "";

  const queueInfo = state.queuePending > 0
    ? ` ${dim("queue")} ${bold(yellow(String(state.queuePending)))}${dim("/")}${green(String(state.queueCompleted))}`
    : state.queueCompleted > 0
      ? ` ${dim("queue")} ${dim("0")}${dim("/")}${green(String(state.queueCompleted))}`
      : "";

  const res = ` ${dim("res")} ${state.resourceCount > 0 ? green(String(state.resourceCount)) : red("0")}`;

  return `${dim("─")} ${dim(state.orchestratorName)}${modeBadge}${autoPulse}${res}${queueInfo} ${dim("─")}`;
}

// ---------------------------------------------------------------------------
// Command completion
// ---------------------------------------------------------------------------

/** Command definition for the completer. */
export interface CommandDef {
  name: string;
  params: string;
  description: string;
}

/**
 * Master command list with parameter hints and short descriptions.
 * The `params` string is shown as ghost-text / usage hint when the command is completed.
 */
export const COMMAND_DEFS: CommandDef[] = [
  { name: "/agent", params: "list | new | edit <name> | <name>", description: "Agent management" },
  { name: "/auto", params: "", description: "Start autonomous processing" },
  { name: "/bind", params: "[@alias] [resourceAlias]", description: "Bind participant to resource" },
  { name: "/chat", params: "", description: "Start 1-on-1 chat session" },
  { name: "/clear", params: "", description: "Clear conversation history" },
  { name: "/compact", params: "", description: "Compact conversation" },
  { name: "/daily", params: "[start | finish]", description: "Daily work session" },
  { name: "/default", params: "[alias]", description: "Get/set default participant" },
  { name: "/direct", params: '<resourceAlias> "message" [model]', description: "Direct resource query" },
  { name: "/end", params: "", description: "End current mode" },
  { name: "/exit", params: "", description: "Exit Crusty" },
  { name: "/explore", params: "", description: "Open file explorer" },
  { name: "/group", params: "", description: "Start group chat" },
  { name: "/help", params: "[topic]", description: "Show help (topics: chat, auto, resources, …)" },
  { name: "/hud", params: "", description: "Open heads-up display" },
  { name: "/instructions", params: '[@alias] ["text"]', description: "View/edit instructions" },
  { name: "/login", params: "", description: "Show API login token" },
  { name: "/model", params: "[alias] | <alias> <model>", description: "Get/set model" },
  { name: "/models", params: "[resourceAlias | @participant]", description: "List available models" },
  { name: "/nickname", params: '[@alias] ["name"]', description: "Get/set participant nickname" },
  { name: "/orchestrator", params: '["name"]', description: "Get/set orchestrator name" },
  { name: "/participant", params: "list | add | edit | remove", description: "Manage participants" },
  { name: "/preferences", params: "| set <key> <value>", description: "View/set user preferences" },
  { name: "/priority", params: "[high | medium | low]", description: "Get/set queue priority" },
  { name: "/promote", params: "<resourceAlias>", description: "Promote resource to orchestrator" },
  { name: "/rename", params: "<oldAlias> <newAlias>", description: "Rename a participant" },
  { name: "/reset", params: "", description: "Reset all state" },
  { name: "/resource", params: "list | add | edit | refresh | remove", description: "Manage resources" },
  { name: "/sound", params: "[on | off]", description: "Toggle speech audio" },
  { name: "/status", params: "", description: "Show system status" },
  { name: "/stop", params: "", description: "Stop autonomous processing" },
  { name: "/topology", params: "| assign | delegate | undelegate", description: "Network topology" },
  { name: "/voice", params: "[@alias] [preset | list]", description: "Get/set voice preset" },
];

/**
 * Build a readline-compatible completer function.
 *
 * Returns a function matching the signature `(line: string) => [string[], string]`.
 * When the user presses Tab, readline calls this to get completions.
 */
export function buildCompleter(): (line: string) => [string[], string] {
  const commandNames = COMMAND_DEFS.map((def) => def.name);

  return (line: string): [string[], string] => {
    const trimmed = line.trimStart();

    // Only complete slash commands
    if (!trimmed.startsWith("/")) {
      return [[], line];
    }

    // Find the command portion (first word)
    const spaceIndex = trimmed.indexOf(" ");
    const typedCommand = spaceIndex === -1 ? trimmed : trimmed.slice(0, spaceIndex);

    // If user hasn't finished typing the command name
    if (spaceIndex === -1) {
      const matches = commandNames.filter((name) =>
        name.startsWith(typedCommand.toLowerCase())
      );

      if (matches.length === 1) {
        // Exact single match — complete with trailing space
        return [[matches[0] + " "], typedCommand];
      }

      return [matches.length > 0 ? matches : commandNames, typedCommand];
    }

    // Command is complete — show parameter hints as completions
    const def = COMMAND_DEFS.find(
      (d) => d.name === typedCommand.toLowerCase()
    );
    if (def && def.params) {
      // Show the param hint as a "completion" so the user sees expected params
      const currentText = trimmed.slice(spaceIndex + 1);
      const hint = `${typedCommand}  ${dim("— " + def.params)}`;
      return [[hint], trimmed];
    }

    return [[], line];
  };
}

/**
 * Build a parameter hint string for display after a command is entered.
 * Returns undefined if no hint is available.
 */
export function getParamHint(commandName: string): string | undefined {
  const normalized = commandName.toLowerCase();
  const def = COMMAND_DEFS.find((d) => d.name === normalized);
  if (!def || !def.params) return undefined;
  return dim(def.params);
}

// ---------------------------------------------------------------------------
// Status line formatting
// ---------------------------------------------------------------------------

export function formatResourceStatus(
  alias: string,
  tier: string,
  role: string | undefined,
  connected: boolean
): string {
  const statusDot = connected ? dot("green") : dot("red");
  const tierBadge =
    tier === "top" ? bold(green(tier))
      : tier === "mid" ? yellow(tier)
        : dim(tier);
  const roleSuffix = role && role !== "agent"
    ? ` ${dim("(")}${cyan(role)}${dim(")")}`
    : "";
  return `  ${statusDot} ${bold(white("@" + alias))} ${tierBadge}${roleSuffix}`;
}

/**
 * Format a live status line suitable for agent devices.
 * Shows current task, resource alias, and connection status.
 */
export function formatAgentStatusLine(
  alias: string,
  orchestratorName: string,
  status: "idle" | "busy" | "offline"
): string {
  const statusBadge =
    status === "busy" ? `${dot("yellow")} ${yellow("processing")}`
      : status === "idle" ? `${dot("green")} ${green("idle")}`
        : `${dot("red")} ${red("offline")}`;
  return `${dim("─")} ${bold(white("@" + alias))} ${dim("→")} ${dim(orchestratorName)} ${statusBadge} ${dim("─")}`;
}
