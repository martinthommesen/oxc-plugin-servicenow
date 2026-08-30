# oxc-plugin-servicenow verification map

This directory is the maintained source for verifying user-facing plugin behavior. Read this index before a drive. Then use the matching feature file.

## Baseline preconditions

- Work in the `oxc-plugin-servicenow` repo root.
- Run `npm install` and `npm run build`.
- Run `node .cursor/skills/verify-oxc-plugin-servicenow/scripts/verify.mjs doctor` and require exit 0.
- Set `VERIFY_RUN_ID` so doctor and drive share one evidence directory under `artifacts/verify-oxc-plugin-servicenow/`.
- Do not run checked-in `npx oxlint -c .oxlintrc.json` from an example folder in this checkout. The package name does not resolve here.
- Do not drive until doctor has passed in this same session.

## Driving conventions

- Start every recipe from the baseline unless the feature file says otherwise.
- Treat every command as literal. Keep project keys and trees unchanged.
- Run lint and format through `scripts/verify.mjs`.
- Compare plugin rule IDs only. Ignore host diagnostics that are not `servicenow(...)`.
- Restore nothing after a drive. These commands are read-only. Confirm that with `git status -- examples`.
- Do not remove proof artifacts during cleanup.

## Proof and skip reporting

- Capture the command and the resulting diagnostics, not only `summary.json` `ok`.
- Lint proof is `stdout.json` plus `summary.json` `pluginRules`.
- Format proof is `oxfmt --check` stdout, exit 0, and a clean `examples/` tree.
- Record the feature ID and the `verify.mjs drive` invocation on every artifact.
- Report an unreachable path with the command you ran and the unmet precondition.
- Do not report a skipped example project as verified through a different project.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with verify.mjs` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

Keep implementation details out of the map. Name only user paths, stable handles, required state, commands, and observable proof.

## Features

- [Fluent metadata](./fluent-metadata.md) covers `.now.ts` lint on the Fluent example.
- [Classic ES5](./classic-es5.md) covers ES5 Standards server-script lint.
- [Client scripts](./client-scripts.md) covers scoped client GlideAjax lint.
- [Business Rules](./business-rules.md) covers full-script Business Rule wrapper lint.
- [oxfmt recommended](./oxfmt-recommended.md) covers the shipped formatter preset on valid trees.

## Also driveable

These example projects have `projects.json` keys and work with `verify.mjs drive`. They do not have feature files yet.

- `classic-compatibility` reports `servicenow/no-promise` on `invalid/promise.server.js`.
- `es2021` reports `servicenow/no-async-iterators`, `servicenow/no-typed-arrays`, and `servicenow/no-unsupported-syntax` on its invalid tree.
- `ui-action` reports `servicenow/no-client-gliderecord` on `invalid/client-query.client.ui-action.js`.
- `mixed` reports `servicenow/no-client-gliderecord` on `invalid/src/client/bad.client.js`.
