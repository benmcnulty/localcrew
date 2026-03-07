# Phase III Offline Review Packet

Date: 2026-03-06
Branch: `staging`
PR: `staging -> dev` (`#1`)

## Review Status

I could not post directly to GitHub from this environment because `gh auth status` reports an invalid token for the configured account.

Evidence used:

- `bun test ./test/*.test.ts`: 748 pass
- `bunx tsc --noEmit`: fails at `src/ollama.ts:202`
- Local diff review across the Phase III files
- Live API spot checks against `http://127.0.0.1:4310`

## Merge Verdict

Not ready to merge as-is.

The display polish itself is directionally good, but there are three issues I would treat as pre-merge blockers:

1. The advertised typecheck gate currently fails.
2. The new Playwright configuration can target the live dev server on port `4310`.
3. Parallel dispatch still does not feed active resource occupancy back into routing, so concurrent cycles can stack onto the same resource.

After those are fixed, `MAX_PARALLEL_CYCLES = 3` is a reasonable starting default only if resource occupancy is included in routing and per-resource concurrency remains effectively `1`.

## Ranked Findings

### 1. Blocker: `bunx tsc --noEmit` does not pass

Files:

- `src/ollama.ts:202`

Why it matters:

- The branch claims a clean typecheck, but the new code references `body.done_reason` without declaring that field on the parsed response shape.
- That makes the stated release gate inaccurate and breaks the review instructions that ask stakeholders to rely on typecheck.

Implementation guidance:

- Add `done_reason?: unknown` to the local response type in `src/ollama.ts`, or stop interpolating it into the error message.
- Re-run `bunx tsc --noEmit` and update the PR description only once it is actually green.

### 2. Blocker: Playwright is wired to the live dev app instead of an isolated staging server

Files:

- `playwright.config.ts:6-11`

Why it matters:

- `baseURL` and `webServer.url` are hard-coded to `http://127.0.0.1:4310`.
- `reuseExistingServer: true` means `bunx playwright test` can silently attach to the live dev instance the brief explicitly says not to disturb.
- That makes the E2E result nondeterministic and unsafe for a branch that is supposed to be reviewed in isolation on `4311`.

Implementation guidance:

- Default the config to a staging-only URL, ideally from `LOCALCREW_API_URL` / `PLAYWRIGHT_BASE_URL`.
- Use a dedicated Playwright port such as `4311` in the spawned server command.
- Do not reuse the live `4310` server for this suite.

### 3. Blocker: Parallel dispatch still routes without accounting for active resource occupancy

Files:

- `src/app.ts:5192-5218`
- `src/resources.ts:1109-1113`

Why it matters:

- `busyAliases` only filters tasks that already requested a specific resource.
- The `resourceLoad` map is built from pending tasks with `requestedResource`; it does not include resources that are already executing work through `activeTasksByResource`.
- Under concurrent `runIdleCycle()` calls, multiple auto-routed tasks can still pick the same resource while other resources are idle, which directly undermines the Phase III goal of parallel utilization and the claimed `@pav` escape hatch.

Implementation guidance:

- Seed `resourceLoad` with current in-flight occupancy from `activeTasksByResource`.
- Treat a busy alias as load for automatic routing, not just for explicitly pinned tasks.
- Add a regression test that starts two or three concurrent cycles and asserts tasks do not all land on the same resource when idle alternatives exist.

### 4. High: active task rows lose the actual assigned resource for auto-routed tasks

Files:

- `src/app.ts:1547-1550`
- `src/app.ts:5452`
- `src/gui.ts:3122-3127`

Why it matters:

- `activeTasksByResource` stores the raw `task` object before `assignedResource` is written onto it.
- `getQueueSnapshot()` serializes only the stored task value, so auto-routed active tasks often have neither `assignedResource` nor `requestedResource`.
- The new queue UX is supposed to clarify what is in flight, but in the common auto-routing path it can omit the resource label entirely.

