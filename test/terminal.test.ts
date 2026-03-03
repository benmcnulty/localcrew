import { describe, expect, test, beforeEach, afterEach } from "bun:test";

import {
  bold,
  buildCompleter,
  buildStyledPrompt,
  clickableUrl,
  cyan,
  dim,
  dot,
  errorText,
  formatAgentStatusLine,
  formatResourceStatus,
  green,
  heading,
  labelValue,
  link,
  magenta,
  red,
  renderBanner,
  renderStatusBar,
  setColorEnabled,
  successText,
  supportsColor,
  warnText,
  yellow,
  COMMAND_DEFS,
  getParamHint,
} from "../src/terminal.ts";

describe("color support", () => {
  test("setColorEnabled overrides detection", () => {
    setColorEnabled(false);
    expect(supportsColor()).toBe(false);
    setColorEnabled(true);
    expect(supportsColor()).toBe(true);
  });
});

describe("ANSI color functions (colors enabled)", () => {
  beforeEach(() => setColorEnabled(true));
  afterEach(() => setColorEnabled(true));

  test("bold wraps text with bold codes", () => {
    expect(bold("hello")).toBe("\u001b[1mhello\u001b[22m");
  });

  test("dim wraps text", () => {
    expect(dim("hello")).toBe("\u001b[2mhello\u001b[22m");
  });

  test("red wraps text with red codes", () => {
    expect(red("err")).toBe("\u001b[31merr\u001b[39m");
  });

  test("green wraps text", () => {
    expect(green("ok")).toBe("\u001b[32mok\u001b[39m");
  });

  test("cyan wraps text", () => {
    expect(cyan("info")).toBe("\u001b[36minfo\u001b[39m");
  });

  test("yellow wraps text", () => {
    expect(yellow("warn")).toBe("\u001b[33mwarn\u001b[39m");
  });

  test("magenta wraps text", () => {
    expect(magenta("thing")).toBe("\u001b[35mthing\u001b[39m");
  });
});

describe("ANSI color functions (colors disabled)", () => {
  beforeEach(() => setColorEnabled(false));
  afterEach(() => setColorEnabled(true));

  test("bold returns plain text", () => {
    expect(bold("hello")).toBe("hello");
  });

  test("red returns plain text", () => {
    expect(red("err")).toBe("err");
  });
});

describe("semantic helpers", () => {
  beforeEach(() => setColorEnabled(true));
  afterEach(() => setColorEnabled(true));

  test("dot returns colored bullet", () => {
    expect(dot("green")).toContain("●");
    expect(dot("red")).toContain("●");
  });

  test("heading returns bold cyan text", () => {
    const result = heading("Title");
    expect(result).toContain("Title");
    // Should have both bold and cyan codes
    expect(result).toContain("\u001b[1m");
    expect(result).toContain("\u001b[36m");
  });

  test("labelValue formats label:value pair", () => {
    const result = labelValue("Mode", "auto");
    expect(result).toContain("Mode:");
    expect(result).toContain("auto");
  });

  test("errorText includes cross mark", () => {
    const result = errorText("failed");
    expect(result).toContain("✘");
    expect(result).toContain("failed");
  });

  test("successText includes check mark", () => {
    const result = successText("done");
    expect(result).toContain("✔");
    expect(result).toContain("done");
  });

  test("warnText includes warning sign", () => {
    const result = warnText("caution");
    expect(result).toContain("⚠");
    expect(result).toContain("caution");
  });
});

describe("link and clickableUrl", () => {
  test("link uses OSC 8 when color enabled", () => {
    setColorEnabled(true);
    const result = link("Click here", "http://example.com");
    expect(result).toContain("\u001b]8;;http://example.com\u001b\\");
    expect(result).toContain("Click here");
  });

  test("link falls back to text (url) when color disabled", () => {
    setColorEnabled(false);
    const result = link("Click here", "http://example.com");
    expect(result).toBe("Click here (http://example.com)");
  });

  test("clickableUrl uses URL as display text", () => {
    setColorEnabled(true);
    const result = clickableUrl("http://localhost:4310/ui");
    expect(result).toContain("http://localhost:4310/ui");
  });
});

