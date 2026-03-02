# Setup

## Requirements

- Node.js and npm are the default runtime and setup path
- Bun is optional for development and tests
- Ollama, LM Studio, or another reachable inference endpoint using `ollama`, `openai`, or `anthropic` API style
- macOS only for `say` voice playback; the rest of the CLI and Local UI are cross-platform

## First-Run Flow

1. Clone the repo and run `npm install`.
2. On the best local device, run `npm run setup:crusty`. This primary device becomes the local agent orchestrator.
   - the setup flow prompts for the agent-orchestrator name
   - when you rerun setup later, that prompt is prefilled from the existing local configuration
   - after configuration, Crusty starts automatically in the same terminal unless you pass `--no-start`
3. Open the printed `Local UI` link or stay in the CLI.
4. Bring a second agent device online, benchmark it with the platform script on that device if needed, then run:
   - `node scripts/setup-agent.js`
   - the Crusty setup output shows the full primary-device IP to remember
   - the script will prompt for `Orchestrator IP:` and prefill the first three IP numbers from the local network when available
   - confirm or enter the final number of the orchestrator IP before continuing
   - it immediately tests `http://<orchestrator-ip>:4310/api/health` before continuing
   - it then prompts for a device nickname used in the orchestrator resource listing and reuses the prior local nickname when available
   - it prints a verified configuration summary before syncing
   - re-running it on the same device replaces the prior synced listing for that device instead of creating duplicates
   - for local agent endpoints, the script keeps running as a local monitor by default; use `--once` to skip the persistent monitor
   - that monitor exposes a narrow LAN gateway for the orchestrator and limits access to the configured orchestrator IP instead of requiring broad LAN exposure of the local inference service
   - for OpenAI-compatible or Anthropic endpoints, pass `--api-style openai|anthropic` and optionally `--api-key-env YOUR_ENV_NAME`; the named env var must exist on the orchestrator for live use after sync
   - or register it manually with `/resource add <alias> "Label" <baseUrl> [top|mid|low] [ollama|openai|anthropic]`
   - or use the `Resources` section in `/ui`
5. Configure the starter chat roster and test the network:
   - `/participant list`
   - `/nickname @erin "Your Preferred Name"`
   - `/bind @erin orchestrator`
   - `/models @erin`
   - `/model erin llama3.1:8b`
   - `/direct orchestrator "Ping test"`
   - or use the matching forms in `/ui`

The first-run goal is a single working orchestrator resource. Once that is stable, add more devices and let the orchestrator delegate across them.

## Configuration Model

Crusty keeps a strict split between committed external system memory and ignored local runtime state.

- `external-memory/` is committed and contains durable orchestrator directives, workflows, and built-in agent specs.
- `.crusty/` is ignored and contains local queue state, internal memory, telemetry, and resource inventory.
- `.env` and `.env.local` are ignored and can hold machine-specific overrides.

The orchestrator bootstrap script writes a managed block to `.env.local` and seeds `.crusty/resources.json` for the first local resource. The agent bootstrap script is self-contained, writes a local agent report, and can sync it directly into the orchestrator over the local API.

## Environment Variables

The main public-safe env surface is:

- `CRUSTY_API_ENABLED`
- `CRUSTY_API_BIND_HOST`
- `CRUSTY_API_PUBLIC_HOST`
- `CRUSTY_API_PORT`
- `CRUSTY_API_CORS_ORIGIN` — allowed CORS origin for the local API (omit for no CORS headers)
- `CRUSTY_API_TOKEN` — optional Bearer token for API authentication
- `CRUSTY_ORCHESTRATOR_NAME`
- `CRUSTY_ORCHESTRATOR_ALIAS`
- `CRUSTY_ORCHESTRATOR_LABEL`
- `CRUSTY_ORCHESTRATOR_TIER`
- `CRUSTY_ORCHESTRATOR_BASE_URL`
- `CRUSTY_ORCHESTRATOR_API_STYLE`
- `CRUSTY_ORCHESTRATOR_HOST_NAME`
- `CRUSTY_ORCHESTRATOR_PLATFORM`
- `CRUSTY_ORCHESTRATOR_DEFAULT_MODEL`
- `CRUSTY_ORCHESTRATOR_REASONING_MODEL`
- `CRUSTY_ORCHESTRATOR_CODING_MODEL`
- `CRUSTY_ORCHESTRATOR_TOOLS_MODEL`
- `CRUSTY_ORCHESTRATOR_EMBEDDING_MODEL`
- `CRUSTY_ORCHESTRATOR_ROLE`
- `CRUSTY_ORCHESTRATOR_CAPABILITIES`
- `CRUSTY_ORCHESTRATOR_NOTES`

Optional runtime tuning:

- `CRUSTY_AUTO_PULSE_INTERVAL_MS` — auto-mode pulse interval in milliseconds (default: 1500)
- `CRUSTY_AUTO_SOURCE_DOC_CHAR_LIMIT` — max chars from a source document fed to auto prompts (default: 12000)
- `CRUSTY_ANTHROPIC_MAX_TOKENS` — max tokens for Anthropic-style completions (default: 2048)

Participant routing still supports optional env overrides such as `CRUSTY_ENDPOINT_ERIN_RESOURCE`, `CRUSTY_ENDPOINT_ERIN_NICKNAME`, and `CRUSTY_ENDPOINT_ERIN_MODEL`, but the preferred path for ongoing device management is `/resource`, `/participant`, `/nickname`, `/bind`, and `/model` in the CLI or Local UI.

