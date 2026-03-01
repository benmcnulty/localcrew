# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install             # install dependencies (Node-first project)
npm run start           # start the CLI + local API/UI (via Node)
bun run src/index.ts    # start with bun directly
npm test                # run test suite (uses bun test internally)
npm run setup:crusty    # bootstrap primary orchestrator device
node scripts/setup-agent.js  # onboard a secondary agent device
```

Run a single test file:
```bash
bun test test/commands.test.ts
```

TypeScript type checking (no emit, strict mode):
```bash
bunx tsc --noEmit
```

## Architecture

Crusty is a local-first multi-device inference orchestrator with a REPL CLI and browser UI.

### Entry Point & REPL Loop

`src/index.ts` bootstraps the app and runs the main REPL loop. It creates a `CrustyApp` instance, starts the API server, then handles user input: parsing commands (`commands.ts`), dispatching to `app.execute()`, and rendering viewer overlays (`/status`, `/hud`, `/explore`). Background auto-pulse fires on an interval when `/auto` mode is active.

### Core App (`src/app.ts`)

`CrustyApp` is the central orchestration class. It owns:
- Mode state: `command | chat | group | auto | agent`
- Chat dispatch to participants/resources via `ollama.ts`
- Auto queue processing and idle cycle logic
- Agent management, dropbox workflow, Wikipedia grounding
- All REPL command handlers

### Two Key Concepts

- **Participants** (`@erin`, `@zora`, etc.): Named chat personas with nicknames, instructions, resource bindings, and model selections. Stored in `.crusty/config.json`.
- **Resources**: Underlying inference endpoints (Ollama, OpenAI-compatible, Anthropic) registered in `.crusty/resources.json`. Routed by tier: `top` → `mid` → `low`.

### Storage Boundary

| Layer | Location | Tracked |
|---|---|---|
| Committed seed data | `external-memory/` | Yes |
| Local runtime state | `.crusty/` | No (gitignored) |
| Env config | `.env`, `.env.local` | No (gitignored) |

Key local state files:
- `.crusty/config.json` — participant routing, orchestrator profile
- `.crusty/resources.json` — device inventory with tier/hardware metadata
- `.crusty/sessions.json` — shared chat transcript + compaction state
- `.crusty/system/state.json` — auto queue (pending + completed tasks)
- `.crusty/system/secure/orchestrator/telemetry/audit-log.jsonl` — append-only transaction log

### Module Map

| Module | Purpose |
|---|---|
| `commands.ts` | Parse slash-command input → typed `Command` union |
| `types.ts` | All shared TypeScript types |
| `config.ts` | Load/save participant config from `.crusty/config.json` |
| `resources.ts` | Resource CRUD, tier-based routing, capacity summary |
| `orchestrator-store.ts` | Agent specs, system documents, auto state persistence |
| `messages.ts` | Build prompt message arrays for chat/auto/agent contexts |
| `ollama.ts` | HTTP calls to inference endpoints (all three provider styles) |
| `resource-discovery.ts` | Probe resource endpoints for available models |
| `api-server.ts` | Fork `api-worker.js` as a child process; proxy HTTP ↔ IPC |
| `telemetry.ts` | Append audit events, index into telemetry summary |
| `dropbox.ts` | inbox → active → outbox file workflow |
| `wikipedia.ts` | Constrained Wikipedia search + chunking for grounding |
| `compact.ts` | Conversation compaction (summarize old messages) |
| `storage.ts` | Low-level file read/write helpers for `.crusty/` |
| `session-store.ts` | Load/save shared conversation transcript |
| `gui.ts` | Inline browser UI HTML/CSS/JS (served via API) |

### API Server Architecture

The HTTP API runs in a **forked child process** (`api-worker.js`) to avoid blocking the REPL. The parent (`api-server.ts`) communicates via IPC — requests arrive at the worker, it sends them to the parent over IPC, the parent calls `app` methods, then sends responses back. Controlled by env vars: `CRUSTY_API_ENABLED`, `CRUSTY_API_BIND_HOST`, `CRUSTY_API_PUBLIC_HOST`, `CRUSTY_API_PORT` (default 4310).

### Auto Mode & Queue

In `/auto`, the orchestrator processes queued tasks by tier-routing to resources. When the queue is empty, it checks `external-memory/inbox` for dropbox documents. Tasks can request Wikipedia grounding by emitting `WIKIPEDIA: query` in model output — Crusty fetches, chunks, logs, and re-prompts.

## Code Style

- TypeScript with ESM imports using explicit `.ts` suffixes (`import { foo } from "./bar.ts"`)
- `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`, strict mode
- 2-space indent, double quotes, semicolons
- Tests use `bun:test` (`import { describe, it, expect } from "bun:test"`)
- Test files: `test/*.test.ts`, isolated with temp directories — never write to real `.crusty/`
