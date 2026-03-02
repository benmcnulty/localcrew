# CLI Quality and Test Coverage Plan — 2026-03-03

## Purpose

Define focused improvements to CLI usability, operator safety, and test coverage, based on marathon observations where manual CLI usage exposed race conditions, ambiguity, and weak completion trust.

## Primary Problems Observed

1. Prompt/output contention during auto mode caused duplicate submissions and operator confusion.
2. Completion status did not always reflect concrete artifact outcomes.
3. Alias-heavy outputs reduced readability under pressure.
4. Error messaging for blocked writes and cancelled edits was not always action-oriented.

## Goals

- Make CLI behavior deterministic under active auto output.
- Improve trust in completion and error outputs.
- Increase test coverage for high-risk interaction paths.

## Workstream CLI-1: Input Safety and Dedupe (P0)

### Deliverables

- Normalized submission dedupe window for queueing commands/messages.
- Compose-safe mode for long message drafting during auto activity.
- Operator-visible notice when a duplicate is suppressed.

### Acceptance criteria

- Repeated accidental submissions within TTL do not enqueue duplicates.
- Compose flow remains stable while auto logs continue.

## Workstream CLI-2: Completion and Artifact Trust (P0)

### Deliverables

- Completion output includes artifact verification summary when writes are claimed.
- Missing-output tasks are surfaced as failed/quarantined with explicit reason.

### Acceptance criteria

- No successful completion message if expected outputs are absent.
- CLI displays actionable remediation guidance for verification failures.

## Workstream CLI-3: Output Readability and Consistency (P1)

### Deliverables

- Identity formatting standard: `Label (alias)`.
- Clear mode/status badges and concise queue summaries.
- Better differentiation between operator commands, system events, and model output.

### Acceptance criteria

- Operator can parse active mode, queue depth, and latest event quickly.
- Reduced ambiguity between participant/resource naming in CLI output.

## Workstream CLI-4: Error UX Improvements (P1)

### Deliverables

- Standardized error classes/messages for:
  - denied writes,
  - cancelled edit flows,
  - missing capability proof artifacts,
  - model policy violations.

### Acceptance criteria

- Every major failure path returns a reason + next-step hint.
- Error output is test-covered and stable.

## CLI Test Coverage Plan

## Unit/Integration areas (existing test framework)

- `test/commands.test.ts`
  - command parse and validation for new compose/dedupe controls.
- `test/terminal.test.ts`
  - prompt rendering, status line behavior, and readable identity formatting.
- `test/app.test.ts`
  - queue submission dedupe behavior.
  - completion verification messaging.

## Scenario Tests to Add

1. Duplicate submission race scenario
   - simulate rapid repeated input during auto output and assert single queued item.
2. Cancelled edit scenario
   - assert cancellation feedback includes remediation and no partial update side-effects.
3. Claimed write missing
   - assert task status not marked completed and CLI reports failed verification.
4. Alias/label formatting
   - assert critical outputs include readable labels with canonical alias.

## Manual Verification Script (post-implementation)

Run once after merge:

1. Enter auto mode and submit long prompt under active output.
2. Verify dedupe suppression behavior.
3. Trigger one controlled denied-write case and inspect error/audit output.
4. Trigger one proof-required task and confirm completion gating.

## Suggested File Targets

- `src/index.ts`
- `src/app.ts`
- `src/terminal.ts`
- `src/commands.ts`
- `src/telemetry.ts`

## Definition of Done

- P0 CLI workstreams merged with regression tests.
- Known race/duplication issue has passing tests.
- Completion trust gap closed with explicit artifact verification output.
- CLI remains stable and readable during sustained auto-mode sessions.