Implementation guidance:

- Store `assignedResource: selection.alias` when inserting into `activeTasksByResource`, or derive `assignedResource` from the map key when building the snapshot.
- Mirror the same fix in the SSE state payload so the UI and CLI stay consistent.

### 5. Medium: the Current Focus card becomes less informative exactly when the system is busiest

Files:

- `src/gui.ts:3307-3309`

Why it matters:

- Replacing the task text with `N task(s) in progress` removes the content and the resource at the moment operators most need a quick read on what is happening.
- The queue panel still has the detail, but the primary billboard card is the highest-attention surface and now carries the least information.

Implementation guidance:

- Show the first active task plus a compact remainder indicator, for example `@vic - Analyze queue starvation (+2 more)`.
- If keeping the count-only headline, add a second metadata row with `@resource` and elapsed time for the first active task.

### 6. Medium: the new CLI is only partially compatible with the live review workflow described in the brief

Files:

- `scripts/localcrew-cli.js:57`
- `scripts/localcrew-cli.js:68-89`

Why it matters:

- The CLI defaults to `4310`, but the current live dev branch does not yet expose `orchestratorAlias`, `activeTasks`, or `shipRole`.
- In practice that produces `@?` for the orchestrator and tier fallback instead of ship-role output, so the "review the live system with the new CLI" instructions are only accurate if the reviewer points the CLI at a staging server first.

Implementation guidance:

- Either document `LOCALCREW_API_URL=http://127.0.0.1:4311` as mandatory for Phase III review, or make the CLI degrade more explicitly when the old API shape is returned.
- A small compatibility note is enough if the tool is intentionally forward-looking.

## Top-Level PR Review Comment Draft

```md
Review verdict: not ready to merge as-is.

The display polish is directionally good, and the queue/role terminology changes improve readability, but I found three pre-merge blockers:

1. `bunx tsc --noEmit` currently fails in `src/ollama.ts` because `done_reason` is referenced without being declared on the parsed response type.
2. The new Playwright config is hard-wired to `http://127.0.0.1:4310` with `reuseExistingServer: true`, so `bunx playwright test` can attach to the live dev app the brief explicitly says not to disturb.
3. Parallel dispatch is still global-cap only. The scheduler tracks in-flight tasks, but routing does not count active resource occupancy, so concurrent cycles can still pile onto the same resource while other nodes are idle.

Ranked improvements after those blockers:

4. Preserve the actual assigned resource on active task snapshots; today the queue/CLI can drop the resource label for auto-routed tasks.
5. Make the Current Focus card show at least one active task/resource instead of only `N task(s) in progress`.
6. Tighten the Phase III review workflow docs or CLI fallback behavior, because the new CLI fields are not present on the current live dev API yet.

Parallel-dispatch readiness:

- `MAX_PARALLEL_CYCLES = 3` is not safe to ship by itself yet.
- I would ship it only after active resource occupancy is fed into routing, or after a per-resource concurrency cap is enforced.
- Once that is in place, `3` is a reasonable starting ceiling, ideally bounded by online resource count and made configurable through env.

Display/UI notes:

- Ship-role labels are semantically fine as topology labels: Captain = primary orchestrator, Mate = orchestrator-capable subordinate, Crew = agent.
- The amber pulse and ACTIVE/IDLE/OFFLINE labels are understandable, but the active queue rows need the resource shown reliably to make the polish meaningful.
- The neumorphic shadows are acceptable; they do not read as a regression from code inspection alone, but they are lower priority than the functional clarity gaps above.

Playwright coverage notes:

