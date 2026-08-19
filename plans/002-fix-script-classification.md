# Plan 002: Fix script-type classification, pragma detection, and their per-file cost

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c987eee..HEAD -- src/utils/filenames.ts src/constants.ts src/types.ts src/rules/no-gs-now.ts src/rules/no-br-current-update.ts tests/filenames.test.ts tests/rules/no-client-gliderecord.test.ts tests/rules/no-promise.test.ts README.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

> **Status: DONE.** Landed on `advisor/improve-batch-001-005` at `f982ed2`. Do not execute. "Current state" below is a snapshot of `c987eee` before landing.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/001-real-host-integration-tests.md (recommended — its suite catches host-level regressions; can proceed without it)
- **Category**: bug
- **Planned at**: commit `c987eee`, 2026-08-19

## Why this matters

`classifyFile` in `src/utils/filenames.ts` decides which rules fire on which files — it is the highest-fan-in decision in the plugin (12 of 24 rules gate on it). It currently has four confirmed defects that hit the plugin's core use case:

1. A **display Business Rule** (server code populating `g_scratchpad`) is classified as a *client* script because `looksLikeClientSource` word-matches `g_scratchpad` anywhere in the raw text — even in a file explicitly named `*.br.js`, because the source sniff runs before the Business Rule filename check. Result: a false `no-client-gliderecord` **error** on legitimate server GlideRecord, plus silent loss of `no-br-current-update` coverage. This is the canonical file shape the plugin exists to lint.
2. The `@sn-es-latest` pragma is matched against **raw source text**, so the pragma appearing inside a string or template literal silently disables the entire classic-engine rule family (9 rules) for the file — a governance bypass nothing signals.
3. ServiceNow's own export filenames (`sys_script_client_*`) are not recognized, so files pulled down by standard export tooling bypass client-script rules entirely.
4. Classification re-runs from scratch constantly: 12 rules recompute it per file, two rules (`no-gs-now`, `no-br-current-update`) recompute it **per matching AST node**, and `looksLikeClientSource` compiles 7 fresh `RegExp` objects and rescans the whole source on every call — roughly 30 redundant whole-file scans per linted file with the recommended preset, scaling with file size × violation count.

Additionally, `usesClassicEngine` ignores `settings.servicenow.scriptType`, so the documented `scriptType: "fluent"` escape hatch does not actually disable engine bans, and the settable union omits `script-include`/`ui-action` which the classifier can produce.

## Current state

- `src/utils/filenames.ts` (68 lines) — all the classification logic. Key excerpts:

  ```ts
  // lines 6-12
  const CLIENT_FILE = /(\.client\.|\.cs\.|client[-_.]?script|catalog[-_.]?client|ui[-_.]?script|ui_script|on[-_]?change|on[-_]?load|on[-_]?submit|ui[-_.]?policy)/i;
  const BR_FILE = /(business[-_.]?rule|\.br\.|sys_script[^_]|\/br\/)/i;
  const SI_FILE = /(script[-_.]?include|\.si\.|\/script-include)/i;
  const UI_ACTION_FILE = /(ui[-_.]?action|\.ua\.|sys_ui_action)/i;
  const SERVER_DIR = /(?:^|[\\/])(?:src[\\/])?server[\\/]/i;

  const ES_LATEST_PRAGMA = /(?:^|\n)\s*(?:\/\/|\/\*)\s*@sn-es-latest\b/;
  ```

  ```ts
  // lines 28-34
  export function hasEsLatestPragma(sourceText: string): boolean {
    return ES_LATEST_PRAGMA.test(sourceText);
  }

  export function looksLikeClientSource(sourceText: string): boolean {
    return CLIENT_GLOBALS.some((name) => new RegExp(`\\b${name}\\b`).test(sourceText));
  }
  ```

  ```ts
  // lines 36-52 — note client check (filename OR source sniff) precedes BR/SI checks
  export function classifyFile(
    filename: string,
    sourceText: string,
    settings: ServiceNowSettings,
  ): ScriptKind {
    if (settings.scriptType && settings.scriptType !== "auto") {
      return settings.scriptType;
    }

    if (isFluentFile(filename)) return "fluent";
    if (UI_ACTION_FILE.test(filename)) return "ui-action";
    if (CLIENT_FILE.test(filename) || looksLikeClientSource(sourceText)) return "client";
    if (BR_FILE.test(filename)) return "business-rule";
    if (SI_FILE.test(filename)) return "script-include";
    if (SERVER_DIR.test(filename)) return "server";
    return "unknown";
  }
  ```

  ```ts
  // lines 62-68 — no scriptType check, no caching
  export function usesClassicEngine(context: Context): boolean {
    const settings = getSettings(context);
    if (settings.ecmaLatest) return false;
    if (hasEsLatestPragma(context.sourceCode.text)) return false;
    if (isFluentFile(context.filename)) return false;
    return true;
  }
  ```

