# Contributing to Crusty

Thank you for your interest in contributing to Crusty! This document covers the workflow for reporting issues, submitting changes, and getting help.

## Getting Started

1. Fork the repository and clone your fork
2. Install dependencies: `npm install`
3. Bootstrap the orchestrator: `npm run setup:crusty`
4. Start the app: `npm start`

### Prerequisites

- **Node.js** >= 20.0.0
- **Bun** (for running tests): install from [bun.sh](https://bun.sh)
- **Ollama** (optional, for local inference): install from [ollama.com](https://ollama.com)

## Development Workflow

### Running the App

```bash
npm start              # Start with Node
bun run src/index.ts   # Start with Bun directly
```

### Running Tests

```bash
npm test                          # Run all tests
bun test test/commands.test.ts    # Run a single test file
```

## Code Style

- **TypeScript** with ESM imports using explicit `.ts` suffixes
- `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`, strict mode
- 2-space indentation, double quotes, semicolons
- Small, focused functions — avoid large monolithic methods
- Tests use `bun:test` and live in `test/*.test.ts`
- Tests must be isolated with temp directories — never write to real `.crusty/`

## Submitting Changes

1. Create a feature branch from `main`
2. Make focused, narrowly scoped commits using conventional commit messages:
   - `feat: add resource health monitoring`
   - `fix: prevent race condition in telemetry writes`
   - `docs: document /compact CLI command`
   - `test: add coverage for resource routing`
3. Run `npm test` before pushing
4. Open a pull request with:
   - A short summary of what changed and why
   - User-facing impact description
   - Test coverage notes
   - Screenshots only if UI behavior changed

## Reporting Issues

Open a GitHub issue with:
- Steps to reproduce
- Expected vs actual behavior
- Node.js/Bun version and OS
- Relevant log output (redact any personal data)

## Security

- **Never** commit `.crusty/`, `.env`, `.env.local`, or local agent memory
- `external-memory/` is the committed portable seed layer
- Machine-specific configuration belongs in gitignored local files
- When adding provider support, preserve the boundary between public-safe repo defaults and install-local secrets
- If you discover a security vulnerability, please report it privately rather than opening a public issue

## Project Structure

See [CLAUDE.md](./CLAUDE.md) and [docs/architecture.md](./docs/architecture.md) for a detailed overview of the codebase.
