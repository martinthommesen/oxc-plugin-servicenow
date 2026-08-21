# Plan 009: Rebuild stateful rule lifecycles on the corrected evaluator

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Do not improvise. This work is one implementation PR in the PR #51
> replacement stack. Do not update `plans/README.md`; the tracking-PR owner
> maintains the index.
>
> **Drift check (run first)**:
> `git diff --stat b87972a..HEAD -- src/glide src/analysis/query-before-next.ts src/analysis/glide-query-lifecycle.ts src/analysis/glideaggregate.ts src/analysis/glideajax-params.ts src/analysis/glide-setnocount.ts src/analysis/glide-windowing.ts src/analysis/cursor-condition.ts src/analysis/glide-query-in-loop.ts src/analysis/glide-bulk-filter.ts src/analysis/static-args.ts src/analysis/glide-element-collection.ts src/analysis/index.ts src/rules/no-glideelement-in-collection.ts src/rules/require-callback-for-getreference.ts src/rules/require-query-before-next.ts src/rules/validate-gliderecord-calls.ts src/rules/validate-glideaggregate-calls.ts src/rules/require-glideajax-sysparm-name.ts src/rules/prefer-setnocount-with-choosewindow.ts src/rules/no-gliderecord-query-modifier-after-query.ts src/rules/no-gliderecord-query-in-loop.ts src/rules/no-unfiltered-gliderecord-bulk-operation.ts src/rules/no-delete-multiple-with-windowing.ts src/catalog.ts src/catalog-metadata.ts tests/glide tests/rules/stateful-lifecycle.test.ts tests/rules/phase3.test.ts tests/rules/phase5.test.ts tests/rules/no-delete-multiple-with-windowing.test.ts tests/rules/require-callback-for-getreference.test.ts tests/rules/require-glideajax-sysparm-name.test.ts tests/rules/validate-glideaggregate-calls.test.ts tests/rules/layer3-consumers.test.ts tests/integration/stateful-host.test.ts tests/integration/stateful-fixtures tests/integration/stateful-configs CHANGELOG.md docs/rules README.md examples tests/integration/profiles/configs`
> Plans 007 and 008 intentionally change several listed analysis files. Compare
> their live consumer-neutral interfaces with the excerpts, then reproduce the
> lifecycle defects through the red tests in this plan. Stop if a dependency
> changed lifecycle policy, already fixed a finding incompatibly, or lacks the
> required per-path/unnamed-receiver seam. Do not revert expected dependency drift.

## Status

- **Status**: IN PROGRESS — implemented in PR #79; merge pending.
- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: `plans/006-freeze-and-restack-pr51.md`, `plans/007-rebuild-path-state-semantics.md`, `plans/008-fix-bindings-scopes-and-closures.md`
- **Category**: bug
- **Planned at**: commit `b87972a`, 2026-08-20

## Why this matters

The corrected evaluator from plans 007 and 008 is necessary but not sufficient.
Each stateful consumer still defines its own recovery, join, epoch, capability,
and uncertainty policy. Several policies lose definite defects, retain stale
state, or report valid ServiceNow code. This plan makes those policies explicit
and verifies them under both real Oxlint and real ESLint.

## Current state

The relevant implementation is split across these files:

- `src/analysis/query-before-next.ts` tracks the must-fact that a cursor is open.
- `src/analysis/glide-query-lifecycle.ts` tracks modifiers made after an open query.
- `src/analysis/glideaggregate.ts` tracks pending and committed aggregate tuples.
- `src/analysis/glideajax-params.ts` tracks `sysparm_name` and terminal requests.
- `src/analysis/glide-setnocount.ts` tracks window/count behavior by numeric epoch.
- `src/analysis/glide-windowing.ts` tracks windowing before bulk deletion.
- `src/analysis/cursor-condition.ts` proves cursor identities on loop-body entry.
- `src/analysis/glide-query-in-loop.ts` finds nested Glide queries.
- `src/analysis/glide-bulk-filter.ts` and `src/analysis/static-args.ts` classify filter evidence.
- `src/rules/no-glideelement-in-collection.ts` has a second cursor-loop walker.
- `src/rules/require-callback-for-getreference.ts` checks only callback nullishness.
- `src/glide/manifest.ts` stores method scope, but exports unconditional role sets.

At the planned commit, a later query cannot recover a branch join:

```ts
// src/analysis/query-before-next.ts:34-41
mergeData: (left, right) => ({
  queryState: left.queryState === right.queryState ? left.queryState : "unknown",
}),
onCall({ call, rec, objectName, property }) {
  if (!rec || !property) return;
  if (GLIDE_QUERY_EXECUTORS.has(property) && rec.data.queryState === "unopened") {
    rec.data.queryState = "opened";
  }
```

The modifier rule uses must-style joins for a may-risk diagnostic:

```ts
// src/analysis/glide-query-lifecycle.ts:32-47
mergeData: (left, right) => ({
  opened: mergeTri(left.opened, right.opened),
  pending: mergeTri(left.pending, right.pending),
}),
// ...
if (GLIDE_RESULT_CONSUMERS.has(property) && rec.data.pending === true) {
  findings.push({ node: call, name: objectName, method: property });
}
```

GlideAggregate has one sticky dynamic flag for all query epochs:

