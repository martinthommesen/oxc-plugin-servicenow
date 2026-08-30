# Client scripts

Client lint loads the plugin with `surfaces` set to `client` and `scope` set to `scoped`. A valid `GlideAjax` `getXMLAnswer` callback stays silent. `g_form.getReference` without a callback reports `servicenow/require-callback-for-getreference`.

## Sub-features

- `client-valid` lints `examples/client/valid` with no plugin diagnostics.
- `client-sync-getreference` reports `servicenow/require-callback-for-getreference` on `examples/client/invalid/sync.client.js`.
- `client-oxfmt` checks the valid client script with `oxfmt.recommended.json`.

## How to get to it (user POV)

- Copy `examples/client`, install `oxc-plugin-servicenow`, and run `npx oxlint -c .oxlintrc.json valid`.
- Run `npx oxlint -c .oxlintrc.json invalid` and expect the client API rules.
- Run `npx oxfmt -c oxfmt.config.ts --check valid` after the package is installed.

## Driving it with verify-examples

Preconditions:

- `npm run verify:examples -- prepare --run-id <id>` exited 0.
- `examples/client` is unmodified.

- **Valid tree.** Lint the clean Catalog Client Script. Run `npm run verify:examples -- --project client --tree valid --run-id <id>`. Exit 0. `pluginRules` is `[]`.
- **Sync getReference.** Lint the invalid client script. Run `npm run verify:examples -- --project client --tree invalid --run-id <id>`. Exit 0. `pluginRules` is `["servicenow/require-callback-for-getreference"]`. `stdout.json` filename contains `sync.client.js`.
- **Format check.** Run `npm run verify:examples -- --project client --tree oxfmt --run-id <id>`. Exit 0. `summary.json` has `"ok": true`.
- **Proof.** Open `run-summary.json` in the run directory. Use the attempt whose `project` is `client` and `tree` is `invalid`. Read that relative `dir` for `summary.json` and `stdout.json`. Run `git status -- examples/client` and require a clean tree.

## Gotchas

- This invalid fixture is a missing callback, not client `GlideRecord`. Client `GlideRecord` lives on `ui-action` and `mixed`.
- `scope` must stay `scoped`. The client `GlideRecord` rule is quiet when scope is unknown.
- Filename suffixes such as `.client.js` help classification. Do not rename the fixture during a drive.
