# Crusty

Crusty is a local-first orchestration CLI for multi-node Ollama networks. It gives you a shared conversational shell, autonomous `/auto` mode, persistent orchestrator memory, agent identities, queue-based delegation, and local observability tools such as `/status` and `/explore`.

The repo is being prepared for public release. Local node addresses, model assignments, and hardware-specific notes are now loaded from ignored env files instead of being committed into source.

## Current Features

- Shared chat, group chat, and autonomous orchestrator modes
- Participant voices through macOS `say`
- Shared queue with priorities and background auto pulse
- Agent identity creation, editing, and private memory
- Local orchestrator state under `.crusty/`
- Internal file explorer and status viewer in the terminal
- Cross-platform Ollama benchmark scripts for macOS, Windows 11, and Linux

## Quick Start

1. Copy `.env.example` to `.env` or `.env.local`.
2. Fill in your local endpoint URLs and preferred models.
3. Run `bun run src/index.ts` or `node src/index.ts`.
4. Use `/help` in the REPL to see the current command surface.

## Local State

- `.env` and `.env.local` are ignored and may contain device-specific configuration.
- `.crusty/` is ignored and contains local config, memory, queue state, and orchestrator documents.
- `/clear` resets the app back to its env-backed first-run state.

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

The next meaningful pieces are runtime telemetry, model-switching backed by evidence, a terminal HUD, and a browser GUI with parity for observability and control.
