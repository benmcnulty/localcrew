# Roadmap

- Make autonomous routing more evidence-driven through cleaner telemetry interpretation, queue awareness, and context-fit heuristics.
- Improve memory quality so summaries, indexes, and directives stay compact, canonical, and resistant to long-run drift.
- Use daily work sessions to create bounded work cycles with clear deliverables and digests.
- Leverage context budgeting to ensure prompts fit within resource context windows without losing critical instructions.
- Use canonical memory file updates during autonomous work to keep orchestrator state accurate across context boundaries.
- Expand observability through the HUD, local API, and browser GUI without weakening the internal/external memory boundary.
- Strengthen safe-mode recovery so failures produce diagnosis and realignment instead of repeated derailment.
- Formalize the promotion path from local discoveries in `.crusty/` into simplified, committed `external-memory/` seeds.
- Support orchestrator role reassignment across devices to enable flexible multi-device topologies.
- Leverage hierarchical orchestration for complex tasks: sub-orchestrators coordinate subordinate agents, primary orchestrator focuses on high-level delegation.
- Enable online/offline resilience: sub-orchestrator networks continue operating when the primary is unavailable.
- Keep external feature work spec-driven through outbox tickets until it is deliberately implemented in the application layer.
