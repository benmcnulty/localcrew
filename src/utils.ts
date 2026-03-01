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
