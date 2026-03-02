import { search, SafeSearchType } from "duck-duck-scrape";

import type { FetchFn } from "./ollama.ts";
import { chunkText } from "./page-fetcher.ts";
import type { WebSearchResult, WebSearchResultEntry } from "./types.ts";

const ALLOWED_SEARCH_TOPICS = new Set([
  "news",
  "jobs",
  "software-engineering",
  "ai-engineering"
]);

const MAX_RESULTS = 5;

export function isAllowedSearchTopic(topic: string): boolean {
  return ALLOWED_SEARCH_TOPICS.has(topic.toLowerCase().trim());
}

export function getAllowedTopics(): string[] {
  return [...ALLOWED_SEARCH_TOPICS];
}

function formatResultChunks(query: string, topic: string, entries: WebSearchResultEntry[]): string[] {
  const block = [
    `Web search results for "${query}" (topic: ${topic}):`,
    "",
    ...entries.flatMap((entry, index) => [
      `${index + 1}. ${entry.title}`,
      `   URL: ${entry.url}`,
      `   ${entry.snippet}`,
      ""
    ])
  ]
    .join("\n")
    .trim();

  return chunkText(block, 1400).map(
    (chunk, index, chunks) => `Web search chunk ${index + 1}/${chunks.length}\n${chunk}`
  );
}

export async function searchWeb(
  query: string,
  topic: string,
  _fetchFn?: FetchFn
): Promise<WebSearchResult> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    throw new Error("Web search query cannot be empty.");
  }

  if (!isAllowedSearchTopic(topic)) {
    throw new Error(
      `Topic "${topic}" is not allowed. Allowed topics: ${getAllowedTopics().join(", ")}`
    );
  }

  const started = Date.now();

  const searchResults = await search(trimmedQuery, {
    safeSearch: SafeSearchType.STRICT
  });

  const entries: WebSearchResultEntry[] = (searchResults.results ?? [])
    .slice(0, MAX_RESULTS)
    .map((result) => ({
      title: result.title ?? "(no title)",
      url: result.url ?? "",
      snippet: result.description ?? ""
    }));

  const durationMs = Date.now() - started;
  const chunks = formatResultChunks(trimmedQuery, topic, entries);

  return {
    query: trimmedQuery,
    topic: topic.toLowerCase().trim(),
    durationMs,
    entries,
    chunks
  };
}
