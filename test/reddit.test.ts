import { describe, expect, test } from "bun:test";

import { searchReddit } from "../src/reddit.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePost(overrides: {
  subreddit?: string;
  title?: string;
  url?: string;
  permalink?: string;
  selftext?: string;
  score?: number;
  num_comments?: number;
}) {
  return {
    data: {
      subreddit: overrides.subreddit ?? "programming",
      title: overrides.title ?? "Default title",
      url: overrides.url ?? "https://example.com",
      permalink: overrides.permalink ?? "/r/programming/comments/abc/default",
      selftext: overrides.selftext ?? "",
      score: overrides.score ?? 10,
      num_comments: overrides.num_comments ?? 5
    }
  };
}

function makeRedditResponse(posts: ReturnType<typeof makePost>[]) {
  return {
    data: {
      children: posts
    }
  };
}

function makeFetch(body: unknown, status = 200): typeof fetch {
  return () =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body)
    } as Response);
}

// ---------------------------------------------------------------------------
// searchReddit — basic behaviour
// ---------------------------------------------------------------------------

describe("searchReddit", () => {
  test("rejects empty query", async () => {
    const fetchFn = makeFetch({});
    await expect(searchReddit("", fetchFn)).rejects.toThrow(
      "Reddit search query cannot be empty."
    );
  });

  test("throws on non-2xx response", async () => {
    const fetchFn = makeFetch({}, 429);
    await expect(searchReddit("typescript generics", fetchFn)).rejects.toThrow(
      "Reddit search failed with HTTP 429."
    );
  });

  test("returns empty result when no posts found", async () => {
    const fetchFn = makeFetch(makeRedditResponse([]));
    const result = await searchReddit("obscure query xyz", fetchFn);
    expect(result.posts).toHaveLength(0);
    expect(result.chunks[0]).toContain("No matching posts found");
  });

  test("returns parsed posts for matching subreddits", async () => {
    const fetchFn = makeFetch(
      makeRedditResponse([
        makePost({ subreddit: "typescript", title: "Generic bounds in TS", score: 42 }),
        makePost({ subreddit: "programming", title: "Best practices", score: 15 })
      ])
    );
    const result = await searchReddit("typescript generics", fetchFn);
    expect(result.posts).toHaveLength(2);
    expect(result.posts[0].subreddit).toBe("typescript");
    expect(result.posts[0].title).toBe("Generic bounds in TS");
    expect(result.posts[0].score).toBe(42);
  });

  test("filters out posts from non-technical subreddits", async () => {
    const fetchFn = makeFetch(
      makeRedditResponse([
        makePost({ subreddit: "gaming", title: "Gaming post", score: 100 }),
        makePost({ subreddit: "funny", title: "Funny post", score: 200 }),
        makePost({ subreddit: "linux", title: "Linux post", score: 10 })
      ])
    );
    const result = await searchReddit("linux config", fetchFn);
    expect(result.posts).toHaveLength(1);
    expect(result.posts[0].subreddit).toBe("linux");
  });

  test("filters out posts with score below minimum (2)", async () => {
    const fetchFn = makeFetch(
      makeRedditResponse([
        makePost({ subreddit: "programming", score: 1, title: "Low score" }),
        makePost({ subreddit: "programming", score: 2, title: "Minimum score" }),
        makePost({ subreddit: "programming", score: 10, title: "High score" })
      ])
    );
    const result = await searchReddit("some query", fetchFn);
    expect(result.posts.every((p) => p.score >= 2)).toBe(true);
    expect(result.posts.some((p) => p.title === "Low score")).toBe(false);
  });

  test("caps results at 5 posts", async () => {
    const posts = Array.from({ length: 10 }, (_, i) =>
      makePost({ subreddit: "programming", title: `Post ${i}`, score: 10 })
    );
    const fetchFn = makeFetch(makeRedditResponse(posts));
    const result = await searchReddit("query", fetchFn);
    expect(result.posts.length).toBeLessThanOrEqual(5);
  });

  test("constructs full reddit permalink URL", async () => {
    const fetchFn = makeFetch(
      makeRedditResponse([
        makePost({
          subreddit: "python",
          permalink: "/r/python/comments/xyz/my_post"
        })
      ])
    );
    const result = await searchReddit("python decorators", fetchFn);
    expect(result.posts[0].permalink).toBe(
      "https://www.reddit.com/r/python/comments/xyz/my_post"
    );
  });

  test("strips HTML and markdown from title", async () => {
    const fetchFn = makeFetch(
      makeRedditResponse([
        makePost({
          subreddit: "programming",
          title: "**Bold title** with [link](https://example.com)",
          score: 10
        })
      ])
    );
    const result = await searchReddit("query", fetchFn);
    expect(result.posts[0].title).toBe("Bold title with link");
  });

  test("sanitizes deleted and removed selftext", async () => {
    const fetchFn = makeFetch(
      makeRedditResponse([
        makePost({ subreddit: "programming", selftext: "[deleted]", score: 10 }),
        makePost({ subreddit: "programming", selftext: "[removed]", score: 10 })
      ])
    );
    const result = await searchReddit("query", fetchFn);
    expect(result.posts[0].excerpt).toBe("");
    expect(result.posts[1].excerpt).toBe("");
  });

  test("strips Edit: and Update: footnotes from selftext", async () => {
    const fetchFn = makeFetch(
      makeRedditResponse([
        makePost({
          subreddit: "programming",
          selftext: "This is the real content. Edit: never mind, ignore this.",
          score: 10
        })
      ])
    );
    const result = await searchReddit("query", fetchFn);
    expect(result.posts[0].excerpt).not.toContain("Edit:");
    expect(result.posts[0].excerpt).toContain("real content");
  });

  test("chunks output with Reddit chunk N/M prefix", async () => {
    const longText = "a".repeat(3000);
    const fetchFn = makeFetch(
      makeRedditResponse([
        makePost({ subreddit: "programming", selftext: longText, score: 10, title: "Long post" })
      ])
    );
    const result = await searchReddit("long content", fetchFn);
    expect(result.chunks.length).toBeGreaterThan(1);
    expect(result.chunks[0]).toMatch(/^Reddit chunk 1\/\d+/);
  });

  test("includes durationMs in result", async () => {
    const fetchFn = makeFetch(makeRedditResponse([]));
    const result = await searchReddit("query", fetchFn);
    expect(typeof result.durationMs).toBe("number");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  test("echoes query back in result", async () => {
    const fetchFn = makeFetch(makeRedditResponse([]));
    const result = await searchReddit("  my query  ", fetchFn);
    expect(result.query).toBe("my query");
  });

  test("includes subreddit name and score in chunk text", async () => {
    const fetchFn = makeFetch(
      makeRedditResponse([
        makePost({ subreddit: "LocalLLaMA", title: "Ollama on Apple Silicon", score: 88 })
      ])
    );
    const result = await searchReddit("ollama apple", fetchFn);
    const combined = result.chunks.join("\n");
    expect(combined).toContain("LocalLLaMA");
    expect(combined).toContain("Ollama on Apple Silicon");
    expect(combined).toContain("88");
  });

  test("handles missing selftext gracefully", async () => {
    const post = {
      data: {
        subreddit: "programming",
        title: "No text post",
        url: "https://example.com",
        permalink: "/r/programming/comments/abc/no_text",
        score: 10,
        num_comments: 3
        // selftext intentionally absent
      }
    };
    const fetchFn = makeFetch({ data: { children: [post] } });
    const result = await searchReddit("query", fetchFn);
    expect(result.posts).toHaveLength(1);
    expect(result.posts[0].excerpt).toBe("");
  });
});
