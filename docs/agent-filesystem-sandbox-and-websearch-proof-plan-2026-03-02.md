# Agent Filesystem Sandbox + Web Search Proof Plan — 2026-03-02

## Why this exists

During marathon run review, two high-risk integrity gaps were confirmed:

1. Unexpected autonomous writes produced an out-of-scope root folder:
   - `# Updated Spec\n\nNew content.`
   - with a parallel `.localcrew` subtree inside.
2. A task claimed successful outbox writes (`web_search_demo_report.md`, `web_search_demo_steps.md`), but those artifacts were not present in `external-memory/outbox/`.

This document defines implementation requirements for tomorrow (post-marathon), documentation-only for now.

## Objectives

- Prevent autonomous writes outside explicitly allowed directories.
- Ensure completed tasks have verifiable artifact outputs.
- Provide concrete evidence for capability claims (including web search demonstrations).

## A. Filesystem Sandbox Requirements

### A1. Allowlist-only write targets

Autonomous writes must be accepted only for canonical targets:

- `WRITE[internal]` → `.localcrew/system/**`
- `WRITE[active]` → `external-memory/active/**`
- `WRITE[outbox]` → `external-memory/outbox/**`

All other absolute or relative resolved targets are denied.

### A2. Canonical path enforcement

Before write execution:

- normalize path,
- resolve against repo root,
- verify containment within the selected stage root,
- reject traversal patterns and disguised paths.

Reject if path contains disallowed control characters (including newline), invalid separators, or hidden/reserved names per stage policy.

### A3. Denial behavior

On denied write:

- fail the write operation,
- record structured audit event (task id, model, resource, attempted path, violated rule),
- return operator-facing remediation guidance.

## B. Completion Proof Requirements

### B1. Post-write verification gate

A task may be marked `completed` only when all claimed outputs pass:

- file exists at expected stage path,
- file size > 0,
- file is in declared stage (`internal/active/outbox`) and not redirected unexpectedly.

If verification fails:

- task is marked `failed` or `quarantined` (policy choice),
- include explicit missing-artifact reason in result,
- optional remediation follow-up task can be queued.

### B2. Evidence bundle for capability claims

For capability demonstration tasks (for example web search):

Required artifact set:

1. Primary report markdown in outbox,
2. raw execution trace (inputs/queries and tool markers),
3. summary with pass/fail criteria.

Without these artifacts, task cannot claim capability proof.

## C. Web Search Proof Workflow (Required)

When asked to prove web-search capability:

1. Execute one demo per configured tool type (SEARCH, Wikipedia, Reddit, etc. as applicable).
2. Persist all outputs to `external-memory/outbox/` with predictable names.
3. Include explicit list of tools attempted and whether each succeeded or failed.
4. Include exact failure reasons when unavailable (for example tool not configured).

## D. Cleanup + Recovery Plan for This Incident

After marathon completes:

1. Inspect and archive unexpected root folder:
   - `# Updated Spec\n\nNew content.`
2. Compare files inside unexpected subtree with canonical `.localcrew/` state; keep only intentional data.
3. Remove unexpected folder after archival.
4. Re-run targeted autonomy safety tests.

## E. Test Plan Additions

### Unit tests

- canonical path allowlist enforcement,
- newline/control-char path rejection,
- hidden/reserved name rejection behavior by stage.

### Integration tests

- autonomous WRITE attempt to out-of-scope path is denied and audited,
- claimed `WRITE[outbox]` task cannot complete when output file is absent,
- successful capability demo writes expected artifact bundle.

### Regression tests

- no successful completion status on missing outputs,
- no writes created outside allowed roots under auto mode.

## F. Rollout

1. Implement guardrails behind a strict default-on policy.
2. Validate with focused safety suite + full `npm run validate`.
3. Ship with operator-facing release note describing stronger write controls and completion verification.
