# Contributing

## Validation

Run every local gate with one command:

```bash
npm run validate
```

That command runs typecheck, build, tests (including oxlint, ESLint, oxfmt, profile fixtures, and the packed-package consumer), generated-doc consistency, the Fluent manifest check, the real Oxlint benchmark, and `release:check -- --consumer` on one inspected tarball.

`npm test` runs `scripts/run-tests.mjs`. That script lists every `*.test.ts` file and passes the list to `tsx --test`. Do not use a quoted `tests/**/*.test.ts` glob. Node 20 treats that path as one missing file.

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
- Do not invent Fluent APIs. Add them to `src/fluent/manifest.ts` with an evidence URL.

## Autofixes

Add a fix only when the rewrite preserves semantics. Include exact output, syntax validity, idempotence, and comment-preservation tests. Otherwise use a diagnostic only.

## Changelog

Add a short Unreleased note in `CHANGELOG.md` for user-visible rule, preset, or settings changes. Before you tag a release, move those notes under an exact heading `## <version> — YYYY-MM-DD`.

## Release

1. Set `package.json` version and add the exact changelog heading for that version.
2. Run `npm run validate`. That command inspects one tarball and runs packed-consumer tests on that file.
3. Merge to `main`. Tag `v<version>` on that commit. The tag must match `package.json`.
4. `.github/workflows/release.yml` validates on a read-only job, uploads the inspected tarball, runs the consumer matrix on that file, then publishes the same file with `npm publish <tarball> --ignore-scripts --provenance`.
5. The publish job uses the protected `release` environment and npm trusted-publishing OIDC (`id-token: write`). Do not set `NPM_TOKEN`.
6. After publish, `scripts/verify-published-package.mjs` imports the registry package and compares integrity to the inspected tarball. The workflow creates the GitHub release only after that check passes.
7. If publish fails after a green validate/consumer run, fix the registry or trust configuration and re-run the publish job. Do not publish from a pull request or a working tree.

See [Release provenance](docs/release.md).

Dependabot updates npm and GitHub Actions weekly. Oxc-related packages are grouped. Do not auto-merge those updates.
