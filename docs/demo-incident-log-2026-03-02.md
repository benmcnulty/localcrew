# Demo Incident Log — 2026-03-02

## Operational misses observed

1. Agent setup failed with generic `fetch failed` after orchestrator health check succeeded.
   - Impact: first Windows agent onboarding blocked.
   - Root cause: local endpoint probe stage failed before monitor startup.

2. Local endpoint readiness mismatch during setup (`ollama serve` running but setup still failed).
   - Impact: repeated onboarding retries.
   - Root cause class: endpoint resolution/binding/timing on agent host.

3. Agent monitor generated steady `/api/version` + `/api/tags` traffic.
   - Impact: unnecessary local endpoint load.
   - Root cause: model discovery performed too frequently in monitor loop.

4. Duplicate local resource aliases (`@orchestrator`, `@erin`) caused topology/operator confusion.
   - Impact: increased risk of incorrect promotion/delegation actions.
   - Root cause: setup/legacy alias coexistence without explicit cleanup step.

5. Sub-orchestrator promotion failed despite expected real model capability.
   - Impact: blocked hierarchy setup for demo.
   - Root cause: missing `maxContextTokens` metadata in resource profile; promotion gate uses metadata.

6. Interactive `/resource edit` cancelled in terminal flow.
   - Impact: blocked quick metadata correction during live run.
   - Root cause class: edit UX fragility under multiline JSON terminal input.

7. Auto-mode prompt/input race caused perceived lost text and duplicate task queueing.
   - Impact: operator composed a long message while auto pulse/log output interleaved; duplicate/redundant tasks were queued.
   - Root cause class: REPL input and background auto output contention; no dedupe guard for repeated plain-message submissions.

8. Auto output uses resource aliases/device-style names where operator expects participant nicknames.
   - Impact: reduced readability and confidence during live monitoring (for example `@desktop-m01slkb` vs friendly nickname).
   - Root cause class: mixed presentation layers between resource routing identifiers (aliases) and participant-friendly labels.

9. Model baseline drift during auto mode (for example local `gpt-oss` usage when all-Llama behavior was expected).
   - Impact: inconsistent performance profile and higher load on constrained hardware.
   - Root cause class: mixed model purpose settings and policy defaults not locked to a single model family.

10. Dropbox write rejected hidden/reserved filename during autonomous write attempt.
   - Impact: write failed and operator observed error during live run.
   - Root cause class: path safety guard correctly blocked unsafe/generated filename, but error surfaced late and without sufficient operator guidance.

11. Auto-generated artifact quality drift (plan-text returned as "completed implementation").
   - Impact: completed queue items often contained speculative pseudo-code or implementation plans without creating verified artifacts.
   - Root cause class: weak completion contract and insufficient post-task validation of artifact existence/content quality.

## Immediate mitigations used tonight

- Improved setup probe diagnostics.
- Added endpoint candidate fallback during setup (`127.0.0.1` / `localhost` / `OLLAMA_HOST`).
- Added probe retries for startup timing tolerance.
- Throttled monitor polling/model discovery to reduce endpoint load.
- Removed duplicate local alias (`@erin`) after participant rebind.

## Next development round — test and UX coverage

1. Setup diagnostics
   - Add tests for probe-stage failures to assert explicit endpoint/stage error messages.

2. Endpoint candidate resolution
   - Add tests for loopback variants and `OLLAMA_HOST` fallback selection.

3. Monitor load behavior
   - Add tests asserting discovery cadence and health-check intervals under steady-state.

4. Metadata-driven promotion
   - Add tests and docs clarifying required fields (`tier=top`, `maxContextTokens>=16000`).

5. Resource edit workflow
   - Add a non-interactive command path for key metadata updates (e.g., context tokens/role), with tests.

6. Post-setup hygiene
   - Add an explicit check/warning for duplicate local aliases and guided cleanup.

7. Auto-mode operator safety + dedupe
   - Add queue submission dedupe by normalized text + short TTL (for example, 60-120s).
   - Add an explicit "quiet compose" mode or temporary auto-pulse pause while typing multiline input.
   - Add tests for interleaved terminal output while user is composing a line.

8. Identifier presentation consistency
   - Normalize user-facing logs to prefer friendly labels/nicknames while retaining canonical alias in parentheses.
   - Add snapshot tests for terminal/status/auto output to ensure consistent formatting.

9. Baseline model policy lock
   - Add a profile-level "baseline family" setting (e.g., all-llama) that enforces model-family constraints for default/reasoning/coding/tools routing.
   - Add a command to apply baseline lock across all resources/participants in one operation.
   - Add tests verifying auto mode never selects models outside the active baseline family when lock is enabled.

10. Dropbox path-safety observability
   - Capture explicit structured telemetry when write guards reject hidden/reserved filenames.
   - Include attempted target path, guard rule triggered, and remediation hint in operator-facing output.

11. Completion quality gates for auto tasks
   - Require tasks marked complete to include one of:
     - verified `WRITE[...]` artifact creation, or
     - explicit "analysis-only" completion with no implementation claim.
   - Add validation that claimed output files actually exist and are non-empty before marking completion.
   - Add language/runtime guardrails so suggested code matches repo stack (TypeScript/Node for this repo) unless user explicitly requests otherwise.

12. Safe Python autonomy enablement plan
   - Add a three-mode policy switch: `off` (default), `review`, `sandboxed`.
   - Require task execution contracts (intent, inputs, outputs, success criteria) before Python execution.
   - Enforce sandbox boundaries for file paths, network, runtime limits, and dependency changes.
   - Add approval tiers for low-risk internal transforms vs external I/O/dependency actions.
   - Gate completion on verified artifact creation and policy-compliant audit events.

