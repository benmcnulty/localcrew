import { describe, expect, test } from "bun:test";

import {
  CommandParseError,
  extractAddressedMessage,
  formatDirectedMessageInput,
  parseCommand,
  parseDirectedMessage,
  tokenizeInput
} from "../src/commands.ts";

describe("tokenizeInput", () => {
  test("handles smart quotes", () => {
    expect(tokenizeInput('/instructions “Reply clearly.”')).toEqual([
      "/instructions",
      "Reply clearly."
    ]);
  });

  test("throws on unterminated quotes", () => {
    expect(() => tokenizeInput('/instructions "Hello')).toThrow(CommandParseError);
  });
});

describe("parseCommand", () => {
  test("treats plain text as a general chat message", () => {
    expect(parseCommand("Hello Erin")).toEqual({
      type: "message",
      text: "Hello Erin"
    });
  });

  test("treats @alias text as a targeted user message", () => {
    expect(parseCommand("@zora Hello there")).toEqual({
      type: "message",
      alias: "zora",
      text: "Hello there"
    });
  });

  test("parses directed participant crosstalk", () => {
    expect(parseCommand('@erin to @zora: "Please go next."')).toEqual({
      type: "crosstalk",
      fromAlias: "erin",
      toAlias: "zora",
      text: "Please go next."
    });
  });

  test("parses help commands", () => {
    expect(parseCommand("/help")).toEqual({
      type: "help"
    });
    expect(parseCommand("/help chat")).toEqual({
      type: "help.topic",
      topic: "chat"
    });
    expect(parseCommand("/help auto")).toEqual({
      type: "help.topic",
      topic: "auto"
    });
    expect(parseCommand("/help resources")).toEqual({
      type: "help.topic",
      topic: "resources"
    });
    expect(parseCommand("/help topology")).toEqual({
      type: "help.topic",
      topic: "topology"
    });
    expect(parseCommand("/help tools")).toEqual({
      type: "help.topic",
      topic: "tools"
    });
    expect(parseCommand("/help preferences")).toEqual({
      type: "help.topic",
      topic: "preferences"
    });
    expect(parseCommand("/status")).toEqual({
      type: "status"
    });
    expect(parseCommand("/hud")).toEqual({
      type: "hud"
    });
    expect(parseCommand("/explore")).toEqual({
      type: "explore"
    });
    expect(parseCommand("/login")).toEqual({
      type: "login"
    });
  });

  test("parses auto mode commands", () => {
    expect(parseCommand("/auto")).toEqual({
      type: "autoMode"
    });
    expect(parseCommand("/stop")).toEqual({
      type: "stopAuto"
    });
  });

  test("parses priority commands", () => {
    expect(parseCommand("/priority medium")).toEqual({
      type: "priority.set",
      priority: "medium"
    });
  });

  test("parses agent commands", () => {
    expect(parseCommand("/agent list")).toEqual({
      type: "agent.list"
    });
    expect(parseCommand("/agent new")).toEqual({
      type: "agent.new"
    });
    expect(parseCommand("/agent edit reviewer")).toEqual({
      type: "agent.edit",
      name: "reviewer"
    });
    expect(parseCommand("/agent reviewer")).toEqual({
      type: "agent.chat",
      name: "reviewer"
    });
  });

  test("parses rename commands", () => {
    expect(parseCommand("/rename @erin atlas")).toEqual({
      type: "rename",
      fromAlias: "erin",
      toAlias: "atlas"
    });
  });

  test("parses clear commands", () => {
    expect(parseCommand("/clear")).toEqual({
      type: "clear"
    });
  });

  test("parses resource commands", () => {
    expect(parseCommand("/resource list")).toEqual({
      type: "resource.list"
    });
    expect(parseCommand('/resource add workhorse "Second Device" http://127.0.0.1:11435 top')).toEqual({
      type: "resource.add",
      alias: "workhorse",
      label: "Second Device",
      baseUrl: "http://127.0.0.1:11435",
      tier: "top"
    });
    expect(
      parseCommand('/resource add studio "LM Studio" http://127.0.0.1:1234 openai')
    ).toEqual({
      type: "resource.add",
      alias: "studio",
      label: "LM Studio",
      baseUrl: "http://127.0.0.1:1234",
      apiStyle: "openai"
    });
    expect(
      parseCommand('/resource add claude "Anthropic Cloud" https://api.anthropic.com anthropic')
    ).toEqual({
      type: "resource.add",
      alias: "claude",
      label: "Anthropic Cloud",
      baseUrl: "https://api.anthropic.com",
      apiStyle: "anthropic"
    });
    expect(parseCommand("/resource edit workhorse")).toEqual({
      type: "resource.edit",
      alias: "workhorse"
    });
    expect(parseCommand("/resource refresh workhorse")).toEqual({
      type: "resource.refresh",
      alias: "workhorse"
    });
    expect(parseCommand("/resource remove workhorse")).toEqual({
      type: "resource.remove",
      alias: "workhorse"
    });
  });

  test("parses participant commands", () => {
    expect(parseCommand("/participant list")).toEqual({
      type: "participant.list"
    });
    expect(parseCommand('/participant add reviewer workhorse "Reviewer Prime"')).toEqual({
      type: "participant.add",
      alias: "reviewer",
      resourceAlias: "workhorse",
      nickname: "Reviewer Prime"
    });
    expect(parseCommand("/participant edit reviewer")).toEqual({
      type: "participant.edit",
      alias: "reviewer"
    });
    expect(parseCommand("/participant remove reviewer")).toEqual({
      type: "participant.remove",
      alias: "reviewer"
    });
  });

  test("parses model and direct chat commands", () => {
    expect(parseCommand("/models")).toEqual({
      type: "models.list"
    });
    expect(parseCommand("/models @reviewer")).toEqual({
      type: "models.list",
      target: "@reviewer"
    });
    expect(parseCommand('/direct workhorse "Ping the node" llama3.1:8b')).toEqual({
      type: "directChat",
      resourceAlias: "workhorse",
      text: "Ping the node",
      model: "llama3.1:8b"
    });
    expect(parseCommand("/model reviewer llama3.1:70b")).toEqual({
      type: "model.assign",
      alias: "reviewer",
      model: "llama3.1:70b"
    });
  });

  test("parses model policy and purpose subcommands", () => {
    expect(parseCommand("/model zora policy auto")).toEqual({
      type: "model.policy",
      alias: "zora",
      policy: "auto"
    });
    expect(parseCommand("/model zora policy fixed")).toEqual({
      type: "model.policy",
      alias: "zora",
      policy: "fixed"
    });
    expect(parseCommand("/model zora coding qwen2.5-coder:7b")).toEqual({
      type: "model.purpose",
      alias: "zora",
      purpose: "coding",
      model: "qwen2.5-coder:7b"
    });
    expect(parseCommand("/model zora reasoning deepseek-r1:14b")).toEqual({
      type: "model.purpose",
      alias: "zora",
      purpose: "reasoning",
      model: "deepseek-r1:14b"
    });
    expect(parseCommand("/model zora tools llama3.1:8b")).toEqual({
      type: "model.purpose",
      alias: "zora",
      purpose: "tools",
      model: "llama3.1:8b"
    });
    expect(() => parseCommand("/model zora policy")).toThrow();
    expect(() => parseCommand("/model zora policy invalid")).toThrow();
    expect(() => parseCommand("/model zora coding")).toThrow();
  });

  test("parses model profile subcommands", () => {
    expect(parseCommand("/model profile")).toEqual({
      type: "model.profile.get"
    });
    expect(parseCommand("/model profile all-llamas")).toEqual({
      type: "model.profile.set",
      mode: "all-llamas"
    });
    expect(parseCommand("/model profile custom")).toEqual({
      type: "model.profile.set",
      mode: "custom"
    });
    expect(parseCommand("/model profile auto")).toEqual({
      type: "model.profile.set",
      mode: "auto"
    });
    expect(() => parseCommand("/model profile nope")).toThrow();
  });

  test("parses nickname, bind, and orchestrator commands", () => {
    expect(parseCommand('/nickname @reviewer "Reviewer Prime"')).toEqual({
      type: "nickname.set",
      alias: "reviewer",
      nickname: "Reviewer Prime"
    });
    expect(parseCommand("/bind @reviewer helper")).toEqual({
      type: "bind.set",
      alias: "reviewer",
      resourceAlias: "helper"
    });
    expect(parseCommand('/orchestrator "Aster"')).toEqual({
      type: "orchestrator.set",
      name: "Aster"
    });
  });

  test("rejects unknown commands", () => {
    expect(() => parseCommand("/nope")).toThrow('Unknown command "/nope".');
  });
});

