# Production Readiness Execution Log

Date: 2026-03-06
Branch: `staging`
Worktree: `/Users/ben/dev/localcrew-staging`

## Objective

Ship the next production-readiness iteration from `staging` without disturbing the live `/auto` session on `dev` until final validation and merge time.

## Baseline

- Live `dev` app is still running in `/auto` mode on `http://127.0.0.1:4310`.
- `staging` is the isolated implementation worktree.
- Existing review baseline is captured in `docs/phase-iii-offline-review-2026-03-06.md`.
- Current known blockers before implementation:
  - autonomous document updates only support whole-file replacement
  - canonical memory writes bypass `atomicWriteFile()`
  - `bunx tsc --noEmit` is currently failing
  - parallel dispatch does not yet account for active resource occupancy
  - active-task snapshots do not reliably retain assigned resource
  - Playwright is still pointed at the live `4310` app

## Implementation Order

1. Harden document write/update mechanics.
2. Fix typecheck and atomic canonical writes.
3. Fix active-task snapshots, routing occupancy, and dynamic queue depth.
4. Isolate Playwright from the live app and expand regression coverage.
5. Tighten display/CLI parity and update docs/runbooks.
6. Run validation in `staging`, then stop `dev` for final integration.

## Progress

### 2026-03-06 Initial grounding

- Confirmed `dev` and `staging` worktree layout.
- Confirmed live `dev` queue API still lacks the new `activeTasks` fields.
- Confirmed autonomous file protocol is `WRITE[...] ... ENDWRITE` only.
- Confirmed canonical memory writes currently use direct `writeFile()` in `src/app.ts`.
- Confirmed release runbook still expects `bunx tsc --noEmit` and `npm test` to pass.

### 2026-03-06 Completed work

- Added an explicit autonomous document update contract beside `WRITE[...]`:
  - `UPDATE[stage][path][replace]` with `SEARCH ... ENDSEARCH` and `CONTENT ... ENDCONTENT`
  - `UPDATE[stage][path][insert-after|insert-before]` with `ANCHOR ... ENDANCHOR`
  - `UPDATE[stage][path][append|prepend]` with `CONTENT ... ENDCONTENT`
- Hardened generated document application so canonical memory and recurring docs now use atomic writes plus file locking instead of direct `writeFile()` replacement.
- Changed autonomous prompt guidance to prefer `UPDATE[...]` for targeted revisions to existing documents and reserve `WRITE[...]` for new or intentionally regenerated files.
- Restored truthful typecheck by fixing the Ollama response typing gap in `src/ollama.ts`.
- Reworked auto scheduling and routing:
  - active resource occupancy is now counted in routing load
  - active-task reservations are recorded before model execution begins
  - active task snapshots retain `assignedResource` / `assignedModel`
  - queue refill threshold is derived from available resources
  - desired pending depth is derived as `2 x available resources`
  - effective parallel cycle limit is derived from available resources and bounded by `LOCALCREW_MAX_PARALLEL_CYCLES`
  - mid-tier escape hatch now compares against the selected top-tier resource load instead of orchestrator load only
  - routing now passes health status into scored fallback routing
- Extended queue/status snapshots with derived capacity fields for UI/CLI parity:
  - `availableResourceCount`
  - `desiredPendingDepth`
  - `refillThreshold`
  - `parallelCycleLimit`
  - `availableCycleSlots`
- Isolated Playwright from the live app:
  - default base URL changed from `http://127.0.0.1:4310` to staging port `4311`
  - embedded web server now starts on `4311`
  - `reuseExistingServer` is disabled by default
  - `LOCALCREW_PLAYWRIGHT_BASE_URL` can be set explicitly when targeting an already-running staging server
- Applied a first UI/CLI parity pass:
  - `/display` Current Focus now shows the lead active task instead of count-only filler text
  - `/display` active-task meta now includes in-progress state, assigned resource, priority, and `+N more` when multiple tasks are running
  - queue header now shows `pending / target` when capacity metadata is available
  - developer CLI status/queue output now uses the new capacity fields when present and degrades cleanly against older live APIs that do not expose them

### 2026-03-06 Added tests

- `test/app.test.ts`
  - targeted `UPDATE[...]` success path for canonical memory
  - ambiguous `UPDATE[...]` failure path that preserves the original file
  - queue fill cap at twice the available resource count
  - active-task snapshot includes assigned resource while in flight
  - concurrent auto cycles distribute across idle top-tier resources
- Updated prompt-contract assertions in `test/core.test.ts` and `test/messages.test.ts` to reflect the new update protocol and dynamic queue-fill targeting.

### 2026-03-06 Validation

- `bunx tsc --noEmit` ✅
- `bun test test/app.test.ts` ✅
- `bun test test/app.test.ts test/messages.test.ts test/core.test.ts` ✅
- `npm test` ✅ (`753 pass / 0 fail`)
- `bunx playwright test --list` ✅ (`21 tests discovered` on isolated staging config)

## Resume Notes

- Keep implementation on `staging` until validation is complete.
- Do not stop the live `dev` auto run during normal development.
- Next logical work items:
  - tighten `/display` and CLI parity using the new queue/status capacity fields
  - verify Playwright execution against isolated staging on `4311`
  - decide whether to propagate the new capacity metrics into the CLI watch output


### 2026-03-06 Outline Navigation Pass

- Added `src/document-outline.ts` as the markdown outline/navigation module.
- Added runtime navigation storage under `.localcrew/system/secure/orchestrator/navigation/`:
  - `document-sitemap.md`
  - `document-outline-index.json`
  - per-document outline sidecars under `navigation/outlines/`
- Extended explorer file reads to include outline metadata and explorer tree responses to advertise sitemap/index paths.
- Added heading-aware markdown update support:
  - `HEADING: Parent > Child` selectors in `ANCHOR` / `SEARCH`
  - `replace-section` mode for whole-section markdown rewrites
  - suffix-trail matching when a unique trailing heading path is sufficient
- Serialized document-navigation sync to avoid concurrent outline rebuild races and excluded generated navigation artifacts from full-text search results.
- Updated preserved guidance docs and added committed map docs:
  - `docs/document-navigation.md`
  - `docs/documentation-map.md`
  - aligned `external-memory/README.md`, `external-memory/orchestrator/directives.md`, `docs/architecture.md`, and `docs/setup.md`
- Expanded regression coverage for:
  - document outline generation
  - explorer outline metadata
  - heading-based incremental updates
  - `replace-section` document updates

### 2026-03-06 Validation Refresh

- `bunx tsc --noEmit` ✅
- `npm test` ✅ (`757 pass / 0 fail`)
- `bunx playwright test --list` ✅ (`21 tests discovered`)
