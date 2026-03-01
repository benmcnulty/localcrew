import type { ChatMessage, EndpointConfig } from "./types.ts";

export type FetchFn = typeof fetch;

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function formatHttpError(status: number, bodyText: string): string {
  const trimmedBody = bodyText.trim();
  return trimmedBody ? `HTTP ${status}: ${trimmedBody}` : `HTTP ${status}`;
}

export async function chatWithOllama(
  endpoint: EndpointConfig,
  messages: ChatMessage[],
  fetchFn: FetchFn = fetch
): Promise<string> {
  const response = await fetchFn(`${trimTrailingSlash(endpoint.baseUrl)}/api/chat`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: endpoint.model,
      messages,
      stream: false
    })
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(formatHttpError(response.status, bodyText));
  }

  const body = (await response.json()) as {
    message?: { content?: unknown };
  };

  if (typeof body.message?.content !== "string" || body.message.content.trim() === "") {
    throw new Error("Ollama response was missing message.content.");
  }

  return body.message.content.trim();
}
