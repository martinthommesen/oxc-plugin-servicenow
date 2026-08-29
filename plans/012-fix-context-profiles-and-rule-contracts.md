# Plan 012: Fix context profiles and bounded rule contracts

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Do not improvise. This work is one implementation PR in the PR #51
> replacement stack. Do not update `plans/README.md`; the tracking-PR owner
> maintains the index.
>
> **Drift check (run first)**:
> `git diff --stat b87972a..HEAD -- src/settings/validate.ts src/settings/index.ts src/context src/index.ts src/rules/require-business-rule-wrapper.ts src/rules/no-br-current-update.ts src/rules/no-client-gliderecord.ts src/rules/no-gs-now.ts src/rules/no-system-query-bypass.ts src/rules/validate-gliderecord-calls.ts src/rules/prefer-glideaggregate.ts src/rules/no-at-method.ts src/rules/no-async-await.ts src/rules/no-async-iterators.ts src/rules/no-bigint.ts src/rules/no-promise.ts src/rules/no-proxy.ts src/rules/no-unsupported-syntax.ts src/rules/require-glideajax-sysparm-name.ts src/rules/require-query-before-next.ts src/rules/validate-glideaggregate-calls.ts src/catalog.ts src/catalog-metadata.ts tests/context.test.ts tests/filenames.test.ts tests/settings-freeze.test.ts tests/perf/benchmark.test.ts tests/rules/prefer-glideaggregate.test.ts tests/rules/glide-and-engine.test.ts tests/rules/layer3-consumers.test.ts tests/rules/phase3.test.ts tests/rules/stateful-lifecycle.test.ts tests/rules/validate-glideaggregate-calls.test.ts tests/rules/no-async-await.test.ts tests/rules/no-bigint.test.ts tests/rules/no-promise.test.ts tests/integration/context-contracts.test.ts tests/integration/context-fixtures tests/integration/context-configs tests/integration/flat-profiles.test.ts CHANGELOG.md docs/rules README.md examples tests/integration/profiles/configs`
> Plans 008, 009, and 011 intentionally change some listed files. Compare their
> live contracts with the excerpts and reproduce the remaining context/rule
> defects before editing. Stop if a dependency moved one of these policies,
> removed a required message ID, or lacks the immutable temporal-provenance seam.
> Do not revert expected dependency drift.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: `plans/006-freeze-and-restack-pr51.md`, `plans/008-fix-bindings-scopes-and-closures.md`, `plans/009-rebuild-stateful-rule-lifecycles.md`, `plans/010-authoritative-fluent-sdk-registry.md`, `plans/011-fix-now-id-and-fluent-directives.md`
- **Category**: bug
- **Planned at**: commit `b87972a`, 2026-08-20

## Why this matters

Rules must run only where the plugin has credible ServiceNow context. The
current settings, filename, and flat-profile contracts can enable incompatible
client and server rule families, while several individual rules bypass those
contracts. Other rules make claims that their own proof does not support. This
plan makes applicability conservative, fixes the bounded rule defects, and
proves the same behavior under Oxlint and ESLint.

## Current state

The relevant files and responsibilities are:

- `src/settings/validate.ts` validates explicit context and deprecated settings.
- `src/settings/index.ts` memoizes normalized settings.
- `src/context/filename.ts` infers authoring and surfaces from filenames.
- `src/context/resolve.ts` assigns confidence and exposes applicability helpers.
- `src/index.ts` defines independently consumable ESLint flat profiles.
- `src/rules/no-client-gliderecord.ts`, `no-gs-now.ts`, and
  `validate-gliderecord-calls.ts` have inconsistent surface gates.
- `src/rules/no-br-current-update.ts` does not recognize the canonical full-script wrapper parameter.
- `src/rules/prefer-glideaggregate.ts` stores count-loop proof on the whole object.
- `src/rules/no-system-query-bypass.ts` reconstructs escape timing by scanning snapshots.
- `src/rules/no-at-method.ts` reports any method named `at` without receiver proof.
- Several rule messages state a problem but give no remediation.

Empty surfaces and contradictory legacy surfaces both pass validation:

```ts
// src/settings/validate.ts:212-238
let surfaces: "auto" | ScriptSurface[] = "auto";
// ...
} else if (Array.isArray(raw.surfaces)) {
  surfaces = raw.surfaces.map((item, index) =>
    expectEnum(`.surfaces[${index}]`, item, SURFACES),
  );
  if (new Set(surfaces).size !== surfaces.length) {
    throw new ServiceNowSettingsError(".surfaces", "duplicate surface values");
  }
}
// ...
if (scriptType !== "auto" && scriptType !== "unknown" && scriptType !== "fluent") {
  if (surfaces !== "auto" && !surfaces.includes(scriptType)) {
```

An explicit empty array then becomes false evidence that the file is an
instance script:

```ts
// src/context/resolve.ts:110-112,231-237
if (settings.surfaces !== "auto") {
  return { surfaces: new Set(settings.surfaces), confidence: "explicit" };
}
// ...
return (
  ctx.sources.authoring !== "unknown" ||
  ctx.sources.surfaces !== "unknown" ||
  ctx.javascriptMode !== "unknown"
);
```

Filename regexes use broad substrings and union incompatible evidence:

```ts
// src/context/filename.ts:4-14,37-49
export const CLIENT_FILE =
  /(\.client\.|\.cs\.|client[-_.]?script|catalog[-_.]?client|sys_script_client|catalog_script_client|ui[-_.]?script|ui_script|on[-_]?change|on[-_]?load|on[-_]?submit|ui[-_.]?policy)/i;
export const BR_FILE = /(business[-_.]?rule|\.br\.|sys_script(?![_a-z])|\/br\/)/i;
// ...
if (CLIENT_FILE.test(path) || CLIENT_DIR.test(path)) surfaces.push("client");
if (BR_FILE.test(path)) surfaces.push("business-rule");
```

