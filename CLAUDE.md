# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install             # install dependencies (Node-first project)
npm run start           # start the CLI + local API/UI (via Node)
npm run start:node      # same as above, explicit Node runtime
npm run start:bun       # start with Bun runtime
bun run src/index.ts    # start with bun directly
npm test                # run test suite (uses bun test internally)
npm run setup:crew      # bootstrap primary orchestrator device
node scripts/setup-agent.js  # onboard a secondary agent device
```

Run a single test file:
```bash
bun test test/commands.test.ts
```

TypeScript type checking (no emit, strict mode):
```bash
# not currently wired into the default validation flow
bunx tsc --noEmit
```

## Architecture

Local Crew is a local-first multi-device inference orchestrator with a REPL CLI and browser UI.

### Entry Point & REPL Loop

`src/index.ts` bootstraps the app and runs the main REPL loop. It creates a `LocalCrewApp` instance, starts the API server, then handles user input: parsing commands (`commands.ts`), dispatching to `app.execute()`, and rendering viewer overlays (`/status`, `/hud`, `/explore`). Background auto-pulse fires on an interval when `/auto` mode is active.

### Core App (`src/app.ts`)

`LocalCrewApp` is the central orchestration class. It owns:
- Mode state: `command | chat | group | auto | agent`
- Chat dispatch to participants/resources via `ollama.ts`
- Auto queue processing and idle cycle logic
- Agent management, dropbox workflow, Wikipedia grounding
- All REPL command handlers

### Two Key Concepts

- **Participants** (`@erin`, `@zora`, etc.): Named chat personas with nicknames, instructions, resource bindings, and model selections. Stored in `.localcrew/config.json`.
- **Resources**: Underlying inference endpoints (Ollama, OpenAI-compatible, Anthropic) registered in `.localcrew/resources.json`. Routed by tier: `top` → `mid` → `low`.

### Storage Boundary

| Layer | Location | Tracked |
|---|---|---|
| Prompt components | `external-memory/prompts/components/` | Yes |
| Committed seed data | `external-memory/` | Yes |
| Local runtime state | `.localcrew/` | No (gitignored) |
| Env config | `.env`, `.env.local` | No (gitignored) |

Key local state files:
- `.localcrew/config.json` — participant routing, orchestrator profile
- `.localcrew/resources.json` — device inventory with tier/hardware metadata
- `.localcrew/sessions.json` — shared chat transcript + compaction state
- `.localcrew/system/state.json` — auto queue (pending + completed tasks)
- `.localcrew/system/secure/orchestrator/telemetry/audit-log.jsonl` — append-only transaction log

### Module Map

| Module | Purpose |
|---|---|
| `commands.ts` | Parse slash-command input → typed `Command` union |
| `types.ts` | All shared TypeScript types |
| `utils.ts` | Pure helper functions, no I/O |
| `config.ts` | Load/save participant config from `.localcrew/config.json` |
| `resources.ts` | Resource CRUD, tier-based routing, capacity summary, network topology |
| `orchestrator-store.ts` | Agent specs, system documents, auto state persistence |
| `messages.ts` | Build prompt message arrays for chat/auto/agent contexts (async, loads from components) |
| `prompt-loader.ts` | Load, cache, interpolate, and compose prompt component files |
| `quality.ts` | Pure quality-verification functions (substantive output, duplicate detection, term extraction) |
| `ollama.ts` | HTTP calls to inference endpoints (all three provider styles) |
| `resource-discovery.ts` | Probe resource endpoints for available models |
| `api-server.ts` | Fork `api-worker.js` as a child process; proxy HTTP ↔ IPC |
| `telemetry.ts` | Append audit events, index into telemetry summary |
| `dropbox.ts` | inbox → active → outbox file workflow |
| `env.ts` | Environment variable loading from `.env` / `.env.local` |
| `wikipedia.ts` | Constrained Wikipedia search + chunking for grounding |
| `reddit.ts` | Reddit search tool |
| `web-search.ts` | DuckDuckGo web search (topic-gated) |
| `page-fetcher.ts` | HTML fetch, strip, and chunking shared by web tools |
| `weather.ts` | Open-Meteo weather forecast tool |
| `benlive.ts` | Ben Live content tool via llms.txt discovery |
| `website.ts` | Personal website content tool |
| `compact.ts` | Conversation compaction (summarize old messages) |
| `storage.ts` | Low-level file read/write helpers for `.localcrew/` |
| `session-store.ts` | Load/save shared conversation transcript |
| `orchestrator-identity.ts` | Orchestrator name/alias from config + env |
| `external-memory.ts` | Read committed seed documents from `external-memory/` |
| `internal-files.ts` | Read + search internal orchestrator memory files |
| `speech.ts` | macOS `say` voice playback |
| `voices.ts` | Voice preset definitions and defaults |
| `gui.ts` | Inline browser UI HTML/CSS/JS (served via API) |
| `terminal.ts` | ANSI colors, OSC 8 links, styled prompts, tab completion |
| `daily-work.ts` | Daily Work briefing document: staleness, load/save, API |
| `sandbox.ts` | Sandboxed Python/JS script execution with static analysis |

### API Server Architecture

The HTTP API runs in a **forked child process** (`api-worker.js`) to avoid blocking the REPL. The parent (`api-server.ts`) communicates via IPC — requests arrive at the worker, it sends them to the parent over IPC, the parent calls `app` methods, then sends responses back. Controlled by env vars: `LOCALCREW_API_ENABLED`, `LOCALCREW_API_BIND_HOST`, `LOCALCREW_API_PUBLIC_HOST`, `LOCALCREW_API_PORT` (default 4310).

### Auto Mode & Queue

In `/auto`, the orchestrator processes queued tasks by tier-routing to resources. When the queue is empty, it checks `external-memory/inbox` for dropbox documents. Tasks can request Wikipedia grounding by emitting `WIKIPEDIA: query` in model output — Local Crew fetches, chunks, logs, and re-prompts.

### Prompt Architecture

All prompt text lives in `external-memory/prompts/components/`. See `docs/PROMPT_ARCHITECTURE.md` for the full component catalog, context assembly map per builder, template variable reference, and editing guide.

## Code Style

- TypeScript with ESM imports using explicit `.ts` suffixes (`import { foo } from "./bar.ts"`)
- `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`, strict mode
- 2-space indent, double quotes, semicolons
- Tests use `bun:test` (`import { describe, expect, test } from "bun:test"`)
- Test files: `test/*.test.ts`, isolated with temp directories — never write to real `.localcrew/`
