# Crusty

Crusty is a local-first orchestration CLI for multi-device inference networks. It gives you a shared conversational shell, autonomous `/auto` mode, persistent orchestrator memory, agent identities, queue-based delegation, web grounding tools, transactional telemetry, a local browser dashboard, and observability tools such as `/status`, `/hud`, and `/explore`.

Local node addresses, model assignments, and hardware-specific notes are loaded from ignored env files — nothing machine-specific is committed to source.

Provider foundation is built around:
- `ollama` for local Ollama endpoints
- `openai` for OpenAI-compatible endpoints such as LM Studio, OpenRouter, OpenAI, and similar custom-compatible services
- `anthropic` for Anthropic-style endpoints

## Current Features

- Shared chat, group chat, and autonomous orchestrator modes
- Dynamic participant bindings, nicknames, and per-participant model selection
- Participant voices through macOS `say`
- Shared queue with priorities and background auto pulse
- Load-aware, hardware-aware resource routing with optional CPU/RAM/GPU/context metadata
- Agent identity creation, editing, and private memory
- Built-in `data-analyst` agent seeded from committed external system memory
- Transactional audit logging and per-model telemetry summaries
- Wikipedia and Reddit search for factual grounding in orchestrator and agent tasks
- DuckDuckGo web search (topic-gated: news, jobs, software-engineering, ai-engineering)
- Weather forecasts via Open-Meteo (no API key required, preferences-aware location)
- Ben Live skill — built-in access to benlive.tv with llms.txt discovery
- Personal website tool — configurable via `/preferences website <url>`
- User preferences (`/preferences`) for weather location, website URL, and daily digest directive
- Daily work sessions (`/daily start | finish | status`) with task tracking and digest generation
- Local HTTP API and browser dashboard served from the same surface
- External dropbox flow through `external-memory/inbox`, `external-memory/active`, and `external-memory/outbox`
- Local orchestrator state under `.crusty/`
- Internal file explorer plus status and HUD views in the terminal
- Cross-platform Ollama benchmark scripts for macOS, Windows 11, and Linux
- Hierarchical network topology: any capable device can serve as a sub-orchestrator with its own subordinate agents
- Dynamic resource role management with `/topology` commands for assigning roles, delegating agents, and viewing the network hierarchy

## Quick Start

1. Run `npm run setup:crusty` on the best local device with Ollama or another supported endpoint. This primary device becomes your local agent orchestrator. The setup flow prompts for the agent-orchestrator name, preloads the existing local name when you rerun setup later, and then starts Crusty automatically in the same terminal.
2. Open the printed `Local UI` link or stay in the CLI and use `/help`.
3. Bring the next best agent device online and run `node scripts/setup-agent.js` on that device, or use the standalone `setup-agent.js` download when that is published. The Crusty setup output shows the full primary-device IP to remember. The agent setup prompt pre-fills the first three IP numbers from the local network, and you confirm or enter the final number before it tests the connection. It then prompts for a device nickname, shows a verified configuration summary, syncs the verified configuration, and stays running as a local monitor by default. For local endpoints, that monitor exposes a narrow agent gateway URL for the orchestrator and keeps requests limited to the configured orchestrator IP instead of requiring broad LAN exposure of the underlying inference service. Re-running it on the same device replaces that device's prior synced listing instead of duplicating it and reuses prior local setup values when available. Use `--once` if you want a one-shot setup run instead of the persistent monitor. For OpenAI-compatible or Anthropic endpoints, pass `--api-style openai|anthropic` and optionally `--api-key-env YOUR_ENV_NAME`; the named env var must exist on the orchestrator for live use after sync. You can still add devices manually with `/resource add <alias> "Label" <baseUrl> [top|mid|low] [ollama|openai|anthropic]`.

Once the orchestrator is up, the fast validation path is:

- use `/participant list`, `/nickname`, `/bind`, `/model`, and `/models` to shape the chat roster
- use `/chat`, `/group`, and `/direct <resource> "message" [model]` to confirm each node is reachable and behaving as expected
- use `/resource refresh <alias>` when models change and `/resource edit <alias>` to fill in hardware and context metadata the endpoint cannot self-report yet
- use `/ui` for the matching browser prototype with editable resources, participants, and direct test chat

The orchestrator identity name is install-local and comes from `CRUSTY_ORCHESTRATOR_NAME` or `npm run setup:crusty -- --name "Your Name"`.

Notable views:

- `/status` for a point-in-time overview
- `/hud` for a live terminal dashboard with `status`, `queue`, `metrics`, and `detail` tabs via left/right arrow keys
- `/explore` for direct inspection of internal state files
- `/ui` in a browser for the prototype GUI backed by the same local API
- `/resource list` and `/resource edit <alias>` for dynamic device inventory management

Additional CLI commands:

- `/priority [high|medium|low]` — set default priority for queued tasks
- `/rename <oldAlias> <newAlias>` — rename a participant alias
- `/reset` — reset the current session transcript
- `/compact` — compact the conversation by summarizing older messages
- `/default [alias]` — set or show the default participant for chat
- `/instructions [@alias] ["text"]` — view or set custom instructions for a participant
- `/sound [on|off]` — toggle voice playback (macOS only)
- `/voice [@alias] [preset|list]` — set or list available voice presets
- `/promote <alias>` — reassign the primary orchestrator role to a different device
- `/topology` — view the current network hierarchy
- `/topology assign <alias> <role>` — assign a resource role (`primary-orchestrator`, `orchestrator`, or `agent`)
- `/topology delegate <orchestrator> <agent>` — assign an agent as a subordinate of a sub-orchestrator
- `/topology undelegate <orchestrator> <agent>` — remove an agent from a sub-orchestrator's subordinates
- `/preferences` — view configured preferences
- `/preferences set city "San Francisco"` — set default weather city
- `/preferences set zipCode 94102` — set default weather zip code
- `/preferences set website https://example.com` — set personal website URL
- `/preferences set directive "..."` — set daily digest directive
- `/daily status` — show current daily work session state
- `/daily start` — begin a tracked daily work session
- `/daily finish` — complete the session and generate a digest
- `/clear` — reset the app back to its env-backed first-run state
- `/end` — end the current chat or group session
- `/exit` — exit Crusty

## Hierarchical Orchestration

Crusty supports hierarchical device topologies where multiple devices can serve as orchestrators, each coordinating their own subordinate agents.

**Resource roles:**
- `primary-orchestrator` — the main device running the REPL and managing the overall network
- `orchestrator` — a sub-orchestrator capable of independently coordinating complex tasks with its own agents
- `agent` — a worker device that executes tasks assigned by an orchestrator

**Orchestrator eligibility:** Only top-tier devices with ≥16k context tokens qualify as orchestrators (set via `ORCHESTRATOR_CAPABLE_CONTEXT_THRESHOLD`).

**How delegation works:**
1. Use `/topology assign workhorse orchestrator` to mark a device as a sub-orchestrator
2. Use `/topology delegate workhorse helper` to assign an agent under that sub-orchestrator
3. In `/auto` mode, complex multi-step tasks are automatically routed to idle sub-orchestrators, which coordinate with their subordinate agents
4. Sub-orchestrators operate autonomously — they can continue processing even if the primary is offline

**Example topology:**
```
Primary: @erin (32k ctx)
  └─ agent: @min (8k ctx)
Sub-Orchestrator: @zora (16k ctx)
  └─ agent: @pav (8k ctx)
```

Use `/topology` to view the live hierarchy at any time.

## Web Tools & Grounding

Crusty exposes six external data tools to orchestrators and agents. Models emit a special marker line in their response; the app resolves the tool and re-prompts with the results.