13. Local verbose log access for co-analysis during marathon tests
   - Add a local-only log streaming endpoint and/or dedicated local port for full verbose auto/task logs.
   - Add CLI command(s) to tail/stream verbose logs in real time from development environments.
   - Require authentication parity with existing API token behavior when enabled.
   - Include log-level filtering, task-id/resource filters, and bounded history replay on connect.
   - Ensure sensitive fields are redacted in stream output by default.

14. Unexpected workspace folder creation outside intended write zones
   - Observed path: `# Updated Spec\n\nNew content.` created at repo root with a parallel `.localcrew` tree inside.
   - Impact: uncontrolled writes outside expected internal/external-memory boundaries increase safety risk.
   - Root cause class: insufficient canonical path allowlisting and write-target enforcement for autonomous WRITE operations.

15. Claimed outbox WRITE artifacts missing despite completed task status
   - Queue state includes `WRITE[outbox][web_search_demo_report.md]` and `WRITE[outbox][web_search_demo_steps.md]`, but files were not present in `external-memory/outbox/`.
   - Impact: false-positive completion and missing proof artifacts for capability verification.
   - Root cause class: missing post-write verification and weak completion gating.

16. Repetitive self-improvement loop behavior (redoing similar tasks instead of iterative evolution)
   - Impact: high token/event spend with limited net progress, operator trust degradation, and thermal/resource pressure.
   - Root cause class: weak novelty/iteration checks, insufficient reuse of prior artifacts, and shallow context bundle selection across agent perspectives.

## Auto Artifact Review — 2026-03-02 Marathon Snapshot

Reviewed sources:
- `external-memory/outbox/2026-03-02-developer-review.md`
- `external-memory/outbox/feature-requests/task-on-orchestrator-create-a-telemetry-collector-that-runs-ever.md`
- `.localcrew/system/state.json` (completed auto tasks)

Quality findings:

1. Scope adherence was mixed.
   - Positive: external implementation requests were correctly redirected into outbox feature tickets.
   - Negative: multiple tasks still returned implementation-like content despite internal-only constraints.

2. Artifact quality was inconsistent.
   - Several "completed" tasks returned planning text/pseudo-code rather than executable repo-aligned changes.
   - Some outputs referenced non-existent modules/patterns (for example, Python `AutoFill` class) not aligned with this TypeScript codebase.

3. Focus drift occurred under auto-fill.
   - Queue-fill generated speculative infrastructure tasks (cron collectors, routing rewrites) beyond immediate run stability goals.
   - Duplicate/redundant task generation was observed during prompt/output contention.

4. Reporting correctness needs tightening.
   - Tasks marked `completed` sometimes had partial/in-progress step states in payload content.
   - At least one high-priority task returned "No direct result text" while still marked completed.

Recommended priority order (post-marathon):

1. Enforce completion contract and file-existence checks.
2. Add dedupe + operator-safe compose mode in auto REPL.
3. Add stack-aware language guardrails for generated implementation content.
4. Tighten queue-fill prompts to emphasize run-stability tasks and avoid speculative feature design.

## Tomorrow Implementation Checklist (Requested)

1. Add model profile selector with exactly three modes:
   - `all-llamas` (default)
   - `custom`
   - `auto` (experimental)
2. Persist active profile in config and expose it in `/status` and `/model` reporting.
3. Enforce profile semantics:
   - `all-llamas`: only Llama-family model IDs allowed for default/reasoning/coding/tools.
   - `custom`: explicit assignments only; no automatic family constraints.
   - `auto`: dynamic orchestrator model choice with explicit experimental labeling.
4. Add migration logic so existing installs default safely to `all-llamas` unless user explicitly opts into another profile.
5. Add regression coverage:
   - Profile persistence and reload behavior.
   - Routing behavior for each profile.
   - Rejection or correction of non-Llama selections while in `all-llamas`.
6. Add Python autonomy safety coverage:
   - Policy unit tests for path/network/runtime/dependency restrictions.
   - Contract enforcement tests proving no completion without verified output artifacts.
   - Audit/telemetry tests for allow/deny decisions and violation reporting.
7. Add observability stream coverage:
   - SSE/WebSocket/API stream tests for auth, reconnection, and bounded replay.
   - CLI tail command tests for filter correctness and redaction behavior.
   - Performance tests for long-running stream stability under active auto mode.
8. Add filesystem sandbox coverage:
   - Canonical path normalization tests (including newline/control-char and disguised relative paths).
   - Allowlist-only write target tests by stage (`internal`, `active`, `outbox`).
   - Hard-fail and audit-event tests for out-of-scope write attempts.
9. Add write-verification coverage:
   - Completion marked failed if claimed WRITE artifact does not exist at target path.
   - Verify non-empty artifact content and expected stage placement before completion.
10. Add anti-redundancy and context-evolution coverage:
   - Detect near-duplicate self-improvement tasks and suppress/merge them.
   - Require each follow-up self-improvement task to reference prior artifact IDs and explicit deltas.
   - Add tests for context bundle selection per perspective (orchestrator vs agent) and bundle swap correctness.
   - Add regression tests ensuring iterative tasks evolve previous outputs instead of restarting from scratch.

## Notes for Review

- This document intentionally records required follow-up only; no further runtime changes should be made during the active marathon test.
- Current marathon run should continue on present code while observations are logged here.

## Marathon run operator mitigations (tonight)

- Compose long requests outside the REPL, then paste once when prompt is idle.
- Use `/stop` before writing long ad-hoc directives; re-enter with `/auto` once queued.
- Prefer inbox-document ingestion for long directives instead of typing during active auto pulses.
- If duplicates are queued, add one corrective task clarifying canonical objective and continue (avoid repeated corrective chatter).
