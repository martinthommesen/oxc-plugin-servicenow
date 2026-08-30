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

## Driving it with verify.mjs

Preconditions:

- Doctor exits 0 in this session.
- `VERIFY_RUN_ID` is set.
- `examples/client` is unmodified.

- **Valid tree.** Lint the clean Catalog Client Script. Run `node .cursor/skills/verify-oxc-plugin-servicenow/scripts/verify.mjs drive client valid`. Exit 0. `pluginRules` is `[]`.
- **Sync getReference.** Lint the invalid client script. Run `node .cursor/skills/verify-oxc-plugin-servicenow/scripts/verify.mjs drive client invalid`. Exit 0. `pluginRules` is `["servicenow/require-callback-for-getreference"]`. `stdout.json` filename contains `sync.client.js`.
- **Format check.** Run `node .cursor/skills/verify-oxc-plugin-servicenow/scripts/verify.mjs drive client oxfmt`. Exit 0. stdout contains `All matched files use the correct format`.
- **Proof.** Read `artifacts/verify-oxc-plugin-servicenow/$VERIFY_RUN_ID/client-invalid/summary.json` and `stdout.json`. Run `git status -- examples/client` and require a clean tree.

## Gotchas

- This invalid fixture is a missing callback, not client `GlideRecord`. Client `GlideRecord` lives on `ui-action` and `mixed`.
- `scope` must stay `scoped`. The client `GlideRecord` rule is quiet when scope is unknown.
- Filename suffixes such as `.client.js` help classification. Do not rename the fixture during a drive.
