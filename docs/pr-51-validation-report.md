# PR #51 validation status and historical snapshot

This document is not a final validation report. It separates current blockers from evidence recorded for older checkpoints.

Readiness terms have these meanings:

- **Pending**: no current proof exists at the owning pull request head.
- **Verified-at-head**: focused proof passed at the exact recorded head.
- **Merge-ready**: all in-repository gates and governance checks passed at the current merge commit.
- **Live-pending**: only a protected post-merge tag, registry, or GitHub action can supply the proof.
- **Release-verified**: the stable protected-tag run supplied exact live evidence.

## Current-head status

The current tracking state is not **Merge-ready**. These blockers remain:

- No current result is linked to the exact head of each owning dependent pull request.
- Ledger rows 2, 9, 14–20, 27, 29, 37, 38, 42–45, 49, 51, 52, 57, 58, 65, 68, 71, 74, 83, 85, and 101–103 were contradicted by the review at `b87972a`.
- Issues #57, #58, #64, #66, #69, #70, #72, #74, and #75 had acceptance requirements omitted from the former ledger. Their restored rows are **Pending**.
- Issue #75 requires actual dependent pull requests with isolated review and rollback boundaries. Ordered commits and document labels do not satisfy it.
- Applicable clean-checkout tests, real Oxlint and ESLint host checks, inspected-artifact checks, review, and executable governance checks must run again at each exact owning head or merge commit.
- Historical checkpoint commands and GitHub runs below refer to older commits. They cannot produce **Verified-at-head** for a changed or rebased head.

The merge gate does not require a stable tag. It evaluates current code and configuration at the exact pull request head or merge commit. It requires applicable clean-checkout tests, real hosts, inspected-artifact checks, review, and executable governance checks.

## Post-merge release status

The release remains **Live-pending**. After the reviewed stack merges to protected `main`, a controlled protected tag must drive approved OpenID Connect (OIDC) publication. The same run must supply registry integrity, exact cryptographic provenance identity, public-import, exact-tag-target, and GitHub release evidence. Only that stable protected-tag evidence can make the release **Release-verified**. Issues #58 and #76 remain open until this evidence exists.

---

## Historical snapshot from the former PR #51 remediation validation report

This section preserves the former validation claims. **Historical at the recorded checkpoint SHAs; contradicted at `b87972a`.** It is not proof for a current owning pull request head. The rebuilt atomic ledger is `docs/pr-51-acceptance-ledger.md`.

## Historical checkpoint groupings

| Layer | Checkpoint(s) | Scope |
| --- | --- | --- |
| 1 | `1d5367a`, `a08f912`, `f92686d`, `1fdf8d2`, `872ab89`, `a9f8a18` | context, settings, engine, profiles, readonly/cache contracts |
| 2 | `6708709`, `8972ce8` | shared path state, joins, abrupt completion, loop effects, expression identity |
| 3 | `379c4f9`, `635a30e` | stateful classic consumers, cursor implications, count proof |
| 4 | `001583e`, `17025c4`, `7053234`, `04ca820`, `225d193`, `7d84748`, `c958c71` | Fluent manifests, declaration boundaries, authoritative imports, Now.ID provenance, and published Table signatures |
| 5 | `8ded017`, `3e5133c`, `3cb44e9`, `57db40f`, `bd113eb`, `9438b38`, `02880e5` | docs, metadata, compatibility, benchmark and parser dimensions |
| 6 | `534572b`, `118d552`, `02880e5`, `7e42e02`, `d14590a` | strict packed artifact, npm-pack shape compatibility, all Fluent/TypeScript packed cells, and all documented JavaScript modes |
| 7 | `530f920`, `4af28f2`, `c98004d`, `e8c78f7`, `751d28b`, `d0e0b62`, `a7b9525`, `10e359d` | artifact-only OIDC workflow, retries, governance declaration, live governance capture, npm trusted publisher, repository-default action pins, dispatchable matrix, and cross-runtime JSON release fix |

## Historical commands and environments

