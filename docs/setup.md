# Setup

## Requirements

- Bun 1.3+ or Node.js with TypeScript execution enabled in your local workflow
- Ollama reachable from the machine running Crusty
- macOS only for `say` voice playback; the rest of the CLI works cross-platform

## Configuration

1. Copy `.env.example` to `.env` or `.env.local`.
2. Set the participant endpoints used for normal chat:
   - `CRUSTY_ENDPOINT_ERIN_BASE_URL`
   - `CRUSTY_ENDPOINT_ZORA_BASE_URL`
   - `CRUSTY_ENDPOINT_SAM_BASE_URL`
   - `CRUSTY_ENDPOINT_PAV_BASE_URL`
3. Set the resource inventory used by Erin in `/auto`:
   - `CRUSTY_RESOURCE_AIR_*`
   - `CRUSTY_RESOURCE_VIC_*`
   - `CRUSTY_RESOURCE_MIN_*`
   - `CRUSTY_RESOURCE_PAV_*`
4. Optionally expose the local browser-facing API:
   - `CRUSTY_API_ENABLED`
   - `CRUSTY_API_HOST`
   - `CRUSTY_API_PORT`

Environment variables provided by the shell take precedence over values loaded from `.env` and `.env.local`.

The durable external system memory lives in the committed `external-memory/` directory. Local internal memory, queue state, agent memory, and telemetry stay under ignored `.crusty/`.

## Running

- `bun run src/index.ts`
- `node src/index.ts`
- `bun test`

## Support Scripts

### macOS

Run `scripts/ollama-optimize-macos.sh` to benchmark a local node and print recommended `OLLAMA_*` settings.

### Windows 11

Run `scripts/ollama-optimize-windows.ps1` in PowerShell to benchmark a local node and emit recommended `setx` commands.

### Linux

Run `scripts/ollama-optimize-linux.sh` to benchmark a local node and write `ollama-recommended.env`.

## First Useful Commands

- `/help`
- `/chat`
- `/group`
- `/auto`
- `/status`
- `/hud`
- `/explore`
- `/agent list`
