# Local Crew

**A local-first orchestration harness for multi-device AI inference networks.**

**Status:** experimental application, version 0.1.0. This repository contains the CLI, HTTP API, browser UI, and tests; it is not a claim of production certification. Use it to inspect and coordinate a trusted set of inference endpoints, starting with interactive commands before enabling autonomous work.

Local Crew turns every machine on your network into a coordinated inference node — your laptop, a desktop GPU rig, a spare mini PC, a cloud endpoint. You name each device, assign it a tier, and the orchestrator handles routing, delegation, quality verification, and memory. No cloud accounts required. No API keys unless you want them. Your models, your hardware, your data.

The system abstracts physical hardware behind **virtual agent identities** - named participants with their own instructions, model preferences, and voice - while a **resource delegation** layer routes work by capability, availability, and memory headroom. Agent instructions, routing decisions, and persisted state remain inspectable in the source and local files.

The local HTTP surface is built for LAN use out of the box. `/ui` and `/display` stay unauthenticated on the local network for ready-to-run collaboration, while the server rejects non-local clients by default. Remote authenticated access belongs to the separate Ben Live portal layer.

```
┌──────────────────────────────────────────────────┐
│  You                                             │
│   ↕                                              │
│  Orchestrator (CLI + API + Browser UI)           │
│   ├── @cap  → Device A (llama3.1:8b, top tier)   │
│   ├── @vic  → Device B (qwen3:14b, top tier)     │
│   ├── @min  → Device C (gemma3:4b, mid tier)     │
│   └── @pav  → Device D (llama3.2:3b, mid tier)   │
└──────────────────────────────────────────────────┘
```

### What you get out of the box

- **Multi-device inference** — pool Ollama, OpenAI-compatible, and Anthropic endpoints across your LAN into one managed network
- **Autonomous orchestration** — `/auto` mode fills a task queue through 3-phase consensus, routes tasks by resource scoring, resolves web tools, writes deliverables, verifies quality, and recovers from failures automatically
- **Virtual agent identities** — named participants with custom instructions, model bindings, and configurable voice (macOS)
- **Persistent memory** — orchestrator directives, roadmap, focus-todo, changelog, and per-agent private memory survive across sessions
- **Web grounding tools** — Wikipedia, Reddit, DuckDuckGo (topic-gated), weather, and website content tools that models invoke via marker lines
- **Browser dashboard** — local UI at `http://localhost:4310/ui` with resource management, queue controls, direct chat, file explorer, and settings
- **Billboard display** — full-screen neon dashboard at `/display` for monitor/TV wallboard use with live SSE updates
- **Remote Port bridge** — authenticate this orchestrator with Ben Live Port, browse shared logs from the CLI, and publish Captain-authored updates with `/port`
- **Hierarchical topology** — sub-orchestrators coordinate their own agents for complex multi-step delegation
- **Telemetry** — transactional audit logging, per-model token/duration tracking, daily session digests
- **Zero third-party runtime packages** - application code uses Node.js built-ins. Development still depends on Bun and downloaded TypeScript tooling; runtimes, model files, and external providers require their own trust decisions.

### How it improves over time

Local Crew is designed to get better the more you use it. The system generates actionable data through tracked metrics on resource usage (tokens, time, throughput) during task completion. This data feeds into routing decisions — the orchestrator scores resources by availability, memory headroom, and capability match, getting smarter about which device handles which kind of work. Agent memory accumulates context across sessions. Quality verification catches failures and triggers safe-mode recovery tasks. The goal is a default configuration that extracts the most from your full network immediately, then continuously improves itself as it has time to investigate the system and generate performance data.

## Getting Started

### Prerequisites

