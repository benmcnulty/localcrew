# Prompt Architecture

This document describes how LocalCrew constructs model prompts from composable component files and how those components are assembled for each context window.

---

## Overview

All prompt text lives in `external-memory/prompts/components/`. The `src/prompt-loader.ts` module loads, caches, interpolates, and composes these files at runtime. Message builder functions in `src/messages.ts` call `composePromptBlock` to assemble the final `ChatMessage[]` arrays that are sent to the inference layer.

**Benefits:**
- Prompt text changes never require TypeScript edits — edit the `.md` file and restart.
- A single canonical source for repeated content (e.g. tool syntax used in 6 builders is one file).
- The eval test suite (`test/prompt-eval.test.ts`) catches structural regressions before deployment.

---

## Component Catalog

### `tools/`

| File | Purpose |
|------|---------|
| `grounding.md` | Canonical 6-tool format lines (WIKIPEDIA, REDDIT, SEARCH, WEATHER, BENLIVE, WEBSITE). WEATHER line is wrapped in `{{#if weatherEnabled}}` conditional. |
| `queue.md` | QUEUE[priority][resource-alias]{role}: format definition and usage rules. |
| `write.md` | WRITE[stage][path] and UPDATE[stage][path][mode] block format definitions. |
| `next.md` | NEXT: @alias: format (used only in chat mode). |

### `identity/`

| File | Purpose |
|------|---------|
| `orchestrator-chat.md` | Orchestrator identity for chat mode. Interpolates `{{orchestratorName}}`, `{{alias}}`, `{{participantList}}`, `{{participantRoster}}`. |
| `orchestrator-auto.md` | Orchestrator identity for auto task mode. Interpolates `{{orchestratorName}}`, `{{resourceAlias}}`, `{{resourceRationale}}`. |
| `orchestrator-preflight.md` | Orchestrator identity for pre-flight analysis mode. Interpolates `{{orchestratorName}}`. |
| `agent.md` | Agent identity framing. Interpolates `{{agentName}}`, `{{agentSlug}}`, `{{preferredResource}}`. |
| `reviewer.md` | Secondary reviewer identity for queue review. Interpolates `{{reviewerAlias}}`. |
| `finalizer.md` | Finalization pass identity. |

### `stance/`

| File | Purpose |
|------|---------|
| `auto-mode.md` | Self-improvement stance, conciseness, resource-selection framing for auto mode. |
| `queue-draft.md` | Instructions for generating a provisional task backlog. |
| `queue-review.md` | Reviewer critique stance and VERDICT output format. |
| `queue-finalize.md` | Instructions for applying critique and finalizing a task list. |
| `compaction.md` | Conversation compaction system prompt (consensus summary instructions). |
| `daily-work.md` | Daily briefing generation instructions and section definitions. |

### `guardrails/`

| File | Purpose |
|------|---------|
| `containment.md` | No external changes, no scripts, no system mutations policy. |
| `task-quality.md` | Task self-containment, explicitness, and no-placeholder-verbs rule. |

### `format/`

| File | Purpose |
|------|---------|
| `domain-taxonomy.md` | SYSTEM, RESEARCH, KNOWLEDGE, SYNTHESIS, IDENTITY domain definitions and `{domain:X}` tag format. |
| `preflight-output.md` | GOAL / CONSTRAINTS / RISKS / APPROACH output format for pre-flight analysis. |
| `canonical-memory.md` | WRITE[internal] and UPDATE[internal] memory file instructions. |

### `defaults/`

| File | Purpose |
|------|---------|
| `directives.md` | Fallback directives when no user directives are configured. |
| `roadmap.md` | Fallback roadmap text. |
| `focus-todo.md` | Fallback focus-todo text. |
| `workflow.md` | Fallback agent workflow specification. |

---

## Context Assembly Map

### `buildChatMessages`

**Purpose:** Orchestrator responding to a user chat message.

| Layer | Source | Notes |
|-------|--------|-------|
| Identity | `identity/orchestrator-chat.md` | `{{orchestratorName}}`, `{{alias}}`, `{{participantList}}`, `{{participantRoster}}` |
| Tools | `tools/grounding.md` | WEATHER conditional applied |
| Tools | `tools/next.md` | NEXT: @alias: format |
| Context | directives, roadmap, focusTodo, changelog, orchestratorSummary | Injected as separate system messages |
| Temporal | `currentDateTime` | Optional system message if provided |
| History | `recentMessages` | Passed through verbatim |
| User | `message` | User chat message |

**Expected output:** Free-form response; may end with NEXT:, WIKIPEDIA:, REDDIT:, SEARCH:, WEATHER:, BENLIVE:, WEBSITE:, QUEUE: lines.

---

### `buildAgentChatMessages`

**Purpose:** Agent responding to a delegated task.