describe("directed message helpers", () => {
  test("parses directed messages with quotes", () => {
    expect(parseDirectedMessage('@erin to @zora: "Please go next."')).toEqual({
      fromAlias: "erin",
      toAlias: "zora",
      text: "Please go next."
    });
  });

  test("extracts addressed messages", () => {
    expect(extractAddressedMessage("@erin Hello there")).toEqual({
      alias: "erin",
      text: "Hello there"
    });
  });

  test("formats follow-up prompts as directed crosstalk", () => {
    expect(
      formatDirectedMessageInput({
        fromAlias: "erin",
        toAlias: "zora",
        message: 'Please go "next".'
      })
    ).toBe('@erin to @zora: "Please go \\"next\\"."');
  });
});

describe("parseCommand — /preferences", () => {
  test("parses /preferences as preferences.get", () => {
    expect(parseCommand("/preferences")).toEqual({ type: "preferences.get" });
  });

  test("parses /preferences set city value", () => {
    expect(parseCommand("/preferences set city Portland")).toEqual({
      type: "preferences.set",
      key: "city",
      value: "Portland",
    });
  });

  test("parses /preferences set zipCode value", () => {
    expect(parseCommand("/preferences set zipCode 97201")).toEqual({
      type: "preferences.set",
      key: "zipCode",
      value: "97201",
    });
  });

  test("parses /preferences set personalWebsiteUrl value", () => {
    expect(
      parseCommand("/preferences set personalWebsiteUrl https://example.com")
    ).toEqual({
      type: "preferences.set",
      key: "personalWebsiteUrl",
      value: "https://example.com",
    });
  });

  test("key is case-insensitive", () => {
    expect(parseCommand("/preferences set CITY Denver")).toEqual({
      type: "preferences.set",
      key: "city",
      value: "Denver",
    });
  });

  test("accepts short alias 'zip' for zipCode", () => {
    expect(parseCommand("/preferences set zip 97201")).toEqual({
      type: "preferences.set",
      key: "zipCode",
      value: "97201",
    });
  });

  test("accepts short alias 'website' for personalWebsiteUrl", () => {
    expect(
      parseCommand("/preferences set website https://example.com")
    ).toEqual({
      type: "preferences.set",
      key: "personalWebsiteUrl",
      value: "https://example.com",
    });
  });

  test("accepts short alias 'directive' for dailyDigestDirective", () => {
    expect(
      parseCommand("/preferences set directive Focus on AI topics")
    ).toEqual({
      type: "preferences.set",
      key: "dailyDigestDirective",
      value: "Focus on AI topics",
    });
  });

  test("throws on invalid key", () => {
    expect(() => parseCommand("/preferences set invalid value")).toThrow(
      CommandParseError
    );
  });

  test("throws on missing value", () => {
    expect(() => parseCommand("/preferences set city")).toThrow(CommandParseError);
  });
});

