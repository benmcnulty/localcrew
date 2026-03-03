# User Profile — Ben

This profile describes the orchestrator's primary user for job opportunity research, compensation benchmarking, and skill-aligned career intelligence tasks. It is committed seed data for autonomous work — update only when the user's skills, interests, or compensation targets meaningfully change.

## Identity & Role

- **Name:** Ben
- **Archetype:** Full-stack AI engineer, systems architect, developer tooling builder
- **Current focus:** Local-first AI infrastructure, autonomous agent orchestration, agentic developer workflows

## Core Technical Skills

### AI / ML Engineering
- Anthropic Claude API (tool use, multi-turn, streaming, prompt engineering)
- OpenAI-compatible APIs (GPT-4, embedding models, structured output)
- Local LLM deployment: Ollama, LM Studio, multi-device inference routing
- Autonomous agent systems: task queues, hierarchical orchestration, memory management
- Grounding techniques: Wikipedia, web search, retrieval augmentation (RAG)
- Prompt design for agentic loops, context budgeting, tool-call chains

### Software Engineering
- TypeScript (ESM, strict mode, NodeNext resolution, bun runtime)
- Node.js / Bun — CLI tools, REPL systems, HTTP APIs, IPC, child processes
- React + TypeScript — frontend components, dashboard UIs
- CSS: complex layouts, responsive design, animation, dark/neon aesthetics
- REST API design, local-first data architectures
- Real-time observability systems (audit logs, telemetry, live dashboards)

### Systems & Infrastructure
- Multi-device LAN networking for inference clusters
- Local-first architecture: committed seed data, ignored runtime state
- Cross-platform shell scripting (macOS, Linux, Windows PowerShell)
- Git workflows, conventional commits, CI quality gates

### Developer Experience
- CLI design and REPL ergonomics
- Developer tooling and agentic workflow frameworks
- Browser dashboard development (inline HTML/CSS/JS served from Node)
- Test-driven development (bun:test, Playwright, Vitest)

## Compensation Benchmarks (as of 2025-2026)

Use these ranges to calibrate whether a discovered role is well-aligned and well-compensated. The orchestrator should surface roles at or above the midpoint for principal/senior levels.

| Role | Range | Notes |
|------|-------|-------|
| Senior AI Engineer | $180k–$280k TC | Strong market; LLM infra premium |
| Principal AI Engineer | $250k–$400k TC | Rare; systems + frontier model work |
| Staff Engineer (AI Infra) | $280k–$450k TC | FAANG/growth-stage premium |
| AI Developer Tools Lead | $200k–$350k TC | DevEx + LLM intersection |
| Head of AI Engineering | $220k–$380k TC | Small team leadership |
| AI Solutions Architect | $180k–$260k TC | Client-facing, broader scope |

## Ideal Role Characteristics

- **High signal:** Multi-agent systems, LLM infrastructure, autonomous AI tooling, developer platform work
- **High signal:** Greenfield, small-to-mid team, technical leadership scope
- **High signal:** Remote or hybrid, US-based company, post-Series-B or profitable
- **Medium signal:** Full-stack AI application development with architecture ownership
- **Weak signal / skip:** Pure MLOps/DevOps, data science without engineering depth, pure front-end
- **Skip:** Roles requiring relocation without strong compensation premium

## Job Search Directives for Autonomous Use

When performing job research tasks in `/auto`:

1. Use `SEARCH[jobs]: senior AI engineer autonomous agents remote 2026` to surface recent listings.
2. Use `SEARCH[news]: AI engineering compensation benchmarks 2026` for market rate intelligence.
3. Use `SEARCH[jobs]: LLM infrastructure engineer staff principal remote` for tier calibration.
4. Cross-reference findings with compensation benchmarks above; flag roles ≥$200k TC as high priority.
5. Summarize new findings in a brief audit event: scope `job-research`, noting role title, company, TC range, and fit signal.
6. Store curated results in `.localcrew/system/job-opportunities.md` (internal memory, not committed).
7. Promote only stable compensation benchmarks to this file via `WRITE[external][user-profile.md]` after multiple confirming data points.

## Research Cadence

- At least one job research cycle per daily autonomous session when session type is `open` or `research`.
- At least one compensation benchmark scan per week during sustained autonomous operation.
- Audit log entries for job research use scope `job-research` to enable log filtering and `/display` badge detection.