- **Node.js** 22.18.0+ and **npm**. `npm start` executes TypeScript directly using Node's built-in type stripping; Node 20 and older Node 22 releases do not support this command without additional tooling. See [Node's TypeScript documentation](https://nodejs.org/api/typescript.html).
- **Ollama** (recommended) — install from [ollama.com](https://ollama.com). Or any OpenAI-compatible / Anthropic endpoint.
- **Bun** (required for the test suite and `npm run validate`; optional for running the app) - install from [bun.sh](https://bun.sh)

### 1. Clone and install

```bash
git clone https://github.com/benmcnulty/localcrew.git
cd localcrew
npm install
```

### 2. Start Ollama

Start Ollama on every device that will serve as an inference endpoint:

```bash
OLLAMA_HOST=127.0.0.1:11434 ollama serve
```

On Windows PowerShell:

```powershell
$env:OLLAMA_HOST="127.0.0.1:11434"; ollama serve
```

This keeps the local Ollama API loopback-only on that device. Local Crew exposes a separate LAN-safe agent gateway for orchestrator-to-agent traffic, so you do not need to open Ollama itself to the full network.

Pull at least one model if you haven't already:

```bash
ollama pull llama3.1:8b
```

### 3. Bootstrap the orchestrator

On your best device (most RAM, best GPU), run:

```bash
npm run setup:crew
```

This prompts for:
- **Orchestrator name** — displayed in the CLI, browser UI, and future remote views
- **Weather location** — zip code or city for the autonomous weather tool
- **Job search** — whether to include job opportunity surfacing in daily sessions

The script discovers your local models, writes the managed `.env.local`, registers the primary resource, and starts Local Crew in the same terminal.

### 4. Add agent devices

On each additional device, with the repo cloned and `npm install` complete:

```bash
OLLAMA_HOST=127.0.0.1:11434 ollama serve   # in one terminal
npm run setup:agent                        # in another terminal
```

The agent setup:
- Pre-fills the local subnet — you confirm or enter the orchestrator's final IP octet
- Tests the connection to the orchestrator API
- Prompts for a device nickname
- Discovers available models
- Syncs the device to the orchestrator
- Prints the exact secure `ollama serve` command it expects for that machine
- Stays running as a local monitor that auto-restarts Ollama with a loopback-only bind if it dies, keeps a narrow agent gateway online for the orchestrator, and re-syncs models periodically

Re-running on the same device replaces the prior listing (no duplicates). Use `--once` for a one-shot setup without the persistent monitor.

For non-Ollama endpoints:
```bash
npm run setup:agent -- --api-style openai --api-key-env OPENAI_API_KEY
npm run setup:agent -- --api-style anthropic --api-key-env ANTHROPIC_API_KEY
```

### 5. Verify the network

```
/status             # orchestrator overview
/resource list      # all registered devices with tier, model, and endpoint
/topology           # hierarchical network view
```

Or open the browser dashboard at the printed `Local UI` link (e.g., `http://localhost:4310/ui`).

### 6. Connect to Port (optional)

If you want a shared remote collaboration surface for humans and authenticated Captain systems:

1. Open `https://benlive.tv/port/` and sign in.
2. Click the Local Crew connect control to generate a device token.
3. In Local Crew, run:

```bash
/login <token>
/port
/port feed public help
/port post mates daily-log "Shift complete. Queue is clear."
```

Port gives you a browser-accessible dashboard plus a tokenized collaboration feed where humans and orchestrators can coordinate updates, requests, and improvement plans through the same authenticated API surface.

### 7. Run an autonomous session

```
/model profile auto     # let the orchestrator pick models per task
/daily start            # begin daily session tracking
/auto                   # start autonomous orchestration
```

The orchestrator will fill a task queue through 3-phase consensus (draft → review → finalize), process tasks across your resources, resolve web tools, write deliverables, verify quality, and recover from failures. Monitor progress in the CLI, the browser UI, or the billboard display.

```
/stop                   # stop autonomous mode
/daily finish           # end session and generate digest
```

For extended overnight runs, see [docs/overnight-runbook.md](docs/overnight-runbook.md).

## Modes

| Mode | Entry | Description |
|------|-------|-------------|
| **Command** | Default | Slash commands execute; plain text goes to the default participant as a one-shot |
| **Chat** | `/chat` | 1-on-1 conversation with a participant, maintains context |
| **Group** | `/group` | All participants respond in round-robin |
| **Auto** | `/auto` | Autonomous orchestration with queue processing, tool resolution, quality verification |
| **Agent** | `/agent <name>` | Chat with a named agent identity that has its own spec, memory, and resource binding |

## Provider Support

Local Crew supports three inference API styles. Any endpoint speaking one of these protocols can join the network:

| Style | Examples | Flag |
|-------|----------|------|
| `ollama` | Ollama | Default |
| `openai` | LM Studio, OpenRouter, OpenAI, vLLM, llama.cpp server | `--api-style openai` |
| `anthropic` | Anthropic API | `--api-style anthropic` |

## Hierarchical Orchestration

Local Crew supports hierarchical device topologies where multiple devices can serve as orchestrators, each coordinating their own subordinate agents. Only top-tier devices with ≥16k context tokens qualify as sub-orchestrators.

```
Primary: @orchestrator (32k ctx)
  └─ agent: @min (8k ctx)
Sub-Orchestrator: @vic (16k ctx)
  └─ agent: @pav (8k ctx)
```

In `/auto` mode, complex multi-step tasks are automatically routed to idle sub-orchestrators, which coordinate with their subordinate agents independently.

```
/topology                                    # view the live hierarchy
/topology assign workhorse orchestrator      # mark a device as sub-orchestrator
/topology delegate workhorse helper          # assign an agent under it
/topology undelegate workhorse helper        # remove the delegation
/promote <alias>                             # reassign the primary orchestrator role
```

## Web Tools & Grounding

Models emit marker lines in their responses to invoke external data tools. The orchestrator resolves the tool, fetches the data, and re-prompts with the results — no API keys required for any built-in tool.

| Marker | Example | Source |
|--------|---------|--------|
| `WIKIPEDIA: query` | `WIKIPEDIA: transformer architecture` | Wikipedia search + chunking |
| `REDDIT: query` | `REDDIT: best rust async runtime` | Reddit (tech subreddits) |
| `SEARCH[topic]: query` | `SEARCH[software-engineering]: typescript generics` | DuckDuckGo web search |
| `WEATHER: location` | `WEATHER: San Francisco` | Open-Meteo forecast |
| `BENLIVE: path` | `BENLIVE: /blog` | benlive.tv content |
| `WEBSITE: path` | `WEBSITE: /about` | Personal website (set via `/preferences set website`) |

Web search topics: `news`, `jobs`, `software-engineering`, `ai-engineering`. Topic gating prevents internal orchestration decisions from leaking to external search.

## CLI Command Reference

### Session & Mode
| Command | Description |
|---------|-------------|
| `/chat` | Enter 1-on-1 chat mode |
| `/group` | Enter group chat (all participants) |
| `/auto` | Start autonomous orchestration |
| `/stop` | Stop autonomous mode |
| `/agent <name>` | Chat with a named agent |
| `/end` | End current chat/group session |
| `/exit` | Exit Local Crew |

### Resources & Network
| Command | Description |
|---------|-------------|
| `/resource list` | List all inference resources |
| `/resource add <alias> "Label" <url> [tier] [style]` | Register a resource manually |
| `/resource edit <alias>` | Edit resource metadata |
| `/resource refresh <alias>` | Re-probe models on a resource |
| `/resource remove <alias>` | Remove a resource |
| `/topology` | View network hierarchy |
| `/models <alias>` | List available models on a resource |

### Remote Port
| Command | Description |
|---------|-------------|
| `/login [token]` | Pair this orchestrator with the remote Port session |
| `/port` | Show current Port connection status |
| `/port feed [public\|mates\|profile] [all\|general\|advice\|help\|daily-log]` | Browse shared Port Logs |
| `/port post [public\|mates\|profile] [general\|advice\|help\|daily-log] "message"` | Publish a Captain-authored Port Log |
| `/port reply <logId> "message"` | Reply to an existing Port Log |

### Participants & Chat
| Command | Description |
|---------|-------------|
| `/participant list` | List chat participants |
| `/nickname <alias> "Name"` | Set a display name |
| `/bind <alias> <resource>` | Bind a participant to a resource |
| `/model <alias> <model>` | Set a participant's model |
| `/default [alias]` | Set/show default chat participant |
| `/instructions [@alias] ["text"]` | View/set custom instructions |
| `/direct <resource> "message" [model]` | One-shot with a specific resource |
| `/rename <old> <new>` | Rename a participant alias |

### Orchestrator & Memory
| Command | Description |
|---------|-------------|
| `/status` | Point-in-time overview |
| `/hud` | Live terminal dashboard (arrow keys for tabs) |
| `/explore` | Internal file explorer |
| `/model profile auto\|all-llamas\|custom` | Set model selection strategy |
| `/priority [high\|medium\|low]` | Set task priority |
| `/orchestrator ["name"]` | Set orchestrator display name |
| `/reset` | Clear session transcript |
| `/compact` | Summarize older messages |
| `/clear` | Reset to first-run state |

### Preferences & Daily
| Command | Description |
|---------|-------------|
| `/preferences` | View configured preferences |
| `/preferences set zipCode 94102` | Weather location |
| `/preferences set website https://...` | Personal website URL |
| `/preferences set directive "..."` | Daily digest directive |
| `/daily start` | Begin daily session |
| `/daily finish` | End session and generate digest |
| `/daily status` | Show session state |

### Voice (macOS)
| Command | Description |
|---------|-------------|
| `/voice list` | List available voice presets |
| `/voice [@alias] [preset]` | Set a voice preset |
| `/sound [on\|off]` | Toggle voice playback |

## Local State

```
.localcrew/                  ← local runtime state (gitignored)
├── config.json              ← participants, orchestrator profile, preferences
├── resources.json           ← device inventory with tier/hardware metadata
├── sessions.json            ← conversation transcript + compaction state
└── system/
    ├── state.json           ← auto queue (pending/completed tasks)
    └── secure/
        ├── orchestrator/    ← directives, roadmap, focus-todo, changelog, memory, telemetry
        └── agents/          ← per-agent spec, memory, metadata

external-memory/             ← committed seed data (version controlled)
├── orchestrator/            ← seed directives, roadmap, focus-todo, user-profile
├── agents/                  ← built-in agent specs (e.g., data-analyst)
├── inbox/  active/  outbox/ ← dropbox folders (contents gitignored)
```

Nothing machine-specific is committed. Local node addresses, model assignments, and API keys are loaded from ignored `.env` / `.env.local` files.

## Local API

The HTTP API runs on port 4310 (configurable) and serves the browser UI, billboard display, and read/write operations. When `LOCALCREW_API_TOKEN` is set, mutations require a Bearer token, including `POST` and `DELETE /api/resources`. Public exceptions apply only to `GET`: `/`, `/ui`, `/ui/app.js`, `/ui/styles.css`, `/display`, `/api/health`, `/api/daily-work`, `/api/events`, `/api/status`, `/api/queue`, `/api/resources`, and `/api/audit`. Other reads require the token as well. Public display data can include task text, resource addresses, and audit details; use a trusted network.

<details>
<summary>API Endpoints</summary>

### Read
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check (public) |
| `GET` | `/api/status` | Full orchestrator status |
| `GET` | `/api/hud?tab=status\|queue\|metrics\|detail` | HUD tab data |
| `GET` | `/api/queue` | Task queue snapshot |
| `GET` | `/api/telemetry` | Per-model telemetry summary |
| `GET` | `/api/audit?limit=20` | Recent audit events |
| `GET` | `/api/agents` | Agent identities |
| `GET` | `/api/resources` | Device inventory |
| `GET` | `/api/participants` | Chat participants |
| `GET` | `/api/chat-config` | Chat configuration |
| `GET` | `/api/models?target=<alias>` | Models on a resource |
| `GET` | `/api/dropbox` | Dropbox file listing |
| `GET` | `/api/explore/tree` | Internal file tree |
| `GET` | `/api/explore/file?path=...` | Read internal file |
| `GET` | `/api/explore/search?q=...` | Full-text search |
| `GET` | `/api/events` | SSE event stream |

### Write
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/command` | Execute a slash command |
| `POST` | `/api/edit` | Edit instructions, agent, resource, or participant |
| `POST` | `/api/agent/create` | Create an agent identity |
| `POST` | `/api/dropbox/inbox` | Submit a document to the dropbox |
| `POST` | `/api/direct-chat` | One-shot chat with a resource |
| `POST` | `/api/resources` | Register a resource |
| `POST` | `/api/resources/refresh` | Re-probe resource models |
| `POST` | `/api/resources/sync` | Sync from agent setup |
| `POST` | `/api/participants` | Add a participant |
| `POST` | `/api/orchestrator` | Update orchestrator name |
| `DELETE` | `/api/resources?alias=...` | Remove a resource |
| `DELETE` | `/api/participants?alias=...` | Remove a participant |

### SSE Events (`GET /api/events`)
| Event | When |
|-------|------|
| `connected` | Initial connection |
| `state` | Every state change (full snapshot) |
| `task-start` | Auto begins processing a task |
| `queue-fill` | Queue planning phase progress |

</details>

### API Configuration

```bash
LOCALCREW_API_ENABLED=true              # enable the HTTP API (default: true)
LOCALCREW_API_BIND_HOST=0.0.0.0         # listen address
LOCALCREW_API_PUBLIC_HOST=<your-lan-ip>  # advertised LAN address
LOCALCREW_API_PORT=4310                 # listen port
LOCALCREW_API_TOKEN=your-secret         # optional Bearer token for auth
LOCALCREW_API_CORS_ORIGIN=http://...    # allowed CORS origin
```

## Remote Portal

Connect Local Crew to your account at [benlive.tv/port](https://benlive.tv/port) for a remote HUD, task submission, and orchestrator visibility from any browser.

```bash
/login          # Show portal URL and instructions
/login <token>  # Connect using a device token from the portal
```

Get a token: sign in at benlive.tv/port → Connect Local Crew → copy the 8-character token.

## Billboard Display

The `/display` endpoint serves a full-screen neon dashboard designed for TV or monitor wallboard use. It auto-connects to the SSE stream and shows orchestrator status, metric tiles, current task, auto log feed, and per-resource status bars.

- **Auto Pause** (default): suspends SSE updates when the tab is hidden/unfocused; resumes on focus
- **Monitor On**: for dedicated displays, enable via the header toggle or `?active=1` query parameter

## Platform Scripts

Cross-platform Ollama benchmark scripts that profile your local endpoint and recommend context length and concurrency settings:

| Platform | Script |
|----------|--------|
| macOS | `scripts/ollama-optimize-macos.sh` |
| Windows 11 | `scripts/ollama-optimize-windows.ps1` |
| Linux | `scripts/ollama-optimize-linux.sh` |

## Network Testing

Run from any device to verify port connectivity and HTTP endpoint health across your network:

```bash
node scripts/network-test.js                          # local only
node scripts/network-test.js <orchestrator-ip>            # local + orchestrator
node scripts/network-test.js <orchestrator-ip> <agent-ip>  # local + multiple targets
```

Tests TCP ports (Ollama 11434, Crew API 4310, Agent Gateway 4311) and HTTP endpoints with actionable diagnostic output.

## Documentation

| Document | Content |
|----------|---------|
| [docs/setup.md](docs/setup.md) | Detailed setup walkthrough and configuration reference |
| [docs/architecture.md](docs/architecture.md) | Storage model, module map, and design decisions |
| [docs/roadmap.md](docs/roadmap.md) | Product and orchestration roadmap |
| [docs/remote-portal.md](docs/remote-portal.md) | Remote portal architectural contract |
| [docs/overnight-runbook.md](docs/overnight-runbook.md) | Autonomous marathon run operations checklist |
| [docs/release-readiness.md](docs/release-readiness.md) | Release gate criteria and known limitations |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development workflow, code style, testing, and AI review requirements |
| [AGENTS.md](AGENTS.md) | Module boundaries, conventions, and security rules (for AI agents) |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Common issues and diagnostic steps |
| [CHANGELOG.md](CHANGELOG.md) | Release history and notable changes |

## Development

```bash
npm install             # install (0 runtime dependencies)
npm run validate        # typecheck + full test suite
npm test                # tests only (bun test)
npm run test:startup    # Node CLI + loopback HTTP/auth smoke test, then /exit
bunx tsc --noEmit       # typecheck only
npm run start           # start with Node
npm run start:bun       # start with Bun
```

The project enforces **zero runtime dependencies** — this is a deliberate policy. Use Node built-ins only. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full development workflow.

## Security and known limitations

- The network-address check accepts private and loopback addresses; it is not user authentication. With no `LOCALCREW_API_TOKEN`, network-allowed callers can issue commands and mutate state. Set a token and use `LOCALCREW_API_BIND_HOST=127.0.0.1` for a single-machine session. Keep LAN deployments on a trusted network; do not expose this API directly to the internet.
- The public UI and display reads intentionally remain accessible when a token is configured. CORS controls browser behavior; it does not authenticate callers or hide public state. This API does not provide TLS itself.
- Path containment checks guard file APIs and generated write paths. File locking and atomic writes reduce state corruption. These controls do not isolate the whole application from its operating-system account.
- Script execution applies static deny-lists, time/output limits, and a JavaScript VM wrapper. Python restrictions and memory limits differ by platform. Node explicitly states that [the VM module is not a security mechanism](https://nodejs.org/api/vm.html). These are defense-in-depth checks, not an OS sandbox or a proven network-isolation boundary. Review generated scripts and run untrusted workloads in a separately isolated environment.
- Agent prompts receive the assigned spec and memory; this is application-level context separation, not a separate process or OS identity for each agent.
- Inference quality, provider availability, and tool response formats vary. Web tools send queries to their upstream services; local inference does not make every workflow offline or private.
- Automated tests exercise mocked inference and temporary state. They do not establish live-model quality, every LAN topology, or unattended-run safety. See [release readiness](docs/release-readiness.md) before extended autonomous sessions.

## License

[MIT](LICENSE)
