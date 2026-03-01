import type { ChatMessage, EndpointConfig, OllamaChatResult } from "./types.ts";

export type FetchFn = typeof fetch;

export interface EndpointModelEntry {
  name: string;
  parameterSize?: string;
  quantizationLevel?: string;
}

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
  const headers: Record<string, string> = {
    "content-type": "application/json"
  };
  if (endpoint.apiKeyEnv && process.env[endpoint.apiKeyEnv]?.trim()) {
    headers.authorization = `Bearer ${process.env[endpoint.apiKeyEnv]!.trim()}`;
  }

  if (endpoint.apiStyle === "openai") {
    const response = await fetchFn(`${trimTrailingSlash(endpoint.baseUrl)}/v1/chat/completions`, {
      method: "POST",
      headers,
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
      choices?: Array<{
        message?: {
          content?: unknown;
        };
      }>;
      usage?: {
        prompt_tokens?: unknown;
        completion_tokens?: unknown;
      };
    };
    const content = body.choices?.[0]?.message?.content;

    if (typeof content !== "string" || content.trim() === "") {
      throw new Error("OpenAI-compatible response was missing choices[0].message.content.");
    }

    return {
      text: content.trim(),
      ...(typeof body.usage?.prompt_tokens === "number"
        ? { promptEvalCount: body.usage.prompt_tokens }
        : {}),
      ...(typeof body.usage?.completion_tokens === "number"
        ? { evalCount: body.usage.completion_tokens }
        : {})
    };
  }

  const response = await fetchFn(`${trimTrailingSlash(endpoint.baseUrl)}/api/chat`, {
    method: "POST",
    headers,
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

export async function listOllamaModels(
  baseUrl: string,
  fetchFn: FetchFn = fetch,
  apiStyle: EndpointConfig["apiStyle"] = "ollama",
  apiKeyEnv?: string
): Promise<EndpointModelEntry[]> {
  const headers =
    apiKeyEnv && process.env[apiKeyEnv]?.trim()
      ? { authorization: `Bearer ${process.env[apiKeyEnv]!.trim()}` }
      : undefined;

  if (apiStyle === "openai") {
    const response = await fetchFn(`${trimTrailingSlash(baseUrl)}/v1/models`, {
      headers
    });

    if (!response.ok) {
      const bodyText = await response.text();
      throw new Error(formatHttpError(response.status, bodyText));
    }

    const body = (await response.json()) as {
      data?: Array<{ id?: unknown }>;
    };

    return Array.isArray(body.data)
      ? body.data
          .map((model) => ({
            name: typeof model.id === "string" ? model.id.trim() : ""
          }))
          .filter((model) => model.name !== "")
      : [];
  }

  const response = await fetchFn(`${trimTrailingSlash(baseUrl)}/api/tags`, { headers });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(formatHttpError(response.status, bodyText));
  }

  const body = (await response.json()) as {
    models?: Array<{
      name?: unknown;
      details?: {
        parameter_size?: unknown;
        quantization_level?: unknown;
      };
    }>;
  };

  return Array.isArray(body.models)
    ? body.models
        .filter((model): model is NonNullable<typeof model> => Boolean(model))
        .map((model) => ({
          name: typeof model.name === "string" ? model.name.trim() : "",
          ...(typeof model.details?.parameter_size === "string"
            ? { parameterSize: model.details.parameter_size }
            : {}),
          ...(typeof model.details?.quantization_level === "string"
            ? { quantizationLevel: model.details.quantization_level }
            : {})
        }))
        .filter((model) => model.name !== "")
    : [];
}