- Current tests are good structural smoke tests, but they do not yet prove the new behavior.
- Missing tests: concurrent dispatch distribution across resources, active-task resource labeling, and a deterministic display-state test that does not depend on the live server on `4310`.
```

## Inline PR Comment Drafts

### Comment 1

Target: `src/ollama.ts:202`

```md
This line breaks the advertised typecheck gate: the local response shape declared above does not include `done_reason`, so `bunx tsc --noEmit` currently fails here. Either add `done_reason?: unknown` to the parsed body type or drop it from the diagnostic string before calling this branch typecheck-clean.
```

### Comment 2

Target: `playwright.config.ts:6-11`

```md
This config points the E2E suite at the live dev server on `4310` and explicitly reuses it. That conflicts with the review brief's "do not disturb" constraint and makes the suite nondeterministic because it can observe whatever the live `/auto` loop is doing. I would switch this to a staging-only URL (for example `4311` from env) and avoid reusing the live server.
```

### Comment 3

Target: `src/app.ts:5192-5218`

```md
`processingTaskIds` prevents duplicate dequeue, but routing here still ignores current in-flight resource occupancy for auto-routed work. `busyAliases` only excludes tasks pinned to a requested resource, and `resourceLoad` only counts pending `requestedResource` entries. Under concurrent idle cycles, multiple tasks can still auto-route onto the same node even when other resources are idle. I would seed `resourceLoad` from `activeTasksByResource` or otherwise enforce per-resource concurrency before calling this parallel-ready.
```

### Comment 4

Target: `src/app.ts:5452`

```md
The map key knows the selected resource, but the stored task value does not. That means `getQueueSnapshot()` later serializes active tasks without `assignedResource` for the common auto-routing path, so the queue UI/CLI can lose the resource label entirely. I would store `{ ...task, assignedResource: selection.alias }` here or derive it from the map key when building snapshots.
```

### Comment 5

Target: `src/gui.ts:3307-3309`

```md
I understand the goal of removing duplication, but this makes the highest-attention card least informative during the busiest state. A count-only message like `3 tasks in progress` does not tell the operator what is actually happening. I would show the first active task plus `+N more`, or at least include `@resource` and elapsed time in a secondary row.
```

## Area-by-Area Notes

### Display UI

- Role badges are semantically understandable at a glance because the tier color is still doing some visual work underneath the ship label.
- ACTIVE / IDLE / OFFLINE text is acceptable, but `IDLE` is close to visual noise and should stay subtle.
- The amber pulse seems directionally correct from the implementation, but the more important usability gap is missing resource attribution on active tasks.
- The Current Focus card needs one concrete task/resource signal, not only a count.

### Parallel Dispatch

- I did not find an `activeCycleCount` leak; `runAutoCycleLocked()` decrements in a `finally`.
- I did find a task-routing gap: in-flight resource occupancy is tracked but not actually fed into routing for auto-selected tasks.
- Because of that, I do not consider the current implementation parallel-ready yet.

### Queue UX

- Splitting active from pending is the right move.
- The active row should show `@resource` reliably and ideally elapsed time.
- Capping pending items at `8` is fine as a billboard default; if it changes, it should be breakpoint-driven rather than user-configurable first.

### Ship Roles

- `Captain / Mate / Crew` is semantically correct for topology, not behavior.
- If the product later wants behavior-based authority labels, this implementation is not enough, but for the current routing model the mapping is fine.
- Surfacing ship role in CLI output is the right choice once the API shape is present.

### Developer CLI

- Human-readable defaults are fine for interactive use, but a future `--json` mode would make it more useful for scripting.
- `watch` is acceptable as a full-screen poller for now.
- The first missing filter I would add is `audit --kind=...` / `--resource=...`.
- The first missing action I would add is `retry <id>` or `pause`, but that should stay out of this PR.

### Playwright Coverage

- The current suite is structural smoke coverage, not behavior coverage.
- The most important missing test is a deterministic active-task test that seeds the display with `activeTasks` and asserts the assigned resource is rendered.
- The next missing test is a scheduler test for concurrent `runIdleCycle()` calls and resource distribution.
- Visual snapshot tests become worthwhile only after the suite is isolated from the live server.
