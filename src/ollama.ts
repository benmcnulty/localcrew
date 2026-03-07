import { getEnvNumber } from "./env.ts";
import type { ChatMessage, EndpointConfig, OllamaChatResult } from "./types.ts";
import { ANTHROPIC_VERSION, trimTrailingSlash } from "./utils.ts";

export type FetchFn = typeof fetch;

const MAX_INFERENCE_RETRIES = 2;
/** Default retry delay. Override with LOCALCREW_INFERENCE_RETRY_DELAY_MS for testing. */
function getInferenceRetryDelayMs(): number {
  return getEnvNumber("LOCALCREW_INFERENCE_RETRY_DELAY_MS", 1500);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns true if the error is a transient network/server failure that is
 * safe to retry. Never retries user-initiated cancellations.
 */
function isTransientFetchError(error: unknown, userSignal?: AbortSignal): boolean {
  if (!(error instanceof Error)) return false;
  // User explicitly aborted — do not retry.
  if (error.name === "AbortError" && userSignal?.aborted) return false;
  // Timeout AbortError (not user-initiated) — safe to retry.
  if (error.name === "AbortError") return true;
  // Network errors: ECONNREFUSED, fetch failed, DNS failures, etc.
  if (error.name === "TypeError") return true;
  // HTTP 5xx server errors.
  if (/^HTTP 5\d\d/.test(error.message)) return true;
  return false;
}

/**
 * Default timeout for inference fetch calls (milliseconds).
 * Override with LOCALCREW_FETCH_TIMEOUT_MS env var.
 * 0 disables the timeout entirely.
 */
export function getFetchTimeoutMs(): number {
  return getEnvNumber("LOCALCREW_FETCH_TIMEOUT_MS", 180_000);
}

function makeFetchSignal(overrideMs?: number, externalSignal?: AbortSignal): AbortSignal | undefined {
  const timeoutMs = overrideMs ?? getFetchTimeoutMs();
  const timeoutSignal = timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined;
  if (timeoutSignal && externalSignal) return AbortSignal.any([timeoutSignal, externalSignal]);
  return timeoutSignal ?? externalSignal;
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
  fetchFn: FetchFn = fetch,
  timeoutMs?: number,
  abortSignal?: AbortSignal
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

  let lastError: Error = new Error("Inference failed");
  for (let attempt = 0; attempt <= MAX_INFERENCE_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(getInferenceRetryDelayMs());
      console.warn(`[LocalCrew] Retrying inference (attempt ${attempt}/${MAX_INFERENCE_RETRIES}, model=${endpoint.model})…`);
    }
    try {

  if (endpoint.apiStyle === "openai") {
    const response = await fetchFn(`${trimTrailingSlash(endpoint.baseUrl)}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: endpoint.model,
        messages,
        stream: false
      }),
      signal: makeFetchSignal(timeoutMs, abortSignal)
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
      signal: makeFetchSignal(timeoutMs, abortSignal)
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

  // Estimate prompt tokens and request a context window large enough to hold
  // the full prompt plus a generous response buffer.  Ollama defaults to
  // num_ctx=2048 which silently truncates large prompts and returns empty
  // responses, so we always send an explicit value.
  const promptChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  const estimatedPromptTokens = Math.ceil(promptChars / 3);
  const numCtx = Math.max(4096, estimatedPromptTokens + 2048);

  const response = await fetchFn(`${trimTrailingSlash(endpoint.baseUrl)}/api/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: endpoint.model,
      messages,
      stream: false,
      options: { num_ctx: numCtx }
    }),
    signal: makeFetchSignal(timeoutMs, abortSignal)
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
    done_reason?: unknown;
  };

  if (typeof body.message?.content !== "string" || body.message.content.trim() === "") {
    const evalInfo = `eval_count=${body.eval_count ?? "?"} done_reason=${body.done_reason ?? "?"}`;
    throw new Error(
      `Ollama response was missing message.content (model=${endpoint.model} num_ctx=${numCtx} promptChars=${promptChars} ${evalInfo})`
    );
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
    } catch (error) {
      lastError = error as Error;
      if (!isTransientFetchError(error, abortSignal)) throw error;
    }
  }
  throw lastError;
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
