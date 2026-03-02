import type { FetchFn } from "./ollama.ts";
import { fetchPageText, chunkText } from "./page-fetcher.ts";
import type { WebsiteFetchResult } from "./types.ts";

const DEFAULT_CHAR_LIMIT = 6_000;

/**
 * Fetch content from the user's configured personal website.
 * `baseUrl` must be provided by the caller from user preferences.
 * If `topicOrPath` starts with `/`, it is appended as a path; otherwise
 * it is used as a search-style topic appended to the base URL.
 */
export async function fetchWebsite(
  baseUrl: string,
  topicOrPath: string,
  fetchFn: FetchFn = fetch,
  charLimit = DEFAULT_CHAR_LIMIT
): Promise<WebsiteFetchResult> {
  const trimmedBase = baseUrl.replace(/\/+$/, "");
  const trimmed = topicOrPath.trim();
  if (!trimmed) {
    throw new Error("Website topic or path cannot be empty.");
  }
  if (!trimmedBase) {
    throw new Error("Personal website URL is not configured. Use /preferences set personalWebsiteUrl <url>");
  }

  const path = trimmed.startsWith("/") ? trimmed : `/${encodeURIComponent(trimmed)}`;
  const url = `${trimmedBase}${path}`;

  const started = Date.now();
  const page = await fetchPageText(url, fetchFn, 10_000, charLimit);
  const durationMs = Date.now() - started;

  const chunks = chunkText(page.text, 1400).map(
    (chunk, index, all) => `Website chunk ${index + 1}/${all.length}\n${chunk}`
  );

  return {
    url,
    path,
    durationMs,
    text: page.text,
    chunks,
  };
}
