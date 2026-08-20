# PR #51 remediation validation report

This report is the final local audit for the seven-layer remediation stack. The atomic ledger is `docs/pr-51-acceptance-ledger.md` (104 rows, including the independent review addendum).

## Reviewable layers

| Layer | Checkpoint(s) | Scope |
| --- | --- | --- |
| 1 | `1d5367a`, `a08f912`, `f92686d`, `1fdf8d2`, `872ab89`, `a9f8a18` | context, settings, engine, profiles, readonly/cache contracts |
| 2 | `6708709`, `8972ce8` | shared path state, joins, abrupt completion, loop effects, expression identity |
| 3 | `379c4f9`, `635a30e` | stateful classic consumers, cursor implications, count proof |
| 4 | `001583e`, `17025c4`, `7053234`, `04ca820` | Fluent manifests, declaration boundaries, authoritative imports, Now.ID provenance |
| 5 | `8ded017`, `3e5133c`, `3cb44e9`, `57db40f`, `bd113eb`, `9438b38`, `02880e5` | docs, metadata, compatibility, benchmark and parser dimensions |
| 6 | `534572b`, `118d552`, `02880e5`, `7e42e02` | strict packed artifact, npm-pack shape compatibility, all Fluent/TypeScript packed cells, and all documented JavaScript modes |
| 7 | `530f920` | artifact-only OIDC workflow, retries, governance declaration, action pin enforcement |

## Local commands and environments

- Node `v26.7.0`, npm `12.0.2`, macOS arm64.
- `npm ci` followed by `npm run validate` from a detached clean worktree — pass.
- `npm run typecheck` — pass.
- `npm test` — pass (655 tests).
- `npm run docs:check` — pass (41 catalog records).
- `npm run manifest:check` — pass (3.0.0 (42 APIs), 4.1.0 (42 APIs), 4.8.0 (48 APIs), 4.10.0 (49 APIs), and 4.11.0 (49 APIs) manifests).
- `npm run workflow:check` and `npm run compat:check` — pass.
- `npm run bench` — pass; recommended small-to-large scale is approximately 2.05x in the final run. RSS is unavailable on this host; `benchmark.mjs --write` deliberately refuses to write a zero-RSS baseline.
- `npm run release:check -- --consumer-all` — pass for one inspected tarball across all six declared cells on the available host (SHA-256 `9e55142d95d9048b44849adc7058c47541d6f03591adda9b70882bc24d04631d`; npm integrity `sha512-QrBcndvCatuTG67ehmM75YfRHjcy6zrMtG7yjkA9Y+UXM+4FdPHcMuUs9ij73PdHuQ6YBheX88FYECQRGgjdcQ==`). The packed artifact is authoritative; no source or filesystem `dist` consumer import is used.
- `npm run compat -- --cell eslint9-current` — pass with real Oxlint, ESLint, oxfmt, TypeScript 5.8.3, and `@typescript-eslint/parser` 8.46.0 coverage; the all-cell packed run also passes the five Fluent SDK manifests.
- Targeted Fluent, stateful, profile, oxfmt, packed-consumer, benchmark-gate, and release-helper suites — pass.

## Before/after outcomes

- Unknown context remains silent while definite ServiceNow context reports.
- Branch joins use must-fact semantics; loop test side effects, continue targets, and equivalent expression identities are retained.
- Cursor rules distinguish `&&` from fallback-only `||`/`??`; count suggestions require a stable numeric counter and exact increments.
- Fluent knowledge is versioned through the current public npm SDK line observed during implementation (`4.11.0`), with explicit 4.8/4.10 transition fixtures and parseable symbol/version evidence.
- Dynamic `Now.ID` retains provenance but loses static-key precision; only lexical identifier aliases receive the alias exemption.
- The release workflow publishes only the inspected tarball, isolates OIDC to publication, verifies executable npm `11.5.1`, retries transient registry lag, and uses centralized full-SHA action pins.

## Intentionally deferred live gates

These are not claimed by local mocks or text checks and remain unchecked in the goal file and ledger:

1. A maintainer must apply and capture the GitHub `main` ruleset, protected `v*` tags, protected `release` environment, and npm trusted-publisher restriction (`scripts/release-governance.json` is the desired configuration).
2. Node 20/22 real-host execution must run in CI; this machine has Node 24/26 only. The release consumer matrix is configured for Node 20.19, 20, 22, 24, 26/current.
3. An approved protected tag must prove live npm OIDC publication, registry integrity/provenance/import visibility, and idempotent GitHub release creation.

No live publication, registry, or GitHub result is represented as complete by this local report.
