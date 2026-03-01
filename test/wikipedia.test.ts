import { describe, expect, test } from "bun:test";

import { searchWikipedia } from "../src/wikipedia.ts";

describe("searchWikipedia", () => {
  test("formats and chunks search results into plain text", async () => {
    const result = await searchWikipedia("Grace Hopper", async (input) => {
      const url = String(input);

      if (url.includes("list=search")) {
        return new Response(
          JSON.stringify({
            query: {
              search: [
                {
                  pageid: 123,
                  title: "Grace Hopper",
                  snippet: "Grace <b>Hopper</b> helped shape modern computing."
                }
              ]
            }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          query: {
            pages: {
              "123": {
                pageid: 123,
                title: "Grace Hopper",
                extract:
                  "Grace Hopper was an American computer scientist &amp; rear admiral.",
                fullurl: "https://en.wikipedia.org/wiki/Grace_Hopper"
              }
            }
          }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });

    expect(result.query).toBe("Grace Hopper");
    expect(result.pages).toEqual([
      {
        pageId: 123,
        title: "Grace Hopper",
        url: "https://en.wikipedia.org/wiki/Grace_Hopper",
        excerpt: "Grace Hopper was an American computer scientist & rear admiral."
      }
    ]);
    expect(result.chunks[0]).toContain('Wikipedia search results for "Grace Hopper":');
    expect(result.chunks[0]).toContain("Grace Hopper");
    expect(result.chunks[0]).toContain("https://en.wikipedia.org/wiki/Grace_Hopper");
  });

  test("returns a no-results chunk when wikipedia finds nothing", async () => {
    const result = await searchWikipedia("no matches", async () => {
      return new Response(
        JSON.stringify({
          query: {
            search: []
          }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });

    expect(result.pages).toEqual([]);
    expect(result.chunks).toEqual([
      'Wikipedia search results for "no matches":\n\nNo matching pages found.'
    ]);
  });
});
