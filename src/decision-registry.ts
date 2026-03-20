/**
 * Decision Registry — catalogs all system decision points with their classification.
 *
 * Every decision in Local Crew is either:
 * - Deterministic: answerable from available data without inference (config lookups,
 *   threshold comparisons, keyword matching, timestamp checks, tier scoring).
 * - Inference: requires model reasoning about meaning, relevance, or creative synthesis.
 *
 * Rule: always prefer deterministic solutions. Use inference only when the answer
 * genuinely requires reasoning about meaning or novelty.
 *
 * When adding new decision logic, classify it and add an entry here.
 */

export type DecisionType = "deterministic" | "inference";

export interface DecisionPoint {
  name: string;
  type: DecisionType;
  module: string;
  description: string;
}

export const DECISION_POINTS: readonly DecisionPoint[] = [
  // ── Deterministic ──────────────────────────────────────────────────────────
  {
    name: "tool-authorization",
    type: "deterministic",
    module: "app.ts",
    description: "Check tool is authorized via config lookup",
  },
  {
    name: "resource-routing",
    type: "deterministic",
    module: "resources.ts",
    description: "Tier-based resource score computation",
  },
  {
    name: "context-budget",
    type: "deterministic",
    module: "app.ts",
    description: "Token count vs context window ceiling",
  },
  {
    name: "weather-gating",
    type: "deterministic",
    module: "app.ts",
    description: "Weather tool availability from preferences",
  },
  {
    name: "feed-polling",
    type: "deterministic",
    module: "portal.ts",
    description: "HTTP fetch of public feed",
  },
  {
    name: "duplicate-detection",
    type: "deterministic",
    module: "quality.ts",
    description: "Keyword overlap threshold",
  },
  {
    name: "learning-novelty-filter",
    type: "deterministic",
    module: "optimization-digest.ts",
    description: "Diff incoming vs local learnings",
  },
  {
    name: "session-expiry",
    type: "deterministic",
    module: "portal.ts",
    description: "Timestamp comparison",
  },
  {
    name: "code-agent-rate-limit",
    type: "deterministic",
    module: "app.ts",
    description: "Counter check: max 3 TO_CODE invocations per auto session",
  },
  {
    name: "working-dir-constraint",
    type: "deterministic",
    module: "app.ts",
    description: "Reject TO_CODE requests targeting directories outside configured workingDir",
  },
  // ── Inference ───────────────────────────────────────────────────────────────
  {
    name: "task-generation",
    type: "inference",
    module: "messages.ts",
    description: "Generate queue-fill tasks",
  },
  {
    name: "quality-verification",
    type: "inference",
    module: "quality.ts",
    description: "Assess output relevance and substance",
  },
  {
    name: "learning-adoption",
    type: "inference",
    module: "app.ts",
    description: "Evaluate external learning local applicability",
  },
  {
    name: "reflection",
    type: "inference",
    module: "app.ts",
    description: "Structured introspection during Reflect phase",
  },
  {
    name: "preflight-analysis",
    type: "inference",
    module: "messages.ts",
    description: "Task risk/constraint assessment",
  },
  {
    name: "optimization-publish",
    type: "inference",
    module: "app.ts",
    description: "Decide what findings to share via Port",
  },
] as const;

/** Return all decision points of the given type. */
export function getDecisionsByType(type: DecisionType): DecisionPoint[] {
  return DECISION_POINTS.filter((d) => d.type === type);
}
