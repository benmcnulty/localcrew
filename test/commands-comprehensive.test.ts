import { describe, expect, test } from "bun:test";

import {
  CommandParseError,
  extractAddressedMessage,
  parseCommand,
  parseDirectedMessage,
  tokenizeInput,
} from "../src/commands.ts";

// ---------------------------------------------------------------------------
// Previously untested simple-command parsing
// ---------------------------------------------------------------------------

describe("parseCommand — simple mode commands", () => {
  test("parses /chat as chatMode", () => {
    expect(parseCommand("/chat")).toEqual({ type: "chatMode" });
  });

  test("parses /group as groupMode", () => {
    expect(parseCommand("/group")).toEqual({ type: "groupMode" });
  });

  test("parses /end as endMode", () => {
    expect(parseCommand("/end")).toEqual({ type: "endMode" });
  });

  test("parses /exit as exit", () => {
    expect(parseCommand("/exit")).toEqual({ type: "exit" });
  });

  test("parses /compact as compact", () => {
    expect(parseCommand("/compact")).toEqual({ type: "compact" });
  });

  test("parses /reset as reset", () => {
    expect(parseCommand("/reset")).toEqual({ type: "reset" });
  });
});

// ---------------------------------------------------------------------------
// Extra-argument error paths for simple commands
// ---------------------------------------------------------------------------

describe("parseCommand — simple commands reject extra args", () => {
  test("/chat rejects extra args", () => {
    expect(() => parseCommand("/chat foo")).toThrow(CommandParseError);
  });

  test("/group rejects extra args", () => {
    expect(() => parseCommand("/group foo")).toThrow(CommandParseError);
  });

  test("/end rejects extra args", () => {
    expect(() => parseCommand("/end now")).toThrow(CommandParseError);
  });

  test("/exit rejects extra args", () => {
    expect(() => parseCommand("/exit now")).toThrow(CommandParseError);
  });

  test("/compact rejects extra args", () => {
    expect(() => parseCommand("/compact all")).toThrow(CommandParseError);
  });

  test("/reset rejects extra args", () => {
    expect(() => parseCommand("/reset hard")).toThrow(CommandParseError);
  });

  test("/clear rejects extra args", () => {
    expect(() => parseCommand("/clear everything")).toThrow(CommandParseError);
  });

  test("/status rejects extra args", () => {
    expect(() => parseCommand("/status verbose")).toThrow(CommandParseError);
  });

  test("/hud rejects extra args", () => {
    expect(() => parseCommand("/hud big")).toThrow(CommandParseError);
  });

  test("/explore rejects extra args", () => {
    expect(() => parseCommand("/explore deep")).toThrow(CommandParseError);
  });

  test("/login rejects extra args", () => {
    expect(() => parseCommand("/login admin")).toThrow(CommandParseError);
  });

  test("/auto rejects extra args", () => {
    expect(() => parseCommand("/auto now")).toThrow(CommandParseError);
  });

  test("/stop rejects extra args", () => {
    expect(() => parseCommand("/stop now")).toThrow(CommandParseError);
  });
});

// ---------------------------------------------------------------------------
// Empty input
// ---------------------------------------------------------------------------

describe("parseCommand — empty input", () => {
  test("throws on empty string", () => {
    expect(() => parseCommand("")).toThrow(CommandParseError);
  });

  test("throws on whitespace-only string", () => {
    expect(() => parseCommand("   ")).toThrow(CommandParseError);
  });
});

// ---------------------------------------------------------------------------
// /model — untested variants
// ---------------------------------------------------------------------------

describe("parseCommand — /model untested variants", () => {
  test("bare /model returns model.get", () => {
    expect(parseCommand("/model")).toEqual({ type: "model.get" });
  });

  test("/model with one arg returns model.set", () => {
    expect(parseCommand("/model erin")).toEqual({
      type: "model.set",
      alias: "erin",
    });
  });

  test("/model normalizes alias", () => {
    expect(parseCommand("/model @Erin")).toEqual({
      type: "model.set",
      alias: "erin",
    });
  });

  test("/model assign with multi-word model name", () => {
    expect(parseCommand("/model erin some-model:latest")).toEqual({
      type: "model.assign",
      alias: "erin",
      model: "some-model:latest",
    });
  });

  test("/model with invalid purpose name falls through to assign", () => {
    // e.g. /model zora debugging model → becomes model.assign since "debugging" is not a known purpose
    expect(parseCommand("/model zora debugging model")).toEqual({
      type: "model.assign",
      alias: "zora",
      model: "debugging model",
    });
  });
});

