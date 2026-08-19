# Contributing

## Validation

Run every local gate with one command:

```bash
npm run validate
```

That command runs typecheck, build, tests (including oxlint, ESLint, oxfmt, profile fixtures, and the packed-package consumer), generated-doc consistency, and the Fluent manifest check.

## Add a rule

1. Create `src/rules/<name>.ts` with `defineRule` and `createOnce`.
2. Export it from `src/rules/index.ts`.
3. Add one descriptor in `src/catalog.ts`. That file is the source of truth for identity, placements, examples, and evidence.
4. Add tests in `tests/rules/` using the matrix in [Write a ServiceNow lint rule](docs/rule-authoring.md).
5. Run `npm run docs`. It regenerates `docs/rules/`, README rule tables, and recommended oxlintrc copies.
6. Run `npm run validate`.

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

Tag `v<version>` after `package.json` matches that version. The release workflow publishes with npm provenance.
