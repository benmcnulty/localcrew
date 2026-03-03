# In Focus Todo

- [high] Surface job opportunities aligned with Ben's skills (AI eng, LLM infra, agent orchestration): run SEARCH[jobs] and SEARCH[news] each autonomous session; log findings with scope=job-research; store curated summaries in .localcrew/system/job-opportunities.md.
- [high] Research current industry compensation for senior/principal AI engineers and LLM infrastructure roles; cross-reference with user-profile.md benchmarks; update benchmarks after multiple confirming data points.
- [high] Keep canonical resource naming, routing, and queue delegation resistant to context drift.
- [high] Leverage daily work sessions to bound autonomous work into coherent deliverable cycles.
- [high] Use canonical memory updates (WRITE[internal]) to keep summaries, focus, and roadmap current during long /auto runs.
- [high] Validate hierarchical orchestration: test sub-orchestrator delegation, agent assignment, and autonomous operation.
- [medium] Tighten orchestrator summaries, indexes, and prompt guidance so long-running `/auto` sessions stay coherent.
- [medium] Improve safe-mode recovery and failure diagnosis using recent audit evidence.
- [medium] Respect context window budgets — prioritize high-value context and trim verbose blocks proactively.
- [medium] Exercise `/topology` commands to build and refine multi-device hierarchies under real workloads.
- [low] Distill validated local lessons into simpler committed seed documents without carrying over experimental clutter.