```ts
// src/analysis/glideaggregate.ts:14-19,82-91
interface AggData {
  queried: boolean | "unknown";
  committed: Set<string>;
  pending: Set<string>;
  dynamicAggregate: boolean;
}
// ...
if (property === "query") {
  rec.data.committed = cloneSet(rec.data.pending);
  rec.data.queried = true;
}
if (property === "getAggregate" && rec.data.queried === true && !rec.data.dynamicAggregate) {
```

GlideAjax collapses absent keys into uncertainty and never opens a clean second
configuration epoch:

```ts
// src/analysis/glideajax-params.ts:73-96
if (property === "addParam") {
  if (rec.data.terminal === true) {
    findings.push({ node: call, name: objectName, messageId: "afterTerminal" });
  }
  const key = getStringValue(call.arguments[0]);
  if (key === null) {
    rec.data.sysparmName = mergeSysparm(rec.data.sysparmName, "unknown");
    rec.data.uncertain = true;
  }
  // ...
}
// ...
rec.data.terminal = true;
rec.data.sysparmName = false;
```

The count rule uses an unrecoverable `-1` epoch and a global use set:

```ts
// src/analysis/glide-setnocount.ts:33-35,50-52,64-68,116-119
function mergeEpoch(left: number, right: number): number {
  return left === right ? left : -1;
}
const pending: PendingFinding[] = [];
const usedRowCount = new Set<string>();
// ...
queryEpoch: mergeEpoch(left.queryEpoch, right.queryEpoch),
// ...
if (usedRowCount.has(`${item.objectId}:${item.epoch}`)) continue;
```

The method registry records scope and then discards it:

```ts
// src/glide/manifest.ts:32-37,82-85,104-107
export interface GlideMethodCapability {
  name: string;
  roles: readonly GlideMethodRole[];
  evidence: string;
  apiScope: GlideApiScope;
}
method("getAsync", ["executor"], {
  apiScope: "global",
  evidence: GLIDE_GLOBAL_RECORD_EVIDENCE,
}),
function namesWithRole(role: GlideMethodRole): Set<string> {
  return new Set(
    GLIDE_RECORD_METHODS.filter((entry) => entry.roles.includes(role)).map((entry) => entry.name),
  );
}
```

Static arguments do not distinguish a string from other literals:

```ts
// src/analysis/static-args.ts:26-31
if (literalNode.type === "Literal" || literalNode.type === "StringLiteral") {
  const literal = literalNode.value;
  if (literal === "" || literal === null || literal === undefined) return "empty";
  if (typeof literal === "string") return literal.length > 0 ? "present" : "empty";
  return "present";
}
```

The collection rule rejects a truthy condition that proves two cursors and
visits a `do/while` body twice without deduplication:

```ts
// src/rules/no-glideelement-in-collection.ts:74-82,127-135
const ids = new Set<number>();
// ...
if (!truthyPathRequiresCursorNext(node, collect) || ids.size !== 1) return null;
// ...
visit(statement.body, cursorIds);
visit(statement.test, cursorIds);
visit(statement.body, nextIds);
```

Callback validation accepts every statically non-null second argument:

```ts
// src/rules/require-callback-for-getreference.ts:52-57
if (call.arguments.some((argument) => argument.type === "SpreadElement")) return;
const callback = call.arguments[1];
if (call.arguments.length >= 2 && !isNullishCallback(callback, analysis)) return;
context.report({ node, messageId: "missingCallback" });
```

Repository rules that govern this work:

- `CONTRIBUTING.md` requires `createOnce`, `beginRuleFile()`, binding and
  provenance proof, conservative silence for unknown provenance, mode, or
  surface, actionable diagnostics, catalog updates, `npm run docs`, and
  `npm run validate`.
- Generated rule pages, README rule tables, and recommended Oxlint configs must
  come from `npm run docs`. Do not edit them manually.
- Plans 007 and 008 own JavaScript execution order, completions, fixed points,
  bindings, temporal escape, cache identity, and immutable analysis products.
  Do not add consumer-specific workarounds to `path-state.ts` or `bindings.ts`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `npm ci` | exit 0 |
| Focused unit tests | `node scripts/run-tests.mjs tests/glide/manifest.test.ts tests/rules/stateful-lifecycle.test.ts tests/rules/phase3.test.ts tests/rules/phase5.test.ts tests/rules/no-delete-multiple-with-windowing.test.ts tests/rules/require-callback-for-getreference.test.ts tests/rules/require-glideajax-sysparm-name.test.ts tests/rules/validate-glideaggregate-calls.test.ts` | all listed tests pass |
| Real-host tests | `node scripts/run-tests.mjs tests/integration/stateful-host.test.ts` | Oxlint and ESLint cases pass |
| Typecheck | `npm run typecheck` | exit 0, no errors |
| Generate docs | `npm run docs` | exit 0 |
| Full validation | `npm run validate` | exit 0 |

## Scope

**In scope** (the only source and hand-written test files to modify):

