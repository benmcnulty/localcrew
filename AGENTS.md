# Repository Guidelines

## Build and Test

```bash
npm test                    # run full test suite (bun test)
bun test test/foo.test.ts   # single file
bunx tsc --noEmit           # type check only
npm run start               # run CLI + API with Node
npm run start:bun           # run with Bun runtime
npm run setup:crew          # bootstrap primary orchestrator device
node scripts/setup-agent.js # onboard a secondary agent device
```

## Architecture

`src/app.ts` (`LocalCrewApp`) is the orchestration hub — it owns mode state, command dispatch, and chat routing. Keep new logic outside of it when it belongs to a focused module instead.

Module boundaries (each has a single job; do not mix concerns):

| Module | Responsibility |
|---|---|
| `types.ts` | Type/interface definitions only — no logic |
| `utils.ts` | Pure functions, no I/O (see shared helpers below) |
| `storage.ts` | File read/write primitives + `getStoragePaths()` |
| `commands.ts` | Parse slash-command input → typed `Command` union |
| `ollama.ts` | HTTP calls to inference endpoints (ollama, openai, anthropic) |
| `messages.ts` | Build prompt message arrays — no I/O |
| `resources.ts` | Resource CRUD, tier routing, capacity summary, network topology |
| `config.ts` | Load/save participant config from `.localcrew/config.json` |
| `session-store.ts` | Load/save shared conversation transcript |
| `orchestrator-store.ts` | Agent specs, system documents, auto state persistence |
| `api-server.ts` | Fork + IPC management for the HTTP child process |
| `compact.ts` | Conversation compaction (summarize old messages) |
| `telemetry.ts` | Append audit events, index into telemetry summary |
| `dropbox.ts` | inbox → active → outbox file workflow |
| `env.ts` | Environment variable loading from `.env` / `.env.local` |
| `wikipedia.ts` | Wikipedia search + chunking for factual grounding |
| `reddit.ts` | Reddit search tool |
| `web-search.ts` | DuckDuckGo web search (topic-gated) |
| `page-fetcher.ts` | HTML fetch, strip, and chunking shared by web tools |
| `weather.ts` | Open-Meteo weather forecast tool |
| `benlive.ts` | Ben Live content tool via llms.txt discovery |
| `website.ts` | Personal website content tool |
| `resource-discovery.ts` | Probe resource endpoints for available models |
| `orchestrator-identity.ts` | Orchestrator name/alias from config + env |
| `external-memory.ts` | Read committed seed documents from `external-memory/` |
| `internal-files.ts` | Read + search internal orchestrator memory files |
| `speech.ts` | macOS `say` voice playback |
| `voices.ts` | Voice preset definitions and defaults |
| `gui.ts` | Inline browser UI HTML/CSS/JS (served via API) |
| `terminal.ts` | ANSI colors, OSC 8 links, styled prompts, tab completion, status bar |
| `daily-work.ts` | Daily Work briefing document: staleness detection, load/save, API snapshot |

Storage layout: `external-memory/` is committed seed data; `.localcrew/` is ignored local runtime state. Never commit `.localcrew/`, `.env`, or `.env.local`.

## Code Style

- TypeScript ESM with explicit `.ts` suffixes on all local imports: `import { foo } from "./bar.ts"`
- Node built-ins with `node:` prefix: `import { readFile } from "node:fs/promises"`
- Use `import type` for type-only imports
- 2-space indent, double quotes, semicolons, trailing commas on multiline
- `tsconfig.json`: `NodeNext` module/resolution, `strict: true`, `noEmit: true`

## Project Conventions

**Zero external dependencies** — no `dependencies` or `devDependencies` in `package.json`. Use Node built-ins and Bun's bundled APIs only. Do not add npm packages.

**Shared utilities** — before adding a helper, check `src/utils.ts` first:
- `titleCase` / `capitalize` — string formatting
- `normalizeAlias(alias)` — trim + strip `@` + lowercase, used for participant aliases
- `trimTrailingSlash(url)` — strip trailing `/` from base URLs
- `getEmptyConversation()` — zeroed `SharedConversationState`
- `getErrorMessage(error)` — safe `unknown` → `string` extraction
- `ANTHROPIC_VERSION` — `"2023-06-01"` constant for Anthropic headers

