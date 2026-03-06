# Documentation Map

## Core Docs

- `README.md`: project overview and entry point.
- `docs/setup.md`: install, bootstrap, runtime commands, and explorer workflow.
- `docs/architecture.md`: runtime/storage model, routing, topology, and observability.
- `docs/document-navigation.md`: sitemap and heading-outline update model.
- `docs/overnight-runbook.md`: operations checklist for long autonomous runs.

## Seed Guidance

- `external-memory/README.md`: boundary between committed seed memory and ignored runtime memory.
- `external-memory/orchestrator/directives.md`: orchestrator operating rules and autonomous loop guidance.
- `external-memory/orchestrator/roadmap.md`: portable roadmap seeds.
- `external-memory/orchestrator/focus-todo.md`: portable priority seeds.
- `external-memory/agents/*`: committed built-in agent identity specs.

## Runtime Memory

- `.localcrew/system/secure/orchestrator/*.md`: live directives, roadmap, focus, workflow, inventory, changelog, and daily work.
- `.localcrew/system/secure/orchestrator/navigation/document-sitemap.md`: generated compact map of markdown content.
- `.localcrew/system/secure/orchestrator/navigation/outlines/*`: generated per-document heading sidecars.
- `.localcrew/system/secure/orchestrator/telemetry/*`: audit log and telemetry summary.
- `.localcrew/system/secure/agents/*`: per-agent memory/spec files.

## Code Paths

- `src/app.ts`: orchestration hub and autonomous document update application.
- `src/document-outline.ts`: markdown heading parsing, sitemap generation, and outline sidecars.
- `src/internal-files.ts`: explorer tree, file reads, and search over runtime/seed memory.
- `src/orchestrator-store.ts`: canonical orchestrator docs, system layout, and runtime seeding.
- `src/messages.ts`: prompt contract for `WRITE[...]` / `UPDATE[...]` guidance.
- `src/gui.ts`: browser explorer and display surfaces.