- `src/glide/manifest.ts`
- `src/glide/query-methods.ts`
- `src/glide/index.ts`
- `src/analysis/query-before-next.ts`
- `src/analysis/glide-query-lifecycle.ts`
- `src/analysis/glideaggregate.ts`
- `src/analysis/glideajax-params.ts`
- `src/analysis/glide-setnocount.ts`
- `src/analysis/glide-windowing.ts`
- `src/analysis/cursor-condition.ts`
- `src/analysis/glide-query-in-loop.ts`
- `src/analysis/glide-bulk-filter.ts`
- `src/analysis/static-args.ts`
- `src/analysis/glide-element-collection.ts`
- `src/analysis/index.ts`
- `src/rules/no-glideelement-in-collection.ts`
- `src/rules/require-callback-for-getreference.ts`
- `src/rules/require-query-before-next.ts`
- `src/rules/validate-gliderecord-calls.ts`
- `src/rules/validate-glideaggregate-calls.ts`
- `src/rules/require-glideajax-sysparm-name.ts`
- `src/rules/prefer-setnocount-with-choosewindow.ts`
- `src/rules/no-gliderecord-query-modifier-after-query.ts`
- `src/rules/no-gliderecord-query-in-loop.ts`
- `src/rules/no-unfiltered-gliderecord-bulk-operation.ts`
- `src/rules/no-delete-multiple-with-windowing.ts`
- `src/catalog.ts` and `src/catalog-metadata.ts`, only for changed examples,
  evidence, and limitation claims.
- `tests/glide/manifest.test.ts`
- `tests/rules/stateful-lifecycle.test.ts`
- `tests/rules/phase3.test.ts`
- `tests/rules/phase5.test.ts`
- `tests/rules/no-delete-multiple-with-windowing.test.ts`
- `tests/rules/require-callback-for-getreference.test.ts`
- `tests/rules/require-glideajax-sysparm-name.test.ts`
- `tests/rules/validate-glideaggregate-calls.test.ts`
- `tests/rules/layer3-consumers.test.ts`
- `tests/integration/stateful-host.test.ts` (create)
- `tests/integration/stateful-fixtures/**` (create)
- `tests/integration/stateful-configs/**` (create)
- `CHANGELOG.md`
- Outputs changed by `npm run docs`: `docs/rules/*.md`, `README.md`,
  `examples/**/.oxlintrc.json`, and `tests/integration/profiles/configs/*.oxlintrc.json`.

**Out of scope**:

- `src/analysis/path-state.ts`, `src/analysis/bindings.ts`,
  `src/analysis/file-analysis.ts`, and `src/analysis/provenance.ts`; plans 007 and
  008 own them.
- Fluent import, `Now.ID`, and directive semantics; plans 010 and 011 own them.
- Context inference, profile globs, and general rule applicability; plan 012 owns them.
- Test-ledger generation, the final cross-rule matrix, and compatibility claims;
  plan 014 owns them.
- Release workflows, package publication, or governance evidence.
- New ServiceNow APIs without a primary evidence URL.

## Git workflow

Plan 006 creates the stack branch and draft pull request before this work starts.
Do not create another branch or pull request.

1. Read plan 009 in `docs/pr-51-stack.json` and run its documented ownership validator. Use the manifest only for expected branch/base topology, archived ownership, reconstruction commit, and rollback rule.
2. Run `gh stack view --json`. Confirm that `pr51-remediation/009-stateful-rule-lifecycles` exists above `pr51-remediation/008-bindings-scopes` and remains draft.
3. Run `gh pr view` for this draft PR. Compare its live URL, base SHA, head SHA, status, and current check run with the PR body and the PR #51 tracking body. Do not compare mutable head data with `docs/pr-51-stack.json`.
4. Fetch `origin` and check out the existing plan 009 branch.
5. Stop on an ownership/topology mismatch or when live PR data disagrees with the PR/tracking body. Return to plan 006 instead of repairing the stack here.

Use one commit per green logical step. Follow the repository's conventional style, for example `fix: recover stateful query epochs` and `test: add stateful real-host fixtures`.
Do not push or update the draft pull request unless the operator instructs you.

## Steps

### Step 1: Add capability views that retain scope and release

Replace unconditional role sets as the analysis authority with an immutable
`GlideCapabilityView` selected by `{ scope, release }`. Do not reuse `apiScope`
as availability: it currently records the documentation page that supplied the
entry. Add an evidence-backed `supportedScopes` field or equivalent availability
data. The selector must:

1. Use the validated `ServiceNowRelease`; use `GLIDE_API_RELEASE` when the
   setting is omitted.
2. Include scoped methods for `scope: "scoped"`.
3. Include scoped plus global-only methods for `scope: "global"`.
4. For `scope: "unknown"`, include only methods documented for scoped use.
   Unknown scope must not let a global-only call prove a protocol transition.
5. Filter by explicit release metadata before deriving `executors`, `filters`,
   `modifiers`, `consumers`, `bulk`, `valueExtractors`, and `knownMethods`.
6. Return readonly sets and cache only by the complete `{ scope, release }` key.

Keep the existing exported constants as deprecated compatibility snapshots if
plan 013 has not narrowed the public API yet. Stateful rules must stop using
those constants. Give every analysis entry point either the selected view or
its exact method set. Do not read global settings from inside generic analysis.

Add manifest tests for scoped, global, unknown, and the supported release. Add a
compile-time exhaustive check so a new supported release cannot omit capability
selection. Plan 010 can add later platform releases without changing consumer APIs.

**Verify**:
`node scripts/run-tests.mjs tests/glide/manifest.test.ts && npm run typecheck`
→ all tests pass and typecheck exits 0.

### Step 2: Define recovery and may-risk joins

In `query-before-next.ts`, every proven selected executor must assign
`queryState = "opened"`, including after `"unknown"`. A consumer still reports
when any reachable state is `"unopened"` or `"unknown"`.

