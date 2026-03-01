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