| Layer | Source | Notes |
|-------|--------|-------|
| Identity | `identity/agent.md` | `{{agentName}}`, `{{agentSlug}}`, `{{preferredResource}}` |
| Tools | `tools/grounding.md` | WEATHER conditional applied |
| Tools | `tools/write.md` | WRITE/UPDATE block formats |
| Tools | `tools/queue.md` | QUEUE format |
| Context | agentSpec (from `external-memory/agents/{domain}.md`), summary | Injected as system messages |
| Temporal | `currentDateTime` | Optional |
| History | `recentMessages` | Passed through verbatim |
| User | `taskPrompt` | The task the agent is being asked to perform |

---

### `buildTaskPreflightMessages`

**Purpose:** Orchestrator analyzing a task before execution.

| Layer | Source | Notes |
|-------|--------|-------|
| Identity | `identity/orchestrator-preflight.md` | `{{orchestratorName}}` |
| Format | `format/preflight-output.md` | GOAL/CONSTRAINTS/RISKS/APPROACH sections |
| Context | directives, inventory | Injected as system messages (directives truncated to 500 chars) |
| Temporal | `currentDateTime` | Optional |
| User | `task`, `priority` | Pre-flight analysis request |

**Expected output:** Structured GOAL: / CONSTRAINTS: / RISKS: / APPROACH: block.

---

### `buildAutoTaskMessages`

**Purpose:** Orchestrator executing an autonomous task.

| Layer | Source | Notes |
|-------|--------|-------|
| Identity | `identity/orchestrator-auto.md` | `{{orchestratorName}}`, `{{resourceAlias}}`, `{{resourceRationale}}` |
| Stance | `stance/auto-mode.md` | Self-improvement framing |
| Guardrails | `guardrails/containment.md` | No external changes |
| Tools | `tools/grounding.md` | WEATHER conditional |
| Tools | `tools/queue.md` | QUEUE format |
| Tools | `tools/write.md` + `format/canonical-memory.md` | WRITE/UPDATE format + memory file instructions |
| Guardrails | `guardrails/task-quality.md` | Task quality rules |
| Context | directives, roadmap, focusTodo, changelog, orchestratorSummary | System messages |
| Resource inventory | `inventory` | System message: "Resource inventory: ..." |
| Temporal | `currentDateTime` | Optional, injected after inventory |
| Agent roster | `agents` | Optional system message |
| User | `task`, `priority`, `createdBy` | Task execution request |

---

### `buildQueueFillMessages`

**Purpose:** Orchestrator generating a batch of new tasks.

| Layer | Source | Notes |
|-------|--------|-------|
| Identity | `identity/orchestrator-auto.md` | `{{orchestratorName}}` |
| Stance | `stance/queue-draft.md` | Draft queue stance |
| Format | `format/domain-taxonomy.md` | Domain tag definitions |
| Tools | `tools/grounding.md` | WEATHER conditional |
| Context | directives, roadmap, focusTodo, changelog, orchestratorSummary | System messages |
| Temporal | `currentDateTime` | Optional |
| Agent roster | `agents` | Optional |
| User | Queue fill request | Hardcoded user message requesting task generation |

**Expected output:** Numbered list of tasks with `{domain:X} [priority] description` format.

---

### `buildQueueFillReviewMessages`

**Purpose:** Reviewer critiquing a draft task list.

| Layer | Source | Notes |
|-------|--------|-------|
| Identity | `identity/reviewer.md` | `{{reviewerAlias}}` |
| Stance | `stance/queue-review.md` | Review criteria + VERDICT format |
| Tools | `tools/grounding.md` | WEATHER conditional |
| Context | inventory, roadmap, focusTodo, changelog | System messages |
| Temporal | `currentDateTime` | Optional, before user message |
| User | `draftTasks` | The draft list to review |

**Expected output:** Critique followed by `VERDICT: approve` or `VERDICT: revise`.

---

### `buildQueueFillFinalizeMessages`

**Purpose:** Finalizer applying review feedback and emitting the canonical task list.

| Layer | Source | Notes |
|-------|--------|-------|
| Identity | `identity/finalizer.md` | |
| Stance | `stance/queue-finalize.md` | Apply critique instructions |
| Format | `format/domain-taxonomy.md` | Domain tag definitions |
| Tools | `tools/grounding.md` | WEATHER conditional |
| Context | directives, roadmap, focusTodo, changelog, orchestratorSummary | System messages |
| Temporal | `currentDateTime` | Optional |
| User | `draftTasks` + `reviewFeedback` | Combined finalization request |

**Expected output:** Final numbered task list ready for insertion into the queue.

---

## Component Dependency Matrix

