/**
 * Optimization Digest — deterministic utilities for inter-orchestrator
 * learning discovery and novelty filtering.
 *
 * All functions are pure and deterministic (no inference calls). The adoption
 * decision — whether to act on an external learning — is handled by the model
 * during the Reflect phase. These functions only parse, filter, and format.
 *
 * Learning format convention:
 *   [LEARNING] Title: <short title>
 *   Action: <what to do>
 *   Context: <why this works>
 *   Confidence: HIGH|MEDIUM
 */

export interface SharedLearning {
  title: string;
  action: string;
  context: string;
  confidence: "HIGH" | "MEDIUM";
  sourceOrchestrator?: string;
  sourceLogId?: string;
}

/**
 * Parse [LEARNING] formatted entries from Port feed text.
 * Handles entries separated by blank lines or new [LEARNING] markers.
 */
export function parseSharedLearnings(feedText: string): SharedLearning[] {
  if (!feedText || !feedText.trim()) return [];

  const learnings: SharedLearning[] = [];

  // Split on [LEARNING] markers (case-insensitive)
  const segments = feedText.split(/\[LEARNING\]/i).slice(1);

  for (const segment of segments) {
    const titleMatch = segment.match(/Title:\s*(.+)/i);
    const actionMatch = segment.match(/Action:\s*(.+)/i);
    const contextMatch = segment.match(/Context:\s*(.+)/i);
    const confidenceMatch = segment.match(/Confidence:\s*(HIGH|MEDIUM)/i);

    if (!titleMatch || !actionMatch) continue;

    if (!confidenceMatch) continue; // Require explicit confidence declaration
    const rawConfidence = confidenceMatch[1].toUpperCase();
    if (rawConfidence !== "HIGH" && rawConfidence !== "MEDIUM") continue;
    const confidence = rawConfidence as "HIGH" | "MEDIUM";

    learnings.push({
      title: titleMatch[1].trim(),
      action: actionMatch[1].trim(),
      context: contextMatch?.[1]?.trim() ?? "",
      confidence,
    });
  }

  return learnings;
}

/**
 * Compare incoming learnings against local learnings.md text to identify novel entries.
 * Uses title-based keyword overlap for deduplication (deterministic — no inference).
 */
export function identifyNovelLearnings(
  incoming: SharedLearning[],
  localLearningsText: string
): SharedLearning[] {
  if (!incoming.length) return [];

  const localLower = localLearningsText.toLowerCase();

  return incoming.filter((learning) => {
    // Extract significant words from title (skip common stop words)
    const stopWords = new Set(["a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by"]);
    const titleWords = learning.title
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length >= 4 && !stopWords.has(w));

    if (titleWords.length === 0) return true; // Can't determine — assume novel

    // A learning is novel if fewer than 2/3 of its significant title words appear in local learnings
    const matchCount = titleWords.filter((w) => localLower.includes(w)).length;
    return matchCount < Math.ceil(titleWords.length * 2 / 3);
  });
}

/**
 * Format novel learnings for injection into the Reflect phase context block.
 */
export function formatLearningsForReflect(learnings: SharedLearning[]): string {
  if (!learnings.length) return "";

  const lines: string[] = [
    "Port network learnings (evaluate for local relevance — adoption is your decision):",
    "",
  ];

  for (const learning of learnings) {
    lines.push(`[LEARNING] Title: ${learning.title}`);
    lines.push(`Action: ${learning.action}`);
    if (learning.context) lines.push(`Context: ${learning.context}`);
    lines.push(`Confidence: ${learning.confidence}`);
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