// ---------------------------------------------------------------------------
// /default — fully untested
// ---------------------------------------------------------------------------

describe("parseCommand — /default", () => {
  test("bare /default returns default.get", () => {
    expect(parseCommand("/default")).toEqual({ type: "default.get" });
  });

  test("/default with alias returns default.set", () => {
    expect(parseCommand("/default erin")).toEqual({
      type: "default.set",
      alias: "erin",
    });
  });

  test("/default normalizes alias", () => {
    expect(parseCommand("/default @Erin")).toEqual({
      type: "default.set",
      alias: "erin",
    });
  });

  test("/default with extra args throws", () => {
    expect(() => parseCommand("/default erin zora")).toThrow(CommandParseError);
  });
});

// ---------------------------------------------------------------------------
// /nickname — untested variants
// ---------------------------------------------------------------------------

describe("parseCommand — /nickname untested variants", () => {
  test("bare /nickname returns nickname.get", () => {
    expect(parseCommand("/nickname")).toEqual({ type: "nickname.get" });
  });

  test("/nickname @alias returns nickname.get with alias", () => {
    expect(parseCommand("/nickname @erin")).toEqual({
      type: "nickname.get",
      alias: "erin",
    });
  });

  test("/nickname with quoted name (no alias) returns nickname.set", () => {
    expect(parseCommand('/nickname "New Name"')).toEqual({
      type: "nickname.set",
      nickname: "New Name",
    });
  });

  test("/nickname normalizes alias", () => {
    expect(parseCommand("/nickname @ERIN")).toEqual({
      type: "nickname.get",
      alias: "erin",
    });
  });

  test("/nickname with 3+ args throws", () => {
    expect(() => parseCommand("/nickname @erin too many args")).toThrow(
      CommandParseError
    );
  });
});

// ---------------------------------------------------------------------------
// /bind — untested variants
// ---------------------------------------------------------------------------

describe("parseCommand — /bind untested variants", () => {
  test("bare /bind returns bind.get", () => {
    expect(parseCommand("/bind")).toEqual({ type: "bind.get" });
  });

  test("/bind @alias returns bind.get with alias", () => {
    expect(parseCommand("/bind @erin")).toEqual({
      type: "bind.get",
      alias: "erin",
    });
  });

  test("/bind resource (non-alias) returns bind.set without alias", () => {
    expect(parseCommand("/bind workhorse")).toEqual({
      type: "bind.set",
      resourceAlias: "workhorse",
    });
  });

  test("/bind normalizes alias", () => {
    expect(parseCommand("/bind @ERIN")).toEqual({
      type: "bind.get",
      alias: "erin",
    });
  });

  test("/bind with 3+ args throws", () => {
    expect(() => parseCommand("/bind @erin res extra")).toThrow(
      CommandParseError
    );
  });
});

// ---------------------------------------------------------------------------
// /orchestrator — untested variant
// ---------------------------------------------------------------------------

describe("parseCommand — /orchestrator untested variants", () => {
  test("bare /orchestrator returns orchestrator.get", () => {
    expect(parseCommand("/orchestrator")).toEqual({ type: "orchestrator.get" });
  });

  test("/orchestrator with multi-word name joins tokens", () => {
    expect(parseCommand("/orchestrator Maestro Prime")).toEqual({
      type: "orchestrator.set",
      name: "Maestro Prime",
    });
  });
});

// ---------------------------------------------------------------------------
// /sound — untested variants
// ---------------------------------------------------------------------------

