import { describe, expect, test } from "bun:test";

import { fetchBenLive } from "../src/benlive.ts";

describe("fetchBenLive", () => {
  test("fetches and chunks content by path", async () => {
    const mockFetch = async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("benlive.tv")) {
        return new Response("<html><body><h1>Welcome to Ben Live</h1><p>Content here.</p></body></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }
      return new Response("Not Found", { status: 404 });
    };

    const result = await fetchBenLive("/blog", mockFetch);
    expect(result.url).toBe("https://benlive.tv/blog");
    expect(result.path).toBe("/blog");
    expect(result.text).toContain("Welcome to Ben Live");
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks[0]).toContain("Ben Live chunk 1/");
  });

  test("encodes topic as path when not starting with /", async () => {
    const mockFetch = async () =>
      new Response("<p>Topic result</p>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });

    const result = await fetchBenLive("updates", mockFetch);
    expect(result.url).toContain("benlive.tv/");
    expect(result.text).toContain("Topic result");
  });

  test("throws on empty input", async () => {
    await expect(
      fetchBenLive("", async () => new Response(""))
    ).rejects.toThrow("empty");
  });
});
