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
 * Safely extract an error message from an unknown thrown value.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