**Atomic writes** — all JSON state file writes must go through `atomicWriteFile()` (or `atomicWriteFileSync()`) from `src/storage.ts`. Plain `writeFile` directly on a live state path is a bug.

**Concurrency** — use `withFileLock(filePath, fn)` from `src/storage.ts` when a flow reads, mutates, then writes the same file (e.g., load→update→save on telemetry or resources).

**Provider model** — endpoint API style is `"ollama" | "openai" | "anthropic"` (`EndpointApiStyle`). Resource tiers are `"top" | "mid" | "low"`. Resource roles are `"primary-orchestrator" | "orchestrator" | "agent"` (`ResourceRole`). Auth is stored as an env var name (`apiKeyEnv`), never the key value.

**Network topology** — resources can be assigned roles and subordinate agents via `/topology` commands. Only top-tier resources with ≥16k context are orchestrator-capable (`isOrchestratorCapable()` in `resources.ts`). Complex tasks in `/auto` are automatically delegated to idle sub-orchestrators.

## Testing

Tests use `bun:test` (`import { describe, expect, test } from "bun:test"`). Every test touching the filesystem must use the `withTempDir` pattern — create an OS temp dir, pass it as `rootDir` to all storage functions, and clean up in `finally`. Never write to the real `.localcrew/`. See `test/core.test.ts` for the canonical pattern.

## Security

- No hardcoded secrets, node addresses, or machine-specific values in source — use ignored env files
- API authentication uses `LOCALCREW_API_TOKEN` (Bearer token); CORS origin is `LOCALCREW_API_CORS_ORIGIN`
- All mutating API endpoints require Bearer token authentication when `LOCALCREW_API_TOKEN` is set; read-only display paths (`/display`, `/api/events`, `/api/status`, `/api/health`, `/api/daily-work`, `/api/queue`, `/api/resources`, `/api/audit`) and static UI assets are public to support unauthenticated billboard access
- Audit log writes use `withFileLock` to prevent corruption on concurrent appends
- Changelog appends are serialized with `withFileLock` and written atomically
- Dropbox inbox ingestion uses `withFileLock` to prevent double-processing under concurrent auto-pulse
- `readInternalFile()` validates paths stay within `.localcrew/system/` or `external-memory/` via `relative()` containment check
- `ensureSafeRelativePath()` (dropbox) rejects `..`, hidden files, and empty segments
- `ensureSafeGeneratedRelativePath()` (app.ts) prevents traversal in autonomous WRITE blocks
- `loadSeedFile()` validates the resolved path stays within the external-memory directory
- Agents receive only their own spec and memory in prompts — not the full orchestrator state
- Autonomous writes are redirected away from external dropbox by `shouldPreferInternalWrite()`

## File Access Layers

Autonomous agents interact with the file system through a layered architecture with strict boundaries:

| Layer | Module | Access | Sandboxed |
|---|---|---|---|
| Atomic primitives | `storage.ts` | `atomicWriteFile()`, `withFileLock()` | N/A |
| Internal files | `internal-files.ts` | Read + search `.localcrew/system/` and `external-memory/` | Yes — path traversal prevented |
| External memory | `external-memory.ts` | Read-only committed seed documents | Yes — path escape validated |
| Dropbox workflow | `dropbox.ts` | inbox → active → outbox file lifecycle | Yes — `ensureSafeRelativePath()` |
| Autonomous writes | `app.ts` | WRITE[internal], WRITE[active], WRITE[outbox] blocks | Yes — `ensureSafeGeneratedRelativePath()` |
| API explore | `api-server.ts` | `/api/explore/tree`, `/api/explore/file`, `/api/explore/search` | Yes — delegates to `readInternalFile()` / `searchInternalFiles()` |

### Search Capability

`searchInternalFiles(query, rootDir)` provides case-insensitive full-text search across `.localcrew/system/` and `external-memory/`. Returns up to 100 matching lines with file paths and line numbers. Exposed via `GET /api/explore/search?q=<query>` (auth required). Binary files and files larger than 512 KB are skipped.