describe("parseCommand — /sound untested variants", () => {
  test("bare /sound returns sound.toggle", () => {
    expect(parseCommand("/sound")).toEqual({ type: "sound.toggle" });
  });

  test("/sound on returns sound.set enabled=true", () => {
    expect(parseCommand("/sound on")).toEqual({
      type: "sound.set",
      enabled: true,
    });
  });

  test("/sound off returns sound.set enabled=false", () => {
    expect(parseCommand("/sound off")).toEqual({
      type: "sound.set",
      enabled: false,
    });
  });

  test("/sound invalid value throws", () => {
    expect(() => parseCommand("/sound maybe")).toThrow(CommandParseError);
  });

  test("/sound extra args throws", () => {
    expect(() => parseCommand("/sound on please")).toThrow(CommandParseError);
  });
});

// ---------------------------------------------------------------------------
// /voice — untested variants
// ---------------------------------------------------------------------------

describe("parseCommand — /voice untested variants", () => {
  test("bare /voice returns voice.get", () => {
    expect(parseCommand("/voice")).toEqual({ type: "voice.get" });
  });

  test("/voice list returns voice.list", () => {
    expect(parseCommand("/voice list")).toEqual({ type: "voice.list" });
  });

  test("/voice @alias returns voice.get with alias", () => {
    expect(parseCommand("/voice @erin")).toEqual({
      type: "voice.get",
      alias: "erin",
    });
  });

  test("/voice preset (non-alias) returns voice.set", () => {
    expect(parseCommand("/voice samantha")).toEqual({
      type: "voice.set",
      preset: "samantha",
    });
  });

  test("/voice @alias preset returns voice.set with alias", () => {
    expect(parseCommand("/voice @erin samantha")).toEqual({
      type: "voice.set",
      alias: "erin",
      preset: "samantha",
    });
  });

  test("/voice @alias normalizes alias", () => {
    expect(parseCommand("/voice @ERIN")).toEqual({
      type: "voice.get",
      alias: "erin",
    });
  });

  test("/voice with 3+ args throws", () => {
    expect(() => parseCommand("/voice @erin preset extra")).toThrow(
      CommandParseError
    );
  });
});

// ---------------------------------------------------------------------------
// /instructions — untested variants
// ---------------------------------------------------------------------------

describe("parseCommand — /instructions untested variants", () => {
  test("bare /instructions returns instructions.edit", () => {
    expect(parseCommand("/instructions")).toEqual({ type: "instructions.edit" });
  });

  test("/instructions @alias returns instructions.edit with alias", () => {
    expect(parseCommand("/instructions @erin")).toEqual({
      type: "instructions.edit",
      alias: "erin",
    });
  });

  test("/instructions with quoted text (no alias) returns instructions.set", () => {
    expect(parseCommand('/instructions "Reply clearly."')).toEqual({
      type: "instructions.set",
      text: "Reply clearly.",
    });
  });

  test("/instructions @alias with text returns instructions.set", () => {
    expect(parseCommand('/instructions @erin "Be concise."')).toEqual({
      type: "instructions.set",
      alias: "erin",
      text: "Be concise.",
    });
  });

  test("/instructions normalizes alias", () => {
    expect(parseCommand("/instructions @ERIN")).toEqual({
      type: "instructions.edit",
      alias: "erin",
    });
  });

  test("/instructions non-alias multi-word text throws", () => {
    // non-alias first token followed by more tokens → throws
    expect(() =>
      parseCommand("/instructions Reply clearly and concisely")
    ).toThrow(CommandParseError);
  });
});

// ---------------------------------------------------------------------------
// /priority — untested variants
// ---------------------------------------------------------------------------

describe("parseCommand — /priority untested variants", () => {
  test("bare /priority returns priority.get", () => {
    expect(parseCommand("/priority")).toEqual({ type: "priority.get" });
  });

  test("/priority high returns priority.set", () => {
    expect(parseCommand("/priority high")).toEqual({
      type: "priority.set",
      priority: "high",
    });
  });

  test("/priority low returns priority.set", () => {
    expect(parseCommand("/priority low")).toEqual({
      type: "priority.set",
      priority: "low",
    });
  });

  test("/priority is case-insensitive", () => {
    expect(parseCommand("/priority HIGH")).toEqual({
      type: "priority.set",
      priority: "high",
    });
  });

  test("/priority invalid value throws", () => {
    expect(() => parseCommand("/priority urgent")).toThrow(CommandParseError);
  });

  test("/priority extra args throw", () => {
    expect(() => parseCommand("/priority high now")).toThrow(CommandParseError);
  });
});

