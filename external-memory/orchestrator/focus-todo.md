# In Focus Todo

## Autonomous Loop Discipline (Reflect → Plan → Implement → Benefit)

- [high] Phase 1 Reflect: answer all five introspection questions; produce a structured summary.md using the required schema (State / Observations / Patterns / Capability Map / Self-Corrections / Learnings Queue). Never skip to task generation.
- [high] Phase 1 Reflect: consult the performance summary in context — identify which resources or models are underperforming and why. Capture any new patterns in learnings.md before planning.
- [high] Phase 2 Plan: produce a sequenced, coordinated 3–6 item task set informed by the reflection summary. Each task concrete, distinct, proportionate.
- [high] Phase 3 Implement: check confidence level (HIGH / MEDIUM / LOW) before starting each task. Emit LOW_CONFIDENCE: reason when uncertain. After each task, write a brief retrospective to summary.md.
- [high] Phase 4 Benefit: dedicate real cycles to proactive user value — career research, knowledge enrichment, goal exploration. This phase is not optional.
- [high] Rotate focus areas across cycles: routing → memory → observability → queue hygiene → recovery → user research. Check audit log to avoid fixation.
- [high] Every cycle must produce at least one externally useful deliverable (job research, digest content, feature request, or actionable finding).

## Introspection and Learning

- [high] Maintain learnings.md: when a durable lesson is discovered during any phase, append it to learnings.md immediately using UPDATE[internal][learnings.md][append]. Do not batch lessons.
- [medium] Cross-pollinate agent knowledge: during Phase 1 Reflect, check whether any agent domain discoveries warrant updating another agent's spec or the orchestrator directives.
- [medium] Promote validated learnings: after 3+ cycles, review learnings.md entries for promotion to directives.md as standing policy. File a feature request ticket for lessons that require application-layer support.

## Standing Objectives

- [high] Surface job opportunities aligned with Ben's skills (AI eng, LLM infra, agent orchestration): run SEARCH[jobs] and SEARCH[news] each autonomous session; log findings with scope=job-research; store curated summaries in .localcrew/system/job-opportunities.md.
- [high] Keep canonical resource naming, routing, and queue delegation resistant to context drift.
- [high] Leverage daily work sessions to bound autonomous work into coherent deliverable cycles.
- [high] Use canonical memory updates (WRITE[internal]) to keep summaries, focus, and roadmap current during long /auto runs.
- [medium] Validate hierarchical orchestration: test sub-orchestrator delegation, agent assignment, and autonomous operation.
- [medium] Measure routing quality: review how often retry-with-fallback and context-budget reroute fire; tune thresholds if needed.
- [medium] Formalize the promotion path from local memory lessons into committed seed docs.
- [low] Distill validated local lessons into simpler committed seed documents without carrying over experimental clutter.
