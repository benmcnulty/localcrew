# Display UX Audit — 2026-03-02

## Scope and Method

This audit reviews the live display at `http://127.0.0.1:4310/display` using Playwright and existing captured screenshots:

- `display-mobile-390x844.png`
- `display-tablet-768x1024.png`
- `display-macbook-1440x900.png`
- `display-hd-1920x1080.png`
- `display-uhd-3840x2160.png`

Additional Playwright layout telemetry was captured for: mobile (390x844), tablet (768x1024), laptop (1440x900), HD (1920x1080), and UHD (3840x2160).

## Observed Current Behavior

### Strengths

- The overall visual identity is consistent (dark neon monitoring aesthetic) and legible on laptop/HD displays.
- Core operational signals are present and understandable: network health, current focus, queue progress, token activity, metrics, and live activity.
- The layout appears stable with no horizontal overflow at tested viewport widths.

### Responsiveness Findings

#### Mobile (390x844)

- Panels stack cleanly and avoid horizontal clipping.
- Metrics panel becomes too tall relative to viewport and competes with live activity.
- Live activity region appears compressed (very little visible line height in viewport telemetry), reducing practical usefulness.
- Header controls are dense for touch interaction; spacing is acceptable but not resilient for future control additions.

#### Tablet (768x1024)

- Network + focus split works; metrics drops beneath main row.
- Good intermediate structure, but visual hierarchy between focus and metrics is still weak.
- Footer/live area remains shallow relative to available space.

#### Laptop (1440x900, fullscreen MacBook Air)

- This is currently the best-balanced experience.
- Focus panel dominates appropriately; side rails are narrow but functional.
- Live activity is present but not visually emphasized enough for real-time incident triage.

#### HD (1920x1080)

- Readability and spacing are comfortable.
- Information density can feel low in some zones (especially side rails) while focus graph area is highly dominant.
- Typography scales up noticeably; this is mostly positive at this size.

#### UHD (3840x2160)

- Root font scales very aggressively, causing oversized UI and potential dashboard "toy-like" proportions at distance.
- Layout stretches significantly; side rails become wide but still low-information.
- Live activity area grows, but not with proportional structure improvements (it scales size more than utility).

## Functional and UX Gaps (Demo-Relevant)

1. **Compose-vs-auto race condition risk**
   - Operator input and auto-cycle output can interleave, producing confusion and accidental duplicate submissions.
2. **Alias-heavy operational language**
   - Display surfaces canonical aliases more often than operator-friendly names, reducing readability under pressure.
3. **Model selection transparency**
   - Display shows model activity but does not clearly indicate active policy mode (`all-llamas`, `custom`, `auto`) or whether a selection violated preferred baseline expectations.
4. **Live activity as weak debugging surface**
   - Lacks on-screen filtering controls and richer event context for incident analysis.

## Design System Recommendations (Next Sprint)

### 1) Establish explicit scaling rails

- Replace unconstrained viewport-proportional typography with bounded scales:
  - min/max font sizes and spacing tokens per breakpoint tier.
- Use a typographic clamp strategy with strict caps for UHD to prevent over-scaling.

### 2) Define responsive layout contracts

- **Mobile:** single-column stack, collapsible metrics detail, dedicated compact live ticker.
- **Tablet:** two-column primary with optional collapsible right rail.
- **Laptop/HD:** three-zone layout (network | focus | metrics) + fixed live strip.
- **UHD:** centered max-width content container with optional expanded telemetry panel, not full stretch.

### 3) Unify information hierarchy

- Prioritize top row: status + mode + alerts.
- Focus panel should show current objective + progress + blockers before chart emphasis.
- Metrics cards should include plain-language labels and trend deltas.

### 4) Standardize entity presentation

- Show `Label (alias)` everywhere in operator-facing UI.
- Keep alias accessible for power users, but default readability to human label first.

### 5) Add display state affordances

- Clear indicator for `Auto Pause` vs `Always Active` with explanation tooltip.
- Display-level warning badges for key anomalies (duplicate queue risk, stale resource refresh, model-policy drift).

## Naming and Identity Exploration (Pre-Public)

Current name is functional internally, but public-facing differentiation can be improved.

### Candidate naming directions

#### Swarm-oriented

- **Swarmline**
- **Swarmkeeper**
- **SwarmOps**

#### Herd/shepherding-oriented

- **Shepherd**
- **HerdFlow**
- **FlockControl**

#### Neutral orchestration-oriented

- **Orchard**
- **RelayMesh**
- **SignalHerd**

### Recommendation

- Use a two-part naming model:
  - Product name (public): e.g., **Shepherd** or **Swarmkeeper**
   - Internal codename (legacy-compatible during migration): keep `localcrew` temporarily as technical identifier.

## Rebrand Execution Plan (Safe Find/Replace Strategy)

1. **Phase 0: Alias layer**
   - Introduce a display-name variable and branding config entry without renaming internals.
2. **Phase 1: UI surface rename**
   - Replace visible labels in terminal/UI/API docs while preserving backward-compatible paths.
3. **Phase 2: Documentation migration**
   - Update README/docs/commands with cross-reference map from old to new naming.
4. **Phase 3: Code symbol migration**
   - Perform controlled refactor with regression gates (typecheck + tests + smoke).
5. **Phase 4: Cleanup**
   - Remove deprecated legacy naming after one release cycle.

## Sprint Backlog Proposal

### P0 (stability + operator confidence)

- Auto compose safety (dedupe + compose pause)
- Model policy visibility on display
- Label-first entity rendering (`Label (alias)`)
- UHD typography cap

### P1 (responsiveness + observability)

- Breakpoint-specific layout contracts
- Live activity filters and richer event context
- Verbose log stream integration hooks (local-only with auth)

### P2 (brand + design cohesion)

- New naming shortlist and decision workshop
- Branding token set (logo, iconography, terminology)
- Staged rename rollout plan with compatibility layer

## Acceptance Criteria for Design Sprint

- No viewport class shows clipped/overlapping critical controls.
- Operator can identify mode, current focus, and most recent critical event within 3 seconds at all target resolutions.
- UHD mode remains legible without oversized UI artifacts.
- Naming and terminology are consistent across display, terminal, docs, and API surfaces.
