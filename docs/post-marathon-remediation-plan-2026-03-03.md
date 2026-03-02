# Post-Marathon Remediation Plan — 2026-03-03

## Purpose

This plan converts observed marathon-run failures into a controlled implementation sequence for the next development session.

Scope: documentation and planning only. No runtime/code changes are included in this document.

## Evidence Snapshot (from current run state)

- Completed tasks: 44
- Pending tasks: 1
- Auto-fill generated tasks: 38
- Empty/insufficient result payloads detected: 3
- Claimed `WRITE[...]` markers in task results: 3
- Missing expected outbox artifacts for web-search proof despite completed status
- Unexpected root path created: `# Updated Spec\n\nNew content.` with nested `.crusty` content

## Strategic Goals for Tomorrow

1. Prevent unsafe or out-of-scope autonomous filesystem writes.
2. Ensure completion status is impossible without verifiable artifacts.
3. Stop prompt/output race-induced duplicate queue submissions.
4. Stabilize model selection toward llama-first baseline under explicit profile control.
5. Improve operator observability and trust in live outputs.
6. Ensure self-improvement tasks iterate on prior artifacts instead of restarting similar work.

## Workstream A — Filesystem Sandbox Hardening (P0)

### Problems addressed

- Out-of-allowlist root folder creation.
- Risk of autonomous writes outside intended stage roots.

### Implementation requirements

- Enforce strict write-stage roots only:
  - `internal` -> `.crusty/system/**`
  - `active` -> `external-memory/active/**`
  - `outbox` -> `external-memory/outbox/**`
- Add canonical path normalization and containment checks before writes.
- Reject newline/control-char targets and unsafe hidden/reserved names where disallowed.
- Emit structured audit events for every denied write attempt.

### Primary modules to update

- `src/app.ts` (autonomous write routing/generation boundary)
- `src/dropbox.ts` (path safety checks)
- `src/internal-files.ts` (containment checks consistency)
- `src/telemetry.ts` (denial/audit event indexing)

### Definition of done

- Out-of-scope write attempts fail deterministically.
- Denied writes are visible in audit log with reason.
- No autonomous writes appear outside allowlisted stage roots under test.

## Workstream B — Completion Proof Enforcement (P0)

### Problems addressed

- Tasks marked completed despite missing claimed artifacts.
- Weak integrity of completion status.

### Implementation requirements

- Introduce post-write verification gate for tasks that claim `WRITE[...]` outputs.
- Completion allowed only when expected files:
  - exist,
  - are non-empty,
  - are in declared stage location.
- On verification failure:
  - mark task failed/quarantined,
  - include explicit artifact verification error,
  - optionally queue remediation task.

### Primary modules to update

- `src/app.ts` (task completion state transition)
- `src/orchestrator-store.ts` (task state persistence semantics)
- `src/session-store.ts` or state handling paths as needed for consistent logging

### Definition of done

- No task can be `completed` if claimed outputs are absent.
- Queue state reflects artifact verification failures explicitly.

## Workstream C — Auto Prompt/Output Race and Dedupe (P0)

### Problems addressed

- Lost/duplicated operator messages while auto output streams.

### Implementation requirements

- Add short-window dedupe on normalized user queue submissions.
- Add operator compose safety mode:
  - temporary auto pulse pause while composing long input, or
  - explicit `/compose` command path.
- Add clear operator feedback when dedupe suppresses duplicate queue item.

### Primary modules to update

- `src/index.ts` (REPL interaction flow)
- `src/app.ts` (queue submit path and dedupe)

### Definition of done

- Repeated accidental submission within TTL does not queue duplicate task.
- Compose experience is deterministic under active auto output.

## Workstream C2 — Dynamic Context Bundles + Novelty Gate (P0)

### Problems addressed

- Repetitive self-improvement tasks redoing prior work.
- Weak reuse of previous artifacts and insufficient perspective-aware context selection.

### Implementation requirements

- Add deterministic context bundle selection by task purpose and perspective.
- Add self-improvement task fingerprinting with near-duplicate suppression/merge.
- Require iterative tasks to reference prior artifact and declare explicit delta.

### Primary modules to update

- `src/messages.ts`
- `src/app.ts`
- `src/orchestrator-store.ts`

### Definition of done

- Repetitive near-duplicate self-improvement tasks are suppressed/merged.
- Iterative tasks evolve existing artifacts with explicit delta evidence.

## Workstream D — Model Policy Profiles (P1)

### Problems addressed

- Drift to high-load models when llama-first baseline expected.

### Required profile modes

- `all-llamas` (default)
- `custom` (explicit operator assignment)
- `auto` (experimental)

### Implementation requirements

- Persist active profile in config.
- Expose active profile in status/model displays.
- Enforce profile behavior during endpoint/model selection.

### Primary modules to update

- `src/config.ts` (profile persistence + migration default)
- `src/app.ts` (selection and policy enforcement)
- `src/messages.ts` (prompt policy hints if needed)

### Definition of done

- Profile state is visible, persistent, and deterministic.
- `all-llamas` never routes to non-llama models in tests.

## Workstream E — Observability & Display Trust (P1)

### Problems addressed

- Alias-heavy readability, missing verbose stream for developer co-analysis.

### Implementation requirements

- Add local-only verbose stream API/port with auth parity.
- Add CLI tail/filter command(s) for verbose events.
- Render user-facing identity as `Label (alias)` in display/terminal status surfaces.

### Primary modules to update

- `src/api-server.ts` / `src/api-worker.js` (stream endpoint)
- `src/terminal.ts` / `src/index.ts` (CLI viewing)
- `src/gui.ts` (label rendering consistency)

### Definition of done

- Authenticated stream works with filters and bounded replay.
- Display readability improves under live monitoring.

## Workstream F — Web Search Capability Proof Contract (P1)

### Problems addressed

- Capability report requested but not materially delivered in outbox.

### Implementation requirements

- Standardize a proof artifact bundle for capability demonstrations:
  - summary report,
  - execution trace,
  - pass/fail matrix by tool.
- Gate completion on bundle presence.
- Add explicit failure-mode report when tool unavailable.

### Primary modules to update

- `src/app.ts` (task contract/checkpoint)
- `src/web-search.ts` plus other tool modules for consistent trace metadata

### Definition of done

- Web-search proof task completion always leaves concrete outbox artifacts.

## Day Plan (Suggested Sequence)

1. P0-A filesystem sandbox
2. P0-B completion proof gate
3. P0-C dedupe + compose safety
4. P0-C2 dynamic context bundles + novelty gate
5. Re-run validation + targeted safety tests
6. P1-D model profile modes
7. P1-E observability stream + label rendering
8. P1-F web-search proof contract

## Validation Protocol

Run after each completed workstream and once globally at end:

- `bunx tsc --noEmit`
- `npm test`
- `npm run validate`

Additionally, perform directed manual checks:

- out-of-scope write attempt should fail and audit
- claimed write missing should force failed/quarantined task
- duplicate message input should not produce duplicate queue entries
- `all-llamas` should prevent non-llama selection in auto run

## Risks and Mitigations

- Risk: broad changes in `app.ts` may introduce regressions.
  - Mitigation: isolate workstream changes and test after each phase.
- Risk: stricter write policy may block legitimate legacy behavior.
  - Mitigation: include compatibility map and migration notes in PR.
- Risk: observability stream can leak sensitive content.
  - Mitigation: default redaction + auth required + local-only binding by default.
