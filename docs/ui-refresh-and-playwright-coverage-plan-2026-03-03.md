# UI Refresh and Playwright Coverage Plan — 2026-03-03

## Purpose

Define a concrete implementation and test plan to refresh the UI and establish robust Playwright coverage for interaction correctness and output expectations.

This plan is action-ready for post-marathon execution.

## Scope

Surfaces in scope:

- Display view (`/display`)
- Main UI (`/ui`)
- Authenticated API/UI integration behavior tied to display status and telemetry rendering

Out of scope:

- Deep backend routing logic changes not required for UI correctness

## Goals

1. Build a cohesive design system baseline across UI and display surfaces.
2. Improve responsiveness for mobile, tablet, laptop, HD, and UHD classes.
3. Add deterministic Playwright coverage for critical interactions and expected output content.
4. Ensure UI terminology aligns with operator readability and planned naming evolution.

## Workstream UI-1: Design System Foundation (P0)

### Deliverables

- UI token map for spacing, typography, panel radius/borders, and state colors.
- Breakpoint contract for: mobile, tablet, laptop, HD, UHD.
- Standard entity format: `Label (alias)`.

### Acceptance criteria

- Shared tokens are used across `/ui` and `/display`.
- No viewport class exhibits clipped or overlapping critical controls.
- Typography scaling is capped for UHD.

## Workstream UI-2: Responsive Layout Refresh (P0)

### Deliverables

- Mobile: single-column stack with compact live feed and collapsible secondary metrics.
- Tablet: two-column structure with non-critical panel collapse behavior.
- Laptop/HD/UHD: stabilized three-zone composition with max-width containment for UHD.

### Acceptance criteria

- Horizontal overflow remains zero at all target breakpoints.
- Live activity remains readable and useful across viewport classes.
- Header controls remain operable without overlap at all tested widths.

## Workstream UI-3: Interaction and State Clarity (P1)

### Deliverables

- Explicit visual state indicators for auto pause/monitor active behavior.
- On-screen policy visibility (model profile mode) where applicable.
- Critical anomalies surfaced as badges/alerts (stale resources, duplicate submission suppression, stream disconnects).

### Acceptance criteria

- Operator can identify mode, focus, and latest critical event within 3 seconds.
- State transitions are visibly reflected within one refresh cycle.

## Workstream UI-4: Naming and Terminology Cohesion (P2)

### Deliverables

- Naming abstraction layer for product-facing title/icon text.
- One migration-ready terminology map (legacy -> new term) for UI labels.

### Acceptance criteria

- UI strings are centralized and replaceable without broad code churn.
- Legacy naming can coexist during staged rebrand.

## Playwright Test Coverage Plan

## Test Matrix by Viewport

- Mobile: 390x844
- Tablet: 768x1024
- Laptop: 1440x900
- HD: 1920x1080
- UHD: 3840x2160

For each viewport, validate:

1. No horizontal overflow.
2. Header status and controls visible.
3. Network panel readable.
4. Focus panel content present.
5. Metrics panel visible and values render.
6. Live activity region present and not collapsed.

## Interaction Coverage (Display)

- Toggle monitor mode (`Monitor Off`/`Monitor On`) and assert state persistence.
- Focus/visibility behavior (auto-pause default, resume on focus).
- SSE disconnect/reconnect handling and fallback behavior.
- Correct rendering of label + alias format.

## Interaction Coverage (UI)

- Auth behavior with token/no token scenarios.
- Key dashboard navigation actions.
- Telemetry rendering paths under empty/loading/populated states.

## Output Expectation Coverage

- Verify expected text patterns for key status blocks:
  - network counts,
  - queue progress,
  - token activity,
  - model activity list.
- Verify no alias-only regressions where labels exist.
- Verify major state banners/alerts appear under simulated failure conditions.

## Test Artifact Strategy

- Store baseline screenshots for each viewport and surface.
- Add visual diff threshold policy to reduce false positives.
- Persist trace/video only on failure for CI efficiency.

## Suggested File Targets

Implementation likely touches:

- `src/gui.ts`
- `src/api-worker.js`
- `src/api-server.ts`
- `src/terminal.ts` (if shared terminology/status strings)

Tests likely touch:

- `test/gui.test.ts` (unit-level behavior)
- new Playwright e2e suite under `test/e2e/` (proposed)

## Definition of Done

- UI refresh workstreams UI-1 and UI-2 merged.
- Playwright suite covers all target breakpoints and key interactions.
- CI includes Playwright run (or dedicated nightly if runtime-sensitive).
- Manual-only UI validation is no longer required for release confidence.