| Marker | Example | Tool |
|--------|---------|------|
| `WIKIPEDIA: query` | `WIKIPEDIA: transformer architecture` | Wikipedia search |
| `REDDIT: query` | `REDDIT: best rust async runtime` | Reddit (tech subreddits only) |
| `SEARCH[topic]: query` | `SEARCH[software-engineering]: typescript generics` | DuckDuckGo web search |
| `WEATHER: location` | `WEATHER: San Francisco` | Open-Meteo weather forecast |
| `BENLIVE: path` | `BENLIVE: /blog` | benlive.tv content |
| `WEBSITE: path` | `WEBSITE: /about` | Personal website (requires `/preferences website`) |

Web search is topic-gated to: `news`, `jobs`, `software-engineering`, `ai-engineering`. This prevents internal orchestration decisions from leaking to external search and keeps queries focused on current real-world information.

## Local State

- `.env` and `.env.local` are ignored and may contain device-specific configuration.
- `.crusty/` is ignored and contains local config, memory, queue state, and orchestrator documents.
- `external-memory/` is committed and contains durable seed directives, workflows, and built-in agent specs that are restored on fresh installs.
- `external-memory/inbox`, `external-memory/active`, and `external-memory/outbox` are tracked only as folders; their contents stay local and untracked.
- `/clear` resets the app back to its env-backed first-run state.

## Local API

- `GET /api/health`
- `GET /api/status`
- `GET /api/hud?tab=status|queue|metrics|detail`
- `GET /api/queue`
- `GET /api/telemetry`
- `GET /api/audit?limit=20`
- `GET /api/agents`
- `GET /api/chat-config`
- `GET /api/resources`
- `GET /api/participants`
- `GET /api/models?target=@participant-or-resource`
- `GET /api/dropbox`
- `GET /api/explore/tree`
- `GET /api/explore/file?path=/full/path`
- `POST /api/command`
- `POST /api/edit`
- `POST /api/agent/create`
- `POST /api/dropbox/inbox`
- `POST /api/direct-chat`
- `POST /api/resources`
- `POST /api/resources/refresh`
- `POST /api/resources/sync`
- `POST /api/participants`
- `POST /api/orchestrator`
- `POST /api/login` currently returns a local placeholder until remote auth exists
- `DELETE /api/resources?alias=resource-alias`
- `DELETE /api/participants?alias=participant-alias`

Control the API listener with:

- `CRUSTY_API_ENABLED=true`
- `CRUSTY_API_BIND_HOST=0.0.0.0`
- `CRUSTY_API_PUBLIC_HOST=127.0.0.1`
- `CRUSTY_API_PORT=4310`
- `CRUSTY_API_CORS_ORIGIN=http://localhost:3000` — allowed CORS origin (omit for no CORS headers)
- `CRUSTY_API_TOKEN=your-secret` — optional Bearer token for API authentication

## Platform Scripts

- macOS: `scripts/ollama-optimize-macos.sh`
- Windows 11: `scripts/ollama-optimize-windows.ps1`
- Linux: `scripts/ollama-optimize-linux.sh`

Each script benchmarks a local Ollama endpoint, recommends a context length and concurrency tier, and writes a machine-readable profile JSON for later routing decisions. The intended onboarding flow is: bootstrap the primary Crusty device first with `npm run setup:crusty`, then bring secondary agent devices online with `node scripts/setup-agent.js`.

## Documentation

- Setup and local configuration: `docs/setup.md`
- Architecture and storage model: `docs/architecture.md`
- Product and orchestration roadmap: `docs/roadmap.md`
- Remote portal and auth planning: `docs/remote-portal.md`

## Near-Term Direction

The next meaningful pieces are measured routing policy, a richer browser GUI and write controls on top of the local API, private-first remote account connectivity with feature flags, and a safe promotion workflow that lifts validated internal discoveries into committed external-memory seeds while keeping runtime autonomy local.
