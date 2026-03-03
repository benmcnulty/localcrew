import { getEnvNumber } from "./env.ts";
import type { ChatMessage, EndpointConfig, OllamaChatResult } from "./types.ts";
import { ANTHROPIC_VERSION, trimTrailingSlash } from "./utils.ts";

export type FetchFn = typeof fetch;

/**
 * Default timeout for inference fetch calls (milliseconds).
 * Override with LOCALCREW_FETCH_TIMEOUT_MS env var.
 * 0 disables the timeout entirely.
 */
export function getFetchTimeoutMs(): number {
  return getEnvNumber("LOCALCREW_FETCH_TIMEOUT_MS", 120_000);
}

function makeFetchSignal(): AbortSignal | undefined {
  const timeoutMs = getFetchTimeoutMs();
  if (timeoutMs <= 0) return undefined;
  return AbortSignal.timeout(timeoutMs);
}

export interface EndpointModelEntry {
  name: string;
  parameterSize?: string;
  quantizationLevel?: string;
}

function getAnthropicMaxTokens(): number {
  return getEnvNumber("LOCALCREW_ANTHROPIC_MAX_TOKENS", 2048);
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
  const apiKey = endpoint.apiKeyEnv ? process.env[endpoint.apiKeyEnv]?.trim() : undefined;
  if (apiKey) {
    if (endpoint.apiStyle === "anthropic") {
      headers["x-api-key"] = apiKey;
      headers["anthropic-version"] = ANTHROPIC_VERSION;
    } else {
      headers.authorization = `Bearer ${apiKey}`;
    }
  }

  if (endpoint.apiStyle === "openai") {
    const response = await fetchFn(`${trimTrailingSlash(endpoint.baseUrl)}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: endpoint.model,
        messages,
        stream: false
      }),
      signal: makeFetchSignal()
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

  if (endpoint.apiStyle === "anthropic") {
    const systemText = messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n");
    const anthropicMessages = messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role,
        content: message.content
      }));

    const response = await fetchFn(`${trimTrailingSlash(endpoint.baseUrl)}/v1/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: endpoint.model,
        max_tokens: getAnthropicMaxTokens(),
        ...(systemText ? { system: systemText } : {}),
        messages: anthropicMessages
      }),
      signal: makeFetchSignal()
    });

    if (!response.ok) {
      const bodyText = await response.text();
      throw new Error(formatHttpError(response.status, bodyText));
    }

    const body = (await response.json()) as {
      content?: Array<{
        type?: unknown;
        text?: unknown;
      }>;
      usage?: {
        input_tokens?: unknown;
        output_tokens?: unknown;
      };
    };
    const content = Array.isArray(body.content)
      ? body.content
          .filter(
            (item): item is { type: "text"; text: string } =>
              item?.type === "text" && typeof item.text === "string"
          )
          .map((item) => item.text.trim())
          .filter((text) => text !== "")
          .join("\n")
      : "";

    if (!content) {
      throw new Error("Anthropic response was missing content text.");
    }

    return {
      text: content,
      ...(typeof body.usage?.input_tokens === "number"
        ? { promptEvalCount: body.usage.input_tokens }
        : {}),
      ...(typeof body.usage?.output_tokens === "number"
        ? { evalCount: body.usage.output_tokens }
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
    }),
    signal: makeFetchSignal()
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
  const apiKey = apiKeyEnv ? process.env[apiKeyEnv]?.trim() : undefined;
  const headers: Record<string, string> | undefined =
    apiKey && apiStyle === "anthropic"
      ? {
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION
        }
      : apiKey
        ? { authorization: `Bearer ${apiKey}` }
        : undefined;

  if (apiStyle === "openai" || apiStyle === "anthropic") {
    const response = await fetchFn(`${trimTrailingSlash(baseUrl)}/v1/models`, {
      headers,
      signal: makeFetchSignal()
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

  const response = await fetchFn(`${trimTrailingSlash(baseUrl)}/api/tags`, { headers, signal: makeFetchSignal() });

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
