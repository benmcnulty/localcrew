import { describe, expect, test } from "bun:test";

import { fetchWebsite } from "../src/website.ts";

describe("fetchWebsite", () => {
  test("fetches content from personal website by path", async () => {
    const mockFetch = async () =>
      new Response("<html><body><h1>My Site</h1><p>About me.</p></body></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });

    const result = await fetchWebsite("https://mysite.dev", "/about", mockFetch);
    expect(result.url).toBe("https://mysite.dev/about");
    expect(result.path).toBe("/about");
    expect(result.text).toContain("My Site");
    expect(result.text).toContain("About me.");
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks[0]).toContain("Website chunk 1/");
  });

  test("strips trailing slash from base URL", async () => {
    const mockFetch = async () =>
      new Response("<p>Content</p>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });

    const result = await fetchWebsite("https://mysite.dev/", "/page", mockFetch);
    expect(result.url).toBe("https://mysite.dev/page");
  });

  test("encodes non-path topics", async () => {
    const mockFetch = async () =>
      new Response("<p>Result</p>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });

    const result = await fetchWebsite("https://mysite.dev", "contact", mockFetch);
    expect(result.url).toContain("mysite.dev/");
    expect(result.text).toContain("Result");
  });

  test("throws on empty topic", async () => {
    await expect(
      fetchWebsite("https://mysite.dev", "", async () => new Response(""))
    ).rejects.toThrow("empty");
  });

  test("throws on empty base URL", async () => {
    await expect(
      fetchWebsite("", "/path", async () => new Response(""))
    ).rejects.toThrow("not configured");
  });
});
