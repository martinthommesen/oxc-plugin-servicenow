# Classic compatibility

Compatibility-mode lint loads the plugin with `javascriptMode` set to `compatibility` and `surfaces` set to `server`. A valid `GlideRecord` loop stays silent. `new Promise` reports `servicenow/no-promise`.

## Sub-features

- `compat-valid` lints `examples/classic-compatibility/valid` with no plugin diagnostics.
- `compat-promise` reports `servicenow/no-promise` on `examples/classic-compatibility/invalid/promise.server.js`.
- `compat-oxfmt` checks the valid server script with `oxfmt.recommended.json`.

## How to get to it (user POV)

- Copy `examples/classic-compatibility`, install `oxc-plugin-servicenow`, and run `npx oxlint -c .oxlintrc.json valid`.
- Run `npx oxlint -c .oxlintrc.json invalid` and expect the Compatibility engine bans.
- Run `npx oxfmt -c oxfmt.config.ts --check valid` after the package is installed.

## Driving it with verify-examples

Preconditions:

- `npm run verify:examples -- prepare --run-id <id>` exited 0.
- `examples/classic-compatibility` is unmodified.

- **Valid tree.** Run `npm run verify:examples -- --project classic-compatibility --tree valid --run-id <id>`. Exit 0. `pluginRules` is `[]`.
- **Promise.** Run `npm run verify:examples -- --project classic-compatibility --tree invalid --run-id <id>`. Exit 0. `pluginRules` is `["servicenow/no-promise"]`.
- **Format check.** Run `npm run verify:examples -- --project classic-compatibility --tree oxfmt --run-id <id>`. Exit 0. `summary.json` has `"ok": true`.
- **Proof.** Open `run-summary.json` in the run directory. Use the attempt whose `project` is `classic-compatibility` and `tree` is `invalid`. Read that relative `dir` for `summary.json` and `stdout.json`. Run `git status -- examples/classic-compatibility` and require a clean tree.

## Gotchas

- Recommended rules stay silent on `Promise` until `javascriptMode` is `compatibility` or `es5`.
- ES5 is a different project key (`classic-es5`) and reports `servicenow/no-unsupported-syntax` on `?.`.
- Do not accept `servicenow/no-hardcoded-sysid` as a substitute for `no-promise`.
