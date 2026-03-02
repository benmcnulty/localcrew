# Tomorrow Implementation Ticket Pack — 2026-03-03

This ticket pack translates marathon findings into implementation-ready items.

## TKT-01 — Enforce Autonomous Write Allowlist (P0)

### Goal
Prevent autonomous file writes outside approved stage roots.

### Scope
- Implement canonical path validation for write targets.
- Reject unsafe target names (control chars/newlines/traversal).
- Record denial telemetry with reason and attempted path.

### Files (expected)
- `src/app.ts`
- `src/dropbox.ts`
- `src/internal-files.ts`
- `src/telemetry.ts`
- `test/security.test.ts`

### Acceptance
- Out-of-scope writes fail deterministically.
- Denied attempts are logged and queryable.

## TKT-02 — Add Artifact Verification Before Completion (P0)

### Goal
Eliminate false-positive completion for missing outputs.

### Scope
- Parse claimed `WRITE[...]` outputs from task results.
- Verify existence/non-empty content at declared stage path.
- Block completion on failed verification.

### Files (expected)
- `src/app.ts`
- `src/orchestrator-store.ts`
- `test/app.test.ts`
- `test/security.test.ts`

### Acceptance
- Missing claimed artifact => task not marked completed.
- Error reason explicitly mentions verification failure.

## TKT-03 — Queue Submission Dedupe + Compose Safety (P0)

### Goal
Prevent duplicate task submissions from REPL output/input contention.

### Scope
- Add normalized-content dedupe TTL for user-submitted queue tasks.
- Add compose-safe behavior while typing long directives.

### Files (expected)
- `src/index.ts`
- `src/app.ts`
- `test/terminal.test.ts`
- `test/app.test.ts`

### Acceptance
- Immediate duplicate submissions are suppressed with clear operator feedback.

## TKT-04 — Model Profile Modes (`all-llamas`, `custom`, `auto`) (P1)

### Goal
Lock baseline model behavior and reduce unwanted high-load model drift.

### Scope
- Add persisted model profile setting.
- Enforce profile semantics in model selection paths.
- Surface active profile in status and model views.

### Files (expected)
- `src/config.ts`
- `src/app.ts`
- `src/commands.ts`
- `test/commands.test.ts`
- `test/app.test.ts`

### Acceptance
- `all-llamas` blocks non-llama routing choices under auto mode.
- `custom` respects explicit assignments.
- `auto` remains experimental and clearly labeled.

## TKT-05 — Local Verbose Log Stream + CLI Tail (P1)

### Goal
Enable live co-analysis from developer environments.

### Scope
- Add local verbose stream endpoint (auth parity required).
- Add CLI tail command with filters.

### Files (expected)
- `src/api-worker.js`
- `src/api-server.ts`
- `src/index.ts`
- `src/terminal.ts`
- `test/api-server.test.ts`
- `test/terminal.test.ts`

### Acceptance
- Authenticated stream works with reconnect and bounded replay.
- CLI filter behavior verified by tests.

## TKT-06 — Display Identity Consistency (P1)

### Goal
Improve operator readability: use `Label (alias)` consistently.

### Scope
- Update display/terminal rendering to prefer friendly label plus canonical alias.

### Files (expected)
- `src/gui.ts`
- `src/terminal.ts`
- `test/gui.test.ts`
- `test/terminal.test.ts`

### Acceptance
- No critical output surface shows alias-only identity where label exists.

## TKT-07 — Capability Proof Contract for Web Search (P1)

### Goal
Guarantee concrete proof artifacts when capability demonstration is requested.

### Scope
- Define required proof artifact bundle in outbox.
- Gate completion on bundle presence.
- Include explicit unavailable-tool report path.

### Files (expected)
- `src/app.ts`
- `src/web-search.ts`
- `test/web-search.test.ts`
- `test/app.test.ts`

### Acceptance
- Requested web-search demonstration always yields concrete outbox proof artifacts or explicit failure bundle.

## TKT-08 — Cleanup Utility for Rogue Workspace Paths (P2)

