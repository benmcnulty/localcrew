/**
 * Task quality verification functions.
 *
 * These pure functions are extracted from app.ts to enable standalone
 * testing and import without pulling in the full LocalCrewApp state.
 */

import type { AutoQueueTask } from "./types.ts";

/** Matches bare placeholder verbs that indicate a low-information task. */
export const LOW_INFORMATION_AUTONOMOUS_TASK_PATTERN =
  /^(?:implement|review|compare|evaluate|check|analyze|analysis|fix|optimize|improve|research|plan|draft|refine|update|test|verify|document|write|summarize|summarise|create|build|design|explore|investigate|audit)$/i;

/**
 * Extract the most frequent significant content terms from a text block.
 * Stop-words and short tokens are stripped. Returns up to 10 top terms.
 */
export function extractContentTerms(text: string): string[] {
  const stopWords = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "to",
    "of",
    "in",
    "on",
    "for",
    "with",
    "by",
    "from",
    "this",
    "that",
    "these",
    "those",
    "is",
    "are",
    "be",
    "as",
    "at",
    "it",
    "its",
    "into",
    "should",
    "must",
    "can",
    "will",
    "would",
    "about",
    "after",
    "before",
    "through",
    "across"
  ]);

  const counts = new Map<string, number>();
  for (const token of text.toLowerCase().match(/[a-z0-9_.-]+/g) ?? []) {
    if (token.length < 3 || stopWords.has(token)) {
      continue;
    }
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 10)
    .map(([token]) => token);
}

/**
 * Returns true when the output is substantive — at least 10 characters after
 * stripping common boilerplate openers and horizontal rules.
 */
export function isSubstantiveOutput(output: string): boolean {
  const stripped = output
    .replace(/^(sure|of course|i['']ll|let me|here['']s|certainly)[^.]*\.\s*/gi, "")
    .replace(/\n---+\n/g, "\n")
    .trim();
  return stripped.length >= 10;
}

/**
 * Returns true when the output mentions at least 30% of the significant terms
 * found in the task content.
 */
export function outputAddressesTask(output: string, taskContent: string): boolean {
  const taskTerms = extractContentTerms(taskContent);
  if (taskTerms.length === 0) {
    return true;
  }
  const normalizedOutput = output.toLowerCase();
  const found = taskTerms.filter((term) => normalizedOutput.includes(term));
  return found.length >= Math.max(1, Math.ceil(taskTerms.length * 0.3));
}

/**
 * Returns true when the output mentions at least one term from the preflight goal.
 * Always returns true when the goal is empty.
 */
export function outputAlignedWithGoal(output: string, goal: string): boolean {
  const goalTerms = extractContentTerms(goal);
  if (goalTerms.length === 0) {
    return true;
  }
  const normalizedOutput = output.toLowerCase();
  return goalTerms.some((term) => normalizedOutput.includes(term));
}

export interface QualityVerificationResult {
  passed: boolean;
  reason: string;
  signals: {
    substantive: boolean;
    addressesTask: boolean;
    artifactsVerified: boolean;
    goalAligned: boolean;
  };
}

/**
 * Verify a completed task output against quality signals.
 * Task passes when it is substantive and all claimed artifacts are verified.
 */
export function verifyTaskOutput(options: {
  task: AutoQueueTask;
  output: string;
  preflightGoal: string | null;
  claimedWriteCount: number;
  verifiedWriteCount: number;
  postProcessErrors: string[];
}): QualityVerificationResult {
  const signals = {
    substantive: isSubstantiveOutput(options.output),
    addressesTask: outputAddressesTask(options.output, options.task.content),
    artifactsVerified:
      options.postProcessErrors.length === 0 &&
      (options.claimedWriteCount === 0 || options.verifiedWriteCount >= options.claimedWriteCount),
    goalAligned: options.preflightGoal
      ? outputAlignedWithGoal(options.output, options.preflightGoal)
      : true
  };

  const passed = signals.substantive && signals.artifactsVerified;
  const reason = [
    `substantive=${signals.substantive ? "yes" : "no"}`,
    `addressesTask=${signals.addressesTask ? "yes" : "no"}`,
    `artifactsVerified=${signals.artifactsVerified ? "yes" : "no"}`,
    `goalAligned=${signals.goalAligned ? "yes" : "no"}`
  ].join(", ");

  return { passed, reason, signals };
}

/**
 * Returns true when a task has no meaningful content — either empty or a bare
 * placeholder verb with no object or outcome specified.
 */
export function isLowInformationAutonomousTask(content: string): boolean {
  const normalized = content.trim().replace(/["""]/g, "");
  if (!normalized) {
    return true;
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length >= 5) {
    return false;
  }

  if (LOW_INFORMATION_AUTONOMOUS_TASK_PATTERN.test(normalized)) {
    return true;
  }

  return words.length <= 2;
}

/**
 * Extract significant keywords from a task string for overlap comparison.
 * Strips common low-information words so comparison focuses on substantive topics.
 */
function extractTaskKeywords(content: string): Set<string> {
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "to", "for", "of", "in", "on", "is", "are", "was",
    "with", "by", "from", "at", "that", "this", "it", "be", "as", "has", "have", "had",
    "not", "but", "if", "its", "all", "into", "our", "their", "can", "will", "do", "does",
    "more", "most", "each", "every", "any", "no", "been", "would", "should", "could",
    "than", "also", "only", "how", "what", "when", "where", "which", "who", "that",
    "review", "update", "improve", "enhance", "optimize", "implement", "add", "create",
    "ensure", "check", "verify", "analyze", "generate", "build", "make", "use",
    "system", "current", "existing", "new", "based", "local", "crew",
  ]);
  const words = content.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);
  return new Set(words.filter((w) => w.length > 2 && !stopWords.has(w)));
}

/**
 * Returns true when the proposed task shares >= 60% keyword overlap with any
 * existing task — indicating likely duplication.
 */
export function isTaskDuplicate(
  proposed: string,
  existingTasks: ReadonlyArray<{ content: string }>
): boolean {
  const proposedKeywords = extractTaskKeywords(proposed);
  if (proposedKeywords.size === 0) return false;

  for (const existing of existingTasks) {
    const existingKeywords = extractTaskKeywords(existing.content);
    if (existingKeywords.size === 0) continue;
    let overlap = 0;
    for (const word of proposedKeywords) {
      if (existingKeywords.has(word)) overlap++;
    }
    const overlapRatio = overlap / proposedKeywords.size;
    if (overlapRatio >= 0.6) return true;
  }
  return false;
}
