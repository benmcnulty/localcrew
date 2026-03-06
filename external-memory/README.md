# External System Memory

This directory is the committed, portable seed layer for Local Crew.

It is intended for:

- core orchestrator defaults that should survive a fresh install
- built-in agent identities and their specifications
- durable workflows and guidance promoted from validated local experience
- tracked dropbox folder structure under `inbox/`, `active/`, and `outbox/`

It is not intended for:

- local queue state
- autonomous run output
- live agent memory
- telemetry logs
- machine-specific resource details
- speculative implementation drafts generated during `/auto`

Those belong in the ignored `.localcrew/` directory as internal system memory.

Internal notes, summaries, diagnostics, and process artifacts generated during `/auto`
should stay under `.localcrew/system/secure/orchestrator/` rather than being treated as
portable external memory.

## Outline Navigation

- Local Crew generates a runtime sitemap at `.localcrew/system/secure/orchestrator/navigation/document-sitemap.md`.
- Per-document outline sidecars are generated under `.localcrew/system/secure/orchestrator/navigation/outlines/`.
- These outline files are the compact navigation layer for recurring markdown docs and the preferred source of `HEADING: Parent > Child` references during targeted updates.
- Keep committed markdown headings stable and functional so the runtime outline index stays reliable across installs.

## Promotion Rule

Promote a local lesson into `external-memory/` only when it is:

- still useful on a fresh install
- simpler than the local experimentation that discovered it
- expressed as guidance, workflow, or a stable specification rather than runtime residue

## Dropbox Folders

- `inbox/`: untracked user-supplied documents waiting for the orchestrator to ingest
- `active/`: untracked source documents and rough drafts currently being worked
- `outbox/`: untracked finalized source documents, final deliverables, and feature request tickets for external implementation work

For autonomous self-improvement:

- prefer local internal writes over `active/` when the artifact is only useful to the swarm
- use `outbox/feature-requests/` when the swarm needs developers to change the app

Only the folders themselves are tracked. Their contents are ignored so local work artifacts stay local.
