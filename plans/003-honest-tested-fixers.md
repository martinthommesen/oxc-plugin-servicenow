# Plan 003: Make the autofix/suggestion surface honest, safe, and tested

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c987eee..HEAD -- src/runtime/apply-rules.ts src/rules/no-gs-now.ts src/rules/no-at-method.ts src/rules/fluent-directives.ts src/rules/require-fluent-id.ts src/rules/fluent-proper-imports.ts src/catalog.ts tests/helpers/rule-tester.ts tests/rules/glide-and-engine.test.ts tests/plugin.test.ts README.md docs/rules`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

> **Status: DONE.** Landed on `advisor/improve-batch-001-005` at `f982ed2`. Do not execute. "Current state" below is a snapshot of `c987eee` before landing.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (001 recommended first for host-level validation)
- **Category**: bug
- **Planned at**: commit `c987eee`, 2026-08-19

## Why this matters

The plugin ships fix/suggestion code that no test has ever executed — the test harness's `report()` shim silently discards `fix` and `suggest` and never constructs a fixer. Hiding behind that gap are three shipped defects:

1. **`no-gs-now`'s autofix is semantically lossy.** It unconditionally rewrites `gs.now()` / `gs.nowDateTime()` (which return display **strings** in the session timezone) to `new GlideDateTime()` (an **object** holding a GMT datetime). `oxlint --fix` therefore silently changes what gets written to fields, concatenated into work notes, or compared with `==`, across every call site. The rule's own second suggestion (`.getDisplayValue()`) is the string-preserving variant — evidence the unconditional fix is known to be lossy.
2. **`no-at-method`'s suggestion is wrong for negative indices.** It splices the raw argument text into brackets, so `list.at(-1)` — the dominant real-world use of `.at()` — becomes `list[-1]`, which evaluates to `undefined`. The rule's own docs show the correct rewrite (`list[list.length - 1]`).
3. **Three rules advertise suggestions that don't exist.** `fluent-directives`, `require-fluent-id`, and `fluent-proper-imports` all declare `meta.hasSuggestions: true` but never pass a `suggest` array to any `context.report` call. Editors show an empty lightbulb; the generated docs say "Suggestions: yes".

This plan fixes all three, adds fixer execution to the test harness so fix output is asserted from now on, and adds a meta-honesty test that permanently prevents `fixable`/`hasSuggestions` from drifting from reality.

## Current state

- `src/runtime/apply-rules.ts:121-151` — the harness `report()` destructures only `message`, `messageId`, `node`, `loc`, `data`. No `fix`, no `suggest`, no fixer object. `LintMessage` (lines 8-17) has no fix-related fields.
- `src/rules/no-gs-now.ts` — `meta.fixable: "code"` (line 16), `hasSuggestions: true` (line 17). The report (lines 35-55) passes a top-level `fix` replacing the call with `new GlideDateTime()`, plus two suggestions (`new GlideDateTime()` and `new GlideDateTime().getDisplayValue()`).
- `src/rules/no-at-method.ts:32-47` — the suggestion:

  ```ts
  suggest:
    arg && arg.type !== "SpreadElement"
      ? [
          {
            desc: "Replace with an index access",
            fix(fixer) {
              const obj = context.sourceCode.getText(/* callee.object */);
              const index = context.sourceCode.getText(arg as unknown as ESTree.Node);
              return fixer.replaceText(node, `${obj}[${index}]`);
            },
          },
        ]
      : undefined,
  ```

  `index` is raw source text — `-1` produces `obj[-1]`.
- False `hasSuggestions` flags: `src/rules/fluent-directives.ts:45`, `src/rules/require-fluent-id.ts:30`, `src/rules/fluent-proper-imports.ts:33` (this one also has a real `fixable: "code"` at line 32 with a genuine `fix` at line 68 — keep `fixable`, drop `hasSuggestions`).
- `src/catalog.ts` mirrors the flags (each entry has `fixable`/`hasSuggestions` booleans): `no-gs-now` at lines 176-177 (`fixable: true`, `hasSuggestions: true`); `fluent-proper-imports` at 269-270 (`true`/`true`); `fluent-directives` at 292-293 (`false`/`true`); `require-fluent-id` at ~340-341 (`false`/`true`); `no-at-method` at ~412-413 (`false`/`true`). `docs/rules/*.md` are **generated** from the catalog by `npm run docs` — never hand-edit them; regenerate after catalog changes.
- `tests/helpers/rule-tester.ts` — `lint()`, `assertValid()`, `assertInvalid()`; no fix helpers. `tests/rules/glide-and-engine.test.ts:5` has a test literally named "flags gs.now() and is fixable" that asserts only a messageId.
- `README.md:196` lists `no-gs-now` with "fix" in its Fix column, and `README.md:210` lists `no-at-method` with "suggest" — the `no-gs-now` row must change to "suggest".
- Rule-shape convention: `defineRule` + `createOnce`, `before()` gating, messages in `meta.messages` — see `src/rules/no-at-method.ts` as the compact exemplar.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npm run typecheck`      | exit 0              |
| Tests     | `npm test`               | all pass            |
| Regen docs| `npm run docs`           | exit 0, rewrites `docs/rules/` |
| Docs gate | `npm run docs:check`     | exit 0 after regen  |

## Scope

**In scope** (the only files you should modify):
- `src/runtime/apply-rules.ts` (fixer shim + `LintMessage` fields)
- `tests/helpers/rule-tester.ts` (fix assertion helpers)
- `src/rules/no-gs-now.ts`, `src/rules/no-at-method.ts`
- `src/rules/fluent-directives.ts`, `src/rules/require-fluent-id.ts`, `src/rules/fluent-proper-imports.ts` (drop one meta line each)
- `src/catalog.ts` (the five entries' `fixable`/`hasSuggestions` booleans)
- `docs/rules/*.md` (regenerated only — via `npm run docs`)
- `README.md` (the `no-gs-now` Fix-column cell only)
- `tests/rules/glide-and-engine.test.ts`, `tests/plugin.test.ts` (new assertions)

**Out of scope** (do NOT touch):
- Implementing NEW suggestions for `fluent-directives`/`require-fluent-id` (deferred — see Maintenance notes).
- `src/rules/prefer-glideaggregate.ts`'s suggestion — it exists and is plausibly correct; just gets covered by the new meta-honesty test.
- Any other rule file.

## Git workflow

- Use the `git`/`gh` wrappers on `PATH` (machine identity + signing enforced).
- Branch: `advisor/003-honest-tested-fixers`.
- Commit per step; short imperative messages. Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Teach the harness to execute fixes and suggestions

In `src/runtime/apply-rules.ts`:

1. Extend `LintMessage` with optional fields:

   ```ts
   /** Source after applying the diagnostic's own fix, if it provided one. */
   fixedSource?: string;
   suggestions?: Array<{ desc: string; fixedSource: string }>;
   ```

2. Inside `report()`, build a minimal fixer whose methods return `{ range: [number, number]; text: string }`:

   ```ts
   const fixer = {
     replaceText: (n: { start?: number; end?: number }, text: string) =>
       ({ range: [n.start ?? 0, n.end ?? 0] as [number, number], text }),
     replaceTextRange: (range: [number, number], text: string) => ({ range, text }),
     insertTextBefore: (n: { start?: number }, text: string) =>
       ({ range: [n.start ?? 0, n.start ?? 0] as [number, number], text }),
     insertTextAfter: (n: { end?: number }, text: string) =>
       ({ range: [n.end ?? 0, n.end ?? 0] as [number, number], text }),
     remove: (n: { start?: number; end?: number }) =>
       ({ range: [n.start ?? 0, n.end ?? 0] as [number, number], text: "" }),
   };
   ```

3. Accept `fix` and `suggest` in the diagnostic parameter type. If `fix` is present, call it with the fixer; normalize the result to an array (a fix may return one edit or an array), sort edits by range start descending, apply them to `source` by slicing, and set `fixedSource`. Same application logic for each `suggest[i].fix`, producing `suggestions[]` with the entry's `desc`.
4. Wrap fix/suggest execution in try/catch: a throwing fixer becomes a test failure with the rule id in the message (rethrow with context), not a silent skip.

**Verify**: `npm run typecheck` → exit 0; `npm test` → all 136 still pass (no existing test asserts the new fields).

### Step 2: Add fix assertion helpers

In `tests/helpers/rule-tester.ts` add:

```ts
export function assertFix(code: string, rule: RuleName, expectedOutput: string, options: RunOptions = {}): void
export function assertSuggestion(code: string, rule: RuleName, desc: RegExp | string, expectedOutput: string, options: RunOptions = {}): void
```

`assertFix` lints, requires ≥1 message with `fixedSource`, and asserts strict equality with `expectedOutput`. `assertSuggestion` finds the message whose `suggestions[]` contains an entry matching `desc` and asserts its `fixedSource`. Follow the existing assert/error-message style in this file.

**Verify**: `npm run typecheck` → exit 0.

### Step 3: Demote `no-gs-now`'s autofix to suggestions

In `src/rules/no-gs-now.ts`:

- Delete `fixable: "code"` from `meta` and the top-level `fix(fixer)` property from the report call. Keep both `suggest` entries.
- Reorder suggestions so the string-preserving variant is first: `new GlideDateTime().getDisplayValue()` first, `new GlideDateTime()` second (accepting a suggestion is deliberate; the safer default should lead).

In `src/catalog.ts` line ~176, change the `no-gs-now` entry to `fixable: false` (keep `hasSuggestions: true`).

In `README.md`, the `no-gs-now` row's Fix cell: `fix` → `suggest`.

**Verify**: `npm run docs && npm run docs:check` → exit 0 (docs regenerate cleanly); `npm test` → pass.

### Step 4: Fix `no-at-method`'s suggestion for negative indices

Replace the suggestion logic. Target behavior:

- Argument is a numeric `Literal` with value ≥ 0 → suggest `obj[n]`.
- Argument is a `UnaryExpression` with `operator: "-"` and a numeric `Literal` argument (value k > 0), **and** the callee object is a plain `Identifier` (side-effect-free to evaluate twice) → suggest `obj[obj.length - k]`.
- Anything else (variables, expressions, non-identifier receivers, spread) → report with **no** suggestion.

Note the AST shape: `-1` is `UnaryExpression{operator:"-", argument: Literal{value:1}}`, not a negative literal. Keep the message unchanged.

**Verify**: `npm test` → pass (new assertions in step 6 cover this).

### Step 5: Drop the three false `hasSuggestions` flags

- Delete the `hasSuggestions: true` line from `src/rules/fluent-directives.ts` (line 45), `src/rules/require-fluent-id.ts` (line 30), `src/rules/fluent-proper-imports.ts` (line 33 — keep its `fixable: "code"`).
- In `src/catalog.ts`, set `hasSuggestions: false` on the corresponding three entries (lines ~293, ~341, ~270).
- Regenerate docs: `npm run docs`.

**Verify**: `npm run docs:check` → exit 0; `grep -rn "hasSuggestions: true" src/rules/` → exactly three files remain: `no-gs-now.ts`, `no-at-method.ts`, `prefer-glideaggregate.ts`.

### Step 6: Add fix-output tests

In `tests/rules/glide-and-engine.test.ts` (existing style), add:

- `no-gs-now`: `assertSuggestion("current.u_opened = gs.now();", "no-gs-now", /getDisplayValue/, "current.u_opened = new GlideDateTime().getDisplayValue();")` and the plain-GlideDateTime variant. Also assert no message carries `fixedSource` (the autofix is gone).
- `no-at-method`: `assertSuggestion("var last = list.at(2);", "no-at-method", /index access/i, "var last = list[2];")`; `assertSuggestion("var last = list.at(-1);", "no-at-method", /index access/i, "var last = list[list.length - 1];")`; and assert `getComputed().at(-1)` reports **without** any suggestion.
- `fluent-proper-imports` (this file or `tests/rules/fluent.test.ts`, wherever it lives — check both): `assertFix` on the wrong-module bad example rewrites the import source to `"@servicenow/sdk/core"`.

**Verify**: `npm test` → all pass including the new assertions.

### Step 7: Add the permanent meta-honesty test

In `tests/plugin.test.ts`, add a test that iterates `ruleCatalog` and, for each entry:

- Asserts the rule's `meta.fixable`/`meta.hasSuggestions` equal the catalog booleans.
- For each entry with `fixable: true` or `hasSuggestions: true`: lint every `bad` example (via the shared helper `lint` from `tests/helpers/rule-tester.ts`, with the example's `filename`) and assert at least one resulting message has `fixedSource` (for fixable) or a non-empty `suggestions` array (for hasSuggestions).

This is what makes the false-advertising class structurally impossible going forward.

**Verify**: `npm test` → passes. If it fails for `prefer-glideaggregate`, inspect whether its catalog bad examples actually trigger the suggestion path; if they don't, extend that catalog entry's bad example minimally so one does (and regenerate docs) — if that turns out to require rule changes, STOP instead.

## Test plan

Steps 6–7 are the test plan. Pattern: existing `tests/rules/glide-and-engine.test.ts` blocks. Final: `npm test` green with new fix assertions; `npm run docs:check` green after regeneration.

## Done criteria

Machine-checkable. ALL must hold:

- [x] `npm run typecheck` exits 0
- [x] `npm test` exits 0, including `assertFix`/`assertSuggestion` assertions and the meta-honesty test
- [x] `grep -n "fixable" src/rules/no-gs-now.ts` → no matches
- [x] `grep -rln "hasSuggestions: true" src/rules/` → exactly `no-at-method.ts`, `no-gs-now.ts`, `prefer-glideaggregate.ts`
- [x] `npm run docs:check` exits 0 (regenerated docs committed)
- [x] README `no-gs-now` row says `suggest`, not `fix`
- [x] No files outside the in-scope list modified (`git status`)
- [x] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The real `@oxlint/plugins` fixer contract (check `node_modules/@oxlint/plugins/index.d.ts`) is incompatible with the shim signature in step 1 in a way that breaks `npm run typecheck` — report the actual `RuleFixer` type surface.
- Applying sorted fix edits produces overlapping ranges in any existing rule's output (an exception from step 1's applier) — that is a latent rule bug; report which rule.
- Step 7's meta-honesty test fails for any rule other than the five this plan touches.
- The catalog's line numbers have shifted so much that you cannot confidently identify the five entries by their `name:` field — re-locate by `grep -n 'entry("no-gs-now"' src/catalog.ts` etc.; if an entry is missing entirely, STOP.

## Maintenance notes

- Real suggestions for `fluent-directives` (replace typo'd directive with the known correction — the rule already computes `FLUENT_DIRECTIVE_TYPOS[name]`) and `require-fluent-id` (insert `$id: Now.ID['<hint>']` — `hintFrom` already computes the hint) are cheap follow-ups now that the harness can assert them; deliberately deferred to keep this plan's diff reviewable.
- ESLint's `RuleTester` (once plan 001's devDeps exist) can later replace the hand-rolled fix applier for per-rule tests; the meta-honesty test should stay harness-based since it sweeps the whole catalog cheaply.
- Reviewers should scrutinize: suggestion ordering in step 3 (safer-first is a UX decision), and the `obj.length - k` guard requiring an `Identifier` receiver (prevents double-evaluating side effects).
- Removing the `no-gs-now` autofix is a behavior change for anyone running `oxlint --fix`; CHANGELOG entry required.