In `glide-query-lifecycle.ts`, name the abstract state by meaning. The rule asks
whether **any** reachable open-result path has a modifier that was not followed
by another selected executor. Its join is therefore logical OR for risk. A
selected executor clears the risk on that path. A result consumer reports once
when risk is possible on any reaching path. Preserve conservative escape and
invalid-receiver suppression from plans 007 and 008.

Remove `objectName` as a semantic precondition in every touched analysis. Use
`objectName ?? "record"` only when constructing a finding. Complex receivers
that resolve to one ObjectId must participate.

Add unit cases for:

- one conditional query, then one unconditional query, then `next()` (valid);
- late modifier, conditional re-query, then `next()` (one `lateModifier`);
- late modifier followed by an unconditional re-query (valid);
- the same cases through an alias and a proven conditional/sequence receiver.

**Verify**:
`node scripts/run-tests.mjs tests/rules/stateful-lifecycle.test.ts tests/rules/phase3.test.ts`
→ all tests pass.

### Step 3: Preserve GlideAggregate alternatives across result epochs

Replace the sticky object-level `dynamicAggregate` Boolean with path-local
pending and committed domains. A domain alternative contains:

- the definite static tuples registered for future queries;
- whether that same alternative has a dynamic registration;
- the static tuples committed by its last `query()`;
- whether that committed result includes a dynamic registration;
- whether a result is queried.

`addAggregate()` changes only pending configuration. `query()` atomically
copies pending static and dynamic state into the committed result. A call after
`query()` cannot affect the open result, but it participates in the next query.

Preserve alternatives at branch joins, with structural deduplication. At an
exact `getAggregate()` read:

- report once if any queried alternative has no dynamic committed registration
  and definitely lacks the tuple;
- stay silent only when every queried alternative either definitely contains
  the tuple or is genuinely dynamic;
- report `missingQuery` if any reaching alternative is not queried.

Two renamed merged Booleans are insufficient because they lose which path
carries dynamic evidence. Keep the alternative set finite through plan 007's
consumer-domain equality/widening contract. Stop instead of adding an unbounded
path list.

The current suite documents cumulative static registrations across later
queries. Apply the same retention policy to dynamic registrations unless
primary ServiceNow evidence establishes a reset operation. Therefore, a dynamic
registration made after query does not affect the current result, but becomes
committed and conservative after the next query. Do not claim that a later
query on the same object becomes fully static without a documented reset. A new
GlideAggregate object starts with clean pending and committed state.

Add cases for dynamic-before-query, dynamic-after-query/current-result,
dynamic-after-query/next-result, static tuple retention, branch alternatives,
new-object reset, aliases, early return, switch, and `try/finally`. The abrupt
cases validate plan 007; do not reimplement control flow.

**Verify**:
`node scripts/run-tests.mjs tests/rules/validate-glideaggregate-calls.test.ts tests/rules/stateful-lifecycle.test.ts`
→ all aggregate lifecycle tests pass.

### Step 4: Model independent GlideAjax request epochs

First record primary ServiceNow evidence that one GlideAjax instance can send
more than one request. If the API is single-use or reuse is not established,
stop and report instead of guessing. With reuse established, replace the sticky
terminal Boolean with an explicit request state: `configuring` or `sent`, plus
per-epoch `sysparm_name` evidence. The first `addParam()` after `sent` begins a
new `configuring` epoch before it applies the parameter. Two complete requests
on one object are valid.

Classify keys and values separately:

- Missing, `null`, the platform `undefined`, `void`, empty string, Boolean,
  number, object, and array keys definitely do not name `sysparm_name`.
- A non-empty static string key can be `sysparm_name`, another `sysparm_*`, or a
  definite bad prefix.
- A dynamic key remains uncertain and suppresses only conclusions that depend
  on which key it names.
- A `sysparm_name` value is usable only when it is a non-empty static string.
  Missing, nullish, or empty values report `emptyValue`. Boolean, number,
  object, or array values report the new `invalidValue` on that `addParam()`
  call. Dynamic values remain conservative. Both messages tell the user to
  pass a non-empty method string.

A terminal call consumes the current epoch. A second terminal without new
configuration reports `missingName`. Remove `afterTerminal`: no documented
reachable shape distinguishes a late mutation of the old request from setup of
a supported next epoch. Remove its catalog metadata and tests. If primary
evidence contradicts this decision, stop rather than preserving a sticky flag.
At joins, a known missing or invalid alternative still reports even when a
different alternative has a dynamic key; uncertainty suppresses only the
alternative that carries it.

Add exact cases for missing/null/non-string keys, invalid values, dynamic keys,
nested argument setup, two valid requests, and a second terminal without a new
name.

**Verify**:
`node scripts/run-tests.mjs tests/rules/require-glideajax-sysparm-name.test.ts tests/rules/stateful-lifecycle.test.ts`
→ all GlideAjax tests pass.

### Step 5: Replace numeric count epochs with path-local query-result state

Remove `queryEpoch`, `mergeEpoch()`, the `-1` sentinel, and the global
`usedRowCount` key set from `glide-setnocount.ts`. Track only the facts needed
for the pending query and the current result on each evaluator state:

- pending `chooseWindow` evidence;
- pending definite `setNoCount`/documented count-skip evidence;
- pending `forceCount` evidence;
- current-result candidate finding identity;
- whether that exact reachable result path calls `getRowCount()`.

