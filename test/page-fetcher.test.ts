import { describe, expect, test } from "bun:test";

import { stripHtmlToText, chunkText, fetchPageText } from "../src/page-fetcher.ts";

describe("stripHtmlToText", () => {
  test("strips script, style, and noscript blocks", () => {
    const html = `<p>Hello</p><script>alert('x')</script><style>.a{}</style><noscript>Off</noscript><p>World</p>`;
    expect(stripHtmlToText(html)).toBe("Hello World");
  });

  test("strips HTML tags and collapses whitespace", () => {
    const html = `<div>  <p>A   B</p>  <span>C</span>  </div>`;
    expect(stripHtmlToText(html)).toBe("A B C");
  });

  test("decodes common entities", () => {
    expect(stripHtmlToText("&amp; &lt; &gt; &quot; &#39; &nbsp;")).toBe('& < > " \'');
  });

  test("returns empty string for empty input", () => {
    expect(stripHtmlToText("")).toBe("");
  });
});

describe("chunkText", () => {
  test("returns single chunk when text is under limit", () => {
    expect(chunkText("Hello world", 100)).toEqual(["Hello world"]);
  });

  test("splits on newline when possible", () => {
    const text = "Line one\nLine two\nLine three";
    const chunks = chunkText(text, 18);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(18);
    }
  });

  test("splits on space when no newline available", () => {
    const text = "word1 word2 word3 word4 word5";
    const chunks = chunkText(text, 12);
    expect(chunks.length).toBeGreaterThan(1);
  });

  test("hard splits when no whitespace available", () => {
    const text = "a".repeat(30);
    const chunks = chunkText(text, 10);
    expect(chunks.length).toBe(3);
  });
});

describe("fetchPageText", () => {
  test("fetches and strips HTML from a response", async () => {
    const mockFetch = async () =>
      new Response("<html><body><p>Hello World</p></body></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });

    const result = await fetchPageText("https://example.com", mockFetch);
    expect(result.url).toBe("https://example.com");
    expect(result.text).toBe("Hello World");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  test("returns plain text for non-HTML responses", async () => {
    const mockFetch = async () =>
      new Response("Plain content here", {
        status: 200,
        headers: { "content-type": "text/plain" },
      });

    const result = await fetchPageText("https://example.com/feed", mockFetch);
    expect(result.text).toBe("Plain content here");
  });

  test("throws on non-OK response", async () => {
    const mockFetch = async () => new Response("Not Found", { status: 404 });

    await expect(fetchPageText("https://example.com/404", mockFetch)).rejects.toThrow("404");
  });

  test("truncates to charLimit", async () => {
    const longBody = "<p>" + "x".repeat(200) + "</p>";
    const mockFetch = async () =>
      new Response(longBody, {
        status: 200,
        headers: { "content-type": "text/html" },
      });

    const result = await fetchPageText("https://example.com", mockFetch, 10000, 50);
    expect(result.text.length).toBeLessThanOrEqual(50);
  });
});