describe("renderBanner", () => {
  beforeEach(() => setColorEnabled(true));
  afterEach(() => setColorEnabled(true));

  test("includes orchestrator name and resource count", () => {
    const lines = renderBanner({
      orchestratorName: "TestBot",
      mode: "command",
      resourceCount: 3,
      apiUrl: "http://localhost:4310",
      uiUrl: "http://localhost:4310/ui",
    });
    const text = lines.join("\n");
    expect(text).toContain("TestBot");
    expect(text).toContain("3 resources");
  });

  test("includes clickable UI URL", () => {
    const lines = renderBanner({
      orchestratorName: "Bot",
      mode: "command",
      resourceCount: 1,
      uiUrl: "http://localhost:4310/ui",
    });
    const text = lines.join("\n");
    expect(text).toContain("http://localhost:4310/ui");
  });

  test("shows onboarding warning when only 1 resource", () => {
    const lines = renderBanner({
      orchestratorName: "Bot",
      mode: "command",
      resourceCount: 1,
    });
    const text = lines.join("\n");
    expect(text).toContain("setup-agent.js");
  });

  test("shows ready message when multiple resources", () => {
    const lines = renderBanner({
      orchestratorName: "Bot",
      mode: "command",
      resourceCount: 4,
    });
    const text = lines.join("\n");
    expect(text).toContain("Ready");
  });

  test("includes help tip", () => {
    const lines = renderBanner({
      orchestratorName: "Bot",
      mode: "command",
      resourceCount: 2,
    });
    const text = lines.join("\n");
    expect(text).toContain("/help");
    expect(text).toContain("Tab");
  });
});

describe("buildStyledPrompt", () => {
  beforeEach(() => setColorEnabled(true));
  afterEach(() => setColorEnabled(true));

  test("command mode prompt contains crew", () => {
    const result = buildStyledPrompt({
      mode: "command",
      currentEndpoint: "erin",
      defaultEndpoint: "erin",
      queueDepth: 0,
      priority: "medium",
      autoBusy: false,
      resourceCount: 2,
    });
    expect(result).toContain("crew");
    expect(result).toContain("›");
  });

  test("chat mode prompt contains chat and endpoint", () => {
    const result = buildStyledPrompt({
      mode: "chat",
      currentEndpoint: "erin",
      defaultEndpoint: "erin",
      queueDepth: 0,
      priority: "medium",
      autoBusy: false,
      resourceCount: 2,
    });
    expect(result).toContain("chat");
    expect(result).toContain("erin");
  });

  test("auto mode prompt contains queue depth", () => {
    const result = buildStyledPrompt({
      mode: "auto",
      currentEndpoint: "erin",
      defaultEndpoint: "erin",
      queueDepth: 5,
      priority: "high",
      autoBusy: true,
      resourceCount: 3,
    });
    expect(result).toContain("auto");
    expect(result).toContain("5");
  });

  test("agent mode prompt contains agent name", () => {
    const result = buildStyledPrompt({
      mode: "agent",
      currentEndpoint: "erin",
      defaultEndpoint: "erin",
      currentAgent: "data-analyst",
      queueDepth: 0,
      priority: "medium",
      autoBusy: false,
      resourceCount: 1,
    });
    expect(result).toContain("agent");
    expect(result).toContain("data-analyst");
  });

  test("plain text prompt when colors disabled", () => {
    setColorEnabled(false);
    const result = buildStyledPrompt({
      mode: "command",
      currentEndpoint: "erin",
      defaultEndpoint: "erin",
      queueDepth: 0,
      priority: "medium",
      autoBusy: false,
      resourceCount: 2,
    });
    expect(result).toBe("crew› ");
    expect(result).not.toContain("\u001b");
  });
});

describe("renderStatusBar", () => {
  beforeEach(() => setColorEnabled(true));
  afterEach(() => setColorEnabled(true));

  test("contains orchestrator name and mode", () => {
    const result = renderStatusBar({
      mode: "command",
      resourceCount: 2,
      queuePending: 0,
      queueCompleted: 0,
      autoBusy: false,
      autoEnabled: false,
      orchestratorName: "TestBot",
    });
    expect(result).toContain("TestBot");
    expect(result).toContain("CMD");
  });

  test("shows AUTO badge in auto mode", () => {
    const result = renderStatusBar({
      mode: "auto",
      resourceCount: 3,
      queuePending: 5,
      queueCompleted: 10,
      autoBusy: false,
      autoEnabled: true,
      orchestratorName: "Bot",
    });
    expect(result).toContain("AUTO");
    expect(result).toContain("idle");
  });

  test("shows busy indicator when autoBusy", () => {
    const result = renderStatusBar({
      mode: "auto",
      resourceCount: 3,
      queuePending: 5,
      queueCompleted: 10,
      autoBusy: true,
      autoEnabled: true,
      orchestratorName: "Bot",
    });
    expect(result).toContain("busy");
  });

  test("plain text when colors disabled", () => {
    setColorEnabled(false);
    const result = renderStatusBar({
      mode: "command",
      resourceCount: 2,
      queuePending: 3,
      queueCompleted: 7,
      autoBusy: false,
      autoEnabled: false,
      orchestratorName: "Bot",
    });
    expect(result).toBe("── Bot | mode:command | resources:2 | queue:3/7 ──");
    expect(result).not.toContain("\u001b");
  });
});

