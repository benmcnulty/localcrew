# Dynamic Context and Memory Optimization Plan — 2026-03-03

## Purpose

Address marathon-observed behavior where autonomous self-improvement repeatedly restarts similar work rather than iterating on prior outputs.

This plan defines how to improve memory traversal, context bundle selection, and perspective-specific execution for shared resource pools.

## Observed Failure Pattern

- Self-improvement tasks frequently repeat themes (telemetry/routing/context budgeting) without explicit delta from previous outputs.
- Queue fill appears to prioritize idea generation over artifact evolution.
- Context appears broad but not selectively reused, causing reset-like behavior.

## Design Objectives

1. Prefer iterative enhancement over net-new restarts.
2. Select context bundles based on task purpose and agent perspective.
3. Keep context payloads minimal, relevant, and version-linked.
4. Reduce redundant tasks and thermal/resource waste.

## Core Design: Context Bundle Manager

Introduce an explicit bundle selection layer before model invocation.

### Bundle classes

- Run state bundle
  - queue state summary, recent failures, recent completions
- Artifact lineage bundle
  - latest relevant internal/outbox artifacts and their version IDs
- Perspective bundle
  - orchestrator policy directives vs agent-specific memory/spec
- Resource policy bundle
  - model profile mode, context budgets, constraints
- Novelty guard bundle
  - recent task fingerprints and suppression candidates

### Selection rules

- Each task selects only the minimal required bundles.
- Bundle selection is purpose-aware (reasoning, coding, tools, planning).
- Bundle inclusion is deterministic and logged for auditability.

## Iteration Contract for Self-Improvement Tasks

Every self-improvement task must include:

1. Prior artifact reference(s): file path + identifier.
2. Explicit delta statement: what changes vs previous version.
3. Completion proof:
  - updated artifact exists,
  - change summary generated,
  - novelty score above threshold or justified override.

If contract is missing, downgrade task or reject from queue fill.

## Anti-Redundancy Controls

### Task fingerprinting

- Build normalized fingerprints from:
  - objective text,
  - target artifact,
  - domain keywords,
  - requested operation class.

### Suppression policy

- If a near-duplicate appears within a rolling window:
  - suppress,
  - merge into existing task, or
  - force explicit delta requirement.

### Escalation

- Repeated duplicates beyond threshold trigger safe-mode context reset and operator notice.

## Perspective-Aware Resource Pooling

When multiple agents share common inference resources:

- Keep shared global constraints central (model policy, context limits, safety policy).
- Keep perspective context isolated (agent memory/spec) unless explicitly shared.
- Cache perspective bundles separately to avoid cross-contamination and unnecessary token load.

## Implementation Workstreams

### W1 (P0): Iteration and novelty gating

- Add task fingerprinting and duplicate suppression.
- Require prior-artifact and delta metadata for self-improvement tasks.

### W2 (P0): Bundle selection framework

- Introduce deterministic bundle picker with purpose + perspective inputs.
- Log selected bundles per task for debugging.

### W3 (P1): Artifact lineage integration

- Add lightweight lineage index for internal/outbox artifacts.
- Prefer latest canonical artifact in prompt assembly.

### W4 (P1): Context budget optimization

- Apply per-bundle token budgets with hard caps.
- Evict low-value bundle components first.

### W5 (P2): Adaptive policy tuning

- Tune novelty thresholds and suppression windows using telemetry feedback.

## Testing Plan

### Unit tests

- fingerprint normalization and near-duplicate detection
- bundle selection determinism for same inputs
- perspective isolation rules

### Integration tests

- repeated self-improvement prompts produce merge/suppress behavior
- iterative task references prior artifact and writes delta update
- context bundle swap correctness under mixed agent perspectives

### Regression tests

- no repeated “start over” loops for same objective within suppression window
- completion blocked if iteration contract is missing

## Success Metrics

- Reduction in near-duplicate self-improvement tasks per hour.
- Increase in tasks that update existing artifacts vs creating redundant drafts.
- Lower tokens-per-net-new-decision for autonomous queue fill.
- Reduced thermal pressure on orchestrator host during long runs.
