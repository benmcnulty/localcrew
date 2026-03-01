# Crusty

Crusty is a local-first orchestration CLI for multi-node Ollama networks. It gives you a shared conversational shell, autonomous `/auto` mode, persistent orchestrator memory, agent identities, queue-based delegation, transactional telemetry, a local browser-facing API, and observability tools such as `/status`, `/hud`, and `/explore`.

The repo is being prepared for public release. Local node addresses, model assignments, and hardware-specific notes are now loaded from ignored env files instead of being committed into source.

## Current Features

- Shared chat, group chat, and autonomous orchestrator modes
- Participant voices through macOS `say`
- Shared queue with priorities and background auto pulse
- Agent identity creation, editing, and private memory
- Built-in `data-analyst` agent seeded from committed external system memory
- Transactional audit logging and per-model telemetry summaries
- Wikipedia search tool workflow for grounded factual retrieval in orchestrator and agent tasks
- Local HTTP API for status, HUD, queue, telemetry, audit, and agent snapshots
- Local orchestrator state under `.crusty/`
- Internal file explorer plus status and HUD views in the terminal
- Cross-platform Ollama benchmark scripts for macOS, Windows 11, and Linux

## Quick Start

1. Copy `.env.example` to `.env` or `.env.local`.
2. Fill in your local endpoint URLs and preferred models.
3. Run `bun run src/index.ts` or `node src/index.ts`.
4. Use `/help` in the REPL to see the current command surface.

Notable views:

- `/status` for a point-in-time overview
- `/hud` for a live terminal dashboard with `status`, `queue`, `metrics`, and `detail` tabs via left/right arrow keys
- `/explore` for direct inspection of internal state files

## Local State

- `.env` and `.env.local` are ignored and may contain device-specific configuration.
- `.crusty/` is ignored and contains local config, memory, queue state, and orchestrator documents.
- `external-memory/` is committed and contains durable seed directives, workflows, and built-in agent specs that are restored on fresh installs.
- `/clear` resets the app back to its env-backed first-run state.

## Local API

- `GET /api/health`
- `GET /api/status`
- `GET /api/hud?tab=status|queue|metrics|detail`
- `GET /api/queue`
- `GET /api/telemetry`
- `GET /api/audit?limit=20`
- `GET /api/agents`

Control the API listener with:

- `CRUSTY_API_ENABLED=true`
- `CRUSTY_API_HOST=127.0.0.1`
- `CRUSTY_API_PORT=4310`

## Platform Scripts

- macOS: `scripts/ollama-optimize-macos.sh`
- Windows 11: `scripts/ollama-optimize-windows.ps1`
- Linux: `scripts/ollama-optimize-linux.sh`

Each script benchmarks a local Ollama node, recommends a context length and concurrency tier, and writes a machine-readable profile JSON for later routing decisions.

## Documentation

- Setup and local configuration: `docs/setup.md`
- Architecture and storage model: `docs/architecture.md`
- Product and orchestration roadmap: `docs/roadmap.md`

## Near-Term Direction

The next meaningful pieces are measured routing policy, a richer browser GUI on top of the local API, and a safe promotion workflow that lifts validated internal discoveries into committed external-memory seeds.