// ---------------------------------------------------------------------------
// /rename — error paths
// ---------------------------------------------------------------------------

describe("parseCommand — /rename error paths", () => {
  test("/rename with 1 arg throws", () => {
    expect(() => parseCommand("/rename erin")).toThrow(CommandParseError);
  });

  test("/rename with 3+ args throws", () => {
    expect(() => parseCommand("/rename a b c")).toThrow(CommandParseError);
  });

  test("/rename bare throws", () => {
    expect(() => parseCommand("/rename")).toThrow(CommandParseError);
  });
});

// ---------------------------------------------------------------------------
// /direct — error paths
// ---------------------------------------------------------------------------

describe("parseCommand — /direct error paths", () => {
  test("/direct with 1 arg throws", () => {
    expect(() => parseCommand("/direct workhorse")).toThrow(CommandParseError);
  });

  test("/direct bare throws", () => {
    expect(() => parseCommand("/direct")).toThrow(CommandParseError);
  });

  test("/direct without model is valid", () => {
    expect(parseCommand('/direct workhorse "Hello"')).toEqual({
      type: "directChat",
      resourceAlias: "workhorse",
      text: "Hello",
    });
  });
});

// ---------------------------------------------------------------------------
// /resource — error paths
// ---------------------------------------------------------------------------

describe("parseCommand — /resource error paths", () => {
  test("/resource bare throws", () => {
    expect(() => parseCommand("/resource")).toThrow(CommandParseError);
  });

  test("/resource add with only 2 args throws", () => {
    expect(() => parseCommand("/resource add alias")).toThrow(
      CommandParseError
    );
  });

  test("/resource add with only 3 args throws", () => {
    expect(() => parseCommand('/resource add alias "Label"')).toThrow(
      CommandParseError
    );
  });

  test("/resource add with invalid 5th arg (not tier or apiStyle) throws", () => {
    expect(() =>
      parseCommand('/resource add alias "Label" http://localhost:11434 nope')
    ).toThrow(CommandParseError);
  });

  test("/resource add with invalid 6th arg (not apiStyle) throws", () => {
    expect(() =>
      parseCommand(
        '/resource add alias "Label" http://localhost:11434 top nope'
      )
    ).toThrow(CommandParseError);
  });

  test("/resource unknown subcommand throws", () => {
    expect(() => parseCommand("/resource upgrade workhorse")).toThrow(
      CommandParseError
    );
  });

  test("/resource add with tier+apiStyle both works", () => {
    expect(
      parseCommand(
        '/resource add alias "Label" http://localhost:1234 top openai'
      )
    ).toEqual({
      type: "resource.add",
      alias: "alias",
      label: "Label",
      baseUrl: "http://localhost:1234",
      tier: "top",
      apiStyle: "openai",
    });
  });
});

// ---------------------------------------------------------------------------
// /participant — error paths
// ---------------------------------------------------------------------------

describe("parseCommand — /participant error paths", () => {
  test("/participant bare throws", () => {
    expect(() => parseCommand("/participant")).toThrow(CommandParseError);
  });

  test("/participant unknown subcommand throws", () => {
    expect(() => parseCommand("/participant promote erin")).toThrow(
      CommandParseError
    );
  });

  test("/participant add with too few args throws", () => {
    expect(() => parseCommand("/participant add erin")).toThrow(
      CommandParseError
    );
  });
});

// ---------------------------------------------------------------------------
// /agent — error paths
// ---------------------------------------------------------------------------

describe("parseCommand — /agent error paths", () => {
  test("/agent bare throws", () => {
    expect(() => parseCommand("/agent")).toThrow(CommandParseError);
  });

  test("/agent with 3+ non-edit args throws", () => {
    expect(() => parseCommand("/agent new extra stuff")).toThrow(
      CommandParseError
    );
  });
});

// ---------------------------------------------------------------------------
// /models — error paths
// ---------------------------------------------------------------------------

