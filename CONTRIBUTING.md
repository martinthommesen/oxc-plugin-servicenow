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

That command checks workflow action pins and the compatibility matrix; runs lint, format, project and fixture typechecking, build, tests, and Fluent-manifest verification; then checks evidence, acceptance, generated-documentation consistency, benchmarks, and the release artifact with a packed consumer.

`npm test` runs the serial TypeScript suite through `scripts/run-tests.mjs`, then runs `npm run fluent:check`. The test runner lists every `*.test.ts` file and passes the list to `tsx --test`. Do not use a quoted `tests/**/*.test.ts` glob. Node 20 treats that path as one missing file.

## Add a rule

1. Create `src/rules/<name>.ts` with `defineRule` and `createOnce`.
2. Add one descriptor in `src/catalog.ts` that imports that implementation. Identity, placements, examples, options, and evidence live there. `src/rules/index.ts` is generated from the catalog at load time.
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
- Do not invent Fluent APIs. Update the version-pinned declaration fixture with `npm run manifest:update`.

## Autofixes

Add a fix only when the rewrite preserves semantics. Include exact output, syntax validity, idempotence, and comment-preservation tests. Otherwise use a diagnostic only.

## Changelog

Add a short note under `Unreleased` in `CHANGELOG.md` for user-visible rule, preset, or settings changes. Before you tag a release, move the applicable notes under an exact heading `## <version> — YYYY-MM-DD`. The heading must be the first version heading after `Unreleased`.

## Release

1. Confirm the desired policy and principal IDs in `scripts/release-governance.json`, then run the read-only GitHub audit with `node scripts/check-release-governance.mjs`.
2. Set the package version and add the exact changelog heading for that version.
3. Run `npm run validate`.
4. Merge to `main`. Tag `v<version>` at the exact current protected `main` tip.
5. Let `.github/workflows/release.yml` validate and publish the uploaded tarball through the protected `release` environment.
6. Confirm that registry integrity, provenance identity, public imports, and the GitHub release all match the inspected artifact.

Keep `main` unchanged until the release workflow's initial tip check passes. Protected release tags are immutable; never move one to recover from a mismatch.

The publish job uses npm trusted-publishing OIDC and has only `id-token: write`. Do not set `NPM_TOKEN`. Do not publish from a pull request or a working tree.

Dependabot updates npm and GitHub Actions weekly. Oxc-related packages are grouped. Do not auto-merge those updates.
