# Orchestrator Learnings

Distilled, validated lessons accumulated across autonomous sessions. Each entry
is a durable pattern that has been observed more than once or confirmed by outcome.

Entries are captured during Phase 1 Reflect and immediately after discovery during
Phase 3 Implement. Superseded or disproven entries should be pruned or marked obsolete.

**Promotion path:** Entries that survive 3+ cycles without revision are candidates
for promotion into `directives.md` as standing policy.

---

## Routing

### Context budget pre-flight prevents silent truncation
**Observed**: Tasks routed to resources with smaller context windows silently truncated
prompts, producing incomplete or incoherent outputs without explicit errors.
**Pattern**: Routing decisions must account for actual prompt size (directives + context
blocks + task content) against the resource's `maxContextTokens` ceiling.
**Action**: Always verify context headroom before dispatch. The `checkContextBudget()`
pre-flight guard handles this automatically — preserve it and do not disable it.
**Confidence**: HIGH

### Failed resources need cooldown before retry
**Observed**: Immediate retry on the same resource that just failed produces the same
error, wasting a task slot.
**Pattern**: Network or model errors are often transient but not instantaneous. A
10-point load penalty on failed resources for ~10 minutes allows the error to resolve
before another task hits the same resource.
**Action**: Do not clear or override the network-failure penalty in routing logic.
**Confidence**: HIGH

---

## Memory Quality

### Free-form summary.md drifts into incoherence over long sessions
**Observed**: After multiple context-window boundaries, the orchestrator's summary.md
accumulated contradictory state descriptions, stale task references, and inflated text.
**Pattern**: Without a required schema, the model adds to the summary rather than
refining it, and old state persists alongside new state.
**Action**: Use the structured summary.md schema (State / Observations / Patterns /
Capability Map / Self-Corrections / Learnings Queue) and replace sections rather than
appending. Use `UPDATE[internal][summary.md][replace-section]` with heading selectors.
**Confidence**: HIGH

### Changelog grows unbounded and wastes context budget
**Observed**: After extended sessions, the changelog consumed a disproportionate share
of the context budget during queue fill and task execution.
**Pattern**: `tailChangelog()` limits to the last 60 lines, but entries can be verbose.
**Action**: Keep changelog entries concise (one line per completed task, two lines max
for notable events). Prefer IDs and outcomes over full descriptions.
**Confidence**: MEDIUM

---

## Task Quality

### Placeholder task descriptions produce low-value outputs
**Observed**: Tasks like "improve documentation" or "review routing" without explicit
objects and expected outcomes consistently produced generic, unverifiable outputs.
**Pattern**: The model cannot verify success if the task does not specify what
success looks like.
**Action**: Every task must include: what to operate on (file, document, section,
metric), what the expected output is, and what defines completion.
**Confidence**: HIGH

### Pre-flight analysis improves output alignment
**Observed**: Tasks executed without pre-flight GOAL/CONSTRAINTS/RISKS/APPROACH
analysis were more likely to drift from the intended scope or miss constraints.
**Pattern**: The 200-token pre-flight investment consistently reduces rework in the
main task execution.
**Action**: Do not skip pre-flight analysis for complex or multi-step tasks. For
simple retrieval or indexing tasks, abbreviated pre-flight is acceptable.
**Confidence**: HIGH

---

## Autonomous Loop Discipline

### Phase bleed degrades cycle quality
**Observed**: When the Reflect phase generates task proposals and the Plan phase
skips the reflection summary, subsequent tasks lack situational grounding.
**Pattern**: Phase boundaries are enforced by discipline, not by application code.
The model must self-enforce: Reflect → summarize only; Plan → read summary first.
**Action**: Begin every Plan phase with an explicit reference to the summary.md
produced in Reflect. If summary.md is absent or empty, treat it as a Reflect failure
and regenerate before planning.
**Confidence**: HIGH

### Rotation across focus areas prevents fixation
**Observed**: Without explicit rotation tracking, the orchestrator repeatedly planned
memory-hygiene and documentation tasks while neglecting routing quality and user research.
**Pattern**: High-salience domains (memory, documentation) generate more task proposals
because they produce visible, verifiable outputs. Low-salience domains (routing metrics,
failure analysis) require deliberate prioritization.
**Action**: Check the audit log for the last 5 completed task scopes before planning.
If the same domain appears 3+ times, skip it this cycle regardless of apparent need.
**Confidence**: HIGH
