import type { FetchFn } from "./ollama.ts";
import { chunkText, stripHtmlToText } from "./page-fetcher.ts";
import type { WebSearchResult, WebSearchResultEntry } from "./types.ts";

const ALLOWED_SEARCH_TOPICS = new Set([
  "news",
  "jobs",
  "software-engineering",
  "ai-engineering"
]);

const MAX_RESULTS = 5;
const SEARCH_CHAR_LIMIT = 280;
const USER_AGENT = "localcrew-local-orchestrator";

const DUCKDUCKGO_HTML_URL = "https://html.duckduckgo.com/html/";
const DUCKDUCKGO_LITE_URL = "https://lite.duckduckgo.com/lite/";

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function truncateText(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit - 1).trimEnd()}…`;
}

export function extractDuckDuckGoResultUrl(rawUrl: string): string {
  const decodedRaw = decodeHtmlEntities(rawUrl).trim();
  if (!decodedRaw) {
    return "";
  }

  const candidate = decodedRaw.startsWith("//") ? `https:${decodedRaw}` : decodedRaw;
  const absolute = candidate.startsWith("/")
    ? `https://duckduckgo.com${candidate}`
    : candidate;

  try {
    const parsed = new URL(absolute);
    const isDdgRedirect =
      parsed.hostname.includes("duckduckgo.com") &&
      (parsed.pathname === "/l/" || parsed.pathname === "/l");
    if (isDdgRedirect) {
      const redirected = parsed.searchParams.get("uddg") ?? "";
      if (!redirected) {
        return "";
      }
      return decodeURIComponent(redirected).trim();
    }

    return parsed.toString();
  } catch {
    return "";
  }
}

function extractSnippetNearAnchor(sourceHtml: string): string {
  const snippetMatch =
    sourceHtml.match(
      /<(?:a|div|td)\b[^>]*class=(['"])[^'"]*(?:result__snippet|result-snippet)[^'"]*\1[^>]*>([\s\S]*?)<\/(?:a|div|td)>/i
    ) ?? [];
  const raw = typeof snippetMatch[2] === "string" ? snippetMatch[2] : "";
  return truncateText(normalizeWhitespace(stripHtmlToText(decodeHtmlEntities(raw))), SEARCH_CHAR_LIMIT);
}

export function parseDuckDuckGoHtml(
  html: string,
  maxResults = MAX_RESULTS
): WebSearchResultEntry[] {
  if (!html.trim()) {
    return [];
  }

  const entries: WebSearchResultEntry[] = [];
  const seenUrls = new Set<string>();
  const anchorPattern =
    /<a\b([^>]*?)href=(['"])(.*?)\2([^>]*)>([\s\S]*?)<\/a>/gi;

  let match = anchorPattern.exec(html);
  while (match && entries.length < maxResults) {
    const attrs = `${match[1]} ${match[4]}`;
    const classMatch = attrs.match(/class=(['"])(.*?)\1/i);
    const className = classMatch ? classMatch[2] : "";
    const looksLikeResultLink =
      className.includes("result__a") ||
      className.includes("result-link") ||
      className.includes("result-link-url");

    if (!looksLikeResultLink) {
      match = anchorPattern.exec(html);
      continue;
    }

    const url = extractDuckDuckGoResultUrl(match[3] ?? "");
    if (!url || !/^https?:\/\//i.test(url)) {
      match = anchorPattern.exec(html);
      continue;
    }

    const title = normalizeWhitespace(stripHtmlToText(decodeHtmlEntities(match[5] ?? ""))) || "(no title)";
    const searchWindow = html.slice(match.index + match[0].length, match.index + match[0].length + 1200);
    const snippet = extractSnippetNearAnchor(searchWindow) || "(no snippet)";

    if (seenUrls.has(url)) {
      match = anchorPattern.exec(html);
      continue;
    }

    seenUrls.add(url);
    entries.push({
      title,
      url,
      snippet,
    });

    match = anchorPattern.exec(html);
  }

  return entries;
}

function buildSearchUrl(baseUrl: string, query: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set("q", query);
  url.searchParams.set("kl", "us-en");
  url.searchParams.set("kp", "1");
  return url.toString();
}

async function fetchDuckDuckGoHtml(query: string, fetchFn: FetchFn): Promise<string> {
  const headers = {
    "accept": "text/html,application/xhtml+xml",
    "user-agent": USER_AGENT,
  };

  const primary = await fetchFn(buildSearchUrl(DUCKDUCKGO_HTML_URL, query), {
    headers,
  });

  if (!primary.ok) {
    throw new Error(`DuckDuckGo search failed with HTTP ${primary.status}.`);
  }

  const primaryHtml = await primary.text();
  if (primaryHtml.trim()) {
    return primaryHtml;
  }

  const fallback = await fetchFn(buildSearchUrl(DUCKDUCKGO_LITE_URL, query), {
    headers,
  });

  if (!fallback.ok) {
    throw new Error(`DuckDuckGo fallback search failed with HTTP ${fallback.status}.`);
  }

  return fallback.text();
}

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
    ...(entries.length > 0
      ? entries.flatMap((entry, index) => [
          `${index + 1}. ${entry.title}`,
          `   URL: ${entry.url}`,
          `   ${entry.snippet}`,
          "",
        ])
      : ["No web results found."])
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
  fetchFn: FetchFn = fetch
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
  const html = await fetchDuckDuckGoHtml(trimmedQuery, fetchFn);
  const entries = parseDuckDuckGoHtml(html, MAX_RESULTS);

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
