# Roadmap

## What The First Auto Run Showed

The autonomous documentation pass was productive, but it also exposed the current ceiling:

- Erin can generate useful docs and queue follow-up work, but there is not yet a metrics layer to validate whether routing and model choices were actually optimal.
- Generated artifacts can sound authoritative even when they infer capabilities or validations the harness does not yet measure directly.
- The queue is active, but the terminal still lacks a purpose-built live dashboard for long-running autonomous work.

## Highest-Value Next Steps

### 1. Telemetry And Model Analytics

Add structured capture for:

- request/response latency
- prompt and completion token counts when available
- queue wait time
- assigned resource and model
- compaction frequency and summary size
- retry/escalation counts

This unlocks evidence-based routing, model-switch decisions, and resource tuning.

### 2. Dynamic Model Selection

Allow Erin to override the model used on a resource for a specific task when telemetry or task shape justifies it. The important constraint is to make model switching data-driven so the orchestrator can weigh quality gains against cold-load and eviction costs.

### 3. Data Analyst Agent

Add a persistent internal `data-analyst` agent identity focused on:

- aggregating task metrics
- spotting routing regressions
- comparing model efficiency
- recommending queue and model-policy changes

### 4. Better UX Surfaces

- `/hud` for live terminal observability
- browser GUI with mobile/tablet/desktop support
- shared live view of queue, current task, recent completions, and agent output

## Public Release Readiness

Before publishing the repo, the critical baseline is:

- env-based local configuration
- ignored runtime state
- setup docs
- platform support scripts
- a clear architecture description

Those pieces are now in place, so the next iterations can focus on telemetry, HUD, and GUI parity instead of repo hygiene.
