# Copilot instructions for oxc-plugin-servicenow

This repository is an oxlint and ESLint plugin that lints ServiceNow JavaScript. Rules report diagnostics only; nothing here ships a fix. `AGENTS.md` at the root is the agent contract and applies to you as well: read the relevant `lat.md/` sections before changing code, keep `lat.md/` in sync with what you change, and run `lat check`.

## How the project is organized

- `src/catalog/` is the single rule registry. A rule exists only if it has a descriptor there; generated docs, README tables, and presets derive from it.
- `src/rules/` holds rule implementations. `src/analysis/` holds identity, mutation, and path-sensitive analysis shared by rules. `src/context/` classifies a file onto ServiceNow surfaces and modes.
- `scripts/` are type-checked JavaScript. The release scripts are security boundaries described in `docs/release.md`.
- `lat.md/` is the architecture knowledge graph. `lat.md/invariants.md` states the properties the repository enforces; `lat.md/tests.md` binds each one to a test.

## What to check in a review

- Silence on unknown facts. When provenance, mode, surface, or control flow is unknown, a rule must stay silent. A finding that assumes the common case is a false positive waiting to happen.
- Declining is not passing. A rule that returns `false` from `before()` declined the file. Tests must use `assertValidActive` or `assertSkipped`, not a bare "no diagnostics" check.
- Evidence. Every catalog claim of ServiceNow behavior needs a release-pinned official URL or an in-repo proof. Flag prose that asserts support.
- Two version axes. The instance release and the Fluent SDK version are independent. A rule must not claim one when it is versioned by the other.
- Release safety. Nothing outside `.github/workflows/release.yml` may publish, only the Release Sentinel app may create a `v*` tag, and the merge to `main` is the publish action. Treat any change to workflows, `scripts/release-governance.json`, or `scripts/create-release-tag.mjs` as a security change.
- Generated files. Rule pages under `docs/rules/`, `src/version.ts`, and the acceptance ledger are generated. A hand edit there is a defect; the source is elsewhere.

## Conventions

- Commits and pull request titles follow Conventional Commits with a lowercase imperative description. One type and one logical change per pull request.
- Formatting and lint are enforced by oxfmt and oxlint; do not comment on style they already cover.
- User-visible rule, preset, or settings changes add a note under `## Unreleased` in `CHANGELOG.md`. `npm run release:prepare -- <version>` moves those notes when a release is cut.
- Tests run through node:test. `npm run validate` is the full local gate and mirrors the required status checks.
