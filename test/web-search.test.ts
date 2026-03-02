import { describe, expect, test } from "bun:test";

import { isAllowedSearchTopic, getAllowedTopics } from "../src/web-search.ts";

describe("isAllowedSearchTopic", () => {
  test("allows valid topics", () => {
    expect(isAllowedSearchTopic("news")).toBe(true);
    expect(isAllowedSearchTopic("jobs")).toBe(true);
    expect(isAllowedSearchTopic("software-engineering")).toBe(true);
    expect(isAllowedSearchTopic("ai-engineering")).toBe(true);
  });

  test("rejects invalid topics", () => {
    expect(isAllowedSearchTopic("random")).toBe(false);
    expect(isAllowedSearchTopic("")).toBe(false);
    expect(isAllowedSearchTopic("entertainment")).toBe(false);
  });

  test("is case-insensitive", () => {
    expect(isAllowedSearchTopic("News")).toBe(true);
    expect(isAllowedSearchTopic("AI-ENGINEERING")).toBe(true);
  });
});

describe("getAllowedTopics", () => {
  test("returns all allowed topics", () => {
    const topics = getAllowedTopics();
    expect(topics).toContain("news");
    expect(topics).toContain("jobs");
    expect(topics).toContain("software-engineering");
    expect(topics).toContain("ai-engineering");
    expect(topics.length).toBe(4);
  });
});