Resource hardware and context metadata can also be kept local and dynamic:

- `CRUSTY_ORCHESTRATOR_CPU_LOGICAL_CORES`
- `CRUSTY_ORCHESTRATOR_RAM_GB`
- `CRUSTY_ORCHESTRATOR_GPU_MODEL`
- `CRUSTY_ORCHESTRATOR_GPU_COUNT`
- `CRUSTY_ORCHESTRATOR_TOTAL_VRAM_GB`
- `CRUSTY_ORCHESTRATOR_MAX_CONTEXT_TOKENS`

For non-orchestrator devices, the preferred path is `/resource refresh <alias>` for live model discovery and `/resource edit <alias>` for extra hardware metadata so those values stay in `.crusty/resources.json` instead of env files.

Shell env values take precedence over `.env`, which takes precedence over `.env.local`.

If you want a non-default orchestrator identity name during install, run:

- `npm run setup:crusty -- --name "Aster"`

## Device Benchmark Scripts

Run the benchmark script locally on each agent device before adding it as a resource:

- macOS: `scripts/ollama-optimize-macos.sh`
- Windows 11: `scripts/ollama-optimize-windows.ps1`
- Linux: `scripts/ollama-optimize-linux.sh`

Use the script output to decide the device tier:

- `top`: best reasoning/drafting node outside or alongside the orchestrator
- `mid`: structured work, indexing, queue support, moderate drafting
- `low`: small-context isolated work and overflow

## Useful Commands

- `/help`
- `/resource list`
- `/resource add <alias> "Label" <baseUrl> [top|mid|low] [ollama|openai|anthropic]`
- `/resource edit <alias>`
- `/resource refresh <alias>`
- `/participant list`
- `/participant add <alias> <resourceAlias> ["nickname"]`
- `/participant edit <alias>`
- `/nickname [@alias] ["name"]`
- `/bind [@alias] [resourceAlias]`
- `/models [resourceAlias|@participantAlias]`
- `/direct <resourceAlias> "message" [model]`
- `/orchestrator ["name"]`
- `/chat`
- `/group`
- `/auto`
- `/status`
- `/hud`
- `/explore`
- `/promote <alias>`
- `/topology`
- `/topology assign <alias> <role>`
- `/topology delegate <orchestrator> <agent>`
- `/topology undelegate <orchestrator> <agent>`
- `/clear`

## Billboard Display Lifecycle

The browser billboard (`/display`) is optimized for agent-device efficiency by default:

- default mode is **Auto Pause** — when the tab is hidden or loses focus, live network activity is suspended
- when the tab regains focus, the dashboard performs a fast refresh and resumes live updates
- use **Monitor On** in the display header to keep live updates active continuously on dedicated observer screens
- you can also force always-active mode at launch with `http://<host>:4310/display?active=1`

Recommended usage pattern:

- keep orchestrator/agent devices in default auto-pause mode unless actively viewed
- use a non-orchestrator networked tablet/TV/phone as your persistent always-active display when needed

## Hierarchical Topology

After adding multiple devices, you can build a hierarchy:

1. `/topology` — view the current network roles
2. `/topology assign workhorse orchestrator` — promote a capable device to sub-orchestrator
3. `/topology delegate workhorse helper` — assign `helper` as a subordinate of `workhorse`
4. In `/auto`, complex multi-step tasks will be automatically delegated to idle sub-orchestrators

Only top-tier devices with ≥16k context qualify for the orchestrator role.

## Promoting a Device to Sub-Orchestrator

A sub-orchestrator is a device that independently coordinates a group of subordinate agents, receiving complex delegated tasks from the primary orchestrator in `/auto` mode. Sub-orchestrators continue processing even if the primary goes offline.

**Requirements:**
- Must be registered as a resource (via `setup-agent.js` or `/resource add`)
- Must be a `top` tier device (set during sync or via `/resource edit`)
- Must have ≥16k context tokens (set `maxContextTokens` via `/resource edit`)

**Promotion steps:**

1. Sync the device if not already registered:
   ```
   node scripts/setup-agent.js   # run on the agent device
   ```
   Then on the primary, confirm the device appears in `/resource list`.

2. Assign the orchestrator role:
   ```
   /topology assign <alias> orchestrator
   ```
   Replace `<alias>` with the resource alias reported by `/resource list`.

3. Delegate agents under the sub-orchestrator:
   ```
   /topology delegate <orchestrator-alias> <agent-alias>
   ```
   Repeat for each agent device that should be subordinate to this sub-orchestrator.

4. Verify the live hierarchy:
   ```
   /topology
   ```
   You should see the sub-orchestrator listed with its subordinate agents indented beneath it.

**Example output:**
```
Primary: @erin (32k ctx)
  └─ agent: @min (8k ctx)
Sub-Orchestrator: @zora (16k ctx)
  └─ agent: @pav (8k ctx)
```

Once promoted, the primary will automatically route complex multi-step tasks to idle sub-orchestrators during `/auto` mode. Use `/topology undelegate <orchestrator> <agent>` to remove an agent from a sub-orchestrator's subordinates, and `/topology assign <alias> agent` to demote a sub-orchestrator back to agent role.
