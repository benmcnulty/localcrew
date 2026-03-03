# Overnight Autonomous Runbook (v0.18 Observability)

## Goal
Ship the latest orchestration enhancements, run a supervised startup, then execute an overnight autonomous session with reproducible logs and post-run artifacts for cross-team review.

## 1) Preflight Validation (must pass)

```bash
bunx tsc --noEmit
npm test
```

## 2) Deployment Snapshot

Record branch and diff context before rollout:

```bash
git status --short
git --no-pager log -n 5 --oneline
```

Create a handoff note in local runtime memory:

```bash
mkdir -p .crusty/system/handoffs
```

Write `.crusty/system/handoffs/overnight-<date>.md` with:
- build/test status
- operator names
- device roster and model profile mode
- known risks and rollback plan

## 3) Orchestrator Bring-up

Primary node:

```bash
npm run setup:crusty
npm run start
```

Confirm API health and SSE stream:

```bash
curl -s http://127.0.0.1:4310/api/health
```

If `CRUSTY_API_TOKEN` is enabled, verify authenticated events endpoint:

```bash
curl -N -H "Authorization: Bearer $CRUSTY_API_TOKEN" http://127.0.0.1:4310/api/events
```

## 4) Agent Device Onboarding

On each secondary device:

```bash
node scripts/setup-agent.js
```

Then validate from orchestrator shell/UI:
- `/resource list`
- `/topology`
- `/models <resourceAlias>`

## 5) Runtime Configuration for Overnight Run

Set model profile mode explicitly:

```text
/model profile auto
```

(Use `/model profile all-llamas` if you need strict llama-family lock.)

Start session:

```text
/auto
```

For bounded reporting:

```text
/daily start
```

## 6) Observability Checks Before Unattended Window

Verify all of the following in `/status` or `/display`:
- `failedCount` present
- task events visible (`task-start`, `task-complete`, `task-write`, `queue-fill`)
- `modelProfile` visible
- per-resource telemetry and system token throughput updating

## 7) Logging Requirements

During the run, preserve:
- `.crusty/system/secure/orchestrator/telemetry/audit-log.jsonl`
- `.crusty/system/secure/orchestrator/telemetry/summary.json`
- `.crusty/system/changelog.md`
- `.crusty/system/focus-todo.md`
- `.crusty/system/state.json`

Post-run, archive key excerpts into:

`external-memory/outbox/overnight-reports/<date>-overnight-report.md`

Include:
- total completed/failed
- top failure causes
- queue-fill verdict trends
- resource utilization highlights
- actionable next changes

## 8) Rollback

If instability appears:
1. `/stop`
2. revert to last known good commit
3. rerun `bunx tsc --noEmit && npm test`
4. restart orchestrator and rerun 30-minute supervised soak test

## 9) Completion Criteria

An overnight run is considered successful when:
- no runaway duplicate task generation
- quality verification remains active
- SSE events remain live throughout session
- final report produced and shared with engineering teams
