# Contributing

## Adding a rule

1. Create `src/rules/<name>.ts` with `defineRule` + `createOnce`.
2. Export it from `src/rules/index.ts`.
3. Add it to the matching map in `src/configs/maps.ts`.
4. Add a catalog entry in `src/catalog.ts` (good + bad examples).
5. Run `npm run docs` to regenerate `docs/rules/<name>.md`.
6. Add tests in `tests/rules/` that cover aliases, shadowing, and context skips.
7. Run `npm test`, `npm run typecheck`, and `npm run manifest:check`.

## Style

- Prefer `createOnce` and return `false` from `before()` to skip files.
- Read context through `getScriptContext(context)` and settings through `getValidatedSettings(context)`.
- Recognize platform APIs with binding/provenance helpers. Do not match `gs`, `Promise`, or `GlideRecord` by name alone.
- When provenance, mode, or surface is unknown, suppress the diagnostic.
- Message text should say **what** is wrong and **what to do instead**.
- Do not invent Fluent APIs. Add them to `src/fluent/manifest.ts` with an evidence URL. `npm run manifest:check` rejects APIs without evidence.

## Autofixes

Add a fix only when the rewrite preserves semantics. Include exact output, syntax-validity, idempotence, and comment-preservation tests. Otherwise use a diagnostic only.

## Performance

`createOnce` runs once per process. Reset per-file state in `before()`. Do not close over a previous file's AST.
