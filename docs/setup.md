# Setup

## Requirements

- Node.js and npm are the default runtime and setup path
- Bun is optional for development and tests
- Ollama, LM Studio, or another reachable inference endpoint using `ollama`, `openai`, or `anthropic` API style
- macOS only for `say` voice playback; the rest of the CLI and Local UI are cross-platform

## First-Run Flow

1. Clone the repo and run `npm install`.
2. On the best local device, run `npm run setup:orchestrator`.
3. Start Crusty with `npm run start`.
4. Open the printed `Local UI` link or stay in the CLI.
5. Bring a second agent device online, benchmark it with the platform script on that device if needed, then run:
   - `node scripts/setup-agent.js`
   - the script will prompt for `Orchestrator IP:` and prefill the first three octets from the local subnet when available
   - it immediately tests `http://<orchestrator-ip>:4310/api/health` before continuing
   - it then prompts for a device nickname used in the orchestrator resource listing
   - it prints a verified configuration summary before syncing
   - re-running it on the same device replaces the prior synced listing for that device instead of creating duplicates
   - for OpenAI-compatible or Anthropic endpoints, pass `--api-style openai|anthropic` and optionally `--api-key-env YOUR_ENV_NAME`; the named env var must exist on the orchestrator for live use after sync
   - or register it manually with `/resource add <alias> "Label" <baseUrl> [top|mid|low] [ollama|openai|anthropic]`
   - or use the `Resources` section in `/ui`
6. Configure the starter chat roster and test the network:
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

- `npm run setup:orchestrator -- --name "Aster"`

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
- `/clear`
