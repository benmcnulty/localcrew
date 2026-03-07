import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { loadLocalEnv } from "../src/env.ts";
import { chatWithOllamaDetailed, getFetchTimeoutMs } from "../src/ollama.ts";
import type { EndpointConfig } from "../src/types.ts";
import { isNetworkError } from "../src/utils.ts";

async function withTempDir(run: (rootDir: string) => Promise<void>): Promise<void> {
  const rootDir = await mkdtemp(join(tmpdir(), "localcrew-"));

  try {
    await run(rootDir);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

describe("Anthropic env config", () => {
  test("reads max_tokens from local env files at request time", async () => {
    await withTempDir(async (rootDir) => {
      await writeFile(join(rootDir, ".env.local"), "LOCALCREW_ANTHROPIC_MAX_TOKENS=4096\n");
      loadLocalEnv(rootDir);

      let seenMaxTokens = 0;
      const endpoint: EndpointConfig = {
        resourceAlias: "claude",
        nickname: "Claude",
        baseUrl: "https://api.anthropic.test",
        apiStyle: "anthropic",
        model: "claude-test",
        instructions: "",
        voicePreset: ""
      };

      const result = await chatWithOllamaDetailed(
        endpoint,
        [
          { role: "system", content: "Be concise." },
          { role: "user", content: "Hello" }
        ],
        async (_input, init) => {
          const body = JSON.parse(String(init?.body)) as { max_tokens?: number };
          seenMaxTokens = body.max_tokens ?? 0;
          return new Response(
            JSON.stringify({
              content: [{ type: "text", text: "Hello back" }],
              usage: { input_tokens: 10, output_tokens: 5 }
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" }
            }
          );
        }
      );

      expect(seenMaxTokens).toBe(4096);
      expect(result.text).toBe("Hello back");
    });
  });
});

describe("Fetch timeout", () => {
  test("chatWithOllamaDetailed passes an AbortSignal to the fetch call", async () => {
    let receivedSignal: AbortSignal | null | undefined = null;

    const endpoint: EndpointConfig = {
      resourceAlias: "test",
      nickname: "Test",
      baseUrl: "http://localhost:1234",
      apiStyle: "ollama",
      model: "test-model",
      instructions: "",
      voicePreset: ""
    };

    await chatWithOllamaDetailed(
      endpoint,
      [{ role: "user", content: "hi" }],
      async (_input, init) => {
        receivedSignal = init?.signal;
        return new Response(
          JSON.stringify({ message: { content: "ok" } }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
    );

    expect(receivedSignal).toBeDefined();
    expect(receivedSignal).toBeInstanceOf(AbortSignal);
  });

  test("getFetchTimeoutMs returns default of 180000", () => {
    expect(getFetchTimeoutMs()).toBe(180_000);
  });
});

describe("isNetworkError", () => {
  test("detects common network failure messages", () => {
    expect(isNetworkError("fetch failed")).toBe(true);
    expect(isNetworkError("ECONNREFUSED")).toBe(true);
    expect(isNetworkError("ECONNRESET")).toBe(true);
    expect(isNetworkError("ETIMEDOUT")).toBe(true);
    expect(isNetworkError("request timed out")).toBe(true);
    expect(isNetworkError("The operation was aborted")).toBe(true);
    expect(isNetworkError("DNS resolution failed")).toBe(true);
  });

  test("does not flag HTTP errors as network errors", () => {
    expect(isNetworkError("HTTP 500: Internal Server Error")).toBe(false);
    expect(isNetworkError("HTTP 404: Not Found")).toBe(false);
    expect(isNetworkError("Ollama response was missing message.content.")).toBe(false);
  });
});
