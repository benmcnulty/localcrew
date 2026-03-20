/**
 * Code Agent — premium coding agent delegation via subprocess.
 *
 * Provides provider detection, configuration presets, and execution for
 * external CLI coding agents (Claude Code, Codex CLI, etc.).
 *
 * All authorization gating (isToolAuthorized, containment checks) is handled
 * by the caller in app.ts. This module only handles detection and execution.
 */

import { spawn } from "node:child_process";
import type { CodeAgentProvider } from "./types.ts";

export type { CodeAgentProvider };

/** Configuration for a coding agent provider. */
export interface CodeAgentConfig {
  provider: CodeAgentProvider;
  /** CLI binary name or path */
  command: string;
  /** Env var name for API key auth (e.g. "ANTHROPIC_API_KEY"). Optional if CLI handles auth. */
  apiKeyEnv?: string;
  /** Default CLI flags to pass on every invocation */
  defaultArgs?: string[];
  /** Per-invocation timeout in ms (default: 300_000 = 5 min) */
  timeoutMs?: number;
  /** Default working directory for code tasks */
  workingDir?: string;
}

/** Provider presets with sensible defaults. */
export const CODE_AGENT_PRESETS: Record<Exclude<CodeAgentProvider, "custom">, Omit<CodeAgentConfig, "apiKeyEnv">> = {
  "claude-code": {
    provider: "claude-code",
    command: "claude",
    defaultArgs: ["-p", "--output-format", "json"],
    timeoutMs: 300_000,
  },
  "codex": {
    provider: "codex",
    command: "codex",
    defaultArgs: ["-q", "--approval-mode", "full-auto"],
    timeoutMs: 300_000,
  },
  "copilot": {
    provider: "copilot",
    command: "gh",
    defaultArgs: ["copilot", "suggest", "-t", "shell"],
    timeoutMs: 60_000,
  },
};

/** Maximum output buffer for coding agents (256 KB — agents produce verbose output). */
const MAX_OUTPUT_BYTES = 262_144;

export interface CodeAgentResult {
  success: boolean;
  output: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
  provider: CodeAgentProvider;
}

/**
 * Check which coding agent CLIs are installed by running `which <command>`.
 * Deterministic — no inference.
 */
export async function detectInstalledCodeAgents(): Promise<CodeAgentProvider[]> {
  const checks: Array<[CodeAgentProvider, string]> = [
    ["claude-code", "claude"],
    ["codex", "codex"],
    ["copilot", "gh"],
  ];

  const results = await Promise.all(
    checks.map(([provider, command]) =>
      isCommandAvailable(command).then((found) => (found ? provider : null))
    )
  );

  return results.filter((p): p is CodeAgentProvider => p !== null);
}

function isCommandAvailable(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const which = process.platform === "win32" ? "where" : "which";
    // Use `as any` for Bun type compatibility — Bun's child_process spawn types
    // lack env/cwd/stdout/stderr/kill on the return type.
    const child = spawn(which, [command], {
      stdio: "ignore",
      env: { PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin" },
    } as any) as any;

    child.on("exit", (code: number | null) => resolve(code === 0));
    child.on("error", () => resolve(false));
  });
}

/**
 * Execute a coding agent CLI as a subprocess with the given prompt.
 * The prompt is passed as the final positional argument.
 */
export async function executeCodeAgent(
  config: CodeAgentConfig,
  prompt: string,
  workingDir?: string
): Promise<CodeAgentResult> {
  const timeoutMs = config.timeoutMs ?? 300_000;
  const cwd = workingDir ?? config.workingDir ?? process.cwd();
  const args = [...(config.defaultArgs ?? []), prompt];

  // Build env: full PATH and HOME (agents need access to git, runtimes, etc.)
  // plus the configured API key env var if specified.
  const env: Record<string, string> = {};
  if (process.env.PATH) env.PATH = process.env.PATH;
  if (process.env.HOME) env.HOME = process.env.HOME;
  if (process.env.LANG) env.LANG = process.env.LANG;
  if (config.apiKeyEnv && process.env[config.apiKeyEnv]) {
    env[config.apiKeyEnv] = process.env[config.apiKeyEnv]!;
  }

  return new Promise((resolve) => {
    const startTime = Date.now();
    let outputBuf = "";
    let stderrBuf = "";
    let timedOut = false;

    // Use `as any` for Bun type compatibility — Bun's child_process spawn types
    // lack env/cwd/stdout/stderr/kill on the return type.
    const child = spawn(config.command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env,
    } as any) as any;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs + 1000);

    child.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      if (outputBuf.length + text.length <= MAX_OUTPUT_BYTES) {
        outputBuf += text;
      } else if (outputBuf.length < MAX_OUTPUT_BYTES) {
        outputBuf += text.slice(0, MAX_OUTPUT_BYTES - outputBuf.length);
      }
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      if (stderrBuf.length + text.length <= MAX_OUTPUT_BYTES) {
        stderrBuf += text;
      }
    });

    child.on("exit", (code: number | null) => {
      clearTimeout(timer);
      resolve({
        success: code === 0 && !timedOut,
        output: outputBuf,
        stderr: stderrBuf,
        exitCode: code,
        timedOut,
        durationMs: Date.now() - startTime,
        provider: config.provider,
      });
    });

    child.on("error", (err: Error) => {
      clearTimeout(timer);
      resolve({
        success: false,
        output: outputBuf,
        stderr: `Process error: ${err.message}`,
        exitCode: null,
        timedOut: false,
        durationMs: Date.now() - startTime,
        provider: config.provider,
      });
    });
  });
}