describe("parseCommand — /daily", () => {
  test("parses /daily as daily.status", () => {
    expect(parseCommand("/daily")).toEqual({ type: "daily.status" });
  });

  test("parses /daily status as daily.status", () => {
    expect(parseCommand("/daily status")).toEqual({ type: "daily.status" });
  });

  test("parses /daily start as daily.start", () => {
    expect(parseCommand("/daily start")).toEqual({ type: "daily.start" });
  });

  test("parses /daily finish as daily.finish", () => {
    expect(parseCommand("/daily finish")).toEqual({ type: "daily.finish" });
  });

  test("throws on unknown /daily subcommand", () => {
    expect(() => parseCommand("/daily foo")).toThrow(CommandParseError);
  });
});

describe("parseCommand — /promote", () => {
  test("parses /promote with alias", () => {
    expect(parseCommand("/promote workhorse")).toEqual({
      type: "promote",
      alias: "workhorse",
    });
  });

  test("normalizes alias to lowercase", () => {
    expect(parseCommand("/promote WorkHorse")).toEqual({
      type: "promote",
      alias: "workhorse",
    });
  });

  test("strips @ prefix from alias", () => {
    expect(parseCommand("/promote @workhorse")).toEqual({
      type: "promote",
      alias: "workhorse",
    });
  });

  test("throws when alias is missing", () => {
    expect(() => parseCommand("/promote")).toThrow(CommandParseError);
  });
});

