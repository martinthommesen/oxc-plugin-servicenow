# UI Action

UI Action lint uses the recommended rule map. A valid client UI Action stays silent. Client `GlideRecord` in a scoped UI Action reports `servicenow/no-client-gliderecord`.

## Sub-features

- `ui-action-valid` lints `examples/ui-action/valid` with no plugin diagnostics.
- `ui-action-client-query` reports `servicenow/no-client-gliderecord` on `invalid/client-query.client.ui-action.js`.
- `ui-action-oxfmt` checks the valid UI Action files with `oxfmt.recommended.json`.

## How to get to it (user POV)

- Copy `examples/ui-action`, install `oxc-plugin-servicenow`, and run `npx oxlint -c .oxlintrc.json valid`.
- Run `npx oxlint -c .oxlintrc.json invalid` and expect the client GlideRecord rule.
- Run `npx oxfmt -c oxfmt.config.ts --check valid` after the package is installed.

## Driving it with verify-examples

Preconditions:

- `npm run verify:examples -- prepare --run-id <id>` exited 0.
- `examples/ui-action` is unmodified.

- **Valid tree.** Run `npm run verify:examples -- --project ui-action --tree valid --run-id <id>`. Exit 0. `pluginRules` is `[]`.
- **Client query.** Run `npm run verify:examples -- --project ui-action --tree invalid --run-id <id>`. Exit 0. `pluginRules` is `["servicenow/no-client-gliderecord"]`.
- **Format check.** Run `npm run verify:examples -- --project ui-action --tree oxfmt --run-id <id>`. Exit 0. `summary.json` has `"ok": true`.
- **Proof.** Read the invalid attempt `summary.json` and `stdout.json`. Run `git status -- examples/ui-action` and require a clean tree.

## Gotchas

- The UI Action README documents `surfaces: auto`. The checked-in config is the recommended map. The invalid fixture still fires `no-client-gliderecord` with that map.
- `.client.ui-action.js` classifies as client. Do not rename the fixture during a drive.
- Mixed UI Actions keep a client file and a server file.
