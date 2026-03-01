# Repository Guidelines

## Project Structure & Module Organization

Core runtime code lives in `src/`. The main CLI entry is `src/index.ts`; orchestration, routing, API, GUI, telemetry, storage, and Wikipedia tooling are split into focused modules such as `src/app.ts`, `src/api-server.ts`, `src/resources.ts`, and `src/wikipedia.ts`. Tests live in `test/` and mirror runtime areas with `*.test.ts` files. Durable seed data belongs in `external-memory/`; local runtime state belongs in ignored paths such as `.crusty/`, `.env`, and `.env.local`. Public docs live in `docs/`.

## Build, Test, and Development Commands

- `npm install` installs the Node-first project dependencies.
- `npm run setup:crusty` bootstraps the primary device and starts the app.
- `npm run setup:agent` runs the secondary-device setup flow.
- `npm run start` starts the CLI and local API/UI with Node.
- `npm test` runs the test suite through `bun test`.
- `node scripts/setup-agent.js` is the minimal standalone agent setup path.

## Coding Style & Naming Conventions

Use TypeScript with ESM imports and explicit `.ts` import suffixes. Follow the existing style: 2-space indentation, double quotes, semicolons, and small focused functions. Keep module names lowercase with hyphens only where already established, and prefer descriptive names like `resource-discovery.ts` over abbreviations. Use command-style naming for scripts (`setup-agent.js`) and `*.test.ts` for tests.

## Testing Guidelines

Tests use `bun:test`. Add or update targeted tests whenever behavior changes in `src/`, especially for command parsing, API behavior, storage, and orchestration flows. Keep tests isolated with temp directories and avoid writing to real local state. Run `npm test` before submitting changes.

## Commit & Pull Request Guidelines

Recent history follows concise conventional commits such as `feat: ...` and `fix(docs): ...`. Keep commits narrowly scoped and imperative. PRs should include a short summary, user-facing impact, test coverage notes, and screenshots only when UI behavior changes.

## Security & Configuration Tips

Do not commit `.crusty/`, `.env`, `.env.local`, or local agent memory. Treat `external-memory/` as the committed, portable seed layer and keep machine-specific configuration in ignored local files. When adding provider support, preserve the existing boundary between public-safe repo defaults and install-local secrets.