describe("buildCompleter", () => {
  const completer = buildCompleter();

  test("returns all commands for bare /", () => {
    const [completions, prefix] = completer("/");
    expect(completions.length).toBeGreaterThan(10);
    expect(prefix).toBe("/");
  });

  test("filters commands by partial input", () => {
    const [completions, prefix] = completer("/re");
    expect(completions).toContain("/rename");
    expect(completions).toContain("/reset");
    expect(completions).toContain("/resource");
    expect(prefix).toBe("/re");
  });

  test("single match appends trailing space", () => {
    const [completions, prefix] = completer("/hel");
    expect(completions).toEqual(["/help "]);
    expect(prefix).toBe("/hel");
  });

  test("returns nothing for non-slash input", () => {
    const [completions] = completer("hello");
    expect(completions.length).toBe(0);
  });

  test("shows param hint after completed command", () => {
    const [completions, prefix] = completer("/preferences ");
    expect(completions.length).toBe(1);
    expect(completions[0]).toContain("/preferences");
    expect(prefix).toBe("/preferences ");
  });

  test("multiple partial matches returns all candidates", () => {
    const [completions, prefix] = completer("/s");
    expect(completions).toContain("/sound");
    expect(completions).toContain("/status");
    expect(completions).toContain("/stop");
    expect(prefix).toBe("/s");
  });
});

describe("COMMAND_DEFS", () => {
  test("all commands start with /", () => {
    for (const def of COMMAND_DEFS) {
      expect(def.name.startsWith("/")).toBe(true);
    }
  });

  test("all commands have a description", () => {
    for (const def of COMMAND_DEFS) {
      expect(def.description.length).toBeGreaterThan(0);
    }
  });

  test("commands are sorted alphabetically", () => {
    const names = COMMAND_DEFS.map((d) => d.name);
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });
});

describe("getParamHint", () => {
  beforeEach(() => setColorEnabled(true));
  afterEach(() => setColorEnabled(true));

  test("returns hint for known command", () => {
    const hint = getParamHint("/preferences");
    expect(hint).toBeDefined();
    expect(hint).toContain("set");
  });

  test("returns undefined for unknown command", () => {
    expect(getParamHint("/nonexistent")).toBeUndefined();
  });

  test("returns undefined for commands with no params", () => {
    expect(getParamHint("/auto")).toBeUndefined();
  });
});

describe("formatResourceStatus", () => {
  beforeEach(() => setColorEnabled(true));
  afterEach(() => setColorEnabled(true));

  test("shows green dot for connected resource", () => {
    const result = formatResourceStatus("workhorse", "top", "agent", true);
    expect(result).toContain("@workhorse");
    expect(result).toContain("top");
  });

  test("shows red dot for disconnected resource", () => {
    const result = formatResourceStatus("helper", "low", undefined, false);
    expect(result).toContain("@helper");
  });

  test("shows role suffix for orchestrators", () => {
    const result = formatResourceStatus("main", "top", "primary-orchestrator", true);
    expect(result).toContain("primary-orchestrator");
  });

  test("omits role suffix for agents", () => {
    const result = formatResourceStatus("worker", "mid", "agent", true);
    expect(result).not.toContain("(agent)");
  });
});

describe("formatAgentStatusLine", () => {
  beforeEach(() => setColorEnabled(true));
  afterEach(() => setColorEnabled(true));

  test("shows idle status", () => {
    const result = formatAgentStatusLine("helper", "Captain", "idle");
    expect(result).toContain("@helper");
    expect(result).toContain("Captain");
    expect(result).toContain("idle");
  });

  test("shows busy status", () => {
    const result = formatAgentStatusLine("worker", "Captain", "busy");
    expect(result).toContain("processing");
  });

  test("shows offline status", () => {
    const result = formatAgentStatusLine("node", "Captain", "offline");
    expect(result).toContain("offline");
  });
});
