import { describe, expect, test } from "bun:test";

import type { ToolAuthorization } from "../src/types.ts";

// Test helper — mirrors the logic in LocalCrewApp.isToolAuthorized()
function isToolAuthorized(tool: keyof ToolAuthorization, auth?: ToolAuthorization): boolean {
  if (!auth) return true; // backward compat: absent = all authorized
  return auth[tool] !== false;
}

// Test helper — mirrors computeGroundingFlags() in messages.ts
function computeGroundingFlags(
  weatherEnabled: boolean | undefined,
  auth?: ToolAuthorization
): Record<string, boolean> {
  const authorized = (tool: keyof ToolAuthorization) => !auth || auth[tool] !== false;
  return {
    wikipediaEnabled: authorized("wikipedia"),
    redditEnabled: authorized("reddit"),
    webSearchEnabled: authorized("webSearch"),
    weatherEnabled: !!weatherEnabled && authorized("weather"),
    benliveEnabled: authorized("benlive"),
    websiteEnabled: authorized("website"),
  };
}

describe("isToolAuthorized", () => {
  test("returns true for all tools when auth is undefined (backward compat)", () => {
    const tools: (keyof ToolAuthorization)[] = [
      "wikipedia", "reddit", "webSearch", "weather", "benlive", "website", "toCode"
    ];
    for (const tool of tools) {
      expect(isToolAuthorized(tool, undefined)).toBe(true);
    }
  });

  test("returns true when tool is explicitly true", () => {
    const auth: ToolAuthorization = {
      wikipedia: true, reddit: false, webSearch: true,
      weather: false, benlive: true, website: false, toCode: false
    };
    expect(isToolAuthorized("wikipedia", auth)).toBe(true);
    expect(isToolAuthorized("webSearch", auth)).toBe(true);
    expect(isToolAuthorized("benlive", auth)).toBe(true);
  });

  test("returns false when tool is explicitly false", () => {
    const auth: ToolAuthorization = {
      wikipedia: false, reddit: false, webSearch: false,
      weather: false, benlive: false, website: false, toCode: false
    };
    for (const tool of Object.keys(auth) as (keyof ToolAuthorization)[]) {
      expect(isToolAuthorized(tool, auth)).toBe(false);
    }
  });

  test("mixed authorization", () => {
    const auth: ToolAuthorization = {
      wikipedia: true, reddit: false, webSearch: true,
      weather: true, benlive: false, website: false, toCode: true
    };
    expect(isToolAuthorized("wikipedia", auth)).toBe(true);
    expect(isToolAuthorized("reddit", auth)).toBe(false);
    expect(isToolAuthorized("toCode", auth)).toBe(true);
    expect(isToolAuthorized("benlive", auth)).toBe(false);
  });
});

describe("computeGroundingFlags", () => {
  test("all enabled when auth is absent", () => {
    const flags = computeGroundingFlags(true, undefined);
    expect(flags.wikipediaEnabled).toBe(true);
    expect(flags.redditEnabled).toBe(true);
    expect(flags.webSearchEnabled).toBe(true);
    expect(flags.weatherEnabled).toBe(true);
    expect(flags.benliveEnabled).toBe(true);
    expect(flags.websiteEnabled).toBe(true);
  });

  test("weather disabled when weatherEnabled=false regardless of auth", () => {
    const flags = computeGroundingFlags(false, undefined);
    expect(flags.weatherEnabled).toBe(false);
  });

  test("weather disabled when tool auth is false", () => {
    const auth: ToolAuthorization = {
      wikipedia: true, reddit: true, webSearch: true,
      weather: false, benlive: true, website: true, toCode: false
    };
    const flags = computeGroundingFlags(true, auth);
    expect(flags.weatherEnabled).toBe(false);
    expect(flags.wikipediaEnabled).toBe(true);
  });

  test("selectively disables tools based on auth", () => {
    const auth: ToolAuthorization = {
      wikipedia: false, reddit: false, webSearch: true,
      weather: true, benlive: false, website: false, toCode: false
    };
    const flags = computeGroundingFlags(true, auth);
    expect(flags.wikipediaEnabled).toBe(false);
    expect(flags.redditEnabled).toBe(false);
    expect(flags.webSearchEnabled).toBe(true);
    expect(flags.weatherEnabled).toBe(true);
    expect(flags.benliveEnabled).toBe(false);
    expect(flags.websiteEnabled).toBe(false);
  });
});