Thus `sys_script2.js` matches Business Rule, and
`src/client/business-rule.js` becomes both client and Business Rule at filename
confidence. Only UI Actions are documented as mixed execution surfaces.

Settings memoization observes raw object identity, not mutation:

```ts
// src/settings/index.ts:18-40
let memoFilename: string | undefined;
let memoRaw: unknown;
let memoResult: ValidatedSettingsResult | undefined;
// ...
if (filename === memoFilename && raw === memoRaw && memoResult) {
  return memoResult;
}
```

Unknown-surface gates are inconsistent:

```ts
// src/rules/validate-gliderecord-calls.ts:38-40
before() {
  const { context: script } = beginRuleFile(context);
  if (isFluentContext(script)) return false;
}
```

```ts
// src/rules/no-gs-now.ts:28-48
const { analysis, context: script } = beginRuleFile(context);
if (!isInstanceScript(script) && !isClientCapableContext(script)) return;
// ...
const messageId = isNowDateTime
  ? "nowDateTime"
  : appliesOnSurface(script, "client")
    ? "client"
    : "server";
```

A known JavaScript mode can therefore make an otherwise unknown file report a
server message. The `gs` call itself can also become circular inferred server
evidence.

The client rule enables its whole visitor when any client surface is present:

```ts
// src/rules/no-client-gliderecord.ts:25-28
before() {
  const { context: script } = beginRuleFile(context);
  if (!appliesOnSurface(script, "client")) return false;
}
```

This reports code that is server-only within a mixed client/server UI Action.
This plan uses conservative whole-file silence for mixed UI Actions. It does
not infer execution regions from `typeof window` text.

The Business Rule update rule recognizes global `current` and aliases, but not
the parameter of the exact wrapper required by its sibling rule:

```ts
// src/rules/no-br-current-update.ts:34-40
const directGlobal =
  getName(member.object) === "current" &&
  analysis.isPlatformGlobal(member.object as ESTree.Node);
const proven = analysis.ofExpression(member.object);
const alias =
  proven?.kind === "current" && !proven.invalid && !proven.escaped;
if (!directGlobal && !alias) return;
```

The flat profiles cover only narrow suffixes:

```ts
// src/index.ts:65-68,107-118
const CLIENT_FILES = ["**/*.client.js", "**/*.client.cjs", "**/*.client.mjs"];
const BUSINESS_RULE_FILES = ["**/*.br.js", "**/*.br.cjs", "**/*.br.mjs"];
// ...
client: flatConfig(/* ... */, CLIENT_FILES),
businessRule: flatConfig(/* ... */, BUSINESS_RULE_FILES),
```

Count-loop state is object-wide and counter reads are rejected:

```ts
// src/rules/prefer-glideaggregate.ts:9-18,99-107,225-244
interface GrBinding {
  name: string;
  counted: boolean;
  iterated: boolean;
  onlyIncremented: boolean;
  countNode: ESTree.Node | null;
}
// ...
if (binding.iterated && binding.onlyIncremented && !binding.counted) {
  context.report({ /* ... */ messageId: "iterateCount" });
}
// ...
if (!isDeclaration && !isUpdate && !isAssignment) valid = false;
```

A useful `gs.info(count)` consumption suppresses the rule, and one old loop can
leave a permanent claim about later loops.

The bypass rule performs a whole-program reconstruction of escape order:

```ts
// src/rules/no-system-query-bypass.ts:26-46,75-83
function escapedBefore(/* ... */) {
  // walks earlier Identifier and MemberExpression snapshots
}
// ...
if (proven.escaped) {
  const sameArgument = sameObjectArgument(call, proven.objectId, analysis);
  // ...
  if (!sameArgument || !isNode(program) || escapedBefore(/* ... */)) return;
}
```

The `.at()` rule checks only the member name:

```ts
// src/rules/no-at-method.ts:26-30
const call = node as ESTree.CallExpression;
if (call.callee.type !== "MemberExpression") return;
if (staticPropertyName(call.callee) !== "at") return;
context.report({ node, messageId: "at" });
```

Repository constraints:

- `CONTRIBUTING.md` requires shared context helpers, binding/provenance proof,
  silence for unknown provenance/mode/surface, and actionable messages.
- `CONTRIBUTING.md` requires catalog changes, `npm run docs`, and
  `npm run validate` for user-visible rule changes.
- Generated rule pages, README rule tables, example Oxlint configs, and profile
  config copies must be generated. Do not edit them manually.
- Plan 008 owns SourceCode/filename cache identity, immutable cached context,
  scope-tree parity, and temporal escape snapshots. Use those contracts; do not
  reopen their implementation here.
- Plan 009 owns GlideAjax, query, aggregate, count-window, cursor, bulk-filter,
  callback, and collection lifecycle semantics. This plan may improve their
  message text but must not change those state machines.
- Plan 011 owns Fluent and directive semantics.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `npm ci` | exit 0 |
| Focused unit tests | `node scripts/run-tests.mjs tests/context.test.ts tests/settings-freeze.test.ts tests/rules/prefer-glideaggregate.test.ts tests/rules/glide-and-engine.test.ts tests/rules/layer3-consumers.test.ts tests/rules/phase3.test.ts` | all tests pass |
| Real-host tests | `node scripts/run-tests.mjs tests/integration/context-contracts.test.ts tests/integration/flat-profiles.test.ts` | Oxlint and ESLint cases pass |
| Typecheck and build | `npm run typecheck && npm run build` | both exit 0 |
| Generate/check docs | `npm run docs && npm run docs:check` | both exit 0 |
| Full validation | `npm run validate` | exit 0 |