describe("parseCommand — /topology", () => {
  test("parses bare /topology as topology", () => {
    expect(parseCommand("/topology")).toEqual({ type: "topology" });
  });

  test("parses /topology assign with alias and role", () => {
    expect(parseCommand("/topology assign workhorse orchestrator")).toEqual({
      type: "topology.assign",
      alias: "workhorse",
      role: "orchestrator",
    });
  });

  test("parses /topology assign primary-orchestrator role", () => {
    expect(parseCommand("/topology assign workhorse primary-orchestrator")).toEqual({
      type: "topology.assign",
      alias: "workhorse",
      role: "primary-orchestrator",
    });
  });

  test("parses /topology assign agent role", () => {
    expect(parseCommand("/topology assign helper agent")).toEqual({
      type: "topology.assign",
      alias: "helper",
      role: "agent",
    });
  });

  test("normalizes alias in /topology assign", () => {
    expect(parseCommand("/topology assign @WorkHorse orchestrator")).toEqual({
      type: "topology.assign",
      alias: "workhorse",
      role: "orchestrator",
    });
  });

  test("throws on unknown role in /topology assign", () => {
    expect(() => parseCommand("/topology assign workhorse leader")).toThrow(CommandParseError);
  });

  test("throws when alias is missing in /topology assign", () => {
    expect(() => parseCommand("/topology assign")).toThrow(CommandParseError);
  });

  test("parses /topology delegate", () => {
    expect(parseCommand("/topology delegate workhorse helper")).toEqual({
      type: "topology.delegate",
      orchestratorAlias: "workhorse",
      agentAlias: "helper",
    });
  });

  test("normalizes aliases in /topology delegate", () => {
    expect(parseCommand("/topology delegate @WorkHorse @Helper")).toEqual({
      type: "topology.delegate",
      orchestratorAlias: "workhorse",
      agentAlias: "helper",
    });
  });

  test("throws when agent is missing in /topology delegate", () => {
    expect(() => parseCommand("/topology delegate workhorse")).toThrow(CommandParseError);
  });

  test("parses /topology undelegate", () => {
    expect(parseCommand("/topology undelegate workhorse helper")).toEqual({
      type: "topology.undelegate",
      orchestratorAlias: "workhorse",
      agentAlias: "helper",
    });
  });

  test("throws on unknown /topology subcommand", () => {
    expect(() => parseCommand("/topology foo")).toThrow(CommandParseError);
  });
});
