# Classic ES5

Classic ES5 lint loads the plugin with `javascriptMode` set to `es5` and `surfaces` set to `server`. A valid `GlideRecord` loop stays silent. Optional chaining and nullish coalescing report `servicenow/no-unsupported-syntax`.

## Sub-features

- `es5-valid` lints `examples/classic-es5/valid` with no plugin diagnostics.
- `es5-optional` reports `servicenow/no-unsupported-syntax` on `examples/classic-es5/invalid/optional.server.js`.
- `es5-oxfmt` checks the valid server script with `oxfmt.recommended.json`.

## How to get to it (user POV)

- Copy `examples/classic-es5`, install `oxc-plugin-servicenow`, and run `npx oxlint -c .oxlintrc.json valid`.
- Run `npx oxlint -c .oxlintrc.json invalid` and expect the ES5 engine bans.
- Run `npx oxfmt -c oxfmt.config.ts --check valid` after the package is installed.

## Driving it with verify.mjs

Preconditions:

- Doctor exits 0 in this session.
- `VERIFY_RUN_ID` is set.
- `examples/classic-es5` is unmodified.

- **Valid tree.** Lint the clean ES5 server script. Run `node .cursor/skills/verify-oxc-plugin-servicenow/scripts/verify.mjs drive classic-es5 valid`. Exit 0. `pluginRules` is `[]`.
- **Unsupported syntax.** Lint the invalid server script. Run `node .cursor/skills/verify-oxc-plugin-servicenow/scripts/verify.mjs drive classic-es5 invalid`. Exit 0. `pluginRules` is `["servicenow/no-unsupported-syntax"]`. `stdout.json` mentions both `?.` and `??` on `optional.server.js`.
- **Format check.** Run `node .cursor/skills/verify-oxc-plugin-servicenow/scripts/verify.mjs drive classic-es5 oxfmt`. Exit 0. stdout contains `All matched files use the correct format`.
- **Proof.** Read `artifacts/verify-oxc-plugin-servicenow/$VERIFY_RUN_ID/classic-es5-invalid/summary.json` and `stdout.json`. Run `git status -- examples/classic-es5` and require a clean tree.

## Gotchas

- Two diagnostics can share one rule ID. Compare the rule set, not the diagnostic count.
- Recommended rules stay silent on `?.` until `javascriptMode` is `es5` or `compatibility`. This project sets `es5`.
- Compatibility mode is a different project key (`classic-compatibility`) and reports `servicenow/no-promise` on `Promise`. Do not treat that file as ES5 proof.
- Do not accept `servicenow/no-hardcoded-sysid` as a substitute for the syntax rule.
