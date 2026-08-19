# Plan 004: Fix five confirmed rule-level correctness bugs (false positives and silent gaps)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c987eee..HEAD -- src/rules/no-packages-calls.ts src/rules/no-br-current-update.ts src/rules/fluent-proper-imports.ts src/utils/ast.ts src/utils/sysid.ts src/rules/prefer-now-include.ts src/rules/validate-gliderecord-calls.ts src/rules/prefer-glideaggregate.ts src/rules/no-hardcoded-table-names.ts src/constants.ts tests/rules docs/rules/no-br-current-update.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. Plans 002/003 touch adjacent files;
> re-read any shared file before editing.

> **Status: DONE.** Landed on `advisor/improve-batch-001-005` at `f982ed2`. Do not execute. "Current state" below is a snapshot of `c987eee` before landing.

## Status

- **Priority**: P2
- **Effort**: M (five independent S-sized fixes)
- **Risk**: LOW–MED
- **Depends on**: none (001 recommended first; if 002/003 landed, rebase on them)
- **Category**: bug
- **Planned at**: commit `c987eee`, 2026-08-19

## Why this matters

Five confirmed bugs, each reproduced by executing the rules. Three are false positives on `error`-severity recommended rules — the failure mode that gets a linter uninstalled: `no-packages-calls` flags *any* identifier named `Packages` (object keys, member properties, local variables); `no-br-current-update` fires on every file kind except client/ui-action, including plain `.js` utilities where `current.update()` is legitimate (Fix Scripts, Transform Maps, Script Includes); and `fluent-proper-imports` reports a correctly-imported API as missing when the call appears above the (hoisted) import. Two are silent coverage gaps: quoted object keys (`{ "$id": ... }`) are invisible to `require-fluent-id`/`prefer-now-include`/`fluent-naming-convention`, and `GlideRecordSecure` — the ACL-respecting constructor ServiceNow recommends for scoped apps — is not tracked by three of the four GlideRecord rules. Plus one small contract fix: the sys_id matcher accepts uppercase hex against its own documented contract, flagging uppercase MD5s as sys_ids.

## Current state

- `src/rules/no-packages-calls.ts:19-26` — the whole implementation:

  ```ts
  createOnce(context) {
    return {
      Identifier(node) {
        if (getName(node) !== "Packages") return;
        context.report({ node, messageId: "packages" });
      },
    };
  }
  ```

  Reproduced: `var o = { Packages: 1 }; var x = lib.Packages; var Packages = 2;` → three errors. Real usage is always a member chain rooted at the global: `Packages.java.lang.String`.

- `src/rules/no-br-current-update.ts:21-30` — blocklist instead of allowlist:

  ```ts
  CallExpression(node) {
    if (!isCallTo(node, "current", "update")) return;
    const kind = classifyFromContext(context);
    if (kind === "client" || kind === "ui-action") return;
    context.report({ node: node as ESTree.Node, messageId: "update" });
  },
  ```

  (If plan 002 landed, `kind` is now computed in `before()` — the allowlist change below applies to wherever the check lives.)

- `src/rules/fluent-proper-imports.ts:73-82` — the `CallExpression` visitor reports immediately based on sets that only the `ImportDeclaration` visitor fills, so a call above its import is a false `missingCore`:

  ```ts
  CallExpression(node) {
    const name = getName((node as ESTree.CallExpression).callee);
    if (!name || !FLUENT_IMPORT_SET.has(name)) return;
    if (importedFromCore.has(name) || importedElsewhere.has(name)) return;
    context.report({ ... messageId: "missingCore" ... });
  },
  ```

- `src/utils/ast.ts:110-123` — `objectProperty` resolves non-computed keys with `getName` only, so a string-literal key returns null:

  ```ts
  const name = property.computed ? getStringValue(property.key) : getName(property.key);
  ```

  Same expression repeated in `src/rules/prefer-now-include.ts` (inside its `Property` visitor: `const key = prop.computed ? getStringValue(prop.key) : getName(prop.key);`). The correct pattern already exists at `src/rules/no-hardcoded-sysid.ts:86`: `getName(prop.key) ?? getStringValue(prop.key)`.

- GlideRecordSecure gaps — constructor checks that only accept `GlideRecord`:
  - `src/rules/validate-gliderecord-calls.ts:47` and `:54` — `isNewNamed(decl.init, "GlideRecord")` / `isNewNamed(assign.right, "GlideRecord")`
  - `src/rules/prefer-glideaggregate.ts:53` and `:60` — same two patterns
  - `src/rules/no-hardcoded-table-names.ts:51` — `if (!isNewNamed(node, "GlideRecord") && !isNewNamed(node, "GlideAggregate")) return;`
  - Contrast `src/rules/no-client-gliderecord.ts`, which already checks both `GlideRecord` and `GlideRecordSecure`.