## Scope

**In scope** (the only source and hand-written test files to modify):

- `src/settings/validate.ts`
- `src/settings/index.ts`
- `src/context/filename.ts`
- `src/context/resolve.ts`
- `src/context/index.ts`
- `src/index.ts`
- `src/rules/require-business-rule-wrapper.ts`
- `src/rules/no-br-current-update.ts`
- `src/rules/no-client-gliderecord.ts`
- `src/rules/no-gs-now.ts`
- `src/rules/no-system-query-bypass.ts`
- `src/rules/validate-gliderecord-calls.ts`
- `src/rules/prefer-glideaggregate.ts`
- `src/rules/no-at-method.ts`
- `src/rules/no-weak-collections.ts`, `src/rules/no-weak-references.ts`, and one small shared constructor-rule factory under `src/rules/`
- `src/utils/settings.ts`, only to remove the unused `objectOptionAt` re-export
- Message-only edits in `src/rules/no-async-await.ts`,
  `no-async-iterators.ts`, `no-bigint.ts`, `no-promise.ts`, `no-proxy.ts`,
  `no-unsupported-syntax.ts`, `require-glideajax-sysparm-name.ts`,
  `require-query-before-next.ts`, and `validate-glideaggregate-calls.ts`.
- `src/catalog.ts` and `src/catalog-metadata.ts`, only for rules changed here.
- `tests/context.test.ts`
- `tests/filenames.test.ts`
- `tests/settings-freeze.test.ts`
- `tests/perf/benchmark.test.ts`, only for the settings-validation counter/regression.
- `tests/rules/prefer-glideaggregate.test.ts`
- `tests/rules/glide-and-engine.test.ts`
- `tests/rules/layer3-consumers.test.ts`
- `tests/rules/phase3.test.ts`
- `tests/rules/stateful-lifecycle.test.ts`
- `tests/rules/validate-glideaggregate-calls.test.ts`
- `tests/rules/no-async-await.test.ts`
- `tests/rules/no-bigint.test.ts`
- `tests/rules/no-promise.test.ts`
- `tests/integration/context-contracts.test.ts` (create)
- `tests/integration/context-fixtures/**` (create)
- `tests/integration/context-configs/**` (create)
- `tests/integration/flat-profiles.test.ts`
- `CHANGELOG.md`
- The hand-authored settings row in `README.md`, outside generated markers.
- Outputs changed by `npm run docs`: `docs/rules/*.md`, generated `README.md`
  sections, `examples/**/.oxlintrc.json`, and
  `tests/integration/profiles/configs/*.oxlintrc.json`.

**Out of scope**:

- `src/analysis/path-state.ts`, `bindings.ts`, `file-analysis.ts`, and
  `provenance.ts`; plan 008 owns their final contracts.
- Stateful lifecycle behavior covered by plan 009.
- Fluent imports, `Now.ID`, and directives covered by plans 010 and 011.
- A general branch/region execution classifier for mixed UI Actions.
- Public-root export narrowing, catalog architecture, migration docs, examples,
  self-lint/format gates, and general generated-asset repairs; plan 013 owns them.
- Cross-rule evidence generation, compatibility matrices, and benchmarks; plan 014 owns them.
- New platform releases or APIs, release workflows, publication, and governance.
- Autofixes. These changes are diagnostic and applicability corrections only.

## Git workflow

Plan 006 creates the stack branch and draft pull request before this work starts.
Do not create another branch or pull request.

1. Read plan 012 in `docs/pr-51-stack.json` and run its documented ownership validator. Use the manifest only for expected branch/base topology, archived ownership, reconstruction commit, and rollback rule.
2. Run `gh stack view --json`. Confirm that `pr51-remediation/012-context-profiles-contracts` exists above `pr51-remediation/011-now-id-directives` and remains draft.
3. Run `gh pr view` for this draft PR. Compare its live URL, base SHA, head SHA, status, and current check run with the PR body and the PR #51 tracking body. Do not compare mutable head data with `docs/pr-51-stack.json`.
4. Fetch `origin` and check out the existing plan 012 branch.
5. Stop on an ownership/topology mismatch or when live PR data disagrees with the PR/tracking body. Return to plan 006 instead of repairing the stack here.

Use one commit per green logical step. Follow the repository style, for example `fix: reject contradictory ServiceNow contexts` and `test: verify context contracts in real hosts`.
Do not push or update the draft pull request unless the operator instructs you.

## Steps

### Step 1: Add failing settings and context contract tests

Before implementation, add exact tests for:

- reject `{ surfaces: [] }` with `ServiceNowSettingsError` at `.surfaces`;
- reject `{ scriptType: "server", surfaces: ["server", "client"] }`;
- reject `{ scriptType: "business-rule", surfaces: ["business-rule", "client"] }`;
- reject legacy `scriptType: "ui-action"` with extra surfaces; mixed UI Actions
  must use `authoring: "classic"` and explicit `surfaces` without `scriptType`;
- accept `surfaces: ["ui-action", "client"]`, `["ui-action", "server"]`, and
  `["ui-action", "client", "server"]` when legacy `scriptType` is absent;
