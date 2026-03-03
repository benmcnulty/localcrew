# Roadmap

## Autonomous Loop Maturity

- Embed the Reflect → Plan → Implement → Benefit loop as the core autonomous operating rhythm. Measure cycle completeness — every cycle should touch all four phases.
- Deepen Phase 1 Reflect: the orchestrator should build richer situational awareness by cross-referencing audit trails, memory state, resource health, and user activity patterns before any planning begins.
- Strengthen Phase 3 Implement continuity: refine positional tracking ("task N of M") so multi-task sequences maintain coherent progress across context window boundaries without losing orientation.
- Mature Phase 4 Benefit into a first-class capability: move beyond job search to include knowledge enrichment, skills gap analysis, workflow optimization suggestions, and goal-aligned opportunity discovery that the user hasn't explicitly requested.
- Create specialized agent identities for Phase 4 work: brainstorming agent, research analyst agent, career strategist agent — each with focused specs and memory.

## System Quality

- ~~Make autonomous routing more evidence-driven through cleaner telemetry interpretation, queue awareness, and context-fit heuristics.~~ **Done** — `buildResourceTelemetry()` wires real success rate, failure count, and throughput into `computeResourceScore()`.
- Improve memory quality so summaries, indexes, and directives stay compact, canonical, and resistant to long-run drift.
- ~~Leverage context budgeting to ensure prompts fit within resource context windows without losing critical instructions.~~ **Done** — `checkContextBudget()` pre-flight guard with automatic reroute to highest-context resource.
- ~~Strengthen safe-mode recovery so failures produce diagnosis and realignment instead of repeated derailment.~~ **Done** — retry-with-fallback on task failure (one retry on a different resource before quarantine).
- Formalize the promotion path from local discoveries in `.localcrew/` into simplified, committed `external-memory/` seeds.
- Measure and report routing quality: track how often tasks are rerouted, retried, or quarantined per session.

## Infrastructure & Scale

- Support orchestrator role reassignment across devices to enable flexible multi-device topologies.
- Leverage hierarchical orchestration for complex tasks: sub-orchestrators coordinate subordinate agents, primary orchestrator focuses on high-level delegation.
- Enable online/offline resilience: sub-orchestrator networks continue operating when the primary is unavailable.
- Expand observability through the HUD, local API, and browser GUI without weakening the internal/external memory boundary.
- Use daily work sessions to create bounded work cycles with clear deliverables and digests.

## User-Centric Value Creation

- Proactive benefit delivery is the ultimate measure of system value. The agents exist to improve the user's quality of life.
- Build toward a state where autonomous sessions routinely surface insights, opportunities, and actionable guidance the user didn't ask for but genuinely benefits from.
- Connect the user's stated skills and interests with adjacent opportunities — career, learning, creative, entrepreneurial — through systematic exploration.
- Keep external feature work spec-driven through outbox tickets until it is deliberately implemented in the application layer.
