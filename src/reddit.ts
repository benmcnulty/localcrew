import type { FetchFn } from "./ollama.ts";
import type { RedditSearchPost, RedditSearchResult } from "./types.ts";

const TECHNICAL_SUBREDDITS = new Set([
  "programming",
  "linux",
  "selfhosted",
  "homelab",
  "sysadmin",
  "devops",
  "MachineLearning",
  "LocalLLaMA",
  "ollama",
  "typescript",
  "node",
  "javascript",
  "rust",
  "python"
]);

const MIN_POST_SCORE = 2;

function stripHtmlAndMarkdown(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeRedditContent(text: string): string {
  if (!text || text === "[deleted]" || text === "[removed]") {
    return "";
  }

  const stripped = stripHtmlAndMarkdown(text);

  return stripped
    .replace(/\bEdit\s*\d*\s*:/gi, "")
    .replace(/\bUpdate\s*\d*\s*:/gi, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/(?:upvote|downvote|karma|award|gold|silver|medal)\b[^.]*\./gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function chunkText(text: string, limit: number): string[] {
  if (text.length <= limit) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > limit) {
    let splitAt = remaining.lastIndexOf("\n", limit);
    if (splitAt < limit / 2) {
      splitAt = remaining.lastIndexOf(" ", limit);
    }
    if (splitAt < limit / 2) {
      splitAt = limit;
    }
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining) {
    chunks.push(remaining);
  }
  return chunks;
}

function formatChunks(query: string, posts: RedditSearchPost[]): string[] {
  const block = [
    `Reddit search results for "${query}":`,
    "",
    ...posts.flatMap((post, index) => [
      `${index + 1}. r/${post.subreddit} — ${post.title}`,
      `URL: ${post.permalink}`,
      `Score: ${post.score} | Comments: ${post.numComments}`,
      post.excerpt || "(No text content.)",
      ""
    ])
  ]
    .join("\n")
    .trim();

  return chunkText(block, 1400).map(
    (chunk, index, chunks) => `Reddit chunk ${index + 1}/${chunks.length}\n${chunk}`
  );
}

export async function searchReddit(
  query: string,
  fetchFn: FetchFn = fetch
): Promise<RedditSearchResult> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    throw new Error("Reddit search query cannot be empty.");
  }

  const started = Date.now();
  const searchUrl = new URL("https://www.reddit.com/search.json");
  searchUrl.searchParams.set("q", trimmedQuery);
  searchUrl.searchParams.set("type", "link");
  searchUrl.searchParams.set("limit", "10");
  searchUrl.searchParams.set("sort", "relevance");
  searchUrl.searchParams.set("t", "all");

  const response = await fetchFn(searchUrl.toString(), {
    headers: {
      "user-agent": "crusty-local-orchestrator"
    }
  });

  if (!response.ok) {
    throw new Error(`Reddit search failed with HTTP ${response.status}.`);
  }

  const body = (await response.json()) as {
    data?: {
      children?: Array<{
        data: {
          subreddit: string;
          title: string;
          url: string;
          permalink: string;
          selftext?: string;
          score: number;
          num_comments: number;
        };
      }>;
    };
  };

  const children = body.data?.children ?? [];

  const posts: RedditSearchPost[] = children
    .map((child) => child.data)
    .filter(
      (post) =>
        TECHNICAL_SUBREDDITS.has(post.subreddit) &&
        post.score >= MIN_POST_SCORE
    )
    .map((post) => ({
      subreddit: post.subreddit,
      title: stripHtmlAndMarkdown(post.title),
      url: post.url,
      permalink: `https://www.reddit.com${post.permalink}`,
      excerpt: sanitizeRedditContent(post.selftext ?? ""),
      score: post.score,
      numComments: post.num_comments
    }))
    .slice(0, 5);

  if (posts.length === 0) {
    return {
      query: trimmedQuery,
      durationMs: Date.now() - started,
      posts: [],
      chunks: [`Reddit search results for "${trimmedQuery}":\n\nNo matching posts found in technical subreddits.`]
    };
  }

  return {
    query: trimmedQuery,
    durationMs: Date.now() - started,
    posts,
    chunks: formatChunks(trimmedQuery, posts)
  };
}