Only `query()` is evidence-backed for the `chooseWindow` count diagnostic at
this commit. `get()` and `getAsync()` must not emit a message that claims
`query()` performs `COUNT(*)`. Keep their executor roles for cursor rules when
the selected capability view includes them, but give this analysis a narrower
`COUNT_QUERY_EXECUTORS` set backed by primary evidence.

At joins, retain separate candidate identities or attach a small immutable
result token to each path. Do not use `(ObjectId, integer)` as global identity.
Treat this as a reachable performance risk: conditional `chooseWindow()` before
an unconditional `query()` reports for the windowed path, and conditional
`setNoCount()` reports for the unskipped path. A `getRowCount()` on one branch
may suppress only the candidate on that branch. Finalize unmatched candidates
when a later query replaces the result and on every normal or abrupt program
exit. A later unconditional `query()` must create a fresh, analyzable result
after branches executed different numbers of earlier queries.

Clarify `glide-windowing.ts` at the same time. First record primary evidence
for whether `setLimit()`/`chooseWindow()` configuration remains relevant to
`deleteMultiple()` after intervening query epochs. If retention is not
established, stop and report. With evidence, preserve a may-risk when any
reaching path configured windowing that bulk deletion ignores; a query must not
accidentally erase that evidence. Cite the transition beside the implementation.
Change the current `phase5.test.ts` case that treats one-branch
`chooseWindow()` as valid. It must report the reachable windowed query path.
Add its paired conditional `setNoCount()` case and a valid case where every
query-reaching path definitely skips the count.

**Verify**:
`node scripts/run-tests.mjs tests/rules/phase5.test.ts tests/rules/stateful-lifecycle.test.ts tests/rules/no-delete-multiple-with-windowing.test.ts`
→ all window/count tests pass.

### Step 6: Unify cursor-loop proofs and identities

Change `truthyPathRequiresCursorNext()` from a Boolean callback contract to a
proof result that carries the set of ObjectIds required for truthy body entry.
Use the reachability facts supplied by plan 007:

- `a.next() && b.next()` proves both cursor identities;
- `false || a.next()` proves `a`;
- `condition ? a.next() : false` proves `a` on body entry;
- `a.next() || unknown` and `unknown ?? a.next()` do not prove `a`;
- `null ?? a.next()` and `a.next() ?? fallback` prove `a` on truthy entry
  because a documented `next()` result is non-nullish Boolean;
- a sequence uses the truthiness of its final expression.

Use one loop traversal for both query-in-loop and GlideElement collection
analysis. It must model:

- `while` test identities;
- the first and later `do/while` iterations without duplicate findings;
- `for` test identities;
- `for` update `.next()` identities for the second and later body iterations;
- nested loops and multiple simultaneously active cursors;
- function boundaries that clear active cursor identities.

Deduplicate findings by AST node and message ID before returning them. Delete
or delegate the duplicate traversal in `no-glideelement-in-collection.ts`; the
rule adapter should report results from `glide-element-collection.ts`.

**Verify**:
`node scripts/run-tests.mjs tests/rules/phase3.test.ts tests/rules/stateful-lifecycle.test.ts`
→ cursor-loop and collection tests pass.

### Step 7: Validate bulk-filter call shapes and callback callability

Replace generic literal `"present"` evidence with typed evidence such as
`missing`, `emptyString`, `nonEmptyString`, `nonStringLiteral`, and `dynamic`.
The platform `undefined` check must be binding-aware. A shadowed local named
`undefined` is dynamic, not automatically empty.

Apply method-specific bulk filter shapes:

- encoded-query methods require a non-empty static string for definite proof;
- field methods require a non-empty static field string in their first position;
- `addJoinQuery` requires a non-empty static joined-table string;
- `addActiveQuery()` is restricting without arguments;
- documented dynamic input remains uncertain and silent;
- missing, empty, nullish, Boolean, numeric, object, and array values do not
  prove a restriction.

Do not invent signatures. Put the primary API URL beside the capability entry
or validator and add one test for every accepted documented shape.

For `getReference`, add a binding-aware static callability classifier:

- function and arrow expressions are callable;
- a proven function declaration or function-valued immutable binding is callable;
- identifiers or members of unknown value stay conservative;
- missing, nullish, Boolean, number, string, object, and array literals report;
- spreads preserve unknown runtime arity and stay silent.

Use `missingCallback` for absence/nullishness and add `invalidCallback` for a
statically non-callable second argument. Its text must tell the user to pass a
function. Update catalog examples and limitations.

**Verify**:
`node scripts/run-tests.mjs tests/rules/stateful-lifecycle.test.ts tests/rules/require-callback-for-getreference.test.ts`
→ all filter and callback cases pass.

### Step 8: Complete GlideElement collection semantics

The unified collection analysis must use ObjectIds, not identifier spelling.
It must recursively inspect values placed directly into `push()` or `unshift()`
through object literals, array literals, spreads whose literal contents are
known, and transparent expression wrappers. Report the innermost retained
GlideElement once.

Do not classify manifest methods as fields. Derive the cursor-member exclusion
set from the selected `knownMethods`/roles so `getAsync` and future executors do
not drift from the manifest.

An extraction is safe only when proven:

- `gr.getValue()`, `getDisplayValue()`, or `getUniqueValue()` is a manifest
  value extractor;
