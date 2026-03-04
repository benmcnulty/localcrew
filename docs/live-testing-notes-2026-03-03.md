# Live Testing Notes — 2026-03-03

> Code freeze is active. No code changes until testing is complete. Document issues here; action them tomorrow.

---

## Issues Found

### 1. Orchestrator resource label shows "Local Orchestrator" instead of user-chosen name

**Observed:** `/resource list` shows `@orchestrator: Local Orchestrator (top, ollama)` even though the user entered `Cap` as the orchestrator name during `npm run setup:crew`.

**Expected:** The resource label should reflect the name the user provided — e.g., `@orchestrator: Cap (top, ollama)`.

**Root cause:** In `scripts/setup-orchestrator.js`, the `label` variable defaults to `"Local Orchestrator"` (line 198) and is never updated from the user-provided `name` input. The `name` field is written to `LOCALCREW_ORCHESTRATOR_NAME` in `.env.local` and used as the CLI header display name (the "Orchestrator Cap" banner), but the resource entry in `.localcrew/resources.json` keeps the hardcoded default label.

**Fix (for after code freeze):** In `setup-orchestrator.js`, set `label` from the user-provided `name` when no explicit `--label` was passed. Approximately:
```javascript
// After name is resolved, around line 460-470 in resolveSetupOptions():
label: setup.label !== "Local Orchestrator" ? setup.label : setup.name,
```

Alternatively, the `syncResourceInventory()` function could use `setup.name` as the label when building the resource entry.

**Severity:** Cosmetic. The orchestrator functions correctly; only the display label in `/resource list`, the UI, and API responses is wrong.

**Files involved:**
- `scripts/setup-orchestrator.js` — lines 198, 460-472, 670-690
- `src/app.ts` — line 5600 (renders `resource.label`)

---

### 2. Port 4310 EADDRINUSE on re-run of setup:crew

**Observed:** Running `npm run setup:crew` a second time (or after a crashed session) produces `HTTP API failed to start on 0.0.0.0:4310: listen EADDRINUSE`. The orchestrator starts in CLI-only mode with no API server, so agent devices cannot sync.

**Impact:** Agent `setup-agent.js` sync calls to `/api/resources/sync` silently fail or timeout. The agent appears to complete setup locally but the orchestrator never receives the resource registration.

**Workaround:** Before re-running setup, kill the stale process:
```bash
lsof -t -i :4310 | xargs kill
```

**Fix (for after code freeze):** Consider having the startup sequence detect EADDRINUSE and either (a) prompt the user to kill the existing process, (b) auto-kill it if the PID belongs to a previous Local Crew instance, or (c) exit with a clear actionable error message instead of silently falling through to CLI-only mode.

**Severity:** Operational — blocks multi-device setup if not caught.

**Files involved:**
- `src/api-server.ts` — server startup error handling
- `src/index.ts` — startup sequence

---

### 3. Agent devices do not auto-start `ollama serve` during `setup-agent.js` initial setup

**Observed:** On all agent devices, `setup-agent.js` failed with "failed to fetch" on the first attempt because Ollama was not running. The user had to manually open a separate terminal and run `ollama serve` before re-running the setup script.

**Expected:** The setup script should detect that Ollama is not responding and either (a) start it automatically before probing, or (b) clearly instruct the user to start it first.

**Current behavior:** The `startOllamaServe()` function exists in the agent monitor loop (line 843 in `setup-agent.js`) and correctly auto-restarts Ollama when the persistent monitor detects it has stopped. However, this self-healing only runs **after** the initial setup completes and the monitor loop begins. The initial setup probes the endpoint during configuration and fails immediately if Ollama is not already listening.

**Impact:** Every agent device requires two terminals — one for `ollama serve` and one for `setup-agent.js` / the monitor. This doubles the terminal management overhead across the network.

**Fix (for after code freeze):** Move the Ollama auto-start logic into the initial setup phase. Before probing the local endpoint, check if it's reachable — if not, attempt `startOllamaServe()`, wait briefly for it to become healthy, then proceed with the probe. This would collapse the two-terminal requirement to one.

**Longer-term:** The agent monitor could manage the full Ollama lifecycle (start, health check, restart on crash) so that agent devices need only one command (`node scripts/setup-agent.js`) and no manual `ollama serve` step at all. Combined with a `--daemon` or systemd/launchd mode, this becomes a true set-and-forget agent node.

**Severity:** Operational UX — every agent device setup requires an extra manual step and extra terminal.

**Files involved:**
- `scripts/setup-agent.js` — `startOllamaServe()` (line 843), initial discovery/probe phase (~line 990)

---

### 4. Future: Live code push to agent devices without restart

**Category:** Enhancement / future direction

**Observed:** During this session, code updates required stopping the agent monitor, pulling code, running `npm install`, and restarting on each device. This is manageable with 4 devices but does not scale.

**Desired:** A mechanism for the orchestrator to push updates to agent devices (or for agents to self-update from the repo) without requiring manual terminal access. Could be:
- Agent monitor watches for a version signal from the orchestrator and self-restarts
- Agent auto-pulls from configured git remote on orchestrator version bump
- Orchestrator `/deploy` command that signals all agents to update

**Severity:** Enhancement — no fix needed now, but worth designing before the network grows.

---

### 5. Future: Remote model management with disk-aware safeguards

**Category:** Enhancement / future direction

**Desired:** Ability to pull/remove Ollama models on agent devices remotely from the orchestrator, with safeguards against overloading disk space. Would need disk capacity reporting in the resource sync report and pull/remove commands routed through the agent gateway.

**Severity:** Enhancement — future roadmap item.

---

## Setup Session Log

- **Orchestrator device:** orchestrator-host.local (<orchestrator-ip>), macOS, 10 CPU threads, 32 GB RAM
- **Orchestrator name:** Cap
- **First agent:** @zora / Vic (<agent-1-ip>, top tier), synced successfully on second attempt after port conflict resolved
- **Second agent:** @min / Min (<agent-2-ip>, mid tier), model: granite4:3b
- **Third agent:** @pav / Pav (<agent-3-ip>, mid tier), model: llama3.2:latest
- **Total resources online:** 4 (1 top orchestrator, 1 top agent, 2 mid agents)

## Marathon Session — 2026-03-03 overnight

- **Started:** ~06:01 UTC after all 4 resources confirmed via `/resource list`
- **Configuration:** `/model profile auto`, `/daily start`, `/auto`
- **Monitoring:** CLI terminal, Local UI, Billboard display
- **Status:** Running — first autonomous session as the full crew

## Notes

- First agent setup failed initially due to EADDRINUSE on orchestrator port 4310 — API was not running, so sync had no target
- After killing stale process and restarting, agent synced successfully
- All agent devices required manual `ollama serve` in a separate terminal before setup-agent would succeed (issue #3)
- Network test script added at `scripts/network-test.js` for future port/connectivity diagnosis
- The portal team's Firebase emulator is running at `http://<orchestrator-ip>:5003` with crew API endpoints ready for integration testing
