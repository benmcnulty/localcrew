# Architecture

## Runtime Model

Crusty has two related but separate concepts:

- Participants: `@erin`, `@zora`, `@sam`, `@pav` are the personalities used in direct chat and group chat.
- Resources: `air`, `vic`, `min`, `pav` are the underlying inference nodes Erin can delegate work to in `/auto`.

## Storage

Local runtime state lives in `.crusty/` and is intentionally ignored by git.

- `.crusty/config.json`: participant routing, voices, instructions
- `.crusty/sessions.json`: shared chat transcript and compaction state
- `.crusty/system/state.json`: auto queue and completion history
- `.crusty/system/secure/orchestrator/*.md`: Erin directives, roadmap, focus todo, changelog, workflow, inventory
- `.crusty/system/secure/agents/*`: per-agent specs and memory

## Configuration

The committed code now uses public-safe defaults. Real node URLs, model assignments, and hardware notes should be provided through ignored env files or system environment variables.

## Queue And Delegation

- High-value reasoning and code work defaults to `air`
- Heavy drafting defaults to `vic`
- Medium structured/indexing tasks default to `min`
- Small isolated overflow work defaults to `pav`

This tiering is intentionally simple today. The next meaningful upgrade is telemetry-backed routing based on real latency, token, and model-load data rather than static heuristics alone.

## Observability

Current observability surfaces:

- `/status`: point-in-time orchestration summary
- `/explore`: internal file browser
- terminal background output in `/auto`

Planned observability surfaces:

- `/hud`: live terminal dashboard
- browser-based GUI with queue, agents, telemetry, and transcript parity