- `surfacesFromFilename("sys_script2.js")` returns no surface;
- exact `sys_script.js` returns Business Rule;
- `src/client/business-rule.js` yields no filename surface evidence;
- `close.client.ui-action.js` yields `ui-action` plus `client`;
- plain files with explicit JavaScript mode retain
  `sources.surfaces === "unknown"`; surface-specific rules stay silent, while
  mode-specific engine rules continue to run.

Also retain plan 008 regressions: reuse one parsed SourceCode under
`form.client.js`, `incident.br.js`, and `table.now.ts`; assert distinct correct
contexts and immutable results. If these fail, stop and return the defect to
plan 008 instead of editing its files.

**Verify**:
`node scripts/run-tests.mjs tests/context.test.ts`
→ new tests fail only for the intended settings/filename behavior before the
implementation and all plan 008 cache tests pass.

### Step 2: Reject empty and contradictory explicit settings

In `validateServiceNowSettings()`:

1. Reject every explicit empty `surfaces` array. The error path is `.surfaces`
   and the action says to omit the setting or use `"auto"` when the surface is unknown.
2. For a non-Fluent, non-unknown deprecated `scriptType`, permit explicit
   `surfaces` only when it is exactly the one-element legacy mapping. Reject
   extra entries even when the legacy surface is present.
3. Do not use legacy `scriptType` to encode a mixed UI Action. The valid mixed
   form is `authoring: "classic", surfaces: ["ui-action", "client" | "server" | both]`.
4. Preserve existing Fluent/authoring, duplicate, enum, JavaScript-mode, scope,
   release, and Business Rule conflict errors.

Do not assign semantic meaning to `surfaces: []`. Rejecting it is the least
surprising contract and prevents an explicit-but-empty instance context.
Define each settings field once in typed runtime descriptor data. Derive allowed keys, defaults, field parsing, the frozen validated result, and Plan 008's complete cache fingerprint input from that data. Keep field-specific validation hooks beside the descriptor instead of repeating the complete field list. Add a test that adds a synthetic descriptor and proves every derived product sees it.

Remove the unused `objectOptionAt()` function from `src/settings/index.ts` and its re-export from `src/utils/settings.ts`. Do not create a second object-option parser beside the active descriptor parser.

Update the hand-authored `README.md` settings row outside generated rule-table
markers. State that the array must be non-empty and mixed UI Actions must omit
legacy `scriptType`. Do not hand-edit generated README rule tables or rule pages.

**Verify**:
`node scripts/run-tests.mjs tests/context.test.ts && npm run typecheck`
→ settings tests and typecheck pass.

### Step 3: Tokenize filename conventions and resolve conflicts conservatively

Replace broad substring accumulation with one canonical convention table. Each
entry must define complete basename/path token boundaries and its corresponding
ESLint globs. Preserve documented conventions for client, Business Rule, Script
Include, UI Action, scheduled, fix, and server files.

Rules for multiple matches:

- A UI Action may combine `ui-action` with `client`, `server`, or both.
- Two incompatible non-UI-Action surfaces from filename evidence are not truth.
  Return no filename surface evidence and allow later AST inference to supply a
  side. Never enable both rule families from the conflict.
- Exact table-export basenames must not match a longer alphanumeric token.
  `sys_script.js` matches Business Rule; `sys_script2.js` does not.
- Directory tokens must be complete path segments. A substring such as
  `client-tools` is not the `client` directory convention.

Export `CLIENT_FILE_GLOBS` and `BUSINESS_RULE_FILE_GLOBS` from the same module or
derive them from the same descriptors. Tests must fail if a classifier
convention lacks a flat-profile glob.

Do not add or change the SourceCode analysis cache here. Plan 008 must already
include `context.filename` in its semantic cache key.

**Verify**:
`node scripts/run-tests.mjs tests/context.test.ts tests/filenames.test.ts`
→ all filename and context cases pass.

### Step 4: Make settings memoization mutation-sensitive

Replace the three global identity slots with a mutation-sensitive memo. Use a
WeakMap entry for each raw settings object containing its last structural
snapshot and frozen validated result. On every lookup:

1. Compute a deterministic, non-throwing snapshot of own enumerable keys,
   primitives, arrays, and nested plain objects. Sort object keys, distinguish
   value types, and handle cycles with local reference markers. Do not maintain
   a hand-selected field list that can omit a future setting.
2. If the snapshot equals the cached snapshot, return the cached validated result.
3. Otherwise call `validateServiceNowSettings(raw)` first as the error authority,
   then store the new snapshot and result. Never cache an invalid result.

The snapshot helper must not freeze or mutate the consumer's object. Generic
snapshot failures must never replace the validator's path-specific
`ServiceNowSettingsError`. The scan is allowed on each `beginRuleFile()` lookup,
but validation and deep freezing must occur once for unchanged content. Add a
focused counter/benchmark assertion that one unchanged file with many rule
visitors performs one validation and stays within the existing benchmark gate.

Add programmatic regressions:

```ts
const settings = { javascriptMode: "es5" };
// applyRules(... no-promise ...) => one diagnostic
settings.javascriptMode = "es2021";
// same filename and raw object => zero diagnostics
```

Repeat with `surfaces[0]` changed from `client` to `server`; the same
`no-client-gliderecord` source must change from one diagnostic to zero. Also
assert unchanged raw settings reuse the same frozen normalized result, while a
scalar or nested-array mutation creates a new result.

**Verify**:
`node scripts/run-tests.mjs tests/settings-freeze.test.ts tests/context.test.ts tests/perf/benchmark.test.ts`
→ mutation changes semantics, one unchanged input validates once, immutability
tests pass, and the benchmark remains within its existing threshold.

### Step 5: Normalize unknown and mixed-surface applicability

