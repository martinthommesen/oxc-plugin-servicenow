---
name: verify-oxc-plugin-servicenow
description: Drives real oxlint and oxfmt against this plugin's example projects and captures JSON proof. Use when verifying oxc-plugin-servicenow behavior, proving a rule or preset change, checking Fluent or classic ServiceNow lint output, or when the user asks to verify, doctor, or exercise the plugin the way a consumer runs oxlint.
license: MIT
compatibility: Requires Node.js 20.19 or later, npm, and git. Run commands from the oxc-plugin-servicenow repository root.
---

# Verify oxc-plugin-servicenow

Primary user path is the oxlint CLI with this plugin loaded. Secondary path is oxfmt with `oxfmt.recommended.json`. There is no server and no browser UI.

`npm test` is the comprehensive local real-host regression gate. It builds the plugin, then runs unit tests and integration tests that load real oxlint and oxfmt. `npm run verify:examples` is the focused per-project evidence CLI. `npm run test:consumer` checks the packed-package install path and needs the network.

Read [features/README.md](features/README.md) before a drive. Use the matching feature file. Expected diagnostics live in `scripts/verify-projects.json` at the repository root.

## Launch

From the repo root:

```bash
npm install
npm run verify:examples -- --all
```

`--all` builds the plugin, records source and `dist/index.js` hashes, runs doctor, then drives every project. Ready when that command exits 0.

There is no process to keep alive. Each drive starts its own oxlint or oxfmt process.

## Doctor

`--all` and `prepare` run doctor. To re-check an existing run:

```bash
npm run verify:examples -- doctor --run-id <id>
```

`prepare` refuses an existing run id. Use `doctor` for a second check.

Doctor fails when `examples/` is dirty, git fails, `dist` is missing, recorded host versions changed, or the source and dist fingerprints no longer match the run manifest. It also loads the plugin against `examples/fluent/valid` and writes that evidence under `doctor/`.

A failed doctor run removes `doctor/COMPLETED` and sets `manifest.doctorCompleted` to `false` before it writes the new `doctor.txt`.

Refuse to treat a drive as canonical when doctor did not write `doctor/COMPLETED`.

## Drive

Checked-in example configs name `oxc-plugin-servicenow`. That module does not resolve in this checkout. The CLI copies the example config into the attempt directory, finds the `servicenow` plugin by name, and points its specifier at `dist/index.js`.

```bash
npm run verify:examples -- --all
npm run verify:examples -- --project fluent --tree invalid
npm run verify:examples -- --project fluent --tree oxfmt
npm run verify:examples -- --project all --tree oxfmt
```

A later source edit or a stale `dist/` tree fails the run. Rebuild with `prepare` or `--all`.

`--noncanonical` skips the `examples/` cleanliness gates. It stamps `manifest.noncanonical` and the attempt summaries. Do not treat that output as canonical proof.

Do not pass `--write` to oxfmt. The CLI uses `--check` only.

Do not install packages inside `examples/`. Do not edit checked-in `.oxlintrc.json` files.

ESLint host tests and `npm run test:consumer` stay out of this skill.

## Evidence

Proof goes to `artifacts/verify-oxc-plugin-servicenow/<run-id>/`. That path is gitignored. Cleanup must not delete it.

Each attempt directory is named `<project>-<tree>-<uuid>` and holds `label.txt`, `argv.json`, `stdout.txt` or `stdout.json`, `stderr.txt`, `effective.oxlintrc.json` when oxlint ran, `execution.json`, `summary.json`, and `COMPLETED`. Failures write the same files. `COMPLETED` is written last.

`--all` writes `run-summary.json` with `project`, `tree`, `attemptId`, and a `dir` path relative to the run directory. Use that file to find an attempt. Do not guess `<project>-invalid` without the uuid suffix.

`VERIFY_RUN_ID` must match `^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`. The CLI rejects parent segments and refuses to reuse a run directory that already has a manifest.

## Cleanup

```bash
npm run verify:examples -- cleanup --run-id <id>
```

This removes `live.pid` when that pid is dead. It refuses when that pid is still alive. If the run directory has no `manifest.json`, cleanup deletes the directory so a failed `prepare` can retry the same id. A completed run with a manifest keeps its evidence. It does not scan the operating-system temp directory.

## Helpers

The executable is `scripts/verify-examples.mjs`. The shared oxlint and oxfmt process runner is `scripts/lib/host-verifier.mjs`. Integration tests import that runner.

```bash
npm run verify:examples -- --all
npm run verify:examples -- validate
npm run verify:examples -- --project <name> --tree <valid|invalid|oxfmt>
```

## Isolate

Two runs need two run ids. Attempt directories are exclusive. Do not share one run id across agents.

This checkout is the only instance that matters. Do not lint a user's ServiceNow instance or any other working tree.

## Feature map

[features/README.md](features/README.md)
