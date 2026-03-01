import type { FetchFn } from "./ollama.ts";
import type { WikipediaSearchPage, WikipediaSearchResult } from "./types.ts";

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
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

function formatChunks(query: string, pages: WikipediaSearchPage[]): string[] {
  const block = [
    `Wikipedia search results for "${query}":`,
    "",
    ...pages.flatMap((page, index) => [
      `${index + 1}. ${page.title}`,
      `URL: ${page.url}`,
      page.excerpt || "(No plain-text excerpt available.)",
      ""
    ])
  ]
    .join("\n")
    .trim();

  return chunkText(block, 1400).map(
    (chunk, index, chunks) => `Wikipedia chunk ${index + 1}/${chunks.length}\n${chunk}`
  );
}

export async function searchWikipedia(
  query: string,
  fetchFn: FetchFn = fetch
): Promise<WikipediaSearchResult> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    throw new Error("Wikipedia search query cannot be empty.");
  }

  const started = Date.now();
  const searchUrl = new URL("https://en.wikipedia.org/w/api.php");
  searchUrl.searchParams.set("action", "query");
  searchUrl.searchParams.set("list", "search");
  searchUrl.searchParams.set("utf8", "1");
  searchUrl.searchParams.set("format", "json");
  searchUrl.searchParams.set("srlimit", "3");
  searchUrl.searchParams.set("srsearch", trimmedQuery);

  const searchResponse = await fetchFn(searchUrl.toString(), {
    headers: {
      "user-agent": "crusty-local-orchestrator"
    }
  });

  if (!searchResponse.ok) {
    throw new Error(`Wikipedia search failed with HTTP ${searchResponse.status}.`);
  }

  const searchBody = (await searchResponse.json()) as {
    query?: { search?: Array<{ pageid: number; title: string; snippet: string }> };
  };
  const searchResults = searchBody.query?.search ?? [];

  if (searchResults.length === 0) {
    return {
      query: trimmedQuery,
      durationMs: Date.now() - started,
      pages: [],
      chunks: [`Wikipedia search results for "${trimmedQuery}":\n\nNo matching pages found.`]
    };
  }

  const detailUrl = new URL("https://en.wikipedia.org/w/api.php");
  detailUrl.searchParams.set("action", "query");
  detailUrl.searchParams.set("format", "json");
  detailUrl.searchParams.set("prop", "extracts|info");
  detailUrl.searchParams.set("inprop", "url");
  detailUrl.searchParams.set("explaintext", "1");
  detailUrl.searchParams.set("exintro", "1");
  detailUrl.searchParams.set(
    "pageids",
    searchResults.map((result) => String(result.pageid)).join("|")
  );

  const detailResponse = await fetchFn(detailUrl.toString(), {
    headers: {
      "user-agent": "crusty-local-orchestrator"
    }
  });

  if (!detailResponse.ok) {
    throw new Error(`Wikipedia detail fetch failed with HTTP ${detailResponse.status}.`);
  }

  const detailBody = (await detailResponse.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          pageid: number;
          title: string;
          extract?: string;
          fullurl?: string;
        }
      >;
    };
  };

  const details = detailBody.query?.pages ?? {};
  const pages: WikipediaSearchPage[] = searchResults.map((result) => {
    const page = details[String(result.pageid)];
    return {
      pageId: result.pageid,
      title: page?.title ?? result.title,
      url: page?.fullurl ?? `https://en.wikipedia.org/?curid=${result.pageid}`,
      excerpt: stripHtml(page?.extract ?? result.snippet)
    };
  });

  return {
    query: trimmedQuery,
    durationMs: Date.now() - started,
    pages,
    chunks: formatChunks(trimmedQuery, pages)
  };
}