Replace `CONFIDENCE_RANK` and `SURFACE_MIN` with one exported confidence-order authority. Make both `weakest()` and `appliesOnSurface()` consume it. Add a unit assertion for every confidence pair so the two decisions cannot drift.

Audit only the bounded applicability contracts for
`validate-gliderecord-calls`, `no-gs-now`, `no-client-gliderecord`, and the two
Business Rule wrapper/update rules. Use named trigger cases and message IDs;
stop and report any defect discovered in another rule instead of widening Scope.
Make these corrections:

- Gate deprecated `validate-gliderecord-calls` with
  `isServerInstanceContext()`, matching `require-query-before-next`.
- Gate `no-gs-now` on a client or server surface at filename-or-explicit
  confidence. Do not let the diagnosed `gs` reference create the only server
  evidence. An unknown `plain.js` with only `javascriptMode: "es5"` stays silent.
  On a known surface, require the unshadowed global or a valid, unescaped alias
  at that program point. Prior helper/storage escape, reassignment, and
  shadowing stay silent; a direct or still-valid alias reports.
- If a UI Action is explicitly both client and server,
  `no-client-gliderecord` stays silent for the entire file. Preserve findings
  for client-only UI Actions and ordinary client scripts.
- Do not infer execution regions from `typeof window`, function names, comments,
  or spelling. Record mixed-file silence as a known false negative.

Use a named helper such as `isMixedUiActionContext()` so later rules do not
repeat set logic. Require inferred or stronger evidence for ordinary client and
server helpers. Add a table-driven test for only these bounded rules. Name each rule ID,
trigger, known-surface invalid counterpart, and unknown-surface expected silence.
Plan 014 owns the exhaustive catalog-derived applicability matrix.

**Verify**:
`node scripts/run-tests.mjs tests/context.test.ts tests/rules/glide-and-engine.test.ts`
→ unknown and mixed contexts are silent; known surfaces still report.

### Step 6: Share and reuse the canonical Business Rule wrapper proof

Extract the wrapper-shape logic from `require-business-rule-wrapper.ts` into a
small exported rule helper. It must return the exact wrapper call, function,
first parameter binding, and outer arguments only when all of these hold:

- the file is a full-script Business Rule;
- after directive prologue and ignorable statements, there is exactly one
  canonical top-level IIFE;
- its first two parameters are `current` and `previous`;
- its first two call arguments resolve to the unshadowed platform globals
  `current` and `previous`;
- no unrelated top-level executable statement exists.

In `no-br-current-update`, treat only that first parameter binding as platform
`current` inside the canonical wrapper. Keep body-only and unknown formats,
arbitrary functions, nested shadowing, renamed parameters, unrelated IIFEs,
and shadowed outer arguments silent. This is a bounded platform-wrapper rule,
not general interprocedural parameter propagation.

Add one invalid canonical wrapper with `current.update()` and valid near-misses
for renamed parameters, shadowed outer current, arbitrary nested functions, and
noncanonical top-level code.

**Verify**:
`node scripts/run-tests.mjs tests/rules/layer3-consumers.test.ts tests/rules/phase3.test.ts`
→ the canonical call reports once and all near-misses stay silent.

### Step 7: Align independently consumable flat-profile globs

Import `CLIENT_FILE_GLOBS` and `BUSINESS_RULE_FILE_GLOBS` into `src/index.ts`.
Cover JS, CJS, and MJS variants for every public filename convention, including:

- client: `.client`, `.cs`, client-script, catalog-client,
  `sys_script_client`, `catalog_script_client`, UI-script, onChange, onLoad,
  onSubmit, UI-policy, and exact `/client/` path segments;
- Business Rule: `.br`, business-rule, exact `sys_script`, and exact `/br/`
  path segments.

Keep ordinary server files, `sys_script2.js`, and conflicting client/Business
Rule paths unselected. Do not widen either profile to all classic JavaScript.
The settings embedded in each flat config remain explicit for its one surface.

**Verify**:
`node scripts/run-tests.mjs tests/integration/flat-profiles.test.ts`
→ every convention triggers its profile rule and every negative remains skipped.

### Step 8: Make `prefer-glideaggregate` prove each loop independently

Keep immediate `getRowCount()` reporting. Remove object-wide `iterated`,
`onlyIncremented`, and `countNode` state for iterate-to-count. For each
`while`/`for` candidate, prove independently:

- one valid, unescaped GlideRecord ObjectId supplies the `.next()` test;
- one stable numeric counter is initialized before the loop;
- every meaningful body/update operation is `counter++`, `++counter`, or
  `counter += 1` for that same binding;
- the loop does not read a record field, pass/store/return the record, call an
  unrelated helper, update a second counter, or contain extra work;
- the counter has no read or write between initialization and the loop except
  the proven increments;
- read-only uses after the loop are allowed and do not invalidate proof.

Report the loop immediately with wording that says **this loop** only counts
rows. A later processing loop does not inherit the fact and does not erase a
valid first-loop finding. Two independent count-only loops produce two
findings. A pre-loop counter read, an in-loop field read, or ambiguous binding
stays silent.

Add consumed-count, mixed count/processing, two-loop, alias, shadowed counter,
`for` update, and escape cases. Assert the diagnostic node is the proven loop,
not `Program`.

**Verify**:
`node scripts/run-tests.mjs tests/rules/prefer-glideaggregate.test.ts tests/rules/layer3-consumers.test.ts`
→ all loop proofs and exact counts pass.

### Step 9: Simplify `no-system-query-bypass` to temporal receiver provenance