| Component | chat | agent | preflight | auto | fill | review | finalize |
|-----------|:----:|:-----:|:---------:|:----:|:----:|:------:|:--------:|
| identity/orchestrator-chat.md | ✓ | | | | | | |
| identity/orchestrator-auto.md | | | | ✓ | ✓ | | |
| identity/orchestrator-preflight.md | | | ✓ | | | | |
| identity/agent.md | | ✓ | | | | | |
| identity/reviewer.md | | | | | | ✓ | |
| identity/finalizer.md | | | | | | | ✓ |
| stance/auto-mode.md | | | | ✓ | | | |
| stance/queue-draft.md | | | | | ✓ | | |
| stance/queue-review.md | | | | | | ✓ | |
| stance/queue-finalize.md | | | | | | | ✓ |
| tools/grounding.md | ✓ | ✓ | | ✓ | ✓ | ✓ | ✓ |
| tools/next.md | ✓ | | | | | | |
| tools/queue.md | | ✓ | | ✓ | | | |
| tools/write.md | | ✓ | | ✓ | | | |
| guardrails/containment.md | | | | ✓ | | | |
| guardrails/task-quality.md | | | | ✓ | | | |
| format/canonical-memory.md | | | | ✓ | | | |
| format/domain-taxonomy.md | | | | | ✓ | | ✓ |
| format/preflight-output.md | | | ✓ | | | | |

---

## Template Variable Reference

| Variable | Type | Used in | Source |
|----------|------|---------|--------|
| `orchestratorName` | string | orchestrator-chat, orchestrator-auto, orchestrator-preflight | `LocalCrewApp` config |
| `alias` | string | orchestrator-chat | `options.alias` |
| `participantList` | string | orchestrator-chat | Comma-separated @alias list |
| `participantRoster` | string | orchestrator-chat | "Name (@alias)" full list |
| `resourceAlias` | string | orchestrator-auto | Selected inference resource alias |
| `resourceRationale` | string | orchestrator-auto | Rationale for resource selection |
| `agentName` | string | agent | Agent's display name |
| `agentSlug` | string | agent | Agent's @slug |
| `preferredResource` | string | agent | Agent's preferred inference resource |
| `reviewerAlias` | string | reviewer | Secondary reviewer's @alias |

---

## Conditional Flags

| Flag | Component | Effect |
|------|-----------|--------|
| `weatherEnabled` | `tools/grounding.md` | Includes/excludes the `WEATHER:` tool line |

Conditionals use the `{{#if flag}}...{{/if}}` syntax, applied by `applyConditionals()` in `src/prompt-loader.ts`.

---

## Loader API (`src/prompt-loader.ts`)

```typescript
// Load a single component (cached for process lifetime)
loadPromptComponent(componentPath: string, fallback: string, rootDir?: string): Promise<string>

// Interpolate {{varName}} placeholders
interpolatePrompt(template: string, vars: Record<string, string | undefined>): string

// Apply {{#if flag}}...{{/if}} conditionals
applyConditionals(template: string, flags: Record<string, boolean>): string

// Load, concatenate, interpolate, and apply conditionals for multiple components
composePromptBlock(
  componentPaths: string[],
  vars: Record<string, string | undefined>,
  flags?: Record<string, boolean>,
  fallbacks?: Record<string, string>,
  rootDir?: string
): Promise<string>

// Clear in-memory cache (tests only)
clearPromptCache(): void
```

Components are loaded from `external-memory/prompts/{componentPath}` relative to `rootDir` (defaults to `process.cwd()`). Path traversal is prevented by `loadSeedFile()`.

---

## Eval Guard Summary (`test/prompt-eval.test.ts`)

| Suite | What it verifies |
|-------|-----------------|
| Component integrity | All 25 required files exist, are non-empty, contain no unresolved `{{}}` markers after full variable injection, and are ≤8000 chars |
| Structural invariants | Key content is present in specific files: all 6 tool formats in grounding.md, VERDICT in queue-review.md, all 5 domains in domain-taxonomy.md, all 4 output sections in preflight-output.md, etc. |
| Composition correctness | Full `composePromptBlock` compositions produce expected combined content; WEATHER conditional works correctly |
| Duplication guard | No two component files share >30% of their lines (prevents content duplication from creeping back) |

---

## Editing Guide

1. Edit the component `.md` file in `external-memory/prompts/components/`.
2. If adding a new `{{varName}}` placeholder, ensure all callers pass that variable.
3. Run `bun test ./test/prompt-eval.test.ts` — all structural invariant and composition tests must pass.
4. Run `bun test ./test/*.test.ts` — full suite must pass (875+ tests).
5. To add a new component, create the file then add it to the `required` list in `test/prompt-eval.test.ts` Component integrity test.

**Never** move prompt text back inline into TypeScript — the eval suite will not catch regressions there.

---

## Agent Self-Reference

Agents operating in Reflect / IDENTITY domain tasks can use this document together with:
- `external-memory/agents/{domain}.md` — their own identity spec
- `external-memory/orchestrator/directives.md` — current system directives
- `external-memory/orchestrator/summary.md` — orchestrator working memory

to understand their full prompt assembly context. The component files are the authoritative source of what instructions they receive in each context window type.