- `src/constants.ts:220-228`:

  ```ts
  export const CLIENT_GLOBALS = [
    "g_form",
    "g_user",
    "g_list",
    "g_scratchpad",
    "g_navigation",
    "g_tabs2Sections",
    "gel",
  ] as const;
  ```

  `g_scratchpad` is written by **server-side** display Business Rules (that is its purpose); `gel` is a 3-letter token that collides easily. Both are weak client signals. `g_form`, `g_user`, `g_list`, `g_navigation`, `g_tabs2Sections` are genuinely client-only.

- `src/types.ts` — `ServiceNowSettings.scriptType` is typed `"auto" | "client" | "server" | "business-rule" | "fluent"`; `ScriptKind` is the 7-member union that also has `"script-include"` and `"ui-action"`. (Find with `grep -n "scriptType\|ScriptKind" src/types.ts`.)
- `src/rules/no-gs-now.ts:29-34` — `classifyFromContext(context)` called inside the `CallExpression` visitor (once per `gs.now()` call). The rule has no `before()`.
- `src/rules/no-br-current-update.ts:23-27` — same pattern: `classifyFromContext` inside `CallExpression`. Contrast `src/rules/no-client-gliderecord.ts`, which classifies once in `before()` — that is the correct idiom to copy.
- `src/rules/fluent-directives.ts:15-34` — `commentsOf(context)` + `fallbackComments(text)`: the existing pattern for getting real comment tokens (`context.sourceCode.getAllComments()` with a regex fallback). Reuse this for the pragma fix.
- `tests/filenames.test.ts` — the existing classification tests (6 assertions, node:test style). Note line 19 pins `classifyFile("misc.js", "g_form.setValue('x', 1);", {}) === "client"` — that behavior must be preserved (real client heuristic).
- `README.md:168-174` — settings table documenting `scriptType` as `"auto" (default) or force client / server / business-rule / fluent`. Update when the union widens.
- Contract reminder from `CONTRIBUTING.md`: `createOnce` runs once per **process**; per-file state must be reset in `before()`. A cache in a rule closure would leak across files — the memo must live at module scope keyed by the current file.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npm run typecheck`      | exit 0              |
| Tests     | `npm test`               | all pass            |
| Docs gate | `npm run docs:check`     | exit 0 (this plan should not change docs) |

## Scope

**In scope** (the only files you should modify):
- `src/utils/filenames.ts`
- `src/constants.ts` (split `CLIENT_GLOBALS`)
- `src/types.ts` (widen `scriptType`)
- `src/rules/no-gs-now.ts`, `src/rules/no-br-current-update.ts` (hoist classification into `before()`)
- `tests/filenames.test.ts`, plus assertions in `tests/rules/no-client-gliderecord.test.ts` and `tests/rules/no-promise.test.ts` if new cases fit there
- `README.md` (settings table row for `scriptType` only)

**Out of scope** (do NOT touch, even though they look related):
- `src/rules/no-client-gliderecord.ts` — already uses the correct `before()` idiom.
- The 9 engine-ban rules (`no-promise`, `no-async-await`, …) — they call `usesClassicEngine` and benefit automatically; do not edit them.
- `no-br-current-update`'s *kind allowlist* (which kinds it reports on) — that behavior change is plan 004. Here you only hoist the existing check into `before()` unchanged.
- `scripts/generate-rule-docs.mjs`, `src/catalog.ts` — no doc-pipeline changes.

## Git workflow

- Use the `git`/`gh` wrappers on `PATH` (machine identity + signing enforced).
- Branch: `advisor/002-fix-script-classification`.
- Commit per step; short imperative messages. Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Split client globals into strong and weak signals

In `src/constants.ts`, replace the single list with:

```ts
/** Client-side globals that only exist in browser scripts. Safe classification evidence. */
export const CLIENT_GLOBALS_STRONG = [
  "g_form",
  "g_user",
  "g_list",
  "g_navigation",
  "g_tabs2Sections",
] as const;