Use the program-point receiver snapshot supplied by plans 007 and 008. Delete
`sameObjectArgument()`, `escapedBefore()`, and the whole-program walk. Require:

- proven kind `GlideRecord`;
- valid ObjectId;
- not invalid;
- not escaped when the receiver is evaluated;
- a static method in the manifest bypass role selected by plan 009.

A prior storage or helper escape stays silent. A direct receiver, alias, static
computed bypass method, or self argument without an earlier escape reports.
Reassignment, shadowing, and unknown computed members stay silent. Do not add a
second escape-event model in the rule.

**Verify**:
`node scripts/run-tests.mjs tests/rules/phase3.test.ts tests/rules/layer3-consumers.test.ts`
→ prior escapes are silent and definite bypasses report once.

### Step 10: Restrict `.at()` to proven built-in receivers

Keep the mode gate, but suppress unknown receivers. Report only when the
receiver is statically proven to be an Array or String value. At minimum cover
array literals, string literals, and immutable bindings whose initializer is
one of those shapes. A user object, custom class, parameter, mutable/unknown
binding, or shadowed helper stays silent.

Do not invent a general JavaScript type analyzer. If existing binding services
cannot prove an immutable literal alias within this scope, support direct
literals only and document that false-negative boundary. Change metadata that
currently admits user-defined `.at()` false positives.

Add exact invalid direct Array/String cases and valid object/custom-prototype,
parameter, mutable alias, ES2021, and unknown-mode cases.

**Verify**:
`node scripts/run-tests.mjs tests/rules/glide-and-engine.test.ts`
→ only proven built-in ES5/Compatibility calls report.

### Step 11: Make every affected diagnostic actionable

Preserve message IDs unless plan 009 intentionally removed a now-unreachable
GlideAjax state. Change the rendered text and tests so each message states the
problem and an imperative action:

- `no-async-await.awaitExpr`: rewrite the surrounding flow as synchronous
  platform code, or use `javascriptMode: "es2021"` only when the runtime does.
- `no-async-iterators.forAwait`: use a synchronous loop over materialized values.
- `no-async-iterators.asyncGen`: use a normal function with a supported
  collection or platform callback.
- `no-bigint.literal`: use a decimal string, or `Number` only within its safe range.
- `no-promise.staticMethod`: use synchronous Glide APIs, or configure ES2021
  only when the script runs there.
- `no-proxy.revocable`: use explicit object methods and state.
- `no-unsupported-syntax.logicalAssign`: use an explicit conditional and assignment, or ES2021.
- `privateInstance` and `privateStatic`: use conventional properties with
  closure/module encapsulation, or the supported runtime mode.
- `lookbehind`: use capture groups plus an explicit check, or ES2021.
- `require-glideajax-sysparm-name.missingName`: call
  `addParam("sysparm_name", "method")` before the terminal request.
- Confirm plan 009 removed the unsupported `afterTerminal` message ID and its
  metadata. Do not reintroduce a remediation for an unreachable protocol state.
- `require-query-before-next.missingQuery`: call `query()` or `get()` on every
  path before `next()`.
- `validate-glideaggregate-calls.unknownAggregate`: register the exact tuple
  before `query()` and query again before reading it.
- `validate-gliderecord-calls.unusedReturn`: store and check the return value.
- `validate-gliderecord-calls.missingQuery`: call `query()` or `get()` on every
  path before `next()`.

Add table-driven rule tests that execute every listed message ID and assert its
complete rendered message. Do not merely inspect source strings. Coordinate
with plan 013, which owns broader documentation architecture, but do not defer
these CONTRIBUTING violations.

**Verify**:
`node scripts/run-tests.mjs tests/rules/glide-and-engine.test.ts tests/rules/stateful-lifecycle.test.ts tests/rules/validate-glideaggregate-calls.test.ts`
→ every listed message is exercised and contains its required action.

Before the real-host fixtures, replace the copied `no-weak-collections` and `no-weak-references` visitors with one small constructor-rule factory. Keep constructor sets, feature IDs, messages, and policy differences as typed data. Add shared provenance cases and rule-specific message assertions before deleting either old visitor. This refactor must not change applicability or diagnostics.

### Step 12: Add exact real Oxlint and ESLint context fixtures

Create `tests/integration/context-contracts.test.ts`. Run each on-disk fixture
through the real Oxlint binary with `runOxlint()` and through ESLint
`Linter.verify()`. Use rule-specific config so unrelated messages cannot hide a
count mismatch. Assert exact normalized rule ID, ESLint message ID, complete
message, count, and diagnostic offset/range for the unique target substring.
Convert ESLint one-based line/column fields to source offsets. Compare both
hosts by slicing the original source at normalized offsets; do not compare raw
host coordinate objects.

Add these exact invalid-setting host configs under
`tests/integration/context-configs/`. Run Oxlint as a raw child process because
a configuration failure is the expected nonzero exit:

```json
{
  "$schema": "../../../node_modules/oxlint/configuration_schema.json",
  "jsPlugins": [{ "name": "servicenow", "specifier": "../../.." }],
  "settings": { "servicenow": { "surfaces": [] } },
  "rules": { "servicenow/no-client-gliderecord": "error" }
}
```

Run it on `context-fixtures/catalog-client.js`. Assert nonzero exit and a
configuration error containing `.surfaces`; no partial lint result is accepted.
Use the equivalent ESLint flat config with only that rule and assert
`Linter.verify()` throws `ServiceNowSettingsError` containing `.surfaces`.

