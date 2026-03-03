import type { FetchFn } from "./ollama.ts";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_CHAR_LIMIT = 8_000;
const USER_AGENT = "localcrew-local-orchestrator";

/**
 * Strip HTML to plain text: remove script/style/noscript blocks, then all tags,
 * decode common entities, and collapse whitespace.
 */
export function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Split text into chunks of at most `limit` characters, breaking on newlines
 * or spaces when possible. Shared chunking algorithm (also in wikipedia.ts
 * and reddit.ts — kept duplicated there for now to avoid breaking existing tests).
 */
export function chunkText(text: string, limit: number): string[] {
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

export interface PageFetchResult {
  url: string;
  text: string;
  durationMs: number;
}

/**
 * Fetch a URL and return its content as plain text.
 * Uses `stripHtmlToText` for HTML responses and caps output at `charLimit`.
 */
export async function fetchPageText(
  url: string,
  fetchFn: FetchFn = fetch,
  timeout = DEFAULT_TIMEOUT_MS,
  charLimit = DEFAULT_CHAR_LIMIT
): Promise<PageFetchResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetchFn(url, {
      headers: { "user-agent": USER_AGENT },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching ${url}`);
    }

    const raw = await response.text();
    const contentType = response.headers.get("content-type") ?? "";
    const isHtml = contentType.includes("html") || raw.trimStart().startsWith("<");
    const text = isHtml ? stripHtmlToText(raw) : raw;

    return {
      url,
      text: text.slice(0, charLimit),
      durationMs: Date.now() - started
    };
  } finally {
    clearTimeout(timer);
  }
}
