import { describe, expect, test } from "bun:test";

import {
  CODE_AGENT_PRESETS,
  detectInstalledCodeAgents,
  executeCodeAgent,
  type CodeAgentConfig,
} from "../src/code-agent.ts";

describe("CODE_AGENT_PRESETS", () => {
  test("claude-code preset has correct command", () => {
    expect(CODE_AGENT_PRESETS["claude-code"].command).toBe("claude");
  });

  test("codex preset has correct command", () => {
    expect(CODE_AGENT_PRESETS.codex.command).toBe("codex");
  });

  test("copilot preset has correct command", () => {
    expect(CODE_AGENT_PRESETS.copilot.command).toBe("gh");
  });

  test("all presets have timeoutMs", () => {
    for (const preset of Object.values(CODE_AGENT_PRESETS)) {
      expect(typeof preset.timeoutMs).toBe("number");
      expect(preset.timeoutMs).toBeGreaterThan(0);
    }
  });

  test("claude-code has -p and --output-format json flags", () => {
    expect(CODE_AGENT_PRESETS["claude-code"].defaultArgs).toContain("-p");
    expect(CODE_AGENT_PRESETS["claude-code"].defaultArgs).toContain("--output-format");
  });
});

describe("detectInstalledCodeAgents", () => {
  test("returns an array", async () => {
    const result = await detectInstalledCodeAgents();
    expect(Array.isArray(result)).toBe(true);
  });

  test("only returns known provider names", async () => {
    const knownProviders = ["claude-code", "codex", "copilot"];
    const result = await detectInstalledCodeAgents();
    for (const provider of result) {
      expect(knownProviders).toContain(provider);
    }
  });
});

describe("executeCodeAgent", () => {
  test("returns success=true for echo command", async () => {
    const config: CodeAgentConfig = {
      provider: "custom",
      command: "echo",
      defaultArgs: [],
      timeoutMs: 5000,
    };
    const result = await executeCodeAgent(config, "hello world");
    expect(result.success).toBe(true);
    expect(result.output).toContain("hello world");
    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);
    expect(result.provider).toBe("custom");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  test("returns success=false for non-existent command", async () => {
    const config: CodeAgentConfig = {
      provider: "custom",
      command: "this-command-does-not-exist-xyz",
      defaultArgs: [],
      timeoutMs: 5000,
    };
    const result = await executeCodeAgent(config, "task");
    expect(result.success).toBe(false);
    expect(result.provider).toBe("custom");
  });

  test("returns success=false for non-zero exit", async () => {
    const config: CodeAgentConfig = {
      provider: "custom",
      command: "false",
      defaultArgs: [],
      timeoutMs: 5000,
    };
    const result = await executeCodeAgent(config, "");
    expect(result.success).toBe(false);
    expect(result.exitCode).not.toBe(0);
  });

  test("captures stderr output", async () => {
    const config: CodeAgentConfig = {
      provider: "custom",
      command: "sh",
      defaultArgs: ["-c", "echo error >&2; exit 1;"],
      timeoutMs: 5000,
    };
    const result = await executeCodeAgent(config, "");
    expect(result.stderr).toContain("error");
  });

  test("times out and sets timedOut=true", async () => {
    const config: CodeAgentConfig = {
      provider: "custom",
      command: "sleep",
      defaultArgs: [],
      timeoutMs: 100,
    };
    const result = await executeCodeAgent(config, "10");
    expect(result.timedOut).toBe(true);
    expect(result.success).toBe(false);
  });
});