/** Ambiguous globals: g_scratchpad is written by server-side display Business Rules; gel is short enough to collide. Never used for classification. */
export const CLIENT_GLOBALS_WEAK = ["g_scratchpad", "gel"] as const;

export const CLIENT_GLOBALS = [...CLIENT_GLOBALS_STRONG, ...CLIENT_GLOBALS_WEAK] as const;
```

Keep `CLIENT_GLOBALS` exported (other code may reference it; `grep -rn "CLIENT_GLOBALS" src/ tests/` to confirm only `filenames.ts` uses it today).

**Verify**: `npm run typecheck` → exit 0.

### Step 2: Precompile the client-source regex and use only strong globals

In `src/utils/filenames.ts`, replace `looksLikeClientSource`:

```ts
const CLIENT_GLOBAL_RE = new RegExp(`\\b(?:${CLIENT_GLOBALS_STRONG.join("|")})\\b`);

export function looksLikeClientSource(sourceText: string): boolean {
  return CLIENT_GLOBAL_RE.test(sourceText);
}
```

Do **not** add the `g` flag (a stateful `lastIndex` would corrupt later calls). Import `CLIENT_GLOBALS_STRONG` instead of `CLIENT_GLOBALS`.

**Verify**: `npm test` → all pass (existing `g_form` test at `tests/filenames.test.ts:19` still green).

### Step 3: Give explicit filename matches precedence over source sniffing

In `classifyFile`, reorder so filename evidence beats content sniffing:

```ts
if (isFluentFile(filename)) return "fluent";
if (UI_ACTION_FILE.test(filename)) return "ui-action";
if (CLIENT_FILE.test(filename)) return "client";
if (BR_FILE.test(filename)) return "business-rule";
if (SI_FILE.test(filename)) return "script-include";
if (looksLikeClientSource(sourceText)) return "client";
if (SERVER_DIR.test(filename)) return "server";
return "unknown";
```

(The source sniff moves below BR/SI filename checks; `SERVER_DIR` stays below the sniff so a genuinely client-looking file in a server dir still classifies client — preserving the current test at `tests/filenames.test.ts:19` and the UI-action-beats-g_form test at lines 10-15.)

**Verify**: `npm test` → all pass.

### Step 4: Recognize ServiceNow export filenames

Update the filename regexes:

```ts
const CLIENT_FILE = /(\.client\.|\.cs\.|client[-_.]?script|catalog[-_.]?client|sys_script_client|catalog_script_client|ui[-_.]?script|ui_script|on[-_]?change|on[-_]?load|on[-_]?submit|ui[-_.]?policy)/i;
const BR_FILE = /(business[-_.]?rule|\.br\.|sys_script(?![_a-z])|\/br\/)/i;
```

Two changes: `sys_script_client` and `catalog_script_client` added to `CLIENT_FILE`; `BR_FILE`'s `sys_script[^_]` becomes `sys_script(?![_a-z])` so `sys_script.js` and a path segment ending in `sys_script` match, while `sys_script_client…` still does not. `CLIENT_FILE` is tested before `BR_FILE` (step 3 order), so `sys_script_client_foo.js` classifies as client.

**Verify**: `npm test` → all pass (new tests for these come in step 8).

### Step 5: Detect the pragma in real comments only

Replace `hasEsLatestPragma` so it operates on comment tokens, not raw text. `usesClassicEngine` has access to `context`; move the comment extraction there:

```ts
const ES_LATEST_IN_COMMENT = /(^|\s)@sn-es-latest\b/;

