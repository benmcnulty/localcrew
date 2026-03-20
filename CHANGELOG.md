# Changelog

All notable changes to Local Crew are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.1.0] — 2026-03-19

Initial public release.

### Added

**Core orchestration**
- Multi-device inference network: pool Ollama, OpenAI-compatible, and Anthropic endpoints across a LAN into one managed crew
- Resource registration with tier classification (`top` / `mid`) and hardware metadata (CPU, RAM, VRAM, context tokens)
- Capability-based routing: orchestrator scores resources by availability, memory headroom, and model assignment
- Hierarchical topology: sub-orchestrators coordinate their own subordinate agents for complex multi-step delegation

**Operating modes**
- Command mode (default): slash commands + one-shot plain-text prompts
- Chat mode (`/chat`): 1-on-1 conversation with a participant, persistent context
- Group mode (`/group`): all participants respond in round-robin
- Auto mode (`/auto`): autonomous queue-based orchestration with 3-phase consensus (draft → review → finalize), tool resolution, quality verification, and failure recovery
- Agent mode (`/agent <name>`): chat with a named agent that has its own spec, memory, and resource binding

**Virtual agent identities**
- Named participants with custom instructions, model bindings, and configurable voice (macOS)
- Per-agent isolated memory that persists across sessions
- Built-in agent specs in `external-memory/agents/`

**Persistent memory**
- Orchestrator directives, roadmap, focus-todo, changelog, and per-agent private memory
- Session transcript with compaction (`/compact`) for long-running sessions

**Web grounding tools** (no API keys required)
- Wikipedia search + chunking
- Reddit search (tech subreddits)
- DuckDuckGo web search (topic-gated: news, jobs, software-engineering, ai-engineering)
- Open-Meteo weather forecast
- benlive.tv content fetcher
- Personal website fetcher (configurable via `/preferences set website`)

**Browser dashboard** (`/ui`)
- Resource management, queue controls, direct chat, file explorer, and settings
- Live SSE event stream for real-time updates

**Billboard display** (`/display`)
- Full-screen neon dashboard for TV / monitor wallboard use
- Auto-pause mode (default) suspends updates when tab is hidden; `?active=1` for persistent monitor mode
- Live SSE: orchestrator status, metric tiles, current task, auto log feed, per-resource status bars

**Remote Port bridge**
- Authenticate orchestrator with benlive.tv/port via device token (`/login <token>`)
- Browse shared Captain logs from the CLI (`/port feed`)
- Publish Captain-authored updates (`/port post`)

**Telemetry and audit**
- Per-model token and duration tracking
- Daily session digests (`/daily start`, `/daily finish`)
- Transactional audit log with file locking

**Provider support**
- `ollama` style (default)
- `openai` style (LM Studio, OpenRouter, OpenAI, vLLM, llama.cpp server)
- `anthropic` style (Anthropic API)

**Developer experience**
- Zero runtime dependencies — runs on Node.js built-ins only
- TypeScript strict mode throughout
- Full test suite (`bun test`)
- Cross-platform Ollama benchmark and optimization scripts (macOS, Windows, Linux)
- Network connectivity test script (`scripts/network-test.js`)
- Automated orchestrator and agent setup scripts

**Voice (macOS)**
- TTS voice presets per participant via macOS `say` command
- Configurable via `/voice` commands

### Known limitations

- Web search depends on upstream provider markup (DuckDuckGo HTML, Reddit API). Parser adjustments may be needed if upstream changes.
- Billboard always-active mode (`?active=1`) uses persistent live updates and is higher resource usage than the default auto-pause mode.
- Auto mode input deduplication: rapid identical submissions may produce duplicate queue entries.
- Resource `maxContextTokens` may not persist across all refresh paths in the current release.
- Output identifier format is not fully standardized (`Label (alias)` vs alias-only) across all surfaces.
- Python-based autonomous tool authoring is not yet enabled (planned; see `docs/release-readiness.md`).

[0.1.0]: https://github.com/benmcnulty/localcrew/releases/tag/v0.1.0
