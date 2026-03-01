# External System Memory

This directory is the committed, portable seed layer for Crusty.

It is intended for:

- core orchestrator defaults that should survive a fresh install
- built-in agent identities and their specifications
- durable guidance that should be lifted from successful local experimentation into the repo

It is not intended for:

- local queue state
- autonomous run output
- live agent memory
- telemetry logs
- any machine-specific runtime artifacts

Those live in the ignored `.crusty/` directory as internal system memory.
