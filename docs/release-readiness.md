# Release Readiness Runbook

This runbook defines the minimum release gate for Crusty and the operational checks expected by senior leadership for deployment confidence.

## Release Gate (Must Pass)

Fast path command:

- `npm run validate`

1. Type safety
   - `bunx tsc --noEmit`
2. Regression suite
   - `npm test`
3. CI pass on pull request and `main`
   - `.github/workflows/ci.yml` must be green
4. Security baseline
   - API token behavior validated when `CRUSTY_API_TOKEN` is set
   - SSE endpoint auth behavior validated (`/api/events`)
5. Dependency policy
   - `package.json` contains zero runtime dependencies unless a documented exception is approved

## Pre-Release Checklist

- Verify local API and UI health
  - `GET /api/health`
  - open `/ui` and `/display`
- Validate orchestration surfaces
  - `/status`, `/hud`, `/explore`
- Validate tool-chain reachability (if enabled)
  - Wikipedia, Reddit, SEARCH, WEATHER, BENLIVE, WEBSITE
- Validate autonomous path safety
  - queue processing, dropbox ingestion, and WRITE routing constraints
- Validate telemetry and audit flow
  - `/api/telemetry`, `/api/audit?limit=20`

## Rollback Plan

If release health degrades:

1. Stop rolling forward; freeze merges to `main`
2. Revert to last green commit where CI + smoke checks passed
3. Re-run:
   - `bunx tsc --noEmit`
   - `npm test`
4. Validate `/api/health`, `/status`, `/hud`
5. Resume rollout only after root cause and fix are validated

## Operational Monitoring During Early Release

Track at minimum:

- queue depth and completion rate
- error counts in telemetry by kind/model/resource
- API health response and SSE stability for active displays
- audit stream continuity and write integrity

## Known Limitations (Current)

- Web search relies on upstream DuckDuckGo HTML layout and may require parser adjustments if the provider changes markup.
- Dedicated always-active billboard mode intentionally uses persistent live updates and is higher resource usage than default auto-pause mode.
- Some tool quality depends on external provider availability, latency, and response formats.

## Leadership Sign-Off Recommendation

Release approval is recommended when:

- CI is green on the candidate commit
- all release-gate checks above pass
- no unresolved high-severity security or data-integrity issues remain
- known limitations are acceptable for the intended release scope
