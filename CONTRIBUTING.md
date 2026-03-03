# Contributing to Local Crew

Thank you for your interest in contributing to Local Crew. This document covers the workflow for reporting issues, submitting changes, and meeting the quality bar required for merge.

## Getting Started

1. Fork the repository and clone your fork
2. Install dependencies: `npm install`
3. Bootstrap the orchestrator: `npm run setup:crew`
4. Start the app: `npm start` or `bun run src/index.ts`

### Prerequisites

- **Node.js** >= 20.0.0
- **Bun** (for running tests): install from [bun.sh](https://bun.sh)
- **Ollama** (optional, for local inference): install from [ollama.com](https://ollama.com)

## Development Workflow

### Running the App

```bash
npm start              # Start with Node
bun run src/index.ts   # Start with Bun directly
```

### Running Tests

```bash
npm test                          # Run all tests
bun test test/commands.test.ts    # Run a single test file
```

### Type Checking

```bash
bunx tsc --noEmit
```

## AI-Assisted Review (Required)

All pull requests must pass a review by a supported AI code reviewer before submission.

**Accepted reviewers:**
- **Claude Sonnet 4.6** or **Claude Opus 4.6** (recommended — use [Claude Code](https://claude.ai/code) or claude.ai)
- **OpenAI Codex 5.3** or above

**How to run a review with Claude Code:**

Run `/code-review` in Claude Code, or ask Claude to review your staged changes. Address any high-confidence issues flagged before opening the PR. Include a one-line summary in your PR description:

> _"Claude Sonnet 4.6 review: no issues found"_
> _"Codex 5.3 review: addressed 2 flagged issues before submission"_

**Grok is not an accepted reviewer for this codebase.** PRs citing Grok as the review tool will be returned for re-review by an accepted model. Other models may be used for exploration and drafting, but Claude 4.6 (Sonnet or Opus) or Codex 5.3+ must provide the final sign-off on any code merged to `main`.

## Code Style

- **TypeScript** with ESM imports using explicit `.ts` suffixes (`import { foo } from "./bar.ts"`)
- `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`, strict mode
- 2-space indentation, double quotes, semicolons
- Small, focused functions — avoid large monolithic methods
- Tests use `bun:test` and live in `test/*.test.ts`
- Tests must be isolated with temp directories — never write to real `.localcrew/`

## Zero External Dependencies

Local Crew has a deliberate zero-dependency policy. Runtime code must use built-in platform APIs only:

- Native `fetch` for HTTP
- `node:fs/promises` for file I/O
- `node:child_process` for process management
- Standard Web APIs available in Bun/Node

**Rationale:** minimal attack surface, maximum portability, easy auditability. Do not add runtime dependencies without explicit maintainer approval and a documented exception.

## Web Tools & Grounding

Local Crew exposes six grounding tools to orchestrators and agents via a marker-based protocol. Models emit a special line in their response; the app parses it, resolves the tool, and re-prompts with the result.

| Marker | Format | Tool |
|--------|--------|------|
| `WIKIPEDIA:` | `WIKIPEDIA: query` | Wikipedia search (factual grounding) |
| `REDDIT:` | `REDDIT: query` | Reddit search (technical subreddits only) |
| `SEARCH[topic]:` | `SEARCH[software-engineering]: query` | DuckDuckGo (topic-gated) |
| `WEATHER:` | `WEATHER: city or zip` | Open-Meteo forecast |
| `BENLIVE:` | `BENLIVE: /path or topic` | benlive.tv content |
| `WEBSITE:` | `WEBSITE: /path or topic` | Personal website (requires `/preferences website`) |

When extending or adding tools, follow the pattern in `src/wikipedia.ts` and `src/reddit.ts`:

1. New module in `src/` with a `fetchFn` parameter for testability
2. `parseXxxRequest()` in `app.ts` — regex against model output
3. `resolveXxxTool()` in `app.ts` — fetch, audit, re-prompt
4. Add to `resolveExternalTools()` chain in `app.ts`
5. Add marker instruction to all five prompt builders in `src/messages.ts`
6. Tests in `test/xxx.test.ts` using mock fetch (no real HTTP in tests)

## Submitting Changes

1. Create a feature branch from `main`
2. Make focused, narrowly scoped commits using conventional commit messages:
   - `feat: add resource health monitoring`
   - `fix: prevent race condition in telemetry writes`
   - `docs: document /compact CLI command`
   - `test: add coverage for resource routing`
3. Run `npm test` and ensure all tests pass
4. Run the AI review pass described above
5. Open a pull request with:
   - A short summary of what changed and why
   - User-facing impact description
   - Test coverage notes
   - AI review summary (one line)
   - Screenshots only if UI behavior changed

## Reporting Issues

Open a GitHub issue with:
- Steps to reproduce
- Expected vs actual behavior
- Node.js/Bun version and OS
- Relevant log output (redact any personal data or API keys)

## Security

- **Never** commit `.localcrew/`, `.env`, `.env.local`, or local agent memory
- `external-memory/` is the committed portable seed layer — only stable, validated content belongs here
- Machine-specific configuration belongs in gitignored local files
- When adding provider support, preserve the boundary between public-safe repo defaults and install-local secrets
- If you discover a security vulnerability, please report it privately rather than opening a public issue

## Project Structure

| Module | Purpose |
|--------|---------|
| `src/index.ts` | Entry point and REPL loop |
| `src/app.ts` | Core orchestration class — mode state, chat dispatch, tool resolution |
| `src/commands.ts` | Parse slash-command input → typed `Command` union |
| `src/types.ts` | All shared TypeScript types and interfaces |
| `src/config.ts` | Load/save participant config and user preferences |
| `src/resources.ts` | Resource CRUD, tier routing, capacity summary |
| `src/messages.ts` | Build prompt message arrays for all chat/auto/agent contexts |
| `src/ollama.ts` | HTTP calls to inference endpoints (ollama, openai, anthropic) |
| `src/telemetry.ts` | Append audit events, index into telemetry summary |
| `src/wikipedia.ts` | Wikipedia search + chunking |
| `src/reddit.ts` | Reddit search (technical subreddit allowlist) |
| `src/page-fetcher.ts` | Shared HTML-to-text stripping and chunking utility |
| `src/web-search.ts` | Topic-gated DuckDuckGo HTML search scraping + normalization |
| `src/weather.ts` | Open-Meteo geocoding and forecast fetch |
| `src/benlive.ts` | benlive.tv content fetcher with llms.txt discovery |
| `src/website.ts` | Configurable personal website content fetcher |
| `src/orchestrator-store.ts` | Agent specs, system documents, auto state persistence |
| `src/dropbox.ts` | inbox → active → outbox file workflow |
| `src/api-server.ts` | Fork `api-worker.js` as child process; proxy HTTP ↔ IPC |
| `src/gui.ts` | Inline browser dashboard HTML/CSS/JS (served via API) |
| `src/storage.ts` | Low-level file read/write helpers for `.localcrew/` |
| `src/session-store.ts` | Load/save shared conversation transcript |
| `src/compact.ts` | Conversation compaction (summarize old messages) |

See [CLAUDE.md](./CLAUDE.md) and [docs/architecture.md](./docs/architecture.md) for a deeper architectural overview.
