import { describe, expect, test } from "bun:test";

import {
  extractDuckDuckGoResultUrl,
  getAllowedTopics,
  isAllowedSearchTopic,
  parseDuckDuckGoHtml,
  searchWeb,
} from "../src/web-search.ts";

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

describe("extractDuckDuckGoResultUrl", () => {
  test("decodes DuckDuckGo redirect URLs", () => {
    const encoded =
      "https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fjobs%3Fid%3D42";
    expect(extractDuckDuckGoResultUrl(encoded)).toBe("https://example.com/jobs?id=42");
  });

  test("supports protocol-relative URLs", () => {
    expect(extractDuckDuckGoResultUrl("//example.com/path")).toBe("https://example.com/path");
  });

  test("returns empty string for invalid URLs", () => {
    expect(extractDuckDuckGoResultUrl("not-a-url")).toBe("");
  });
});

describe("parseDuckDuckGoHtml", () => {
  test("extracts title, URL, and snippet from HTML results", () => {
    const html = `
      <div class="result">
        <a class="result__a" href="https://example.com/article">Deep <b>Article</b></a>
        <a class="result__snippet">Useful <b>summary</b> text</a>
      </div>
      <div class="result">
        <a class="result__a" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fnews">News Item</a>
        <a class="result__snippet">Latest updates</a>
      </div>
    `;

    const entries = parseDuckDuckGoHtml(html, 5);
    expect(entries).toEqual([
      {
        title: "Deep Article",
        url: "https://example.com/article",
        snippet: "Useful summary text",
      },
      {
        title: "News Item",
        url: "https://example.com/news",
        snippet: "Latest updates",
      },
    ]);
  });

  test("deduplicates repeated URLs and respects maxResults", () => {
    const html = `
      <a class="result__a" href="https://example.com/a">A</a>
      <a class="result__snippet">One</a>
      <a class="result__a" href="https://example.com/a">A duplicate</a>
      <a class="result__snippet">Two</a>
      <a class="result__a" href="https://example.com/b">B</a>
      <a class="result__snippet">Three</a>
    `;

    const entries = parseDuckDuckGoHtml(html, 1);
    expect(entries).toEqual([
      {
        title: "A",
        url: "https://example.com/a",
        snippet: "One",
      },
    ]);
  });

  test("returns empty array when no valid result anchors exist", () => {
    const html = `<div>No result anchors here</div>`;
    expect(parseDuckDuckGoHtml(html, 5)).toEqual([]);
  });
});

describe("searchWeb", () => {
  test("throws on empty query", async () => {
    await expect(searchWeb("   ", "news", fetch)).rejects.toThrow(
      "Web search query cannot be empty."
    );
  });

  test("throws on invalid topic", async () => {
    await expect(searchWeb("q", "movies", fetch)).rejects.toThrow(
      'Topic "movies" is not allowed.'
    );
  });

  test("parses fetched HTML and returns chunked results", async () => {
    const fetchFn: typeof fetch = async () =>
      new Response(
        `
        <a class="result__a" href="https://example.com/1">Result 1</a>
        <a class="result__snippet">Snippet 1</a>
        <a class="result__a" href="https://example.com/2">Result 2</a>
        <a class="result__snippet">Snippet 2</a>
        `,
        {
          status: 200,
          headers: {
            "content-type": "text/html",
          },
        }
      );

    const result = await searchWeb("agent routing", "software-engineering", fetchFn);

    expect(result.query).toBe("agent routing");
    expect(result.topic).toBe("software-engineering");
    expect(result.entries).toEqual([
      { title: "Result 1", url: "https://example.com/1", snippet: "Snippet 1" },
      { title: "Result 2", url: "https://example.com/2", snippet: "Snippet 2" },
    ]);
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks[0]).toContain("Web search results for \"agent routing\"");
  });

  test("returns explicit no-results chunk when parser finds no entries", async () => {
    const fetchFn: typeof fetch = async () =>
      new Response("<html><body>No matching result markup</body></html>", {
        status: 200,
        headers: {
          "content-type": "text/html",
        },
      });

    const result = await searchWeb("obscure", "ai-engineering", fetchFn);
    expect(result.entries).toEqual([]);
    expect(result.chunks.join("\n")).toContain("No web results found.");
  });

  test("throws on non-2xx response", async () => {
    const fetchFn: typeof fetch = async () =>
      new Response("rate limited", {
        status: 429,
        headers: { "content-type": "text/plain" },
      });

    await expect(searchWeb("agent", "news", fetchFn)).rejects.toThrow(
      "DuckDuckGo search failed with HTTP 429."
    );
  });
});