- `gr.field.toString()` is called on the field expression;
- `String(gr.field)` resolves to the unshadowed standard global.

A local `String` function must not suppress a finding. Unknown computed fields
and unknown helper returns remain conservative. Add multi-cursor, nested
literal, alias, static computed member, global/shadowed `String`, `getAsync`
member, nested loop, `do/while`, and `for`-update cases.

**Verify**:
`node scripts/run-tests.mjs tests/rules/phase3.test.ts tests/rules/layer3-consumers.test.ts`
→ all collection cases pass with no duplicate range.

### Step 9: Add exact real Oxlint and ESLint regression fixtures

Create `tests/integration/stateful-host.test.ts`. Run the same on-disk fixture
through the real Oxlint binary with `runOxlint()` and ESLint `Linter.verify()`.
Use a one-rule config for each assertion so unrelated diagnostics cannot hide a
count mismatch. Compare:

- exact rule ID;
- ESLint `messageId`;
- exact interpolated message in both hosts;
- exact count;
- exact start offset and length for the unique target substring;
- line and column derived from that offset.

For each case, construct an ESLint flat config containing only the target rule,
the plugin, and the same `settings.servicenow` object used by the matching
one-rule Oxlint JSON config. Build the plugin before invoking Oxlint. Do not use
recommended/strict presets as the ESLint counterpart. Normalize both hosts to
source offsets, then compare the exact source slice rather than raw host column conventions.

Create the following exact fixtures. The comment after each fixture states the
required target rule, count, and unique target substring.

```js
// valid/query-recovery.br.js — require-query-before-next, 0
var gr = new GlideRecord("incident");
if (preload) gr.query();
gr.query();
gr.next();
```

```js
// invalid/modifier-may-risk.br.js — no-gliderecord-query-modifier-after-query,
// 1 lateModifier at `gr.next()`
var gr = new GlideRecord("incident");
gr.query();
gr.orderBy("number");
if (rerun) gr.query();
gr.next();
```

```js
// invalid/aggregate-late-dynamic.br.js — validate-glideaggregate-calls,
// 1 unknownAggregate at `ga.getAggregate("SUM", "amount")`
var ga = new GlideAggregate("incident");
ga.addAggregate("COUNT");
ga.query();
ga.addAggregate(kind);
ga.getAggregate("SUM", "amount");
```

```js
// invalid/ajax-missing-key.client.js — require-glideajax-sysparm-name,
// 1 missingName at `ajax.getXMLAnswer(handle)`
var ajax = new GlideAjax("x_acme.Lookup");
ajax.addParam();
ajax.getXMLAnswer(handle);
```

```js
// invalid/ajax-null-key.client.js — require-glideajax-sysparm-name,
// 1 missingName at `ajax.getXMLAnswer(handle)`
var ajax = new GlideAjax("x_acme.Lookup");
ajax.addParam(null, "lookup");
ajax.getXMLAnswer(handle);
```

```js
// invalid/ajax-non-string.client.js — require-glideajax-sysparm-name,
// 1 invalidValue at `ajax.addParam("sysparm_name", false)`
var ajax = new GlideAjax("x_acme.Lookup");
ajax.addParam("sysparm_name", false);
ajax.getXMLAnswer(handle);
```

```js
// valid/ajax-two-epochs.client.js — require-glideajax-sysparm-name, 0
var ajax = new GlideAjax("x_acme.Lookup");
ajax.addParam("sysparm_name", "lookupManager");
ajax.getXMLAnswer(handleManager);
ajax.addParam("sysparm_name", "lookupDepartment");
ajax.getXMLAnswer(handleDepartment);
```

```js
// invalid/count-branch-use.br.js — prefer-setnocount-with-choosewindow,
// 1 missing at the first branch's `gr.query()`
var gr = new GlideRecord("incident");
if (flag) {
  gr.chooseWindow(0, 100);
  gr.query();
} else {
  gr.chooseWindow(0, 100);
  gr.query();
  gr.getRowCount();
}
```

```js
// invalid/count-epoch-recovery.br.js — prefer-setnocount-with-choosewindow,
// 1 missing at the final `gr.query()`
var gr = new GlideRecord("incident");
if (preload) gr.query();
gr.chooseWindow(0, 100);
gr.query();
```

```js
// invalid/two-cursors.br.js — no-glideelement-in-collection,
// 1 retained at `a.number`
var values = [];
var a = new GlideRecord("incident");
var b = new GlideRecord("task");
a.query();
b.query();
while (a.next() && b.next()) values.push(a.number);
```

```js
// invalid/for-update-cursor.br.js — no-gliderecord-query-in-loop,
// 1 nestedQuery at `inner.query()`
var cursor = new GlideRecord("incident");
var inner = new GlideRecord("task");
cursor.query();
for (; keepGoing; cursor.next()) {
  inner.query();
}
```

```js
// invalid/nested-collection.br.js — no-glideelement-in-collection,
// 1 retained at `gr.number`
var values = [];
var gr = new GlideRecord("incident");
gr.query();
while (gr.next()) values.push({ fields: [gr.number] });
```

```js
// invalid/shadowed-string.br.js — no-glideelement-in-collection,
// 1 retained at `gr.number`
function String(value) { return value; }
var values = [];
var gr = new GlideRecord("incident");
gr.query();
while (gr.next()) values.push(String(gr.number));
```

