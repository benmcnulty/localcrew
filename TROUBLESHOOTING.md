# Troubleshooting

Common issues and how to resolve them.

---

## Ollama connection failures

**Symptom:** `Connection refused` when Local Crew tries to reach a resource, or a device shows `unreachable` in `/resource list`.

**Cause:** Ollama is not running, or it is bound to a different address than expected.

**Fix:**

Start Ollama with an explicit loopback bind:
```bash
OLLAMA_HOST=127.0.0.1:11434 ollama serve
```

Local Crew exposes its own LAN gateway for orchestrator-to-agent traffic — you do not need Ollama itself open on the LAN. Each agent device runs a narrow gateway process started by `npm run setup:agent`.

Check that at least one model is available:
```bash
ollama list
ollama pull llama3.1:8b
```

---

## Agent device not reachable from orchestrator

**Symptom:** Agent appears in `/resource list` but shows `unreachable`; orchestrator cannot route tasks to it.

**Possible causes and fixes:**

1. **Agent setup monitor is not running.** Re-run `npm run setup:agent` on the agent device to start the persistent monitor that keeps the gateway alive.

2. **Firewall blocking port 4311.** The agent gateway listens on port 4311 by default. Ensure your local firewall allows inbound TCP on 4311 from the orchestrator's IP.

3. **Wrong IP recorded.** The setup script pre-fills the local subnet. If the orchestrator's IP changed (DHCP reassignment), re-run `npm run setup:agent` to re-sync.

4. **Network scope mismatch.** The orchestrator API (`LOCALCREW_API_NETWORK_SCOPE=local`) rejects non-local clients. If you are testing across different subnets, this is by design.

---

## Port conflict on startup

**Symptom:** `EADDRINUSE` error on startup, or the API does not start.

**Fix:** Another process is already using port 4310 (default). Either stop the conflicting process or change the port:

```bash
# Find what's using port 4310
lsof -i :4310

# Or change the port in your .env.local
LOCALCREW_API_PORT=4320
```

---

## Browser UI (`/ui`) not loading

**Symptom:** `http://localhost:4310/ui` returns a connection error or blank page.

**Checks:**
1. Confirm Local Crew started without errors — look for `Local UI:` in the startup output.
2. Confirm `LOCALCREW_API_ENABLED=true` (it defaults to `true` if not set).
3. Confirm the bind host: if `LOCALCREW_API_BIND_HOST=127.0.0.1`, the UI is only accessible from localhost. Set to `0.0.0.0` to reach it from other devices on the LAN.

---

## Remote Port login fails (`/login <token>`)

**Symptom:** `/login <token>` reports an error or the Port dashboard shows the device as disconnected.

**Checks:**
1. The token is 8 characters and was generated from [benlive.tv/port](https://benlive.tv/port) within the last few minutes (tokens expire). Generate a fresh one.
2. The orchestrator device has internet access (the login call reaches benlive.tv).
3. Check `/port` for the current connection status after a successful login.

---

## `npm run setup:crew` does not discover models

**Symptom:** The setup script finds no models on the local Ollama instance.

**Fix:**
1. Confirm Ollama is running (`ollama list` should return at least one model).
2. Confirm `OLLAMA_HOST` or `LOCALCREW_ORCHESTRATOR_BASE_URL` points to the correct address. The default is `http://127.0.0.1:11434`.
3. Pull at least one model before running setup:
   ```bash
   ollama pull llama3.1:8b
   ```

---

## OpenAI-compatible or Anthropic endpoints fail

**Symptom:** A resource with `api-style openai` or `api-style anthropic` returns auth errors or connection failures.

**Fix:**

Ensure the API key environment variable is set and exported before starting Local Crew:
```bash
export OPENAI_API_KEY=sk-...
npm run start
```

The `.env` / `.env.local` file works for this too — add the key there rather than in `.env.example` (which is committed to the repo and should not contain real credentials).

Verify the `LOCALCREW_ORCHESTRATOR_API_KEY_ENV` variable matches the name of the environment variable holding your key:
```bash
LOCALCREW_ORCHESTRATOR_API_KEY_ENV=OPENAI_API_KEY
```

---

## Auto mode produces duplicate queue entries

**Symptom:** The same task appears multiple times in `/auto` mode queue.

**Cause:** Rapid identical plain-text submissions are not deduplicated in the current release.

**Workaround:** Use explicit slash commands (`/auto`) rather than repeated plain-text inputs. A short-window queue deduplication fix is planned for the next release.

---

## Type errors or test failures after a pull

**Symptom:** `bunx tsc --noEmit` or `bun test` fails after pulling new commits.

**Fix:**
```bash
npm run validate    # runs typecheck + full test suite
```

This project has zero runtime dependencies — there is nothing to install. If tests were passing before the pull, the issue is likely a new TypeScript strictness check or a test expectation update. Read the error output and fix accordingly, or open an issue with the full error.

---

## `.localcrew/` state is corrupted or inconsistent

**Symptom:** Unexpected behavior in routing, missing resources, or broken session state.

**Fix:** The safest reset is `/clear` from within the Local Crew REPL, which returns the system to first-run state. Note that this removes all registered resources and participants — you will need to re-run `npm run setup:crew` and `npm run setup:agent` on each device.

For partial recovery, the state files under `.localcrew/` are plain JSON and can be inspected or edited directly:
- `config.json` — participants, orchestrator profile, preferences
- `resources.json` — device inventory
- `sessions.json` — conversation transcript

---

## Logs and diagnostics

**Audit log:**
```
GET http://localhost:4310/api/audit?limit=20
```

**Health check:**
```
GET http://localhost:4310/api/health
```

**Network connectivity test:**
```bash
node scripts/network-test.js                           # local only
node scripts/network-test.js <orchestrator-ip>         # + orchestrator
node scripts/network-test.js <orchestrator-ip> <agent-ip>
```

**HUD (terminal):**
```
/hud
```
Arrow keys navigate tabs: Status, Queue, Metrics, Detail.

---

## Getting help

- Open an issue: [github.com/benmcnulty/localcrew/issues](https://github.com/benmcnulty/localcrew/issues)
- See [docs/setup.md](docs/setup.md) for detailed configuration reference.
- See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow.