- Node `v26.7.0`, npm `12.0.2`, macOS arm64.
- `npm ci` followed by `npm run validate` from a detached clean worktree — pass.
- `npm run typecheck` — pass.
- `npm test` — pass (656 tests).
- `npm run docs:check` — pass (41 catalog records).
- `npm run manifest:check` — pass (3.0.0 (42 APIs), 4.1.0 (42 APIs), 4.8.0 (48 APIs), 4.10.0 (49 APIs), and 4.11.0 (49 APIs) manifests).
- `npm run workflow:check` and `npm run compat:check` — pass.
- `npm run bench` — pass; recommended small-to-large scale is approximately 2x in the final run (host variance observed). RSS is unavailable on this host; `benchmark.mjs --write` deliberately refuses to write a zero-RSS baseline.
- `npm run release:check -- --consumer-all` — pass for one inspected tarball across all six declared cells on the available host (SHA-256 `066894ac2a9f71ca00bd6cdf815472a2a5e0d7c573c756c8627d580bff850510`; npm integrity `sha512-OD0YvFwVj0j7XpUtfmB1jrnxWGPeIwsXoh+AslBU9MCvJpaBs0nGsy2cRPyGhXnwI38Py5qh4EPhjWeni44n3Q==`). The packed artifact is authoritative; no source or filesystem `dist` consumer import is used.
- The same inspected artifact passed `npm run release:check -- --consumer-all` under real Node `20.19.0`, `22.14.0`, `24.16.0`, and `26.7.0` processes; every run covered all six cells, all five Fluent SDK manifests, all TypeScript parser fixtures, and all four JavaScript modes.
- `npm run compat -- --cell eslint9-current` — pass with real Oxlint, ESLint, oxfmt, TypeScript 5.8.3, and `@typescript-eslint/parser` 8.46.0 coverage; the all-cell packed run also passes the five Fluent SDK manifests.
- GitHub Actions [PR CI run `32355160103`](https://github.com/martinthommesen/oxc-plugin-servicenow/actions/runs/32355160103) at governance commit `10e359d` passed all 15 jobs: Node `20.19.0`, `22`, `24`, and `26` tests; six packed compatibility cells; benchmark; docs; manifest; workflow; and artifact checks. The artifact job emitted SHA-256 `b87899b2807325d2cd0eabbb540c377294b4353b299f4d83ce32839d2d7f8bf4` and npm integrity `sha512-DWuIsAra+AdSQJo31soDhkMeY38c/0gpJb7SKKZI6CE582V7KoJVdyUGAEKtH+7zL4Fy4F8oZ4Lpyey3KEik6A==`; each packed-consumer job used that same artifact bytes.
- The PR's actual [pull-request CI run `32351588439`](https://github.com/martinthommesen/oxc-plugin-servicenow/actions/runs/32351588439) at merge commit `d0e0b62` also passed all 15 jobs; the PR check rollup was 18/18 successful (including CodeQL). The merge commit incorporates current `main`, so this is the protected-branch merge-readiness result rather than a standalone dispatch.
- Targeted Fluent, stateful, profile, oxfmt, packed-consumer, benchmark-gate, and release-helper suites — pass.

## Historical claimed outcomes

- Unknown context remains silent while definite ServiceNow context reports.
- Branch joins use must-fact semantics; loop test side effects, continue targets, and equivalent expression identities are retained.
- Cursor rules distinguish `&&` from fallback-only `||`/`??`; count suggestions require a stable numeric counter and exact increments.
- Fluent knowledge is versioned through the current public npm SDK line observed during implementation (`4.11.0`), with explicit 4.8/4.10 transition fixtures and parseable symbol/version evidence.
- Dynamic `Now.ID` retains provenance but loses static-key precision; only lexical identifier aliases receive the alias exemption.
- The release workflow publishes only the inspected tarball, isolates OIDC to publication, verifies executable npm `11.5.1`, retries transient registry lag, and uses centralized full-SHA action pins.

## Historically deferred live gates

The repository controls and npm trust relationship are now live and captured in `docs/release-governance-live.json`; local mocks and text checks still do not substitute for the stable release run:

1. **Complete:** the GitHub `main` ruleset, protected `v*` tags, reviewer-gated `release` environment, SHA-pinning requirement, and npm trusted publisher are applied and captured. `npm trust list oxc-plugin-servicenow --json` identifies workflow `release.yml`, repository `martinthommesen/oxc-plugin-servicenow`, and environment `release`; no `NPM_TOKEN` secret is configured.
2. **Pending:** an approved protected `v2.0.0` tag must prove live npm OIDC publication, exact registry integrity/provenance/import visibility, and idempotent GitHub release creation.

No stable live publication, registry, or GitHub release result is represented as complete by this report.
