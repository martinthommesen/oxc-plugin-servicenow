# Contributing

Thank you for improving the project.
Before you start, search existing issues and discussions.
Use the issue forms for defects, rule proposals, and feature requests.
Ask usage questions in GitHub Discussions.

Follow the [code of conduct](CODE_OF_CONDUCT.md).
Use the process in [SECURITY.md](SECURITY.md) to report vulnerabilities.
Do not report a vulnerability through a public issue.

Fork the repository and create a focused branch.
Open a pull request against `main`.
Keep each pull request limited to one reviewable purpose.
Sign off web commits and explain any public compatibility change.

## Validation

Run every local gate with one command:

```bash
npm run validate
```

That command checks workflow action pins and the compatibility matrix; runs lint, format, project and fixture typechecking, build, tests, `verify:examples -- --all`, and Fluent-manifest verification; then checks evidence, acceptance, generated-documentation consistency, benchmarks, and the release artifact with a packed consumer.

`npm test` runs the serial TypeScript suite through `scripts/run-tests.mjs`, then runs `npm run fluent:check`. The test runner lists every `*.test.ts` file and passes the list to Node's test runner with the project-local `tsx` loader. Do not use a quoted `tests/**/*.test.ts` glob. Node test runners without glob expansion treat that path as one missing file.

`npm test` is hermetic: it does not reach the network. The packed-consumer test installs packages from the live npm registry, so it runs separately as `npm run test:consumer`. CI and the release workflow run it as their own jobs, and `npm run validate` includes it.

## Add a rule

1. Create `src/rules/<name>.ts` with `defineRule` and `createOnce`.
2. Add one descriptor module in `src/catalog/<name>.ts` that imports that implementation, and register it in `src/catalog.ts`. Identity, placements, examples, options, and evidence live in the descriptor. `src/rules/index.ts` derives the rule record from the catalog at load time.
3. Add tests in `tests/rules/` using the matrix in [Write a ServiceNow lint rule](docs/rule-authoring.md).
4. Run `npm run docs`. It regenerates `docs/rules/`, README rule tables, and recommended oxlintrc copies.
5. Run `npm run validate`.

Do not edit generated rule pages, README rule tables, or recommended `.oxlintrc.json` copies by hand.

Read [Non-goals and rejected rule ideas](docs/non-goals.md) before you propose a rule. The proposal must say why it is not a documented non-goal.

## Analysis style

- Prefer `createOnce` and return `false` from `before()` to skip a file.
- Read context through `beginRuleFile(context)` or `getScriptContext(context)`.
- Recognize platform APIs with binding and provenance helpers. Do not match `gs`, `Promise`, or `GlideRecord` by name alone.
- When provenance, mode, or surface is unknown, suppress the diagnostic.
- Message text should say what is wrong and what to do instead.
- Do not invent Fluent APIs. Update the version-pinned declaration fixture with `npm run manifest:update`. The auditor accepts only exact npm-registry artifact URLs and enforces response, decompression, declaration, and graph-work limits before updating reviewed evidence; do not weaken those bounds to accommodate an unexplained upstream artifact.
- Query whole-program facts from the per-file `BindingWriteIndex` instead of re-walking the program per call site. Every remaining traversal over user source must be bounded by a deterministic budget: the path interpreter stops at its work budget and records `pathBudgetExhausted` instead of inventing facts (FINDINGS.md PER-005, PER-006). When a change adds a per-node or per-call-site walk, add its shape to `scripts/benchmark.mjs` and cover the scaling in `tests/analysis/alias-scaling.test.ts`.

## Autofixes

The plugin reports diagnostics only. No rule ships a fix or a suggestion, and the test harness has no fix application support. If a future rule needs a semantics-preserving rewrite, reintroduce the fix machinery from history together with exact output, syntax validity, idempotence, and comment-preservation tests.

## Changelog

Add a short note under `Unreleased` in `CHANGELOG.md` for user-visible rule, preset, or settings changes. `npm run release:prepare -- <version>` moves those notes under the exact heading `## <version> — YYYY-MM-DD` when a release is cut. The heading must be the first version heading after `Unreleased`.

## Release

1. Run `npm run release:prepare -- <version>` in the pull request branch. It sets the package and lockfile version and moves the `Unreleased` notes under the dated heading.
2. Run `npm run validate`.
3. Merge to `main`. The `Create release tag` workflow tags `v<version>` at the merged commit, and `.github/workflows/release.yml` validates, publishes through the `release` environment, verifies the registry package, and creates the GitHub release. No manual step or approval follows the merge.
4. Confirm that `validate / Verify release tag is current main tip`, `registry-verify` through `node scripts/verify-published-package.mjs`, and `github-release` through `node scripts/create-github-release.mjs` all passed. These gates cover registry integrity, provenance identity, public imports, and the GitHub release asset and commit.

A coding agent can run the whole sequence through the repository skill in `.agents/skills/release-oxc-plugin-servicenow`.

Avoid a second merge to `main` until the release workflow's initial tip check passes. Protected release tags are immutable; never move one to recover from a mismatch. Release the next version instead.

The publish job uses npm trusted-publishing OIDC and has only `id-token: write`. Do not set `NPM_TOKEN`. Do not publish from a pull request or a working tree.

Dependabot updates npm and GitHub Actions weekly. Oxc-related packages are grouped. Do not auto-merge those updates.
