import type { FetchFn } from "./ollama.ts";
import { fetchPageText, chunkText } from "./page-fetcher.ts";
import { fetchPublicFeed } from "./portal.ts";
import type { PortLogSection } from "./portal.ts";
import type { BenLiveResult } from "./types.ts";

const BENLIVE_BASE = "https://benlive.tv";
const DEFAULT_CHAR_LIMIT = 6_000;

/**
 * Fetch content from benlive.tv by topic or path.
 * If the input starts with `/`, it is treated as a path; otherwise it is used
 * as a search-style topic appended to the base URL.
 */
export async function fetchBenLive(
  topicOrPath: string,
  fetchFn: FetchFn = fetch,
  charLimit = DEFAULT_CHAR_LIMIT
): Promise<BenLiveResult> {
  const trimmed = topicOrPath.trim();
  if (!trimmed) {
    throw new Error("Ben Live topic or path cannot be empty.");
  }

  const path = trimmed.startsWith("/") ? trimmed : `/${encodeURIComponent(trimmed)}`;
  const url = `${BENLIVE_BASE}${path}`;

  const started = Date.now();
  const page = await fetchPageText(url, fetchFn, 10_000, charLimit);
  const durationMs = Date.now() - started;

  const chunks = chunkText(page.text, 1400).map(
    (chunk, index, all) => `Ben Live chunk ${index + 1}/${all.length}\n${chunk}`
  );

  return {
    url,
    path,
    durationMs,
    text: page.text,
    chunks,
  };
}

/**
 * Fetch recent Port feed entries as BenLive content for orchestrator grounding.
 * Routes `BENLIVE: port [section]` requests to the public feed API.
 */
export async function fetchBenLivePortFeed(
  section?: string,
  fetchFn: FetchFn = fetch,
  charLimit = DEFAULT_CHAR_LIMIT
): Promise<BenLiveResult> {
  const started = Date.now();
  const portSection = (section as PortLogSection | undefined) ?? "all";
  const url = `${BENLIVE_BASE}/port/${portSection === "all" ? "" : portSection}`.replace(/\/$/, "");

  const result = await fetchPublicFeed({ section: portSection, limit: 20 }, fetchFn);

  const text = result.logs
    .map((log) => {
      const author = log.displayName ?? log.username ?? "unknown";
      const when = log.createdAt ? new Date(log.createdAt).toISOString().slice(0, 10) : "";
      return `[${log.section}${when ? " " + when : ""}] @${author}: ${log.content}`;
    })
    .join("\n\n")
    .slice(0, charLimit);

  const chunks = chunkText(text, 1400).map(
    (chunk, index, all) => `Port feed chunk ${index + 1}/${all.length}\n${chunk}`
  );

  return {
    url,
    path: `/port/${portSection}`,
    durationMs: Date.now() - started,
    text,
    chunks,
  };
}
