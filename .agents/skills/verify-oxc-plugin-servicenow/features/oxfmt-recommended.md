# oxfmt recommended

The shipped formatter preset checks Fluent and classic example files without rewriting them. Valid trees already match the preset.

## Sub-features

- `oxfmt-one-project` runs `--check` on one example `valid` tree.
- `oxfmt-all-valid` runs `--check` on every example `valid` tree listed in `scripts/verify-projects.json`.
- `oxfmt-readonly` leaves `examples/` unchanged.

## How to get to it (user POV)

JSON path:

1. Copy `oxfmt.recommended.json` from the package to `.oxfmtrc.json`.
2. Run `npx oxfmt -c .oxfmtrc.json --check valid`.

TypeScript path:

1. Create `oxfmt.config.ts` that exports `recommendedOxfmtConfig` from `oxc-plugin-servicenow/oxfmt`.
2. Run `npx oxfmt -c oxfmt.config.ts --check valid`.

Do not mix those two setups in one command. This checkout proves the JSON path with `oxfmt.recommended.json`.

## Driving it with verify-examples

Preconditions:

- `npm run verify:examples -- prepare --run-id <id>` exited 0.
- `examples/` is unmodified.

- **One project.** Check Fluent valid files. Run `npm run verify:examples -- --project fluent --tree oxfmt --run-id <id>`. Exit 0. `summary.json` has `"ok": true`.
- **All valid trees.** Check every mapped valid tree. Run `npm run verify:examples -- --project all --tree oxfmt --run-id <id>`. Exit 0. `summary.json` has `"ok": true`.
- **No writes.** Run `git status -- examples`. The tree stays clean.
- **Proof.** Open `run-summary.json` in the run directory. Use the attempt whose `tree` is `oxfmt`. Read that relative `dir` for `stdout.txt` and `summary.json`.

## Gotchas

- Example `oxfmt.config.ts` files import `oxc-plugin-servicenow/oxfmt` and fail in this checkout. Use `oxfmt.recommended.json`.
- `--write` mutates fixtures. Never pass it during verification.
- A passing `--check` is not proof that `--write` was unused. Confirm with `git status`.
- Classic Studio style uses double quotes and width 120. Fluent `.now.ts` uses single quotes and width 100. Do not compare those trees to each other.
