# Release Readiness Runbook

This runbook defines the minimum release gate for Local Crew and the operational checks expected by senior leadership for deployment confidence.

## Release Gate (Must Pass)

Fast path command:

- `npm run validate`

1. Type safety
   - `bunx tsc --noEmit`
2. Regression suite
   - `npm test`
3. CI pass on pull request and `main`
   - `.github/workflows/ci.yml` must be green
4. Security baseline
   - API token behavior validated when `LOCALCREW_API_TOKEN` is set
   - SSE endpoint auth behavior validated (`/api/events`)
5. Dependency policy
   - `package.json` contains zero runtime dependencies unless a documented exception is approved

## Pre-Release Checklist

- Verify local API and UI health
  - `GET /api/health`
  - open `/ui` and `/display`
- Validate orchestration surfaces
  - `/status`, `/hud`, `/explore`
- Validate tool-chain reachability (if enabled)
  - Wikipedia, Reddit, SEARCH, WEATHER, BENLIVE, WEBSITE
- Validate autonomous path safety
  - queue processing, dropbox ingestion, and WRITE routing constraints
- Validate telemetry and audit flow
  - `/api/telemetry`, `/api/audit?limit=20`

## Rollback Plan

If release health degrades:

1. Stop rolling forward; freeze merges to `main`
2. Revert to last green commit where CI + smoke checks passed
3. Re-run:
   - `bunx tsc --noEmit`
   - `npm test`
4. Validate `/api/health`, `/status`, `/hud`
5. Resume rollout only after root cause and fix are validated

## Operational Monitoring During Early Release

Track at minimum:

- queue depth and completion rate
- error counts in telemetry by kind/model/resource
- API health response and SSE stability for active displays
- audit stream continuity and write integrity

## Known Limitations (Current)

- Web search relies on upstream DuckDuckGo HTML layout and may require parser adjustments if the provider changes markup.
- Dedicated always-active billboard mode intentionally uses persistent live updates and is higher resource usage than default auto-pause mode.
- Some tool quality depends on external provider availability, latency, and response formats.

## Post-Marathon Implementation Plan (Documentation-Only)

After the overnight marathon run completes, prioritize fixes in this order:

1. Auto-mode input safety and dedupe
    - Add short-window queue dedupe for repeated plain-message submissions.
    - Add a quiet-compose mode (or temporary auto pulse pause) while operators type long directives.
2. Resource metadata reliability
    - Ensure `maxContextTokens` is persisted and preserved across refresh paths.
    - Add non-interactive command support for critical resource metadata updates.
3. Identifier consistency
    - Standardize user-facing output format as `Label (alias)` while retaining canonical alias for routing.
4. Baseline model policy profiles
    - Implement explicit policy profile selection with fixed semantics:
       - `all-llamas` (default baseline)
       - `custom` (explicitly assigned per purpose)
       - `auto` (experimental, orchestrator chooses)
5. Local observability access for development co-analysis
   - Add a local-only verbose log stream surface (API endpoint and/or dedicated local port).
   - Add CLI tail/stream commands so developers can analyze full auto/task logs live.
   - Provide filter controls (task id, resource alias, severity, time window) and bounded replay.
   - Enforce auth parity and redaction defaults for sensitive fields.
6. Filesystem sandbox hardening for autonomous writes
   - Enforce strict allowlist targets for autonomous write stages only.
   - Canonicalize and validate paths before write execution (reject control chars/newlines/traversal/hidden reserved names where disallowed).
   - Emit audit events for every denied write attempt with violation reason.
7. Completion proof enforcement
   - Require post-write verification before marking a task complete.
   - If claimed artifacts are missing or misplaced, mark task as failed and enqueue a remediation task.

### Model Policy Profiles — Required Behavior

- `all-llamas`:
   - Default profile for stable runs.
   - All purpose slots (`default`, `reasoning`, `coding`, `tools`) must resolve to Llama-family models only.
   - If a configured model is non-Llama, fail validation or auto-correct with explicit warning.
- `custom`:
   - Operator explicitly assigns models per purpose and per resource/participant.
   - No automatic model-family constraints.
   - Intended for tuned, reproducible configurations.
- `auto` (experimental):
   - Orchestrator may select models dynamically by task purpose and runtime signals.
   - Must remain opt-in and clearly marked experimental in CLI/status output.

### Acceptance Criteria for Next Update

- Profile is visible and queryable in status output.
- Switching profiles updates effective routing behavior immediately and deterministically.
- Regression tests verify:
   - `all-llamas` never selects non-Llama models,
   - `custom` respects explicit assignments,
   - `auto` remains gated and labeled experimental.
 - Observability stream tests verify:
   - authenticated access,
   - reconnect/resume behavior,
   - filter correctness,
   - long-run stability under active auto mode.
 - Filesystem safety tests verify:
    - write target allowlist enforcement,
    - path canonicalization and rejection coverage,
    - denial audit event integrity.
 - Completion-proof tests verify:
    - claimed WRITE outputs exist and are non-empty,
    - completion status is blocked on failed/missing artifacts.

## Safe Python Autonomy Plan (Post-Marathon)

Goal: enable Python-based autonomous tool authoring/execution safely, with clear guardrails and auditable controls.

### Operating Modes

- `off` (default initially): Python generation/execution disabled.
- `review`: models may propose Python artifacts, but execution requires explicit operator approval.
- `sandboxed`: approved Python tasks may execute in a restricted runtime with strict I/O/network controls.

### Safety Boundaries

- File system write scope:
   - allow only scoped internal paths (for example `.localcrew/system/` or staged workspace folders explicitly designated for autonomous artifacts).
   - deny hidden/reserved filenames and traversal by default.
- Network scope:
   - default deny outbound network; allowlist only approved endpoints when required.
- Process scope:
   - disallow shell passthrough from Python tasks.
   - enforce CPU/time/memory limits per run.
- Dependency scope:
   - default deny arbitrary package installation during autonomous runs.
   - require explicit approval for any dependency change.

### Execution Contract

- Every Python task must declare:
   - intent,
   - expected output artifact path,
   - allowed inputs,
   - success criteria.
- Completion may be marked only if:
   - artifact exists at expected path,
   - artifact passes basic schema/format checks,
   - telemetry records a successful run with no policy violation.

### Approval and Audit

- Approval levels:
   1. low-risk internal text transformations (auto-approvable in `sandboxed` mode),
   2. file writes to approved internal paths (review or policy-gated),
   3. any external I/O or dependency action (manual approval required).
- Audit log fields (required):
   - task id, model/resource, requested operation class, allow/deny decision, violation reason (if denied), output paths, runtime duration.

### Rollout Stages

1. Stage 0: documentation + tests only (no runtime enablement).
2. Stage 1: `review` mode with artifact generation but no execution.
3. Stage 2: `sandboxed` execution for allowlisted internal-only tasks.
4. Stage 3: broaden scopes only after error-rate and policy-violation thresholds are met.

### Required Test Coverage

- Policy enforcement tests:
   - path restrictions, hidden/reserved filename rejection, traversal rejection.
- Runtime guard tests:
   - timeout, memory ceiling, network deny-by-default.
- Contract tests:
   - completion requires verified artifact existence and expected shape.
- Regression tests:
   - no bypass from prompt/tool output to unrestricted execution.

## Leadership Sign-Off Recommendation

Release approval is recommended when:

- CI is green on the candidate commit
- all release-gate checks above pass
- no unresolved high-severity security or data-integrity issues remain
- known limitations are acceptable for the intended release scope