```js
// invalid/malformed-filter.br.js — no-unfiltered-gliderecord-bulk-operation,
// 1 unfiltered at `gr.deleteMultiple()`
var gr = new GlideRecord("incident");
gr.addEncodedQuery(false);
gr.deleteMultiple();
```

```js
// invalid/non-callable-callback.client.js — require-callback-for-getreference,
// 1 invalidCallback at `g_form.getReference("caller_id", false)`
g_form.getReference("caller_id", false);
```

Use dedicated scoped/global configs for this exact capability pair:

```js
// invalid/scoped-getasync.br.js with settings {authoring:"classic",
// surfaces:["server"], scope:"scoped", release:"zurich"}
// require-query-before-next: 1 missingQuery at `gr.next()`
var gr = new GlideRecord("incident");
gr.getAsync(id);
gr.next();
```

```js
// valid/global-getasync.br.js with settings {authoring:"classic",
// surfaces:["server"], scope:"global", release:"zurich"}
// require-query-before-next: 0
var gr = new GlideRecord("incident");
gr.getAsync(id);
gr.next();
```

```js
// invalid/cursor-reachability.br.js — no-gliderecord-query-in-loop,
// 2 nestedQuery findings, one at each unique `inner.query()`
var outerA = new GlideRecord("incident");
var innerA = new GlideRecord("task");
outerA.query();
while (false || outerA.next()) innerA.query();
var outerB = new GlideRecord("incident");
var innerB = new GlideRecord("task");
outerB.query();
while (flag ? outerB.next() : false) innerB.query();
```

```js
// invalid/collection-do-while-dedup.br.js — no-glideelement-in-collection,
// exactly 1 retained at `outer.number`
var values = [];
var outer = new GlideRecord("incident");
var inner = new GlideRecord("task");
outer.query();
inner.query();
while (outer.next()) {
  do {
    values.push(outer.number);
  } while (inner.next());
}
```

```js
// invalid/count-divergent-window.br.js — prefer-setnocount-with-choosewindow,
// exactly 2 missing findings: the conditional and final `gr.query()` calls
var gr = new GlideRecord("incident");
gr.chooseWindow(0, 100);
if (flag) gr.query();
gr.chooseWindow(100, 200);
gr.query();
```

```js
// invalid/count-conditional-window.br.js — prefer-setnocount-with-choosewindow,
// exactly 1 missing at `gr.query()`
var gr = new GlideRecord("incident");
if (page) gr.chooseWindow(0, 100);
gr.query();
```

```js
// invalid/count-conditional-skip.br.js — prefer-setnocount-with-choosewindow,
// exactly 1 missing at `gr.query()` for the reachable unskipped alternative
var gr = new GlideRecord("incident");
gr.chooseWindow(0, 100);
if (skip) gr.setNoCount(true);
gr.query();
```

Use the same source with a one-rule `no-gliderecord-query-in-loop` config under
explicit `scope: "global"` and `scope: "scoped"`:

```js
// stateful-fixtures/nested-getasync.br.js
var outer = new GlideRecord("incident");
var inner = new GlideRecord("task");
outer.query();
while (outer.next()) inner.getAsync(id);
// Global: 1 nestedQuery at `inner.getAsync(id)`.
// Scoped: 0 because the global-only executor is unsupported.
```

Create the following exact complex-receiver fixtures. Each runs with only its
named target rule and expects one finding at the unique conditional-receiver call:

```js
// invalid/complex-bulk.br.js — no-unfiltered-gliderecord-bulk-operation,
// 1 unfiltered at `(flag ? gr : gr).deleteMultiple()`
var gr = new GlideRecord("incident");
(flag ? gr : gr).deleteMultiple();
```

```js
// invalid/complex-aggregate.br.js — validate-glideaggregate-calls,
// 1 missingQuery at `(flag ? ga : ga).next()`
var ga = new GlideAggregate("incident");
(flag ? ga : ga).next();
```

```js
// invalid/complex-ajax.client.js — require-glideajax-sysparm-name,
// 1 missingName at `(flag ? ajax : ajax).getXMLAnswer(handle)`
var ajax = new GlideAjax("x_acme.Lookup");
(flag ? ajax : ajax).getXMLAnswer(handle);
```

```js
// invalid/complex-modifier.br.js — no-gliderecord-query-modifier-after-query,
// 1 lateModifier at `(flag ? gr : gr).next()`
var gr = new GlideRecord("incident");
gr.query();
gr.orderBy("number");
(flag ? gr : gr).next();
```

```js
// invalid/complex-window.br.js — no-delete-multiple-with-windowing,
// 1 windowed at `(flag ? gr : gr).deleteMultiple()`
var gr = new GlideRecord("incident");
gr.setLimit(10);
(flag ? gr : gr).deleteMultiple();
```

```js
// invalid/complex-count.br.js — prefer-setnocount-with-choosewindow,
// 1 missing at `(flag ? gr : gr).query()`
var gr = new GlideRecord("incident");
gr.chooseWindow(0, 100);
(flag ? gr : gr).query();
```

**Verify**:
`npm run build && node scripts/run-tests.mjs tests/integration/stateful-host.test.ts`
→ every fixture has equivalent normalized rule ID, semantic source slice,
interpolated message, and count; ESLint also has the exact message ID.

### Step 10: Update catalog claims, generated docs, and the changelog

