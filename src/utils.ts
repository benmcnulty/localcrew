import type { SharedConversationState } from "./types.ts";

/**
 * Convert a hyphenated/underscored/spaced string into Title Case words.
 * "hello-world" → "Hello World"
 */
export function titleCase(value: string): string {
  if (!value) {
    return value;
  }

  return value
    .split(/[-_\s]+/)
    .filter((segment) => segment !== "")
    .map((segment) => segment.slice(0, 1).toUpperCase() + segment.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Capitalize only the first letter of the string (single-word case).
 * "hello" → "Hello"
 */
export function capitalize(value: string): string {
  if (!value) {
    return value;
  }

  return value.slice(0, 1).toUpperCase() + value.slice(1).toLowerCase();
}

/**
 * Normalize an alias string: trim, strip leading '@', lowercase.
 */
export function normalizeAlias(alias: string): string {
  return alias.trim().replace(/^@/, "").toLowerCase();
}

/**
 * Strip a trailing '/' from a URL string.
 */
export function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

/**
 * Create an empty shared conversation state object.
 */
export function getEmptyConversation(): SharedConversationState {
  return {
    messages: [],
    compactedUntil: 0,
    summary: ""
  };
}

/**
 * Anthropic API version used for all Anthropic-style requests.
 */
export const ANTHROPIC_VERSION = "2023-06-01";

/**
 * Rough token estimate for English text.
 * Uses 1 token ≈ 4 characters, which is a conservative approximation
 * that works across most LLM tokenizers for English prose.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Budget a set of named context blocks to fit within a token ceiling.
 * Blocks are provided in priority order (highest first). Each block is
 * truncated or dropped as needed to stay within the budget. Returns
 * the trimmed blocks in the same order with a summary of what was cut.
 */
export function budgetContextBlocks(
  blocks: Array<{ label: string; content: string; minChars?: number }>,
  maxTokens: number
): { blocks: Array<{ label: string; content: string }>; dropped: string[] } {
  const maxChars = maxTokens * 4;
  // Reserve ~20% for the user prompt and model response
  const usableChars = Math.floor(maxChars * 0.8);

  let remaining = usableChars;
  const result: Array<{ label: string; content: string }> = [];
  const dropped: string[] = [];

  for (const block of blocks) {
    if (remaining <= 0) {
      dropped.push(block.label);
      continue;
    }

    const minChars = block.minChars ?? 200;
    if (block.content.length <= remaining) {
      result.push({ label: block.label, content: block.content });
      remaining -= block.content.length;
    } else if (remaining >= minChars) {
      // Truncate to fit: find a clean break point.
      const truncated = block.content.slice(0, remaining);
      const lastNewline = truncated.lastIndexOf("\n");
      const clean =
        lastNewline > remaining * 0.5 ? truncated.slice(0, lastNewline) : truncated;
      result.push({
        label: block.label,
        content: clean + `\n\n[...${block.label} truncated to fit context budget]`
      });
      remaining = 0;
    } else {
      dropped.push(block.label);
    }
  }

  return { blocks: result, dropped };
}

/**
 * Safely extract an error message from an unknown thrown value.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Format a Date as a compact, human-readable datetime string for injection into
 * model prompts. Includes the ISO date, day of week, UTC time, and local offset
 * so agents can accurately record timestamps and reason about elapsed time.
 *
 * Example: "2026-03-02 (Monday) 15:42 UTC (UTC+0)"
 */
export function formatCurrentDateTime(date = new Date()): string {
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = dayNames[date.getUTCDay()];
  const iso = date.toISOString();
  const datePart = iso.slice(0, 10);
  const timePart = iso.slice(11, 16);

  // Derive local offset from the JS environment
  const offsetMinutes = -date.getTimezoneOffset();
  const offsetSign = offsetMinutes >= 0 ? "+" : "-";
  const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60)
    .toString()
    .padStart(2, "0");
  const offsetMins = (Math.abs(offsetMinutes) % 60).toString().padStart(2, "0");
  const offsetLabel = offsetMinutes === 0 ? "UTC" : `UTC${offsetSign}${offsetHours}:${offsetMins}`;

  return `${datePart} (${dayName}) ${timePart} UTC (${offsetLabel})`;
}

/**
 * Detect whether an error message indicates a network-level failure
 * (connection refused, timeout, DNS, etc.) as opposed to an HTTP or model error.
 */
export function isNetworkError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("fetch failed") ||
    normalized.includes("econnrefused") ||
    normalized.includes("econnreset") ||
    normalized.includes("etimedout") ||
    normalized.includes("enetunreach") ||
    normalized.includes("timeout") ||
    normalized.includes("timed out") ||
    normalized.includes("abort") ||
    normalized.includes("dns") ||
    normalized.includes("ehostunreach")
  );
}
