import type { ChatMessage, EndpointConfig, OllamaChatResult } from "./types.ts";

export type FetchFn = typeof fetch;

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function formatHttpError(status: number, bodyText: string): string {
  const trimmedBody = bodyText.trim();
  return trimmedBody ? `HTTP ${status}: ${trimmedBody}` : `HTTP ${status}`;
}

export async function chatWithOllamaDetailed(
  endpoint: EndpointConfig,
  messages: ChatMessage[],
  fetchFn: FetchFn = fetch
): Promise<OllamaChatResult> {
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
    total_duration?: unknown;
    load_duration?: unknown;
    prompt_eval_count?: unknown;
    prompt_eval_duration?: unknown;
    eval_count?: unknown;
    eval_duration?: unknown;
  };

  if (typeof body.message?.content !== "string" || body.message.content.trim() === "") {
    throw new Error("Ollama response was missing message.content.");
  }

  return {
    text: body.message.content.trim(),
    ...(typeof body.total_duration === "number" ? { totalDuration: body.total_duration } : {}),
    ...(typeof body.load_duration === "number" ? { loadDuration: body.load_duration } : {}),
    ...(typeof body.prompt_eval_count === "number"
      ? { promptEvalCount: body.prompt_eval_count }
      : {}),
    ...(typeof body.prompt_eval_duration === "number"
      ? { promptEvalDuration: body.prompt_eval_duration }
      : {}),
    ...(typeof body.eval_count === "number" ? { evalCount: body.eval_count } : {}),
    ...(typeof body.eval_duration === "number" ? { evalDuration: body.eval_duration } : {})
  };
}

export async function chatWithOllama(
  endpoint: EndpointConfig,
  messages: ChatMessage[],
  fetchFn: FetchFn = fetch
): Promise<string> {
  const result = await chatWithOllamaDetailed(endpoint, messages, fetchFn);
  return result.text;
}