### Goal
Safely handle incidents like `# Updated Spec\n\nNew content.`.

### Scope
- Document and optionally implement a controlled cleanup/archival command.
- Ensure no data loss of potentially useful internal artifacts.

### Files (expected)
- `docs/` runbook updates
- optional script under `scripts/` (if approved)

### Acceptance
- Cleanup process is deterministic, auditable, and non-destructive by default.

## TKT-09 — UI Refresh Baseline + Responsive Contracts (P1)

### Goal
Refresh display/UI layout quality and responsiveness across target viewport classes.

### Scope
- Implement shared design tokens and bounded typography scaling.
- Apply responsive layout contracts for mobile/tablet/laptop/HD/UHD.
- Improve state clarity and panel hierarchy.

### Files (expected)
- `src/gui.ts`
- optional shared UI/token helpers if introduced
- `test/gui.test.ts`

### Acceptance
- No clipped/overlapping critical controls across viewport classes.
- UHD typography remains bounded and legible.

## TKT-10 — Playwright Coverage for UI/Display Interactions (P1)

### Goal
Establish automated interaction/regression coverage for display and UI surfaces.

### Scope
- Add viewport matrix tests (mobile/tablet/laptop/HD/UHD).
- Add interaction tests for monitor toggle/state behavior.
- Add output expectation checks for critical status blocks.

### Files (expected)
- new e2e specs under `test/e2e/` (or agreed location)
- Playwright configuration updates as needed

### Acceptance
- Automated runs validate layout integrity and key interactions at all target resolutions.
- Failures provide screenshot/trace artifacts for triage.

## TKT-11 — CLI Usability Hardening and Regression Expansion (P1)

### Goal
Reduce operator error risk and improve trust/readability in sustained auto sessions.

### Scope
- Improve compose safety and duplicate suppression UX.
- Standardize readable identity formatting (`Label (alias)`).
- Expand CLI error/interaction regression tests.

### Files (expected)
- `src/index.ts`
- `src/terminal.ts`
- `src/app.ts`
- `test/terminal.test.ts`
- `test/app.test.ts`
- `test/commands.test.ts`

### Acceptance
- CLI behavior remains deterministic under active auto output.
- New regression tests cover known race and readability failure classes.

## TKT-12 — Dynamic Context Bundle Manager (P0)

### Goal
Select minimal, perspective-aware context bundles so autonomous work evolves prior artifacts instead of restarting.

### Scope
- Add deterministic context bundle selection by purpose and perspective.
- Include artifact lineage bundle selection for iterative tasks.
- Log selected bundles for observability.

### Files (expected)
- `src/messages.ts`
- `src/app.ts`
- `src/orchestrator-store.ts`
- `test/messages.test.ts`
- `test/app.test.ts`

### Acceptance
- Repeated objective tasks reuse prior canonical artifacts and generate explicit deltas.

## TKT-13 — Self-Improvement Novelty Gate + Duplicate Suppression (P0)

### Goal
Suppress repetitive self-improvement loops and force iterative progression.

### Scope
- Add task fingerprinting for self-improvement queue items.
- Suppress/merge near-duplicate tasks in a rolling window.
- Require prior-artifact reference + delta statement for iterative tasks.

### Files (expected)
- `src/app.ts`
- `src/compact.ts` (if reuse of summarization helpers is useful)
- `src/session-store.ts` or queue state support modules
- `test/app.test.ts`

### Acceptance
- Near-duplicate self-improvement tasks are suppressed or merged.
- Iterative tasks cannot complete without explicit delta evidence.

## Execution Notes

- Implement P0 tickets first before any feature additions.
- Run validation after each ticket and at phase boundaries:
  - `bunx tsc --noEmit`
  - `npm test`
  - `npm run validate`
- Keep no-code-change policy for active marathon; apply tickets only post-run.
- Reference docs:
  - `docs/ui-refresh-and-playwright-coverage-plan-2026-03-03.md`
  - `docs/cli-quality-and-test-coverage-plan-2026-03-03.md`
  - `docs/dynamic-context-and-memory-optimization-plan-2026-03-03.md`