```json
{
  "$schema": "../../../node_modules/oxlint/configuration_schema.json",
  "jsPlugins": [{ "name": "servicenow", "specifier": "../../.." }],
  "settings": {
    "servicenow": {
      "scriptType": "server",
      "surfaces": ["server", "client"]
    }
  },
  "rules": { "servicenow/validate-gliderecord-calls": "error" }
}
```

Run it on `context-fixtures/unknown.js`. Assert both hosts fail initialization
with a path-specific `.scriptType` conflict and produce no partial diagnostics.

In the same real ESLint test, use one `Linter`, reuse each raw nested settings
object, and construct a fresh one-rule flat-config array around that same raw
object for each call:

```ts
const mode = { javascriptMode: "es5" };
count("no-promise", "var p = Promise.resolve(1);", "x.server.js", mode); // 1
mode.javascriptMode = "es2021";
count("no-promise", "var p = Promise.resolve(1);", "x.server.js", mode); // 0

const side = { surfaces: ["client"] };
count("no-client-gliderecord", 'new GlideRecord("incident");', "same.js", side); // 1
side.surfaces[0] = "server";
count("no-client-gliderecord", 'new GlideRecord("incident");', "same.js", side); // 0
```

`count()` must supply only the named rule, plugin, and
`settings: { servicenow: raw }`. Assert exact `1 -> 0` target counts. This test
proves mutation through real ESLint; the paired `applyRules()` test proves the
public programmatic helper.

Create these exact fixtures and expectations:

```js
// context-fixtures/sys_script2.js
current.update();
var gr = new GlideRecord("incident");
gr.next();
// Both hosts: 0 no-br-current-update; 0 require-query-before-next.
```

```js
// context-fixtures/src/client/business-rule.js
var gr = new GlideRecord("incident");
gr.next();
// Both hosts: 0 no-client-gliderecord; 0 require-query-before-next.
```

```js
// context-fixtures/sys_script.js
current.update();
// Both hosts: 1 no-br-current-update at `current.update()`.
```

```js
// context-fixtures/catalog-client.js
var gr = new GlideRecord("incident");
// Both hosts: 1 no-client-gliderecord at `new GlideRecord("incident")`.
```

```js
// context-fixtures/unknown.js, with javascriptMode:"es5" only
var when = gs.now();
var gr = new GlideRecord("incident");
gr.next();
// Both hosts: 0 no-gs-now, 0 require-query-before-next,
// 0 validate-gliderecord-calls.
```

```js
// context-fixtures/gs-alias.br.js
var clock = gs;
clock.now();
// Both hosts: 1 no-gs-now at `clock.now()`.
```

```js
// context-fixtures/escaped-gs.br.js
var clock = gs;
holder.clock = clock;
clock.now();
// Both hosts: 0 no-gs-now because provenance escaped before the call.
```

```js
// context-fixtures/mixed.ui-action.js, with explicit
// surfaces:["ui-action","client","server"]
function onClick() { g_form.save(); }
if (typeof window === "undefined") {
  var gr = new GlideRecord("incident");
  gr.get(current.sys_id);
}
// Both hosts: 0 no-client-gliderecord.
```

Add the same constructor in `client-only.ui-action.js` with explicit
`["ui-action", "client"]`; both hosts must report exactly once.

```js
// context-fixtures/full-script-current-update.br.js, with
// businessRuleSourceFormat:"full-script"
(function executeRule(current, previous) {
  current.update();
})(current, previous);
// Both hosts: 0 require-business-rule-wrapper;
// 1 no-br-current-update at `current.update()`.
```

```js
// context-fixtures/iterate-count-consumed.br.js
var count = 0;
var gr = new GlideRecord("incident");
gr.query();
while (gr.next()) count++;
gs.info(count);
gr.query();
while (gr.next()) gs.info(gr.number);
// Strict hosts: 1 prefer-glideaggregate at the first while statement.
```

```js
// context-fixtures/escaped-system-query.br.js
var gr = new GlideRecord("incident");
holder.record = gr;
gr.addSystemQuery("active", true);
// Both hosts: 0 no-system-query-bypass.
```

```js
// context-fixtures/self-system-query.br.js
var gr = new GlideRecord("incident");
gr.addSystemQuery(gr);
// Both hosts: 1 no-system-query-bypass at `gr.addSystemQuery(gr)`.
```

```js
// context-fixtures/custom-at.server.js, ES5
var cache = { at: function (key) { return key; } };
cache.at("incident");
// Both hosts: 0 no-at-method.
```

```js
// context-fixtures/builtin-at.server.js, ES5
var value = ["incident"].at(0);
// Both hosts: 1 no-at-method at `["incident"].at(0)`.
```

The settings-mutation and SourceCode-reuse contracts are programmatic. Test
them through `applyRules()` and real ESLint `Linter`; there is no meaningful
static Oxlint CLI mutation fixture. Oxlint fixtures above verify static setting
selection and filename parity.

**Verify**:
`npm run build && node scripts/run-tests.mjs tests/integration/context-contracts.test.ts tests/integration/flat-profiles.test.ts`
→ every applicable fixture has exact matching Oxlint and ESLint behavior.

### Step 13: Correct metadata, generate docs, and run all gates

Update `src/catalog.ts` examples and `src/catalog-metadata.ts` limitation
claims for only the changed rules. In particular:

- mixed UI Action suppression and unknown surfaces are known false negatives,
  not accepted false positives;
- a row-processing loop is outside `prefer-glideaggregate` proof, not a known
  false positive;
- user-defined `.at()` methods stay silent;
- canonical wrapper current is covered;
- deprecated validation does not run on unknown surfaces;
- dynamic provenance remains conservative.

