# Roadmap

## Current State

The baseline is stronger now:

- Erin now records transactional telemetry and audit logs for Ollama and Wikipedia work.
- A built-in `data-analyst` identity exists to review metrics and suggest routing refinements.
- `/hud`, the local write-capable HTTP API, and the `/ui` prototype provide a foundation for browser parity and live observability.
- external dropbox folders now let Erin ingest local spec files and move them through inbox, active, and outbox states.

The remaining ceiling is refinement, not absence:

- routing still relies partly on static heuristics rather than measured policy
- the browser-facing API and GUI still need stronger live-state controls and richer ergonomics
- telemetry needs richer historical analysis before model-switching can be strongly automated
- remote login, subscription-aware access, and authenticated swarm-to-portal networking are still architectural plans rather than shipped capabilities

## Highest-Value Next Steps

### 1. Refine Routing With Measured Policy

Build on the existing telemetry with stronger policy inputs:

- explicit queue wait and service-time thresholds by tier
- cold-load and model-eviction cost tracking
- historical success/failure rates by resource and model
- model-switch recommendations that compare real gains against reload cost

This is the bridge from “instrumented” to “self-optimizing.”

### 2. Expand The HUD And Browser Parity

- add richer live views for queue pressure, recent completions, and model health
- expose the same observability cleanly to mobile, tablet, and desktop browsers
- add safe control surfaces for queue actions and agent interactions

### 3. Remote Portal And Auth Bridge

- add a local `/login` flow once the remote portal contract is ready
- connect local Crusty instances to authenticated benlive.tv/crusty profiles
- define safe remote HUD reads, outbound task injection, and eventual swarm-to-swarm operator networking
- keep paid-tier architecture optional during development so all features remain testable without an actual paywall

### 4. Deepen Analyst And Review Workflows

- let `data-analyst` generate recurring telemetry reviews
- add durable analyst outputs to the external-memory playbooks when they prove useful
- separate speculative recommendations from measured conclusions more explicitly

### 5. Safe Promotion From Internal To External Memory

- formalize how useful internal agent discoveries are promoted into committed external-memory seeds
- keep `.crusty/` fully local and disposable without losing validated capabilities
- add review checkpoints before internal guidance becomes repo-default behavior

## Public Release Readiness

Before publishing the repo, the critical baseline is:

- env-based local configuration
- ignored runtime state
- committed external-memory seeds
- setup docs
- platform support scripts
- a clear architecture description

Those pieces are now in place, so the next iterations can focus on measured orchestration quality, GUI parity, and safe promotion workflows instead of basic repo hygiene.
