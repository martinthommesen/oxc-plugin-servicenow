# Business Rules

Business Rule lint loads the plugin with `surfaces` set to `business-rule` and `businessRuleSourceFormat` set to `full-script`. A wrapped `executeRule` file stays silent. A top-level assignment reports `servicenow/require-business-rule-wrapper`.

## Sub-features

- `br-valid` lints `examples/business-rule/valid` with no plugin diagnostics.
- `br-unwrapped` reports `servicenow/require-business-rule-wrapper` on `examples/business-rule/invalid/unwrapped.br.js`.
- `br-oxfmt` checks the valid Business Rule with `oxfmt.recommended.json`.

## How to get to it (user POV)

- Copy `examples/business-rule`, install `oxc-plugin-servicenow`, and run `npx oxlint -c .oxlintrc.json valid`.
- Run `npx oxlint -c .oxlintrc.json invalid` and expect the wrapper rule.
- Run `npx oxfmt -c oxfmt.config.ts --check valid` after the package is installed.

## Driving it with verify-examples

Preconditions:

- `npm run verify:examples -- prepare --run-id <id>` exited 0.
- `examples/business-rule` is unmodified.

- **Valid tree.** Lint the wrapped full-script rule. Run `npm run verify:examples -- --project business-rule --tree valid --run-id <id>`. Exit 0. `pluginRules` is `[]`.
- **Unwrapped body.** Lint the invalid Business Rule. Run `npm run verify:examples -- --project business-rule --tree invalid --run-id <id>`. Exit 0. `pluginRules` is `["servicenow/require-business-rule-wrapper"]`. `stdout.json` filename contains `unwrapped.br.js`.
- **Format check.** Run `npm run verify:examples -- --project business-rule --tree oxfmt --run-id <id>`. Exit 0. `summary.json` has `"ok": true`.
- **Proof.** Open `run-summary.json` in the run directory. Use the attempt whose `project` is `business-rule` and `tree` is `invalid`. Read that relative `dir` for `summary.json` and `stdout.json`. Run `git status -- examples/business-rule` and require a clean tree.

## Gotchas

- Filename `.br.js` does not enable the wrapper rule. `businessRuleSourceFormat` must be `full-script`.
- `businessRuleWhen` stays unknown unless you set it. Timing-sensitive rules are out of scope for this example.
- Body-only format is a different setting. Do not reuse this invalid file to prove body-only behavior.
