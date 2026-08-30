# Mixed repository

A mixed repository uses one recommended config across Fluent, client, server, Business Rule, and UI Action files. A valid tree stays silent. A scoped client `GlideRecord` reports `servicenow/no-client-gliderecord`.

## Sub-features

- `mixed-valid` lints `examples/mixed/valid` with no plugin diagnostics.
- `mixed-client` reports `servicenow/no-client-gliderecord` on `invalid/src/client/bad.client.js`.
- `mixed-oxfmt` checks the valid mixed tree with `oxfmt.recommended.json`.

## How to get to it (user POV)

- Copy `examples/mixed`, install `oxc-plugin-servicenow`, and run `npx oxlint -c .oxlintrc.json valid`.
- Run `npx oxlint -c .oxlintrc.json invalid` and expect the documented rules.
- Run `npx oxfmt -c oxfmt.config.ts --check valid` after the package is installed.

## Driving it with verify-examples

Preconditions:

- `npm run verify:examples -- prepare --run-id <id>` exited 0.
- `examples/mixed` is unmodified.

- **Valid tree.** Run `npm run verify:examples -- --project mixed --tree valid --run-id <id>`. Exit 0. `pluginRules` is `[]`.
- **Bad client.** Run `npm run verify:examples -- --project mixed --tree invalid --run-id <id>`. Exit 0. `pluginRules` is `["servicenow/no-client-gliderecord"]`.
- **Format check.** Run `npm run verify:examples -- --project mixed --tree oxfmt --run-id <id>`. Exit 0. `summary.json` has `"ok": true`.
- **Proof.** Read the invalid attempt `summary.json` and `stdout.json`. Run `git status -- examples/mixed` and require a clean tree.

## Gotchas

- Do not disable recommended rules to silence one surface. File suffixes classify the file.
- The invalid fixture is client `GlideRecord`, not a Fluent or Business Rule failure.
- `scopePrefix` is `x_acme`. Hardcoded table-name policy rules are not in this example map.