export function hasEsLatestPragma(context: Context): boolean {
  const sc = context.sourceCode as {
    getAllComments?: () => Array<{ value: string }>;
    text: string;
  };
  const comments =
    typeof sc.getAllComments === "function" ? sc.getAllComments() : fallbackComments(sc.text);
  return comments.some((c) => ES_LATEST_IN_COMMENT.test(c.value));
}
```

Copy the `fallbackComments` helper from `src/rules/fluent-directives.ts:24-34` into `src/utils/filenames.ts` (or better: move it to `src/utils/ast.ts` and import it in both places — `fluent-directives.ts` already duplicates it with `src/runtime/apply-rules.ts:58-68`; consolidating all three call sites into one shared helper is in scope for this step if the imports stay clean). Update the one existing caller signature: `usesClassicEngine` passes `context` instead of `context.sourceCode.text`. `grep -rn "hasEsLatestPragma" src/ tests/` to catch any other callers.

**Verify**: `npm run typecheck` → exit 0; `npm test` → the `@sn-es-latest` tests in `tests/rules/no-promise.test.ts` and `tests/rules/no-async-await.test.ts` still pass.

### Step 6: Honor `scriptType` in `usesClassicEngine` and widen the settable union

In `src/types.ts`, widen the settings type:

```ts
scriptType?: "auto" | ScriptKind;
```

In `usesClassicEngine`, add after the `ecmaLatest` check:

```ts
if (settings.scriptType === "fluent") return false;
```

In `README.md`'s settings table, update the `scriptType` row to: `"auto" (default) or force client / server / business-rule / script-include / ui-action / fluent`.

**Verify**: `npm run typecheck` → exit 0. New test in step 8 covers behavior.

### Step 7: Memoize per-file classification and hoist per-node calls

In `src/utils/filenames.ts`, add a single-entry module-level memo (single-entry so the previous file's source string is not retained):

```ts
let memoFilename: string | undefined;
let memoText: string | undefined;
let memoSettings: ServiceNowSettings | undefined;
let memoKind: ScriptKind | undefined;

