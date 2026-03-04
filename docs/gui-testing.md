# GUI Testing Guide

Comprehensive testing plan and documentation for the Local Crew web UI.

---

## Architecture

Local Crew serves two web pages from `src/gui.ts`:

| Page | URL | Purpose |
|---|---|---|
| **Admin UI** | `/` or `/ui` | Full-featured CRUD dashboard: status, resources, participants, queue, topology, dropbox, explorer, settings |
| **Display/Billboard** | `/display` | Real-time read-only billboard: three-column layout, SSE live updates, Matrix and Daily overlays |

Both pages are generated as inline HTML strings (no framework, no build step). CSS and JS are embedded or served from `/ui/styles.css` and `/ui/app.js`.

---

## Test Infrastructure

### Unit/Regression Tests (automated, zero-dependency)

**File:** `test/gui.test.ts` — original tests (syntax validation, auth wiring, display lifecycle)
**File:** `test/gui-regression.test.ts` — comprehensive regression suite (61 tests, 112 assertions)

```bash
bun test test/gui-regression.test.ts   # run GUI regression tests
bun test test/gui.test.ts              # run original GUI tests
bun test                               # run all tests
```

These tests validate:
- HTML structure (modals, overlays, buttons, attributes)
- CSS specificity fixes (`section[hidden]`, `.modal-overlay[hidden]`, z-index values)
- JavaScript behavior (function definitions, event handlers, state management, mutual exclusion)
- No browser required — all checks are string/regex analysis of the generated output

### Manual Browser Testing with Playwright MCP

**File:** `scripts/test-gui-server.ts` — standalone mock HTTP server

```bash
bun run scripts/test-gui-server.ts
# Serves:
#   Admin UI:   http://127.0.0.1:4399/
#   Display UI: http://127.0.0.1:4399/display
```

The test server provides mock API responses for all endpoints, including special test commands:
- `/test-edit` → triggers the edit modal
- `/test-workflow` → triggers the workflow modal

Use the Playwright MCP browser tools to navigate, click, type, press keys, take snapshots, and evaluate JavaScript against these pages.

---

## Regression Test Coverage

### Admin UI — Modal System

| # | Test | What It Catches |
|---|---|---|
| 1 | `modal overlay has hidden attribute by default` | Modal visible on page load (CSS specificity bug) |
| 2 | `edit panel exists with hidden attribute` | Edit panel visible when it shouldn't be |
| 3 | `workflow panel exists with hidden attribute` | Both panels showing simultaneously |
| 4 | `edit panel has a Cancel button` | User trapped in edit modal |
| 5 | `workflow panel has a Cancel button` | User trapped in workflow modal |
| 6 | `section[hidden] has display:none` | CSS `display:flex` overriding `hidden` attribute |
| 7 | `.modal-overlay[hidden] has display:none` | CSS specificity regression |
| 8 | `updateModalOverlay function is defined` | Helper removed or renamed |
| 9 | `updateModalOverlay checks both pendingEdit and pendingWorkflow` | Overlay state desync |
| 10 | `updateModalOverlay manages body overflow` | Body still scrollable behind modal |
| 11 | `renderWorkflow does NOT unconditionally hide editPanel` | Edit modal instantly closed after opening |
| 12 | `renderWorkflow calls updateModalOverlay` | Direct overlay manipulation bypass |
| 13 | `renderEdit does NOT unconditionally hide workflowPanel` | Workflow modal instantly closed |
| 14 | `renderEdit calls updateModalOverlay` | Overlay state desync |
| 15 | `Escape key handler` | No keyboard dismissal |
| 16 | `backdrop click handler` | Can't click outside to close |
| 17 | `workflow cancel button handler` | Cancel button doesn't work |

### Admin UI — Navigation & Layout

| # | Test | What It Catches |
|---|---|---|
| 18 | `all content sections have unique IDs` | Section removed or renamed |
| 19 | `navigation links use data-section attribute` | Nav routing broken |
| 20 | `body overflow set to hidden when modal open` | Scroll lock regression |

### Display UI — Overlay System

| # | Test | What It Catches |
|---|---|---|
| 21 | `three-column layout` | Layout structure broken |
| 22 | `Matrix overlay with canvas and close button` | Matrix elements missing |
| 23 | `Daily overlay with close button and content` | Daily elements missing |
| 24 | `trigger buttons exist` | Can't open overlays |
| 25 | `scanlines z-index is 50` | Scanlines covering daily overlay |
| 26 | `matrix overlay z-index is 10000` | Matrix not on top |
| 27 | `daily overlay z-index is 100` | Daily z-index wrong |
| 28 | `scanlines don't overlap daily (50 < 100)` | z-index collision |
| 29 | `matrix above everything (10000 > 100)` | Matrix doesn't cover page |

### Display UI — Mutual Exclusion & Dismissal

