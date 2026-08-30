# oxfmt recommended

The shipped formatter preset checks Fluent and classic example files without rewriting them. Valid trees already match the preset.

## Sub-features

- `oxfmt-one-project` runs `--check` on one example `valid` tree.
- `oxfmt-all-valid` runs `--check` on every example `valid` tree listed in `projects.json`.
- `oxfmt-readonly` leaves `examples/` unchanged.

## How to get to it (user POV)

- Copy `oxfmt.recommended.json` from the package to `.oxfmtrc.json`.
- Import `recommendedOxfmtConfig` from `oxc-plugin-servicenow/oxfmt` in `oxfmt.config.ts`.
- Run `npx oxfmt -c oxfmt.config.ts --check valid` inside an example project after the package is installed.

## Driving it with verify.mjs

Preconditions:

- Doctor exits 0 in this session.
- `VERIFY_RUN_ID` is set.
- `examples/` is unmodified.

- **One project.** Check Fluent valid files. Run `node .cursor/skills/verify-oxc-plugin-servicenow/scripts/verify.mjs drive fluent oxfmt`. Exit 0. stdout contains `All matched files use the correct format`.
- **All valid trees.** Check every mapped valid tree. Run `node .cursor/skills/verify-oxc-plugin-servicenow/scripts/verify.mjs drive all oxfmt`. Exit 0. stdout reports the same phrase.
- **No writes.** Run `git status -- examples`. The tree stays clean.
- **Proof.** Read `artifacts/verify-oxc-plugin-servicenow/$VERIFY_RUN_ID/all-oxfmt/stdout.txt` and `summary.json`. Keep both.

## Gotchas

- Example `oxfmt.config.ts` files import `oxc-plugin-servicenow/oxfmt` and fail in this checkout. Use `oxfmt.recommended.json`.
- `--write` mutates fixtures. Never pass it during verification.
- A passing `--check` is not proof that `--write` was unused. Confirm with `git status`.
- Classic Studio style uses double quotes and width 120. Fluent `.now.ts` uses single quotes and width 100. Do not compare those trees to each other.
