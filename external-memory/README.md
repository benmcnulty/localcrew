# External System Memory

This directory is the committed, portable seed layer for Crusty.

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

Those belong in the ignored `.crusty/` directory as internal system memory.

Internal notes, summaries, diagnostics, and process artifacts generated during `/auto`
should stay under `.crusty/system/secure/orchestrator/` rather than being treated as
portable external memory.

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
