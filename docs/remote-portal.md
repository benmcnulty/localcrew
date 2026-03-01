# Remote Portal Plan

This document captures the public-safe contract Crusty will eventually need for `benlive.tv/crusty`.

It is intentionally architectural. Local branch names, test credentials, and staging specifics belong in the ignored local handoff document, not in the repo.

## Goal

Support authenticated operators who run Crusty locally and want:

- a remote browser HUD for their local swarm
- authenticated task submission into their local queue
- visibility into agent state, queue health, and recent completions
- eventual safe networking between multiple user-controlled Crusty swarms

## Local/Remote Boundary

Crusty must keep two layers distinct:

- local authority: the local Crusty process, local Ollama endpoints, local `.crusty/` runtime state, and local `external-memory` dropbox contents
- remote coordination: authenticated account identity, profile metadata, subscription flags, remote HUD reads, and remote task requests

The remote portal must never become the source of truth for local autonomous memory.

## What The Local App Needs

The local app will eventually need:

- a `/login` flow that authenticates the local operator against the remote portal
- a local auth/session store separate from `.crusty/` autonomous memory
- an authenticated sync worker that can:
  - publish a lightly detailed local HUD snapshot
  - pull remote outbound work requests
  - enqueue approved remote work into the local queue
  - publish acknowledgements, progress, and completion summaries

## Minimum Remote API Contract

The eventual remote service needs endpoints or equivalent Firebase-backed functions for:

- sign-in and sign-out
- profile bootstrap and profile lookup
- subscription or feature-flag lookup
- local swarm registration and heartbeat
- remote HUD snapshot upload
- remote task polling
- task acknowledgement and completion upload
- admin-only test account creation and privilege simulation

## Authentication Shape

The initial direction is a minimal Firebase Auth flow.

Requirements:

- operator sign-in in the browser
- local Crusty device authorization to act for that operator
- revocable session tokens
- support for admin testing and temporary simulated privilege levels during development

## Subscription-Aware Design

Development should not hard-paywall features.

Instead:

- represent subscription levels as feature flags
- support an admin-controlled under-construction gate
- allow the admin account to simulate lower tiers and test accounts
- keep local-only usage fully functional without the remote portal

## Remote HUD Scope

The first remote HUD should publish only lightweight state:

- current mode
- busy or idle status
- queue depth
- next task summary
- last completed task summary
- selected resource and model summaries
- recent audit summaries
- heartbeat timestamp

Do not publish full local autonomous memory by default.

## Remote Task Injection

Remote work submission should arrive as explicit requests that the local app can ingest into the same orchestrator queue model already used locally.

Requirements:

- authenticated origin
- clear requester identity
- priority and scope metadata
- local audit logging
- safe local acceptance rules before execution

## Future Swarm Networking

Longer term, the portal can act as a coordination surface for swarm-to-swarm interaction.

That requires:

- explicit operator consent
- authenticated routing
- per-swarm trust policy
- rate limits
- auditability
- minimal shared payloads by default

## Development Guidance

When building the remote side, development agents should preserve:

- parity between the CLI and browser UI
- the boundary between committed external-memory seeds and local internal runtime state
- the existing local queue model as the core execution primitive
- the ability to disable the remote layer entirely and keep Crusty fully local