| # | Test | What It Catches |
|---|---|---|
| 30 | `mxStart closes daily before opening` | Both overlays visible simultaneously |
| 31 | `dailyOpen closes matrix before opening` | Both overlays visible simultaneously |
| 32 | `mxStart guards against double-open` | Multiple Matrix instances spawned |
| 33 | `dailyOpen guards against double-open` | Multiple Daily renders |
| 34 | `Escape key closes active overlays` | No keyboard dismissal on display |
| 35 | `Escape prioritizes Daily over Matrix` | Wrong overlay closed |
| 36 | `backdrop click on daily overlay` | Can't click outside daily to close |
| 37 | `Matrix close button wired to mxStop` | ✕ button doesn't work |
| 38 | `Daily close button wired to dailyClose` | ✕ button doesn't work |
| 39 | `Matrix button wired to mxStart` | Enter Matrix button broken |
| 40 | `Daily button wired to dailyOpen` | Daily button broken |

---

## Manual Playwright Testing Checklist

Run the test server first: `bun run scripts/test-gui-server.ts`

### Admin UI (`http://127.0.0.1:4399/`)

- [ ] Page loads clean — no console errors, status data renders
- [ ] Sidebar navigation works — clicking each tab shows the correct section
- [ ] Type `/test-edit` in command bar → edit modal opens with pre-filled text
- [ ] Edit modal: Cancel button closes it
- [ ] Edit modal: Escape key closes it
- [ ] Edit modal: Clicking backdrop (dark area) closes it
- [ ] Edit modal: body is not scrollable while open
- [ ] Type `/test-workflow` → workflow modal opens with form fields
- [ ] Workflow modal: Cancel button closes it
- [ ] Workflow modal: Escape key closes it
- [ ] Workflow modal: Clicking backdrop closes it
- [ ] After closing modal, page is fully interactive again

### Display UI (`http://127.0.0.1:4399/display`)

- [ ] Page loads with three-column layout — devices, main area, metrics
- [ ] SSE state event populates status data
- [ ] Click "Enter Matrix" → green falling characters animation
- [ ] Matrix: ✕ button closes it
- [ ] Matrix: Escape key closes it
- [ ] Matrix overlay covers entire viewport (can't click through)
- [ ] Click "Daily" → daily overlay with formatted markdown
- [ ] Daily: ✕ button closes it
- [ ] Daily: Escape key closes it
- [ ] Daily: Clicking backdrop (outside content card) closes it
- [ ] Mutual exclusion: Open Matrix → click Daily should not work (Matrix covers it)
- [ ] Mutual exclusion: Open Daily → close it → open Matrix → close → open Daily (no stale state)
- [ ] Scanlines visible but below overlays (z-index 50)
- [ ] Activity controls: "Auto Pause" / "Always On" toggle works

---

## Bugs Fixed (Session Reference)

These are the bugs discovered and fixed in the GUI testing sprint. The regression tests specifically guard against recurrence:

1. **CSS specificity: `section { display: flex }` overrides `hidden`** — `section[hidden] { display: none }` added
2. **CSS specificity: `.modal-overlay { display: flex }` overrides `hidden`** — `.modal-overlay[hidden] { display: none }` added
3. **`renderWorkflow(null)` clobbers `renderEdit()`** — Root cause of the malfunctioning modal. `submitCommand` called `renderEdit(request)` then `renderWorkflow(null)`, which unconditionally set `editPanel.hidden = true` and `modalOverlay.hidden = true`. Extracted `updateModalOverlay()` helper; each render function only hides the OTHER panel when actively opening.
4. **No Cancel button on workflow panel** — HTML cancel button + JS handler added
5. **No Escape key dismissal (admin)** — `keydown` listener added
6. **No backdrop click dismissal (admin)** — Click listener on `#modal-overlay` checking `event.target`
7. **No body scroll lock** — `document.body.style.overflow` managed by `updateModalOverlay()`
8. **z-index collision: scanlines (9999) above daily overlay (100)** — Scanlines reduced to z-index 50
9. **Matrix and Daily overlays can coexist** — `mxStart()` calls `dailyClose()`, `dailyOpen()` calls `mxStop()`
10. **No backdrop click on Daily overlay** — Click listener added
11. **No Escape key handler on display page** — `keydown` listener added (Daily first, then Matrix)
12. **Daily stale badge visible by default** — Set `display:none` initially

---

## Adding New Tests

When adding UI features to `src/gui.ts`:

1. **Add regression tests** to `test/gui-regression.test.ts`:
   - Test HTML structure: verify IDs, attributes, button text
   - Test CSS rules: verify specificity, z-index values, display properties
   - Test JS behavior: verify function existence, event handler registration, state checks

2. **Test interactively** with the test server:
   - Add mock data to `scripts/test-gui-server.ts` if new API endpoints are needed
   - Add test commands (like `/test-edit`) for features that need API triggers
   - Use Playwright MCP to click, type, and verify visual behavior

3. **Run the full suite** before committing:
   ```bash
   bun test && bunx tsc --noEmit
   ```
