# Fluent metadata

Fluent metadata lint loads the plugin with `authoring` set to `fluent` and checks `.now.ts` files. A valid widget record stays silent. A `BusinessRule()` call without `$id` reports `servicenow/require-fluent-id`.

## Sub-features

- `fluent-valid` lints `examples/fluent/valid` with no plugin diagnostics.
- `fluent-missing-id` reports `servicenow/require-fluent-id` on `examples/fluent/invalid/missing-id.now.ts`.
- `fluent-oxfmt` checks Fluent valid files with `oxfmt.recommended.json`.

## How to get to it (user POV)

- Copy `examples/fluent`, install `oxc-plugin-servicenow`, and run `npx oxlint -c .oxlintrc.json valid`.
- Run `npx oxlint -c .oxlintrc.json invalid` and expect the documented Fluent rules.
- Run `npx oxfmt -c oxfmt.config.ts --check valid` after the package is installed.

## Driving it with verify-examples

Preconditions:

- `npm run verify:examples -- prepare --run-id <id>` exited 0.
- `examples/fluent` is unmodified.

- **Valid tree.** Lint the clean Fluent files. Run `npm run verify:examples -- --project fluent --tree valid --run-id <id>`. Exit 0. `summary.json` has `"pluginRules": []` and `"ok": true`.
- **Missing $id.** Lint the invalid Fluent file. Run `npm run verify:examples -- --project fluent --tree invalid --run-id <id>`. Exit 0. `pluginRules` is `["servicenow/require-fluent-id"]`. `stdout.json` filename contains `missing-id.now.ts`.
- **Format check.** Check Fluent valid formatting. Run `npm run verify:examples -- --project fluent --tree oxfmt --run-id <id>`. Exit 0. `summary.json` has `"ok": true`.
- **Proof.** Read `artifacts/verify-oxc-plugin-servicenow/$VERIFY_RUN_ID/fluent-invalid/summary.json` and `stdout.json`. Keep both. Run `git status -- examples/fluent` and require a clean tree.

## Gotchas

- `npx oxlint -c examples/fluent/.oxlintrc.json` fails in this checkout with `Cannot find module 'oxc-plugin-servicenow'`. Use `verify:examples`.
- `examples/fluent/oxfmt.config.ts` imports `oxc-plugin-servicenow/oxfmt` and fails the same way. Drive oxfmt through `oxfmt.recommended.json`.
- `Now.ID` and `Now.include` in `valid/widget.now.ts` are ambient. oxlint is not type-aware. Do not expect a missing-declaration diagnostic.
- A missing `$id` is `require-fluent-id`. Wrong-module imports are `fluent-proper-imports` and belong to other fixtures, not this example.
