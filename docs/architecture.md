# Architecture

## Runtime Model

Crusty has two related but separate concepts:

- Participants: `@erin`, `@zora`, `@sam`, `@pav` are the starter personalities used in direct chat and group chat. Their nicknames, resource bindings, instructions, and models are editable at runtime.
- Resources: local Ollama or OpenAI-compatible endpoints registered in `.crusty/resources.json` are the underlying inference nodes the orchestrator can delegate work to in `/auto`.

## Storage

Crusty keeps a strict boundary between committed external system memory and ignored local internal runtime state.

Committed external system memory lives in `external-memory/` and seeds durable behavior:

- `external-memory/orchestrator/*.md`: default directives, roadmap, focus todo, and agent-creation workflow
- `external-memory/agents/*`: built-in agent identities such as `data-analyst`
- `external-memory/inbox`, `external-memory/active`, `external-memory/outbox`: local dropbox folders for file-driven work intake and delivery; only the folders are tracked, not their contents

Local runtime state lives in `.crusty/` and is intentionally ignored by git.

- `.crusty/config.json`: participant routing, nicknames, voices, instructions, and orchestrator profile name
- `.crusty/resources.json`: local resource inventory, tiers, provider style, models, hardware hints, and roles
- `.crusty/sessions.json`: shared chat transcript and compaction state
- `.crusty/system/state.json`: auto queue and completion history
- `.crusty/system/secure/orchestrator/*.md`: orchestrator directives, roadmap, focus todo, changelog, workflow, inventory
- `.crusty/system/secure/orchestrator/telemetry/audit-log.jsonl`: append-only transaction log
- `.crusty/system/secure/orchestrator/telemetry/summary.json`: indexed telemetry summary for fast reads
- `.crusty/system/secure/agents/*`: per-agent specs and memory

## Configuration

The committed code now uses public-safe defaults. Real node URLs, model assignments, and hardware notes should be provided through ignored env files, the primary-device setup script, or runtime resource editing in the CLI and Local UI.

For the prototype chat surfaces, the intended layering is:

- one resource can host several participants with different nicknames, instructions, and model selections
- participant aliases remain the stable routing keys in shared chat transcripts
- resource aliases remain the stable routing keys for capability-aware delegation, telemetry, and future remote swarm reporting
- optional hardware metadata on resources lets the orchestrator reason about total RAM, CPU threads, GPU capacity, VRAM, and known context ceilings for the current network
- resource refresh and node sync let the orchestrator keep model inventories current without baking host specifics into the repo

The local browser-facing API is also env-driven:

- `CRUSTY_API_ENABLED`
- `CRUSTY_API_BIND_HOST`
- `CRUSTY_API_PUBLIC_HOST`
- `CRUSTY_API_PORT`

## Queue And Delegation

Routing is tier-based rather than alias-based:

- the orchestrator resource remains the default reasoning and verification fallback
- top-tier external resources are preferred for heavier drafting and sustained generation
- mid-tier resources are preferred for structured outputs, indexing, and queue support
- low-tier resources are reserved for small isolated work and overflow

This tiering is intentionally simple today. The next meaningful upgrade is telemetry-backed routing based on real latency, token, and model-load data rather than static heuristics alone.

The longer-term routing policy also needs:

- context-window awareness per resource and per selected model
- reload-cost awareness when switching models on a device
- explicit handling for metered remote inference providers where context size and token price matter as much as latency

The current implementation now carries optional per-resource hardware/context metadata and exposes aggregate capacity in status/API snapshots so this information can flow into later portal profiles and routing policy.

## Network Topology

Resources can be assigned one of three roles:

- `primary-orchestrator` — the device running the REPL and managing the overall network
- `orchestrator` — a sub-orchestrator that independently coordinates complex tasks with its own subordinate agents
- `agent` — a worker device that executes tasks assigned by an orchestrator

Any top-tier resource with at least 16k context tokens is considered orchestrator-capable and can be assigned the `orchestrator` role. This threshold is defined by `ORCHESTRATOR_CAPABLE_CONTEXT_THRESHOLD` in `resources.ts`.

The `/topology` command family manages the hierarchy:
- `/topology` — view the current network hierarchy
- `/topology assign <alias> <role>` — assign a resource role
- `/topology delegate <orchestrator> <agent>` — assign a subordinate agent
- `/topology undelegate <orchestrator> <agent>` — remove a subordinate

In `/auto` mode, the routing logic detects complex multi-step tasks and automatically delegates them to idle sub-orchestrators. The sub-orchestrator receives detailed context about its subordinate resources and coordinates independently. Sub-orchestrators continue operating when the primary orchestrator is offline.

## Observability

Current observability surfaces:

- `/status`: point-in-time orchestration summary
- `/hud`: live terminal dashboard with `status`, `queue`, `metrics`, and `detail` tabs
- `/explore`: internal and external-memory file browser
- local HTTP API for browser-based status, queue, telemetry, audit, explorer, command, and edit flows
- local HTTP API for browser-based participant/resource config, direct chat, and orchestrator profile editing
- `/ui`: local browser prototype backed by the same API routes
- terminal background output in `/auto`
- append-only audit logging for Ollama and Wikipedia transactions

## Dropbox Workflow

When `/auto` is idle and the queue is empty, the orchestrator checks `external-memory/inbox` before generating self-improvement work.

- The next inbox document is moved into `external-memory/active`
- its `Crusty-Status:` tag is updated to `active`
- the orchestrator queues a high-priority task against that active document
- the task receives the active document body as prompt context
- the orchestrator can emit `WRITE[active][path] ... ENDWRITE` for rough drafts and `WRITE[outbox][path] ... ENDWRITE` for final deliverables
- after a successful source-document task, the source document is moved from `active` to `outbox` and retagged as `outbox`

## Grounding

The orchestrator and agent identities can now request grounded factual context from Wikipedia through a constrained tool workflow. The model emits a `WIKIPEDIA: query` line, Crusty fetches and chunks the results, logs the transaction, and then re-prompts the same model to continue with the retrieved context.

Planned observability surfaces:

- browser-based GUI with queue, agents, telemetry, and transcript parity
- richer live HUD layers for direct chat, participant config, and subscription-aware remote connection state
