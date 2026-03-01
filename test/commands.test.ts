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
