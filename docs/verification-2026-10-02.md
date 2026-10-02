# Verification receipt — 2026-10-02

This is a dated local check, not a permanent pass-count badge or production certification.

Baseline: `a1260355024c459678b55e4f33abca87a566fc41`. Environment: Windows 11, Node.js `24.21.0`, Bun `1.4.2`.

| Check | Result |
| --- | --- |
| `bun test ./test/api-server.test.ts` | 7 passed; public GETs, missing/wrong Bearer tokens, authenticated resource add/remove, unchanged inventory after rejected mutations |
| `npm run validate` | Typecheck passed; 917 tests passed across 32 files, 0 failed |
| `npm run test:startup` | Native `node src/index.ts` reached the CLI and loopback HTTP API, served health/public resource reads, rejected unauthenticated resource mutations, and exited through `/exit` |

The installed Windows Bun executable did not provide a `bunx` command on PATH. A task-local wrapper forwarding to `bun x` supplied that existing tooling command for validation; no application dependency was added.

The initial full-suite run found an existing Windows failure: generated internal writes compared native paths with a literal `/` separator. Using the platform separator restored the internal-note regression. The original test script also depended on shell glob expansion; directory-based discovery now works on Windows.

Inference responses in the suite are mocked, and state is created in temporary directories. The startup smoke uses a loopback API, a test-only token, and an unreachable inference endpoint. No live model quality, production portal, public deployment, TLS, or arbitrary-script isolation was certified by these checks. CI separately exercises the declared minimum Node version (`22.18.0`) and Node 24; check the candidate commit's CI before merging.