export function classifyFromContext(context: Context): ScriptKind {
  const settings = getSettings(context);
  const { filename } = context;
  const text = context.sourceCode.text;
  if (filename === memoFilename && text === memoText && settings === memoSettings) {
    return memoKind!;
  }
  memoFilename = filename;
  memoText = text;
  memoSettings = settings;
  memoKind = classifyFile(filename, text, settings);
  return memoKind;
}
```

(`classifyFile` itself stays pure and un-memoized for direct unit testing.)

In `src/rules/no-gs-now.ts` and `src/rules/no-br-current-update.ts`, hoist classification into `before()` — copy the idiom from `no-client-gliderecord.ts`:

```ts
createOnce(context) {
  let kind: ScriptKind;
  return {
    before() {
      kind = classifyFromContext(context);
    },
    CallExpression(node) {
      // ...existing check, using `kind` instead of calling classifyFromContext
    },
  };
}
```

Behavior must be byte-identical: in `no-br-current-update`, the `if (kind === "client" || kind === "ui-action") return;` logic is unchanged (the allowlist change is plan 004). In `no-gs-now`, the `messageId` selection (`kind === "client" ? "client" : "server"`) is unchanged.

**Verify**: `npm test` → all pass.

### Step 8: Add the regression tests

Extend `tests/filenames.test.ts` (same `describe`/`it` style) with, at minimum:

1. Display BR: `classifyFile("display-stuff.br.js", "g_scratchpad.count = 1;", {})` → `"business-rule"`.
2. Plain file with only `g_scratchpad` in source: `classifyFile("misc.js", "g_scratchpad.x = 1;", {})` → NOT `"client"` (expected `"unknown"`).
3. `classifyFile("sys_script_client_onchange.js", "", {})` → `"client"`.
4. `classifyFile("export/sys_script.js", "", {})` → `"business-rule"`.
5. Comment-only strong global: `classifyFile("util.si.js", "// mirrors g_form.setValue", {})` → `"script-include"` (filename wins over comment mention).
6. Windows separators: `classifyFile("src\\server\\thing.js", "", {})` → `"server"`.

Add to `tests/rules/no-promise.test.ts` (or a new block in `tests/rules/glide-and-engine.test.ts`):

7. Pragma inside a template literal does NOT disable the ban: lint `"var s = `\\n// @sn-es-latest\\n`;\nvar p = new Promise(function(){});"` with `no-promise` → 1 `construct` diagnostic. (Note: the test harness `tests/helpers/rule-tester.ts` passes real oxc-parser comments through, so `getAllComments` sees only true comments.)
8. Real pragma comment still works: existing test unchanged.
9. `settings: { scriptType: "fluent" }` on a `.js` file with `async function f() {}` linted by `no-async-await` → 0 diagnostics.

**Verify**: `npm test` → all pass, including ≥9 new assertions. `npm run docs:check` → exit 0.

## Test plan

Covered by step 8. Pattern: `tests/filenames.test.ts` for classification, `tests/rules/no-promise.test.ts` for rule-level settings/pragma behavior. Final: `npm test` all green; if plan 001 landed, the integration fixtures must also stay green (and the bad-BR fixture's known `no-client-gliderecord` false positive from plan 001's STOP note should now be gone — re-enable that assertion if it was excluded).

## Done criteria

Machine-checkable. ALL must hold:

- [x] `npm run typecheck` exits 0
- [x] `npm test` exits 0 with the new assertions from step 8 present
- [x] `grep -n "new RegExp" src/utils/filenames.ts` shows the regex constructed at module scope only (not inside a function)
- [x] `grep -n "classifyFromContext" src/rules/no-gs-now.ts src/rules/no-br-current-update.ts` shows calls only inside `before()`
- [x] `grep -c "g_scratchpad" src/constants.ts` ≥ 1 and `g_scratchpad` is in the weak list, not the strong list
- [x] `npm run docs:check` exits 0
- [x] No files outside the in-scope list modified (`git status`)
- [x] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `context.sourceCode.getAllComments` does not exist on the real oxlint `Context` type from `@oxlint/plugins` (typecheck failure in step 5) — the comment-based pragma needs a different access path; report the available API surface.
- Reordering in step 3 breaks the existing test `classifyFile("src/ui-actions/close.ui-action.js", "g_form...")` → `"ui-action"` — the precedence contract has more constraints than this plan modeled.
- Any currently-passing test fails for a reason you cannot trace to an intended behavior change listed above.
- You find additional callers of `hasEsLatestPragma` or `CLIENT_GLOBALS` outside the in-scope files.

## Maintenance notes

- This narrows classification, so consumer repos may see diagnostics appear (files previously misclassified as client now get server-side rules) — worth a minor-version bump and a CHANGELOG entry describing the reclassification and the `settings.servicenow.scriptType` override.
- The memo in step 7 assumes one file is processed at a time per process (oxlint's JS-plugin model today). If oxlint ever interleaves files concurrently, the single-entry memo must become keyed storage — note this in a comment on the memo.
- Reviewers should scrutinize: the regex changes (step 4) against ServiceNow export naming, and that step 7 changed no observable behavior.
- Deferred: making `looksLikeClientSource` AST-aware (identifier references instead of raw text) — raw text still matches strong globals in comments/strings; acceptable for now since the strong list is genuinely client-only, but noted in plans/README.md backlog.