describe("parseCommand — /models error paths", () => {
  test("/models with 2+ args throws", () => {
    expect(() => parseCommand("/models one two")).toThrow(CommandParseError);
  });
});

// ---------------------------------------------------------------------------
// /promote — additional error paths
// ---------------------------------------------------------------------------

describe("parseCommand — /promote error paths", () => {
  test("/promote with 2+ args throws", () => {
    expect(() => parseCommand("/promote a b")).toThrow(CommandParseError);
  });
});

// ---------------------------------------------------------------------------
// tokenizeInput — additional edge cases
// ---------------------------------------------------------------------------

describe("tokenizeInput — edge cases", () => {
  test("escaped double quote inside quoted string", () => {
    expect(tokenizeInput('/say "He said \\"hello\\""')).toEqual([
      "/say",
      'He said "hello"',
    ]);
  });

  test("escaped backslash", () => {
    expect(tokenizeInput("/path C:\\\\Users")).toEqual(["/path", "C:\\Users"]);
  });

  test("single-quoted string", () => {
    expect(tokenizeInput("/test 'hello world'")).toEqual([
      "/test",
      "hello world",
    ]);
  });

  test("smart single quotes", () => {
    expect(tokenizeInput("/test \u2018hello world\u2019")).toEqual([
      "/test",
      "hello world",
    ]);
  });

  test("trailing escape outside quotes throws", () => {
    expect(() => tokenizeInput("/test \\")).toThrow(CommandParseError);
  });

  test("trailing escape inside quotes throws", () => {
    expect(() => tokenizeInput('/test "hello\\')).toThrow(CommandParseError);
  });

  test("multiple tokens separated by tabs", () => {
    expect(tokenizeInput("/cmd\targ1\targ2")).toEqual([
      "/cmd",
      "arg1",
      "arg2",
    ]);
  });

  test("empty tokenization returns empty array", () => {
    expect(tokenizeInput("")).toEqual([]);
  });

  test("whitespace-only returns empty array", () => {
    expect(tokenizeInput("   \t  ")).toEqual([]);
  });

  test("unicode in arguments", () => {
    expect(tokenizeInput("/nickname 🤖")).toEqual(["/nickname", "🤖"]);
  });

  test("mixed quote styles in separate tokens", () => {
    expect(tokenizeInput('/cmd "hello" \'world\'')).toEqual([
      "/cmd",
      "hello",
      "world",
    ]);
  });
});

// ---------------------------------------------------------------------------
// parseDirectedMessage — additional edge cases
// ---------------------------------------------------------------------------

describe("parseDirectedMessage — edge cases", () => {
  test("returns null for non-directed input", () => {
    expect(parseDirectedMessage("hello world")).toBeNull();
  });

  test("returns null for single @alias without 'to'", () => {
    expect(parseDirectedMessage("@erin hello")).toBeNull();
  });

  test("handles unquoted text after colon", () => {
    expect(parseDirectedMessage("@erin to @zora: hello there")).toEqual({
      fromAlias: "erin",
      toAlias: "zora",
      text: "hello there",
    });
  });

  test("normalizes aliases to lowercase", () => {
    expect(parseDirectedMessage('@ERIN to @ZORA: "hi"')).toEqual({
      fromAlias: "erin",
      toAlias: "zora",
      text: "hi",
    });
  });
});

// ---------------------------------------------------------------------------
// extractAddressedMessage — additional edge cases
// ---------------------------------------------------------------------------

describe("extractAddressedMessage — edge cases", () => {
  test("plain non-@ text returns text without alias", () => {
    expect(extractAddressedMessage("hello world")).toEqual({
      text: "hello world",
    });
  });

  test("@alias alone returns alias with empty text", () => {
    expect(extractAddressedMessage("@erin")).toEqual({
      alias: "erin",
      text: "",
    });
  });

  test("leading whitespace is trimmed", () => {
    expect(extractAddressedMessage("  @erin hello")).toEqual({
      alias: "erin",
      text: "hello",
    });
  });
});

// ---------------------------------------------------------------------------
// Crosstalk validation
// ---------------------------------------------------------------------------