Update only metadata affected by these rules. Remove claims contradicted by the
new tests. Document dynamic/escape conservative boundaries, request epochs,
method-specific static evidence, selected scope/release behavior, per-branch
count use, and nested literal collection coverage. Ensure every message tells
the user what to do.

Add one concise `CHANGELOG.md` Unreleased entry for corrected false positives
and false negatives. Run the generator; do not edit generated files by hand.

**Verify**:
`npm run docs && npm run docs:check`
→ both commands exit 0 and generated outputs are clean.

### Step 11: Run the full repository gate

Run `npm run validate`. Review `git diff --check` and confirm only in-scope files
changed. Commit generated outputs with their source metadata changes.

**Verify**:
`npm run validate && git diff --check && git status --short`
→ validation and whitespace checks exit 0; status lists only in-scope files.

## Test plan

Unit tests must cover every transition and join, not only end-to-end examples:

- Query: unknown-to-opened recovery, alias recovery, complex receiver, and selected executors.
- Modifier: unsafe-path OR join, repaired-path reset, repeated result consumers, and escape.
- Aggregate: pending/committed static and dynamic epochs across branches and abrupt control flow.
- GlideAjax: missing/null/non-string/dynamic key and value classes, nested setup, repeated valid requests, and missing second name.
- Count/window: branch-local count consumption, later recovery, `forceCount`, setNoCount, setLimit, query-only evidence, and bulk-delete may-risk.
- Capability: scoped/global/unknown and every supported release.
- Cursor: Boolean reachability, multiple identities, all loop forms, nested loops, function boundaries, and deduplication.
- Bulk: every documented valid signature plus each malformed literal shape.
- Callback: statically callable, statically non-callable, unknown, spread, alias, and shadowed `undefined`.
- Collection: direct and nested values, aliases, multiple cursors, method exclusions, extractor proof, and shadowed `String`.

The real-host fixtures in step 9 are mandatory acceptance tests. Internal
`applyRules()` tests alone are insufficient.

## Done criteria

All items must hold:

- [ ] Plans 007 and 008 are merged into this branch, and their foundation tests remain green.
- [ ] A definite executor recovers query state after every branch join.
- [ ] Modifier risk survives if any reachable path consumes a stale result.
- [ ] GlideAggregate has separate pending and committed static/dynamic state.
- [ ] GlideAjax accepts two complete requests and diagnoses definite invalid keys/values.
- [ ] Count findings are path-local and recover after divergent earlier query counts.
- [ ] `get()`/`getAsync()` do not receive an unsupported COUNT claim.
- [ ] Executor selection uses both scope and release; scoped `getAsync` cannot prove an open cursor.
- [ ] Cursor-loop proofs carry all ObjectIds and cover `for` updates and nested loops.
- [ ] Malformed filter literals do not prove a restricted bulk operation.
- [ ] Statically non-callable `getReference` callbacks report.
- [ ] Nested GlideElements and shadowed `String` report once at the exact field range.
- [ ] Every step 9 fixture passes with equivalent normalized rule ID, semantic range, message, and count, plus exact ESLint message ID.
- [ ] `npm run docs:check` and `npm run validate` exit 0.
- [ ] `git diff --check` exits 0 and no out-of-scope file is modified.

## STOP conditions

Stop and report if:

- Plan 006 has not reconstructed the real stack, plans 007 or 008 are
  incomplete, or `analyzePathBindings()` still evaluates
  calls before their receiver/arguments, loses completions, or lacks the
  fixed-point/state contract required by this plan.
- A consumer fix requires a special-case change to `path-state.ts` or bindings.
- Plan 007 does not expose all normal and abrupt completion exit states, or an
  equivalent consumer-neutral finalization hook. Do not add that seam in plan 009.
- Primary ServiceNow evidence does not establish which executors affect the
  `chooseWindow` COUNT behavior. Restrict the rule to proven `query()`; do not guess.
- Primary evidence does not establish GlideAjax object reuse, method availability
  by scope, or window/limit retention across query and bulk-delete transitions.
  Do not derive availability from the page named by `apiScope`.
- A proposed capability behavior cannot distinguish scoped, global, and unknown scope.
- The actual published plan 010 release model makes this plan's release selector
  incompatible. Coordinate the interface; do not create a second registry.
- Oxlint and ESLint disagree after normalization on rule ID, interpolated
  message, count, or exact semantic source slice.
- `npm run docs` changes unrelated rule pages, example configs, or profile
  configs. Do not accept unrelated generated churn.
- A touched message ID must be removed or renamed but a public compatibility
  requirement forbids it. Report the compatibility decision needed.
- Any verification fails twice after one reasonable correction.
- The fix requires a file outside Scope.

## Maintenance notes

- Stateful analysis must state whether each fact is a must-fact or a may-risk.
  Choose joins from that meaning, not from a shared `mergeTri()` habit.
- Keep pending configuration separate from committed result state. Never use a
  sticky object-level flag for per-query or per-request behavior.
- New Glide methods need scope, release, role, primary evidence, unit tests, and
  real-host coverage before consumers can use them.
- Plan 010 may add Australia or later release data. It must extend the selector,
  not restore unconditional global role sets.
- Plan 014 owns the final cross-rule evidence matrix. It should reuse these
  focused fixtures instead of replacing them with generic silence tests.
- Reviewers should scrutinize branch joins, escape boundaries, repeated epochs,
  and whether diagnostic suppression is path-specific rather than global.
