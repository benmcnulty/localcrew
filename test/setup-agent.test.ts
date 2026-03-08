import { afterEach, describe, expect, test } from "bun:test";

import {
  buildLocalEndpointCandidates,
  buildRecommendedOllamaServeCommand,
  getEndpointSetupNotes,
  getRecommendedOllamaHost,
  isPrivateIpv4Address,
} from "../scripts/setup-agent.js";

const originalOllamaHost = process.env.OLLAMA_HOST;

afterEach(() => {
  if (typeof originalOllamaHost === "string") {
    process.env.OLLAMA_HOST = originalOllamaHost;
  } else {
    delete process.env.OLLAMA_HOST;
  }
});

describe("setup-agent onboarding helpers", () => {
  test("expands ollama candidate endpoints to loopback variants", () => {
    delete process.env.OLLAMA_HOST;
    expect(buildLocalEndpointCandidates("http://0.0.0.0:11434", "ollama")).toEqual([
      "http://0.0.0.0:11434",
      "http://127.0.0.1:11434",
      "http://localhost:11434",
    ]);
  });

  test("includes OLLAMA_HOST env as a discovery candidate", () => {
    process.env.OLLAMA_HOST = "127.0.0.1:22434";
    expect(buildLocalEndpointCandidates("http://localhost:11434", "ollama")).toContain(
      "http://127.0.0.1:22434",
    );
  });

  test("builds a loopback-first Ollama host recommendation with the detected port", () => {
    expect(getRecommendedOllamaHost("http://192.168.1.50:22434")).toBe(
      "127.0.0.1:22434",
    );
  });

  test("prints platform-specific secure ollama serve commands", () => {
    expect(
      buildRecommendedOllamaServeCommand("darwin", "http://127.0.0.1:11434"),
    ).toBe("OLLAMA_HOST=127.0.0.1:11434 ollama serve");
    expect(
      buildRecommendedOllamaServeCommand("win32", "http://127.0.0.1:11434"),
    ).toBe('$env:OLLAMA_HOST="127.0.0.1:11434"; ollama serve');
  });

  test("warns when a local Ollama endpoint is LAN-bound instead of loopback-only", () => {
    const notes = getEndpointSetupNotes("http://192.168.1.55:11434", "ollama", {
      platform: "linux",
      localIp: "192.168.1.55",
    });
    expect(notes[0]).toContain("loopback-only");
    expect(notes[0]).toContain("OLLAMA_HOST=127.0.0.1:11434 ollama serve");
  });

  test("classifies private LAN ranges conservatively", () => {
    expect(isPrivateIpv4Address("10.0.0.5")).toBe(true);
    expect(isPrivateIpv4Address("172.20.1.9")).toBe(true);
    expect(isPrivateIpv4Address("192.168.1.8")).toBe(true);
    expect(isPrivateIpv4Address("8.8.8.8")).toBe(false);
  });
});