describe("parseCommand — crosstalk edge cases", () => {
  test("crosstalk with empty text throws", () => {
    expect(() => parseCommand('@erin to @zora: ""')).toThrow(CommandParseError);
  });

  test("crosstalk normalizes aliases", () => {
    expect(parseCommand('@ERIN to @ZORA: "hello"')).toEqual({
      type: "crosstalk",
      fromAlias: "erin",
      toAlias: "zora",
      text: "hello",
    });
  });
});

// ---------------------------------------------------------------------------
// /help edge cases
// ---------------------------------------------------------------------------

describe("parseCommand — /help edge cases", () => {
  test("/help topic is case-insensitive", () => {
    expect(parseCommand("/help AUTO")).toEqual({
      type: "help.topic",
      topic: "auto",
    });
  });

  test("/help with multiple words uses first token", () => {
    // tokenizer splits on space, so only first token becomes topic
    expect(parseCommand("/help chat mode")).toEqual({
      type: "help.topic",
      topic: "chat",
    });
  });
});

// ---------------------------------------------------------------------------
// /preferences — additional edge paths
// ---------------------------------------------------------------------------

describe("parseCommand — /preferences edge cases", () => {
  test("/preferences set with multi-word value", () => {
    expect(
      parseCommand("/preferences set city New York City")
    ).toEqual({
      type: "preferences.set",
      key: "city",
      value: "New York City",
    });
  });

  test("/preferences unknown subcommand throws", () => {
    expect(() => parseCommand("/preferences delete city")).toThrow(
      CommandParseError
    );
  });

  test("/preferences set interval value", () => {
    expect(parseCommand("/preferences set interval 12")).toEqual({
      type: "preferences.set",
      key: "dailyWorkIntervalHours",
      value: "12",
    });
  });

  test("/preferences set dailyDirective alias", () => {
    expect(
      parseCommand("/preferences set dailyDirective Focus on shipping")
    ).toEqual({
      type: "preferences.set",
      key: "dailyWorkDirective",
      value: "Focus on shipping",
    });
  });
});

// ---------------------------------------------------------------------------
// /daily — edge cases
// ---------------------------------------------------------------------------

describe("parseCommand — /daily edge cases", () => {
  test("/daily status is case-sensitive for subcommand check", () => {
    // The parser lowercases the subcommand, so STATUS should still work
    expect(parseCommand("/daily STATUS")).toEqual({ type: "daily.status" });
  });
});

// ---------------------------------------------------------------------------
// /topology — edge cases
// ---------------------------------------------------------------------------

describe("parseCommand — /topology edge cases", () => {
  test("/topology assign is case-insensitive for subcommand", () => {
    expect(parseCommand("/topology ASSIGN workhorse agent")).toEqual({
      type: "topology.assign",
      alias: "workhorse",
      role: "agent",
    });
  });

  test("/topology delegate is case-insensitive", () => {
    expect(parseCommand("/topology DELEGATE orch agent1")).toEqual({
      type: "topology.delegate",
      orchestratorAlias: "orch",
      agentAlias: "agent1",
    });
  });

  test("/topology undelegate normalizes aliases", () => {
    expect(parseCommand("/topology undelegate @ORCH @AGENT")).toEqual({
      type: "topology.undelegate",
      orchestratorAlias: "orch",
      agentAlias: "agent",
    });
  });
});

// ---------------------------------------------------------------------------
// Message routing edge cases
// ---------------------------------------------------------------------------

describe("parseCommand — message routing", () => {
  test("@alias with no text sends empty message", () => {
    expect(parseCommand("@erin")).toEqual({
      type: "message",
      alias: "erin",
      text: "",
    });
  });

  test("@alias normalizes to lowercase and strips @", () => {
    expect(parseCommand("@ERIN hello")).toEqual({
      type: "message",
      alias: "erin",
      text: "hello",
    });
  });

  test("multi-line-like input (just spaces) is treated as message", () => {
    expect(parseCommand("Hello there friend")).toEqual({
      type: "message",
      text: "Hello there friend",
    });
  });
});

// ---------------------------------------------------------------------------
// /resource add — apiStyle-only (no tier)
// ---------------------------------------------------------------------------

