# Verification receipt — 2026-10-02

This is a dated local check, not a permanent pass-count badge or production certification.

Baseline: `a1260355024c459678b55e4f33abca87a566fc41`. Environment: Windows 11, Node.js `24.21.0`, Bun `1.4.2`.

| Check | Result |
| --- | --- |
| API suite (included in `npm run validate`) | 8 passed; virtual authorization cases plus a real Bun-to-Node worker HTTP/SSE regression |
| `bun test ./test/api-server.test.ts --test-name-pattern 'serves Bun worker requests'` | 1 passed; real health/status/resource requests, SSE state delivery, unauthorized POST/DELETE rejection, authorized unsupported methods, preflight and closed-worker behavior |
| `npm run validate` | Typecheck passed; 918 tests passed across 32 files, 0 failed |
| `npm run test:startup` | Native `node src/index.ts` reached the CLI and loopback HTTP API, served health/public resource reads, rejected unauthenticated resource mutations, and exited through `/exit` |

The installed Windows Bun executable did not provide a `bunx` command on PATH. A task-local wrapper forwarding to `bun x` supplied that existing tooling command for validation; no application dependency was added.

The initial full-suite run found an existing Windows failure: generated internal writes compared native paths with a literal `/` separator. Using the platform separator restored the internal-note regression. The original test script also depended on shell glob expansion; directory-based discovery now works on Windows.

Review found two additional worker-boundary defects: non-GET event requests could bypass shared authentication, and the worker's IPC listener was removed immediately after readiness. A bounded real HTTP test reproduced the latter as a response timeout before the fix. The listener now remains until shutdown, and only GET opens the public SSE stream. The regression passed after correction. The runtime range is `^22.18.0 || >=24.0.0`, excluding early Node 23 versions without unflagged TypeScript execution.

Inference responses in the suite are mocked, and state is created in temporary directories. The startup smoke uses a loopback API, a test-only token, and an unreachable inference endpoint. No live model quality, production portal, public deployment, TLS, or arbitrary-script isolation was certified by these checks. CI separately exercises the declared minimum Node version (`22.18.0`) and Node 24; check the candidate commit's CI before merging.
