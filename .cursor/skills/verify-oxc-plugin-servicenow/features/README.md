# oxc-plugin-servicenow verification map

This directory is the maintained source for verifying user-facing plugin behavior. Read this index before a drive. Then use the matching feature file.

## Baseline preconditions

- Work in the `oxc-plugin-servicenow` repo root.
- Run `npm install`.
- Run `npm run verify:examples -- --all` for the canonical proof, or `npm run verify:examples -- prepare --run-id <id>` before a single-project drive.
- Require exit 0 and a `doctor/COMPLETED` marker in the run directory.
- Do not run checked-in `npx oxlint -c .oxlintrc.json` from an example folder in this checkout. The package name does not resolve here.

## Driving conventions

- Start every recipe from the baseline unless the feature file says otherwise.
- Treat every command as literal. Keep project keys and trees unchanged.
- Run lint and format through `npm run verify:examples`.
- Compare the attempt `summary.json` reasons and plugin rules. Do not parse host codes by hand.
- Restore nothing after a drive. These commands are read-only. Confirm that with `git status -- examples`.
- Do not remove proof artifacts during cleanup.

## Proof and skip reporting

- Capture the command and the resulting diagnostics, not only `summary.json` `ok`.
- Lint proof is `stdout.json` plus `summary.json`.
- Format proof is `oxfmt --check` exit 0, `COMPLETED`, and a clean `examples/` tree.
- Record the feature ID and the `verify:examples` invocation on every artifact.
- Report an unreachable path with the command you ran and the unmet precondition.
- Do not report a skipped example project as verified through a different project.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with verify-examples` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

Keep implementation details out of the map. Name only user paths, stable handles, required state, commands, and observable proof.

## Features

- [Fluent metadata](./fluent-metadata.md) covers `.now.ts` lint on the Fluent example.
- [Classic ES5](./classic-es5.md) covers ES5 Standards server-script lint.
- [Classic compatibility](./classic-compatibility.md) covers Compatibility-mode Promise bans.
- [ES2021](./es2021.md) covers Australia ES2021 engine bans.
- [Client scripts](./client-scripts.md) covers scoped client GlideAjax lint.
- [Business Rules](./business-rules.md) covers full-script Business Rule wrapper lint.
- [UI Action](./ui-action.md) covers scoped client UI Action GlideRecord lint.
- [Mixed repository](./mixed.md) covers one recommended config across surfaces.
- [oxfmt recommended](./oxfmt-recommended.md) covers the shipped formatter preset on valid trees.
