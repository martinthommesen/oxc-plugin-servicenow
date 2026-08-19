# Contributing

## Adding a rule

1. Create `src/rules/<name>.ts` with `defineRule` + `createOnce`.
2. Export it from `src/rules/index.ts`.
3. Add it to `src/configs/recommended.ts` and/or `src/configs/strict.ts`.
4. Add a catalog entry in `src/catalog.ts` (good + bad examples).
5. Add `docs/rules/<name>.md`.
6. Add tests in `tests/rules/`.
7. Run `npm test` and `npm run typecheck`.

## Style

- Prefer `createOnce` and return `false` from `before()` to skip files.
- Read `settings.servicenow` through `getSettings(context)`.
- Message text should say **what** is wrong and **what to do instead**.
- Do not invent Fluent APIs. Stick to `@servicenow/sdk/core` and documented directives.

## Performance

`createOnce` runs once per process. Reset per-file state in `before()`. Do not close over a previous file's AST.