describe("parseCommand — /resource add apiStyle without tier", () => {
  test("/resource add with apiStyle as 4th optional arg", () => {
    expect(
      parseCommand(
        '/resource add lmstudio "LM Studio" http://localhost:1234 openai'
      )
    ).toEqual({
      type: "resource.add",
      alias: "lmstudio",
      label: "LM Studio",
      baseUrl: "http://localhost:1234",
      apiStyle: "openai",
    });
  });

  test("/resource add with mid tier", () => {
    expect(
      parseCommand(
        '/resource add helper "Helper Device" http://localhost:11434 mid'
      )
    ).toEqual({
      type: "resource.add",
      alias: "helper",
      label: "Helper Device",
      baseUrl: "http://localhost:11434",
      tier: "mid",
    });
  });

  test("/resource add with low tier", () => {
    expect(
      parseCommand(
        '/resource add tiny "Tiny Device" http://localhost:11434 low'
      )
    ).toEqual({
      type: "resource.add",
      alias: "tiny",
      label: "Tiny Device",
      baseUrl: "http://localhost:11434",
      tier: "low",
    });
  });
});

// ---------------------------------------------------------------------------
// /model profile edge cases
// ---------------------------------------------------------------------------

describe("parseCommand — /model profile edge cases", () => {
  test("/model profile with 3+ args throws", () => {
    expect(() => parseCommand("/model profile auto extra")).toThrow(
      CommandParseError
    );
  });
});

// ---------------------------------------------------------------------------
// /agent normalization
// ---------------------------------------------------------------------------

describe("parseCommand — /agent normalization", () => {
  test("/agent chat normalizes name", () => {
    expect(parseCommand("/agent DataAnalyst")).toEqual({
      type: "agent.chat",
      name: "dataanalyst",
    });
  });

  test("/agent edit normalizes name", () => {
    expect(parseCommand("/agent edit DataAnalyst")).toEqual({
      type: "agent.edit",
      name: "dataanalyst",
    });
  });

  test("/agent list is case-insensitive", () => {
    expect(parseCommand("/agent LIST")).toEqual({ type: "agent.list" });
  });

  test("/agent new is case-insensitive", () => {
    expect(parseCommand("/agent NEW")).toEqual({ type: "agent.new" });
  });
});

// ---------------------------------------------------------------------------
// /participant normalization
// ---------------------------------------------------------------------------

describe("parseCommand — /participant normalization", () => {
  test("/participant list is case-insensitive", () => {
    expect(parseCommand("/participant LIST")).toEqual({
      type: "participant.list",
    });
  });

  test("/participant edit normalizes alias", () => {
    expect(parseCommand("/participant edit @ERIN")).toEqual({
      type: "participant.edit",
      alias: "erin",
    });
  });

  test("/participant remove normalizes alias", () => {
    expect(parseCommand("/participant remove @ERIN")).toEqual({
      type: "participant.remove",
      alias: "erin",
    });
  });

  test("/participant add normalizes all aliases", () => {
    expect(parseCommand('/participant add @ERIN WORKHORSE "Erin"')).toEqual({
      type: "participant.add",
      alias: "erin",
      resourceAlias: "workhorse",
      nickname: "Erin",
    });
  });
});

// ---------------------------------------------------------------------------
// /direct normalization
// ---------------------------------------------------------------------------

describe("parseCommand — /direct", () => {
  test("/direct normalizes resource alias", () => {
    expect(parseCommand('/direct @WorkHorse "Hello"')).toEqual({
      type: "directChat",
      resourceAlias: "workhorse",
      text: "Hello",
    });
  });

  test("/direct without model", () => {
    expect(parseCommand('/direct myres "Test"')).toEqual({
      type: "directChat",
      resourceAlias: "myres",
      text: "Test",
    });
  });
});

// ---------------------------------------------------------------------------
// /models normalization
// ---------------------------------------------------------------------------

describe("parseCommand — /models edge cases", () => {
  test("/models passes target through as-is", () => {
    expect(parseCommand("/models workhorse")).toEqual({
      type: "models.list",
      target: "workhorse",
    });
  });
});
