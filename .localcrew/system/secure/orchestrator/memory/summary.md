# Orchestrator Situational Summary

_Updated: 2026-03-03 — clean restart for marathon session_

## Current State

Fresh start. Queue is empty (lastTaskId=0). All previous task history has been archived under era-0 numbering (0.1-0.69). The first new task will be #1.

## Era-0 Recap (Pre-Marathon)

Three features were implemented in the application layer during era-0:

1. **Real telemetry in routing scores** (resources.ts) — computeResourceScore() factors in success rate, failure count, and throughput from TelemetrySummary.
2. **Context budget pre-flight guard** (resources.ts + app.ts) — checkContextBudget() estimates prompt tokens before execution and reroutes if the prompt exceeds the resource context window.
3. **Retry-with-fallback on task failure** (types.ts + app.ts) — quarantineFailedAutoTask() tries one retry on a different resource before quarantining.

Additionally in the pre-marathon setup:

4. **Daily Work system** (daily-work.ts + gui.ts + app.ts) — auto-generated daily briefing document, billboard overlay, auto mode front-loading.
5. **Display billboard fix** (api-server.ts) — /api/events and /api/status made public so /display can connect without token auth.
6. **Preferences expansion** (commands.ts + config.ts + app.ts) — dailyWorkIntervalHours and dailyWorkDirective added as settable preferences.

## Network Topology

- **orchestrator** (Cap): top-tier, 32 GB RAM, 10 threads — llama3.1:8b (default), gpt-oss:20b (reasoning), qwen3-coder (coding)
- **zora** (Vic): top-tier, 15.7 GB RAM, 24 threads — llama3.1:latest (default), qwen3-vl:8b (reasoning)
- **desktop-m01slkb** (Pav): mid-tier, 15.9 GB RAM, 8 threads — llama3.2:latest (default), granite4:3b (reasoning), deepseek-r1:1.5b (tools)
- **mac-hsd1-fl-comcast-net** (Min): mid-tier, 8 GB RAM, 8 threads — granite4:3b (default)

## Immediate Priorities

1. Generate Daily Work briefing on first auto cycle (preference dailyWorkIntervalHours should be set).
2. Execute a full four-phase cycle: Reflect, Plan, Implement, Benefit.
3. Phase 4 Benefit: deliver proactive user-value (job research, news, actionable suggestions).
4. Monitor routing telemetry: observe how scores change and whether retry-with-fallback fires.
