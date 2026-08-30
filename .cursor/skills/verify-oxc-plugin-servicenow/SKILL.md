---
name: verify-oxc-plugin-servicenow
description: Drives real oxlint and oxfmt against this plugin's example projects and captures JSON proof. Use when verifying oxc-plugin-servicenow behavior, proving a rule or preset change, checking Fluent or classic ServiceNow lint output, or when the user asks to verify, doctor, or exercise the plugin the way a consumer runs oxlint.
---

# Verify oxc-plugin-servicenow

Primary user path is the oxlint CLI with this plugin loaded. Secondary path is oxfmt with `oxfmt.recommended.json`. There is no server and no browser UI.

Do not treat `npm test` or `src/runtime/apply-rules.ts` as proof. Those paths do not load the plugin the way a consumer does.

Read [features/README.md](features/README.md) before a drive. Use the matching feature file. Expected plugin rule IDs live in [projects.json](projects.json).

## Launch

From the repo root:

```bash
npm install
npm run build
```

Ready when `dist/index.js` exists and doctor exits 0.

There is no process to keep alive. Each drive starts its own oxlint or oxfmt process.

Teardown is [Cleanup](#cleanup). Launch does not start a daemon.

## Doctor

Run this first, and again after any failed drive:

```bash
node .cursor/skills/verify-oxc-plugin-servicenow/scripts/verify.mjs doctor
```

Doctor is read-only except for a temp oxlint config it deletes. It checks Node against `engines.node`, `dist/index.js`, the installed oxlint and oxfmt versions, and a real plugin load on `examples/fluent/valid`.

Refuse to drive when doctor prints `FAIL`. A `WARN` on dirty `examples/` means the proof may mix your edits with the fixture.

## Drive

Checked-in example configs use `"specifier": "oxc-plugin-servicenow"`. That module name does not resolve in this checkout. Do not run `npx oxlint -c examples/<project>/.oxlintrc.json` and call that a local proof. The script copies the example config, points `jsPlugins[0].specifier` at `dist/index.js`, and runs repo-local `node_modules/.bin/oxlint`.

```bash
export VERIFY_RUN_ID=verify-$(date +%Y%m%d-%H%M%S)
node .cursor/skills/verify-oxc-plugin-servicenow/scripts/verify.mjs drive fluent valid
node .cursor/skills/verify-oxc-plugin-servicenow/scripts/verify.mjs drive fluent invalid
node .cursor/skills/verify-oxc-plugin-servicenow/scripts/verify.mjs drive fluent oxfmt
node .cursor/skills/verify-oxc-plugin-servicenow/scripts/verify.mjs drive all oxfmt
```

Replace `fluent` with a key from `projects.json` `lintProjects`.

The script exits 0 only when the observed plugin rule set matches `projects.json`. oxlint exit 1 on an invalid tree is the expected host status. It is not a failed proof.

Use `--format json`. Plugin codes look like `servicenow(require-fluent-id)`. Normalize them to `servicenow/require-fluent-id` before you compare.

Do not pass `--write` to oxfmt. Use `--check` only.

Do not install packages inside `examples/`. Do not edit checked-in `.oxlintrc.json` files.

ESLint host tests and `npm run test:consumer` are out of scope. They need a different recipe and, for the packed consumer, the network.

## Evidence

Proof goes to `artifacts/verify-oxc-plugin-servicenow/<VERIFY_RUN_ID>/`. That path is gitignored. Cleanup must not delete it.

Each drive writes `command.txt`, `stdout.json` or `stdout.txt`, `stderr.txt`, and `summary.json`. Doctor writes `doctor/doctor.txt`.

Proof standards:

- Run oxlint or oxfmt on the example tree the feature file names.
- Keep the command and the resulting diagnostics, not only the final `ok` flag.
- Confirm `examples/` is unchanged after the drive (`git status -- examples`).
- A silent unit-test walker is not proof.
- `--check` must not rewrite files. Confirm that with `git status`, not the flag name.

## Cleanup

```bash
node .cursor/skills/verify-oxc-plugin-servicenow/scripts/verify.mjs cleanup
```

This removes leftover `sn-verify-oxlint-*` temp directories. It does not kill processes by name. It does not delete `artifacts/verify-oxc-plugin-servicenow/`.

There is no long-lived instance to stop. If a drive process is still running, kill that pid only.

## Helpers

`scripts/verify.mjs` is executable. Run it with `node` from the repo root.

```bash
node .cursor/skills/verify-oxc-plugin-servicenow/scripts/verify.mjs doctor
node .cursor/skills/verify-oxc-plugin-servicenow/scripts/verify.mjs drive <project> <valid|invalid|oxfmt>
node .cursor/skills/verify-oxc-plugin-servicenow/scripts/verify.mjs cleanup
node .cursor/skills/verify-oxc-plugin-servicenow/scripts/verify.mjs validate-skill
```

## Isolate

Two drives can run at the same time. Each drive creates its own temp config.

Do not point two agents at one shared temp config. Do not reuse a `VERIFY_RUN_ID` that already holds a failed run you still need.

This checkout is the only instance that matters. Do not lint a user's ServiceNow instance or any other working tree.

## Feature map

[features/README.md](features/README.md)