Add one concise Unreleased `CHANGELOG.md` entry. Run the generator and commit its
outputs with the source metadata. Then run the complete validation command.

**Verify**:
`npm run docs && npm run docs:check && npm run validate && git diff --check && git status --short`
→ every command exits 0; status lists only in-scope files.

## Test plan

The focused suite must cover:

- settings: empty arrays, legacy exact mapping, every mixed UI Action shape,
  mutation of scalars and arrays, and unchanged-object behavior;
- filename: exact tokens, all documented conventions, conflicting hints,
  UI Action multi-surface evidence, Windows paths, and flat-glob parity;
- context gates: unknown, client, server, Business Rule, client-only UI Action,
  server-only UI Action, and mixed UI Action;
- `gs` provenance: direct global, valid alias, prior helper/storage escape,
  reassignment, shadowing, and the circular unknown-surface trigger;
- wrapper: exact IIFE, directive prologue, shadowed outer globals, renamed
  parameters, nested functions, body-only, and unknown format;
- aggregate preference: consumed counter, counter misuse, per-loop isolation,
  mixed loops, two count loops, aliases, and exact report node;
- bypass provenance: direct, alias, self argument, prior storage/helper escape,
  reassignment, shadowing, and computed members;
- `.at()`: direct built-ins, proven immutable aliases if supported, user methods,
  custom prototypes, parameters, mutable aliases, modes, and unknown context;
- complete rendered messages for every message ID in step 11;
- all exact real-host cases in step 12.

Use `tests/helpers/rule-tester.ts` for focused rule behavior. Real-host
acceptance must use the actual Oxlint executable and ESLint `Linter`, not only
`applyRules()`.

## Done criteria

All items must hold:

- [ ] Explicit empty surfaces and contradictory legacy surface combinations throw path-specific settings errors.
- [ ] One settings descriptor authority supplies keys, defaults, parsing, validated output, and cache-fingerprint input.
- [ ] The unused `objectOptionAt()` parser and re-export are removed.
- [ ] Filename markers use complete tokens and never combine incompatible non-UI-Action surfaces.
- [ ] Classifier conventions and flat-profile globs come from one maintained source.
- [ ] In-place settings mutation cannot reuse stale validation.
- [ ] Unknown surfaces stay silent for client/server/Business Rule diagnostics.
- [ ] `no-gs-now` reports only a proven unescaped global/alias on a non-inferred known surface.
- [ ] Mixed client/server UI Actions do not receive the file-wide client GlideRecord diagnostic.
- [ ] The exact full-script `executeRule(current, previous)` parameter is recognized as platform current.
- [ ] Every public client and Business Rule filename convention is selected by its flat profile.
- [ ] `prefer-glideaggregate` proves and reports each count-only loop independently and permits post-loop counter reads.
- [ ] `no-system-query-bypass` uses program-point provenance without a whole-program escape scan.
- [ ] User-defined `.at()` methods stay silent; proven built-in calls report in restricted modes.
- [ ] One confidence ordering drives both context ranking and surface applicability.
- [ ] Weak collection and weak reference rules use one tested constructor-rule factory without diagnostic changes.
- [ ] Every listed diagnostic states both the problem and the required action.
- [ ] All step 12 cases pass with exact equivalent Oxlint and ESLint results.
- [ ] Catalog limitations describe current behavior rather than known-fixed defects.
- [ ] `npm run docs:check`, `npm run validate`, and `git diff --check` exit 0.
- [ ] No out-of-scope file is modified.

## STOP conditions

Stop and report if:

- Plans 006, 008, 009, 010, or 011 are incomplete. Plan 010 is a direct delivery
  dependency through plan 011. Stop if their binding, temporal provenance,
  stateful message IDs, or generated-doc contracts differ from this plan.
- Plan 008 does not provide filename-sensitive cache identity and immutable
  program-point receiver snapshots. Return the issue to plan 008.
- The wrapper fix requires general function-call/parameter propagation rather
  than the exact canonical Business Rule IIFE.
- Mixed UI Action correctness appears to require branch/region classification.
  Keep conservative whole-file silence and report a follow-up; do not match
  `typeof window` by text.
- ESLint minimatch cannot represent a public filename convention without
  selecting unrelated classic files. Do not widen a profile to all JavaScript.
- Settings memoization changes path-specific validation errors, freezes the raw
  consumer object, or serializes before validation.
- Built-in `.at()` proof requires a new general type engine. Restrict to direct
  proven literals and report the boundary.
- Oxlint and ESLint disagree after source-offset normalization on rule ID,
  interpolated message, count, or exact semantic source slice.
- `npm run docs` changes unrelated generated content or appears to require a
  manual generated-file edit.
- Any verification fails twice after one reasonable correction.
- The fix requires a file outside Scope.

## Maintenance notes

- Unknown is not a weak client or server default. New rules must use shared
  applicability helpers and state their minimum confidence.
- Only UI Actions may intentionally carry client and server execution surfaces.
  Add execution-region precision later only with binding-aware control-flow proof.
- Add filename regex tokens and ESLint globs through the same descriptor and
  test both hosts in the same change.
- Do not cache mutable raw settings by identity. Cache validated immutable
  snapshots or rely on the complete per-file analysis cache.
- Keep canonical wrapper recognition narrow. It is platform storage shape, not
  a general interprocedural alias rule.
- Performance advice must describe the exact loop proved. Never turn a local
  loop fact into an object-lifetime claim.
- Plan 013 should preserve these corrected messages and metadata while it
  centralizes catalog ownership. Plan 014 should reuse the real-host fixtures
  as named evidence rather than replacing them with generic silence cases.
