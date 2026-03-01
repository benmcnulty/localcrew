# Architecture

## Runtime Model

Crusty has two related but separate concepts:

- Participants: `@erin`, `@zora`, `@sam`, `@pav` are the personalities used in direct chat and group chat.
- Resources: `air`, `vic`, `min`, `pav` are the underlying inference nodes Erin can delegate work to in `/auto`.

## Storage

Crusty keeps a strict boundary between committed external system memory and ignored local internal runtime state.

Committed external system memory lives in `external-memory/` and seeds durable behavior:

- `external-memory/orchestrator/*.md`: default directives, roadmap, focus todo, and agent-creation workflow
- `external-memory/agents/*`: built-in agent identities such as `data-analyst`

Local runtime state lives in `.crusty/` and is intentionally ignored by git.

- `.crusty/config.json`: participant routing, voices, instructions
- `.crusty/sessions.json`: shared chat transcript and compaction state
- `.crusty/system/state.json`: auto queue and completion history
- `.crusty/system/secure/orchestrator/*.md`: Erin directives, roadmap, focus todo, changelog, workflow, inventory
- `.crusty/system/secure/orchestrator/telemetry/audit-log.jsonl`: append-only transaction log
- `.crusty/system/secure/orchestrator/telemetry/summary.json`: indexed telemetry summary for fast reads
- `.crusty/system/secure/agents/*`: per-agent specs and memory

## Configuration

The committed code now uses public-safe defaults. Real node URLs, model assignments, and hardware notes should be provided through ignored env files or system environment variables.

The local browser-facing API is also env-driven:

- `CRUSTY_API_ENABLED`
- `CRUSTY_API_HOST`
- `CRUSTY_API_PORT`

## Queue And Delegation

- High-value reasoning and code work defaults to `air`
- Heavy drafting defaults to `vic`
- Medium structured/indexing tasks default to `min`
- Small isolated overflow work defaults to `pav`

This tiering is intentionally simple today. The next meaningful upgrade is telemetry-backed routing based on real latency, token, and model-load data rather than static heuristics alone.

## Observability

Current observability surfaces:

- `/status`: point-in-time orchestration summary
- `/hud`: live terminal dashboard with `status`, `queue`, `metrics`, and `detail` tabs
- `/explore`: internal file browser
- local HTTP API for browser-based status, queue, telemetry, audit, and agent reads
- terminal background output in `/auto`
- append-only audit logging for Ollama and Wikipedia transactions

## Grounding

Erin and agent identities can now request grounded factual context from Wikipedia through a constrained tool workflow. The model emits a `WIKIPEDIA: query` line, Crusty fetches and chunks the results, logs the transaction, and then re-prompts the same model to continue with the retrieved context.

Planned observability surfaces:

- browser-based GUI with queue, agents, telemetry, and transcript parity
