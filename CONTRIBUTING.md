# Contributing

## Validation

Run every local gate with one command:

```bash
npm run validate
```

That command runs typecheck, build, tests (including oxlint, ESLint, oxfmt, profile fixtures, and the packed-package consumer), generated-doc consistency, and the Fluent manifest check.

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

Add a short Unreleased note in `CHANGELOG.md` for user-visible rule, preset, or settings changes.

## Release

1. Set `package.json` version and add a changelog section for that version.
2. Tag `v<version>` on `main`. The tag must match `package.json`.
3. `.github/workflows/release.yml` runs typecheck, build, tests (including packed-consumer), docs consistency, Fluent manifest check, tarball content inspection, and then `npm publish --provenance`.
4. Publishing uses the npm trusted-publishing OIDC token (`id-token: write`). `NPM_TOKEN` is only a fallback.
5. If publish fails after a green workflow, fix the registry/trust configuration and re-run the tag workflow. Do not publish from a pull request.

Dependabot updates npm and GitHub Actions weekly. Oxc-related packages are grouped. Do not auto-merge those updates.