- `src/utils/sysid.ts:1-7` — doc says lowercase, regex accepts both cases:

  ```ts
  const SYS_ID = /\b[0-9a-fA-F]{32}\b/g;
  const ALL_HEX = /^[0-9a-fA-F]{32}$/;

  /** ServiceNow sys_ids are 32-character lowercase hex strings. */
  export function isSysId(value: string): boolean {
    return ALL_HEX.test(value);
  }
  ```

  `src/rules/no-hardcoded-sysid.ts:16-18` and `:33` lowercase both sides of the allowlist comparison — those `toLowerCase()` calls become removable once the regex is lowercase-only, but leaving them is harmless; do not remove them in this plan.

- Test conventions: node:test `describe`/`it`, helpers `assertValid`/`assertInvalid` from `tests/helpers/rule-tester.ts`. Engine/GlideRecord rule tests live in `tests/rules/glide-and-engine.test.ts`; Fluent rule tests in `tests/rules/fluent.test.ts`.
- `src/utils/ast.ts` exports `staticMemberChain(node)` (returns the dotted chain as string array rooted at an identifier, or null) and `isNewNamed(node, name)`.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npm run typecheck`      | exit 0              |
| Tests     | `npm test`               | all pass            |
| Docs gate | `npm run docs:check`     | exit 0 (no doc-affecting change expected; if a catalog example must change, regen with `npm run docs`) |

## Scope

**In scope** (the only files you should modify):
- `src/rules/no-packages-calls.ts`
- `src/rules/no-br-current-update.ts`
- `src/rules/fluent-proper-imports.ts`
- `src/utils/ast.ts` (add `propertyKeyName`, use it in `objectProperty`)
- `src/rules/prefer-now-include.ts` (key resolution only)
- `src/utils/sysid.ts`
- `src/rules/validate-gliderecord-calls.ts`, `src/rules/prefer-glideaggregate.ts`, `src/rules/no-hardcoded-table-names.ts` (constructor set only)
- `src/constants.ts` (add `GLIDE_RECORD_CTORS`)
- `tests/rules/*.test.ts`, `tests/catalog.test.ts` only if a changed behavior requires it
- `docs/rules/no-br-current-update.md` regeneration IF the catalog description changes (via `npm run docs` only)

**Out of scope** (do NOT touch):
- `src/rules/no-client-gliderecord.ts` — already correct on both fronts it appears in.
- `no-promise`'s `.then/.catch/.finally` heuristic — known FP source but a design decision (backlog).
- Function-scope tracking for `validate-gliderecord-calls`/`prefer-glideaggregate` state (the per-name file-global Map) — separate backlog item; here you only widen the constructor set.
- `src/rules/no-hardcoded-sysid.ts` — its `toLowerCase()` normalization stays.

## Git workflow

- Use the `git`/`gh` wrappers on `PATH` (machine identity + signing enforced).
- Branch: `advisor/004-rule-correctness-batch`.
- One commit per fix (five commits). Do NOT push or open a PR unless instructed.

## Steps

### Step 1: `no-packages-calls` — flag only real `Packages.*` usage

Replace the `Identifier` visitor with a `MemberExpression` visitor that reports once per outermost chain rooted at `Packages`:

```ts
createOnce(context) {
  return {
    MemberExpression(node) {
      const member = node as ESTree.MemberExpression;
      const chain = staticMemberChain(member);
      if (!chain || chain[0] !== "Packages") return;
      // Only report the outermost member expression of the chain so
      // Packages.java.lang.String yields one diagnostic, not three.
      const ancestors = context.sourceCode.getAncestors(node);
      const parent = ancestors[ancestors.length - 1];
      if (parent && parent.type === "MemberExpression"
          && (parent as ESTree.MemberExpression).object === node) return;
      context.report({ node, messageId: "packages" });
    },
  };
}
```

Import `staticMemberChain` from `../utils/ast.js`. Note on `getAncestors`: the real oxlint API takes the node argument; the test harness (`src/runtime/apply-rules.ts:99`) declares it with zero parameters but tolerates being called with one — verify by running the tests; if the harness throws, fix the harness signature to accept and ignore an optional node argument (that file is then in scope for that one-line change).

Note the trade-off: a bare `Packages` reference with no member access (e.g. `typeof Packages`) is no longer flagged. That is acceptable — record it in the rule's catalog description only if a reviewer asks.

Tests (`tests/rules/glide-and-engine.test.ts`, in the existing engine-extras block):
- `assertInvalid('var s = new Packages.java.lang.String("x");', "no-packages-calls", { count: 1 })`
- `assertValid('var o = { Packages: 1 };', "no-packages-calls")`
- `assertValid('var x = lib.Packages;', "no-packages-calls")`
- `assertValid('var Packages = 2; var y = Packages;', "no-packages-calls")` — if this still reports because `y = Packages` is a bare reference chain of length 1, adjust the guard to require `chain.length >= 2` (a lone identifier never enters the `MemberExpression` visitor, so this case should pass; verify).

**Verify**: `npm test` → pass, including the existing invalid case for `Packages.java...` and `npm run docs:check` clean.

### Step 2: `no-br-current-update` — invert to an allowlist

Change the kind check to report **only** when `kind === "business-rule"` or `kind === "server"`:

```ts
if (kind !== "business-rule" && kind !== "server") return;
```

Rationale to preserve in the commit message: `current.update()` is legitimate and required in Fix Scripts, Transform Maps, and Script Includes, which classify as `"unknown"`/`"script-include"`; the documented escape hatch for unconventionally named Business Rules is `settings.servicenow.scriptType: "business-rule"`. `"server"` stays in the allowlist because `src/server/**` trees conventionally hold Business Rule scripts.

Tests:
- `assertInvalid("current.update();", "no-br-current-update", { messageId: "update" }, { filename: "incident.br.js" })` (existing behavior, keep)
- `assertValid("current.update();", "no-br-current-update", { filename: "utils.js" })` (new — unknown kind)
- `assertValid("current.update();", "no-br-current-update", { filename: "helper.si.js" })` (new — script-include)
- `assertInvalid("current.update();", "no-br-current-update", { messageId: "update" }, { filename: "misc.js", settings: { scriptType: "business-rule" } })` (new — settings override; note `settings` rides through `RunOptions`)

Check `tests/catalog.test.ts` and the catalog entry's bad example filename (`incident.br.js` per `src/catalog.ts` — classifies as business-rule, still fires). If any existing test used a non-BR filename for the invalid case, update it to `incident.br.js`.

**Verify**: `npm test` → pass; `npm run docs:check` clean (description text unchanged).

### Step 3: `fluent-proper-imports` — defer `missingCore` to `after()`

In the `CallExpression` visitor, collect instead of reporting:

```ts
let pendingCalls: Array<{ node: ESTree.Node; name: string }>;
// in before(): pendingCalls = [];
CallExpression(node) {
  const name = getName((node as ESTree.CallExpression).callee);
  if (!name || !FLUENT_IMPORT_SET.has(name)) return;
  pendingCalls.push({ node: (node as ESTree.CallExpression).callee as unknown as ESTree.Node, name });
},
after() {
  for (const { node, name } of pendingCalls) {
    if (importedFromCore.has(name) || importedElsewhere.has(name)) continue;
    context.report({ node, messageId: "missingCore", data: { name } });
  }
},
```

The `wrongModule` report in `ImportDeclaration` stays as-is (imports can be judged immediately).

Tests (`tests/rules/fluent.test.ts`):
- `assertValid('Table({ name: "x_a" });\nimport { Table } from "@servicenow/sdk/core";', "fluent-proper-imports")` (call above import — the regression)
- Existing missing-import invalid case must still fail: confirm one exists (`grep -n missingCore tests/rules/fluent.test.ts`); if not, add `assertInvalid('Table({ name: "x_a" });', "fluent-proper-imports", { messageId: "missingCore" })`.

**Verify**: `npm test` → pass.

### Step 4: quoted object keys — add `propertyKeyName` and use it

In `src/utils/ast.ts`, add and export:

```ts
export function propertyKeyName(property: ESTree.ObjectProperty): string | null {
  return property.computed
    ? getStringValue(property.key)
    : (getName(property.key) ?? getStringValue(property.key));
}
```

Use it in `objectProperty` (replacing the inline ternary) and in `src/rules/prefer-now-include.ts`'s `Property` visitor key resolution. Check other repeats: `grep -rn "computed ? getStringValue" src/` — update any remaining site in in-scope files; if a hit is in an out-of-scope file, leave it and note it in your report.

Tests:
- `tests/rules/fluent.test.ts`: `assertValid('import { BusinessRule } from "@servicenow/sdk/core";\nBusinessRule({ "$id": Now.ID["x"], table: "incident", name: "n" });', "require-fluent-id")` — quoted `$id` no longer reported as missing.
- A `prefer-now-include` case with a quoted `"script"` key and an 10+ line template literal → `assertInvalid(..., { messageId: "large" })` (mirror an existing unquoted invalid case; check the actual messageId with `grep -n messages src/rules/prefer-now-include.ts`).

**Verify**: `npm test` → pass.

### Step 5: `GlideRecordSecure` + lowercase sys_id contract

1. In `src/constants.ts` add:

   ```ts
   /** Constructors that produce a GlideRecord-like cursor. */
   export const GLIDE_RECORD_CTORS = ["GlideRecord", "GlideRecordSecure"] as const;
   ```

2. In `validate-gliderecord-calls.ts` and `prefer-glideaggregate.ts`, replace each `isNewNamed(x, "GlideRecord")` with a check over the list:

   ```ts
   const isGr = GLIDE_RECORD_CTORS.some((ctor) => isNewNamed(decl.init, ctor));
   ```

3. In `no-hardcoded-table-names.ts:51`, extend the guard to `GlideRecord`, `GlideRecordSecure`, `GlideAggregate`.
4. In `src/utils/sysid.ts`, tighten both regexes to lowercase-only and fix nothing else:

   ```ts
   const SYS_ID = /\b[0-9a-f]{32}\b/g;
   const ALL_HEX = /^[0-9a-f]{32}$/;
   ```

   The doc comment is now accurate. Uppercase 32-hex (MD5 fingerprints, stripped GUIDs) will no longer be flagged.

Tests:
- `assertInvalid('var gr = new GlideRecordSecure("incident"); gr.next();', "validate-gliderecord-calls", { messageId: "missingQuery" })`
- `assertInvalid('var gr = new GlideRecordSecure("incident");', "no-hardcoded-table-names", { messageId: /* check meta: grep -n messages src/rules/no-hardcoded-table-names.ts */ })`
- `assertValid('var f = "D41D8CD98F00B204E9800998ECF8427E";', "no-hardcoded-sysid")` (uppercase no longer flagged)
- Existing lowercase invalid cases in `tests/rules/no-hardcoded-sysid.test.ts` must still pass unchanged.

**Verify**: `npm test` → pass; `npm run docs:check` clean.

## Test plan

Inlined per step above — each fix lands with its regression tests, following `tests/rules/glide-and-engine.test.ts` / `tests/rules/fluent.test.ts` patterns. Final: `npm test` all green; if plan 001 landed, integration fixtures stay green.

## Done criteria

Machine-checkable. ALL must hold:

- [x] `npm run typecheck` exits 0
- [x] `npm test` exits 0 with all new assertions from steps 1–5 present
- [x] `grep -n "Identifier(node)" src/rules/no-packages-calls.ts` → no matches
- [x] `grep -n 'kind !== "business-rule"' src/rules/no-br-current-update.ts` → 1 match
- [x] `grep -rn '"GlideRecordSecure"' src/` → present in `constants.ts` (and via `GLIDE_RECORD_CTORS` in the three rules)
- [x] `grep -n "a-fA-F" src/utils/sysid.ts` → no matches
- [x] `npm run docs:check` exits 0
- [x] No files outside the in-scope list modified (`git status`)
- [x] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `context.sourceCode.getAncestors(node)` is unavailable or empty under the test harness for step 1 and the one-line harness signature fix does not resolve it.
- Step 2's allowlist makes the catalog bad example for `no-br-current-update` stop firing (its filename in `src/catalog.ts` is not BR-classified) — the catalog entry needs a filename change plus `npm run docs`; if the required change is anything more than the `filename` field, STOP.
- Any `after()` hook does not run under the test harness for step 3 (check `src/runtime/apply-rules.ts:165` calls `hooks.after?.()`) — report rather than restructure.
- Tightening the sys_id regex breaks a test that intentionally used mixed-case sys_ids — decide nothing; report the test and its intent.

## Maintenance notes

- Step 2 is a deliberate coverage narrowing: unclassified files no longer get `no-br-current-update`. CHANGELOG entry required, naming `settings.servicenow.scriptType` as the override. Reviewers should confirm they accept `server` in the allowlist.
- The per-name, file-global binding Maps in `validate-gliderecord-calls`/`prefer-glideaggregate` still leak state across functions (a `gr` in function A satisfies `.query()` for a different `gr` in function B) — known, deferred to backlog ("function-scoped GlideRecord state").
- If plans 002/003 landed first, `no-br-current-update` already computes `kind` in `before()` and `no-gs-now` lost its autofix — merge accordingly; the logic changes here are orthogonal.
