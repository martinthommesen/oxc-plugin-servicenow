# Plan 007: Rebuild the path-state evaluator with reachable JavaScript semantics

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Do not improvise. When done, update the status row for this plan in
> `plans/README.md`, unless a reviewer told you that they maintain the index.
>
> **Drift check (run first)**: `git diff --stat b87972a..HEAD -- src/analysis/path-state.ts src/analysis/file-analysis.ts src/analysis/provenance.ts src/analysis/index.ts src/analysis/query-before-next.ts src/analysis/glide-bulk-filter.ts src/analysis/glideaggregate.ts src/analysis/glideajax-params.ts src/analysis/glide-setnocount.ts src/analysis/glide-query-lifecycle.ts src/analysis/glide-windowing.ts src/analysis/now-id.ts tests/analysis tests/helpers`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code. Treat a semantic mismatch as
> a STOP condition.

## Status

- **Status**: BLOCKED — reconstructed base omits required in-scope files and has no `validate` script; plan amendment or restack is required.
- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: `plans/006-freeze-and-restack-pr51.md`
- **Category**: bug / tech-debt / tests
- **Planned at**: commit `b87972a`, 2026-08-20

## Why this matters

Every stateful rule relies on `analyzePathBindings()`. The current walker reverses JavaScript call order, loses reachable completions, invents paths, and models each loop once. It also mixes control flow, object storage, escape policy, patterns, and consumer data in one 587-line closure. One incorrect join can suppress a safety diagnostic or report unreachable code across several rules.

This plan builds a consumer-neutral control-flow program once per source. It evaluates explicit completion sets and finite abstract domains to a fixed point. Foundation tests must prove JavaScript semantics before any existing ServiceNow consumer changes.

## Current state

The following excerpts are from commit `b87972a`.

- `src/analysis/path-state.ts:35-43` stores one primary completion plus an `abrupt` side map. This split lets joins discard alternatives:

  ```ts
  interface EnvState<T> {
    env: Map<BindingId, ObjectId | undefined>;
    objects: Map<ObjectId, SharedRecord<T>>;
    completion: Completion;
    completionLabel?: string | null;
    abrupt: Map<AbruptCompletion, EnvState<T>[]>;
  }
  ```

- `src/analysis/path-state.ts:613-632` keeps abrupt paths only when no normal path exists. An `if` with a reachable `break` and a normal arm loses the `break` before its loop can consume it:

  ```ts
  const merged = mergeMany(normal, emptyData, mergeData);
  state.abrupt.clear();
  if (merged) {
    replaceWith(state, merged);
    state.completion = "normal";
  } else if (abrupt.length > 0) {
    replaceWith(state, abrupt[0]!);
    // ...retain the remaining abrupt paths...
  }
  ```

- `src/analysis/path-state.ts:664-677` treats a declaration as an assignment even without an initializer. It also skips writes for compound assignments:

  ```ts
  if (decl.init) visit(decl.init, state, false);
  assignFrom(state, decl.id, decl.init);
  // ...
  visit(assign.right, state, false);
  if (assign.operator === "=") {
    assignFrom(state, assign.left, assign.right);
  } else {
    visit(assign.left, state, false);
  }
  ```

- `src/analysis/path-state.ts:680-705` always merges both syntactic branches. It does not remove impossible paths for `if (true)`, `false || right`, or `null ?? right`.
- `src/analysis/path-state.ts:708-732` models a `switch` by merging every case with a synthetic fall state. If every case is abrupt, it falls back to the pre-switch state.
- `src/analysis/path-state.ts:735-809` runs at most one loop body. It consumes every `break` or `continue` at the innermost loop and does not compare completion labels.
- `src/analysis/path-state.ts:813-824` creates a catch path when no catch exists. It calls the finalizer only on a normal primary state:

  ```ts
  const caught = snapshotState(before, cloneData);
  if (stmt.handler) visit(stmt.handler, caught, false);
  const afterTry = mergeMany([tried, caught], emptyData, mergeData);
  // ...
  if (stmt.finalizer) visit(stmt.finalizer, state, false);
  ```

- `src/analysis/path-state.ts:826-840` invokes the consumer before it evaluates the receiver and arguments:

  ```ts
  onCall({ call, rec, objectName, property });
  for (const arg of call.arguments) markEscape(state, arg);
  visitChildren(node, (child) => visit(child, state, false));
  ```

- `src/analysis/path-state.ts:570-597` contains `visitPatternExpressions()`, but no caller uses it. Defaults and computed pattern keys therefore do not execute.
- `src/analysis/path-state.ts:859-864` records neither `BreakStatement.label` nor `ContinueStatement.label`, although the state type has `completionLabel`.
- `src/analysis/query-before-next.ts:37-44` already treats a missing receiver name as presentation data. Six other consumers reject the same proven receiver when `objectName` is null:

  ```ts
  if (!rec || !property) return;
  // ...
  findings.push({ node: call, name: objectName ?? "record" });
  ```

  The rejecting guards are in `glide-bulk-filter.ts:75`, `glide-query-lifecycle.ts:37`, `glideajax-params.ts:72`, `glideaggregate.ts:72`, `glide-windowing.ts:34`, and `glide-setnocount.ts:71`.

- `src/analysis/file-analysis.ts:142-184` runs one path analysis for provenance. Each stateful consumer then calls `analyzePathBindings()` again. `getAnalysisPassCount()` counts only `buildFileAnalysis()`, so the current once-per-file test cannot detect repeated control-flow builds.
- The test style uses `node:test` and strict assertions. Use `tests/analysis/foundation.test.ts` as the local pattern. Use the real-host fixtures under `tests/integration/` only after the foundation suite is green.

## Target architecture

Implement these boundaries. Keep ServiceNow protocol policy outside the evaluator.

1. **Control-flow program**: Add `src/analysis/path-program.ts`. Lower one AST into immutable, ordered evaluation operations and control-flow edges. Preserve source nodes for diagnostics. Cache one program on `FileAnalysis`.
2. **Abstract evaluator**: Add `src/analysis/path-evaluator.ts`. Evaluate the control-flow program over a finite consumer domain. Represent reachable results as completion records: `{ kind, label, state }`. Do not hide abrupt results in a primary state.
3. **Value and reachability facts**: Model only facts needed for JavaScript reachability and evaluation order. Include literal truthiness, nullishness, and definite property absence on literal object/array destructuring sources. Keep every other value unknown.
4. **Object identity adapter**: Keep `src/analysis/path-state.ts` as the ServiceNow-neutral binding/object adapter and compatibility facade. It may allocate stable object IDs and model alias invalidation. It must not know Glide method names, query epochs, diagnostics, or rule severity.
5. **Domain contract**: Replace the loose callback set with a documented `PathDomain<T>` contract. Require `initial`, `clone`, `join`, `equals`, and `widen` operations. Require monotone transfer functions. Use `widen` only when a loop back edge does not stabilize within the documented bound.
6. **Consumer event contract**: Emit a call event only after the callee, receiver, computed property, and arguments execute. Include the proven receiver record, receiver expression, static property, evaluated argument nodes, and a presentation-only `displayName`. A missing display name must never remove semantic evidence.
7. **Shared execution**: Add a domain composer so the built-in state consumers run in one evaluator pass over the shared program. Keep each consumer's existing transfer policy in its own file. Record separate counters for source analysis, control-flow program builds, and evaluator executions.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `npm ci` | exit 0 |
| Focused foundation tests | `node scripts/run-tests.mjs tests/analysis/path-state.test.ts tests/analysis/foundation.test.ts` | all listed tests pass |
| Integration tests | `npm run test:integration` | all integration tests pass |
| Typecheck | `npm run typecheck` | exit 0, no errors |
| Build | `npm run build` | exit 0 |
| Full tests | `npm test` | all tests pass |
| Full local gate | `npm run validate` | every validation stage exits 0 |

Do not use a quoted `tests/**/*.test.ts` glob. `CONTRIBUTING.md` says Node 20 treats it as one missing file.

## Scope

**In scope** (the only files you may modify or create):

- `src/analysis/path-program.ts` (create)
- `src/analysis/path-evaluator.ts` (create)
- `src/analysis/path-object-store.ts` (create)
- `src/analysis/path-state.ts`
- `src/analysis/file-analysis.ts`
- `src/analysis/provenance.ts`
- `src/analysis/index.ts`
- `src/analysis/query-before-next.ts`
- `src/analysis/glide-bulk-filter.ts`
- `src/analysis/glideaggregate.ts`
- `src/analysis/glideajax-params.ts`
- `src/analysis/glide-setnocount.ts`
- `src/analysis/glide-query-lifecycle.ts`
- `src/analysis/glide-windowing.ts`
- `src/analysis/now-id.ts`
- `tests/analysis/path-state.test.ts` (create)
- `tests/analysis/foundation.test.ts`
- `tests/helpers/path-state-recorder.ts` (create only if the direct foundation tests need it)
- `tests/integration/analysis-hosts.test.ts` (create or extend only for evaluator parity cases)

**Out of scope** (do not touch):

- `src/analysis/bindings.ts`, closure escape policy, and shared pattern-walker extraction. Plan 008 owns them.
- Method manifests, query-executor selection, epochs, aggregate tuple policy, GlideAjax request resets, filter argument validity, and rule applicability. Later state-machine plans own these policies.
- Rule diagnostic text, severity, catalog metadata, generated docs, and lifecycle-specific fixtures.
- Fluent factory authority, `Now.ID` canonical alias policy, and directive placement. Plans 010 and 011 own these changes.
- `src/settings/`, `src/context/`, package exports, release code, and generated files.
- `plans/README.md`, except the final status update required by the executor instructions.

Mechanical consumer changes are allowed only to adopt the new event/domain contract, share one evaluator run, and accept a fallback display name. Preserve each consumer's current transition policy.

## Git workflow

Plan 006 establishes the remediation stack. Confirm its branch map before you start.

- Confirm Plan 006 created `archive/pr51-b87972a` and `docs/pr-51-stack.json`.
- Confirm the manifest assigns the expected base topology, archived ownership/hunks, reconstruction commit, and rollback rule. It must not store mutable current head SHAs.
- Query the live stack and PR with `gh stack view --json` and `gh pr view`. Confirm the remote `pr51-remediation/007-path-state` head matches the current PR body and latest check run.
- Confirm the live PR base is Plan 006's execution-time `origin/main` commit. Confirm its three-dot diff contains only the 007-owned paths and hunks from the manifest.
- Check out that reconstructed branch. Do not restore files from the archive, cherry-pick monolith commits, or import a later layer.
- Open or update the real focused PR with `main` as its base. Do not add these commits to PR #51.
- Use commit subjects such as `test(analysis): characterize path evaluator semantics` and `fix(analysis): rebuild reachable path evaluation`.
- Show the current-head commit, focused diff, red-before-green evidence, targeted tests, and `npm run validate` in the PR description.
- Do not push or open a PR unless the operator instructed it. If the branch or manifest check fails, STOP and return to Plan 006.

## Steps

### Step 1: Add direct red foundation tests

Create `tests/analysis/path-state.test.ts`. Test the evaluator through the existing `analyzePathBindings()` facade and a minimal recording domain, not through a lint rule. Keep that facade as the test seam while internals move. The recorder must expose event order, reachable completions, binding/object identity, and path-state joins without ServiceNow lifecycle assumptions.

Add named failing cases for groups 1–5 in this step. Add groups 6–12 at the start of the later step that implements them.

1. Receiver and argument order: sequence receivers, computed properties, nested calls, spread arguments, and left-to-right multiple arguments.
2. Assignment order: evaluate the left reference before the right value for `=`, compound assignments, and logical assignments. Include `cache[gr.next()] = gr.query()`.
3. Writes: invalidate a tracked binding for `+=` and update expressions. Split unknown `&&=`, `||=`, and `??=` into write and no-write paths. Take one path for literal-known left values.
4. Declarations: treat initializer-less `var` redeclaration as a runtime no-op. Distinguish binding declaration from `let`/`const` initialization and temporal dead-zone state.
5. Patterns: execute computed keys and defaults in JavaScript order for declarations, assignments, nested patterns, rest elements, arrays, and objects. Run a default definitely for a missing literal property. Join default/no-default paths for an unknown source.
6. Reachability: prune impossible arms for Boolean, string, number, null, and undefined literals in `if`, conditional, `&&`, `||`, and `??`. Keep both arms for unknown values.
7. Completions: retain normal, return, throw, break, and continue alternatives with labels. Prove that only the matching owner consumes a labeled completion.
8. `switch`: cover no match, no default, default before and after cases, case-test side effects, fall-through, unlabeled break, labeled break, return, and throw.
9. `try`: cover no catch, catch only from thrown paths, catch-parameter initialization, finalizers on every completion kind, and finalizer completion overriding the earlier completion.
10. Loops: cover zero iterations, mandatory first `do` iteration, back edges, effects visible only on iteration two, `continue` through update/test, `break` exits, nested labels, and `for-in`/`for-of` target writes.
11. Equivalent receivers: retain identity through conditional, logical, sequence, and assignment expressions only when every reachable result has the same object ID.
12. Fixed points: assert convergence on a stable loop and conservative widening on a deliberately ascending test domain.

**Verify**: `node scripts/run-tests.mjs tests/analysis/path-state.test.ts` → exit nonzero. Only the new order, assignment, write, declaration, and pattern assertions fail. Parser, imports, and test setup succeed.

### Step 2: Lower JavaScript evaluation order into one control-flow program

Create `src/analysis/path-program.ts`. Lower expressions and statements explicitly. Do not use generic object-key traversal for nodes with observable order.

Implement these orders:

- Evaluate a member receiver before its computed property.
- Evaluate a call callee before its arguments, left to right. Emit the invocation after all argument effects.
- Evaluate a `new` callee and arguments before construction and assignment.
- Evaluate an assignment target reference before its right side. Apply the write after the right side.
- Evaluate a destructuring right side before pattern steps. Evaluate computed keys and defaults at their specified pattern positions.
- Keep declaration creation separate from runtime initializer evaluation.
- Emit explicit branch, join, completion, loop-header, back-edge, and owner operations.

Freeze the resulting program and its operation arrays. Add `pathProgramBuilds` instrumentation next to the existing analysis counter.

**Verify**: `node scripts/run-tests.mjs tests/analysis/path-state.test.ts` → all current direct foundation tests pass.

### Step 3: Evaluate reachable completion sets

Before implementation, add the group 7–9 red cases from Step 1. Run the file once and record that only those completion tests fail.

Create `src/analysis/path-evaluator.ts`. Use a set of completion states instead of one primary state plus an abrupt side map.

Apply these rules:

- Sequence the next operation only into `normal` states.
- Join states only when completion kind and label match.
- Let a loop consume only its own unlabeled `break`/`continue`, or a completion whose label names that loop.
- Let a `switch` consume only an unlabeled `break`. Let an enclosing `LabeledStatement` consume its matching labeled `break`.
- Send only thrown paths from the try block into the catch block.
- Run the finalizer once for every outgoing completion. Restore the incoming completion when the finalizer ends normally. Replace it when the finalizer is abrupt.
- Preserve a no-match `switch` path when no default exists. Select default only after all case tests fail, regardless of default position.

Use the domain's `equals` operation at joins. Do not compare consumer data by object identity.

**Verify**: `node scripts/run-tests.mjs tests/analysis/path-state.test.ts` → all current direct foundation tests pass.

### Step 4: Add literal reachability and fixed-point loops

Before implementation, add the group 6, 10, and 12 red cases from Step 1. Run the file once and record that only those reachability and fixed-point tests fail.

Add the small value lattice described in the target architecture. Do not perform constant folding beyond literal truthiness, literal nullishness, sequence results, and definite literal pattern presence.

Evaluate loop back edges until the complete abstract state stabilizes. Include object bindings, object data, and completions in equality. Route `continue` through the correct update and test. Apply the domain's `widen` operation at the documented convergence bound. Emit a test-visible counter for loop iterations.

Do not use “one body pass plus zero pass” as a fallback. Do not silently drop a non-convergent path.

**Verify**: `node scripts/run-tests.mjs tests/analysis/path-state.test.ts` → all current direct foundation tests pass.

### Step 5: Rebuild the binding/object adapter

Before implementation, add the group 11 complex-receiver cases from Step 1 and record their red result.

Refactor `src/analysis/path-state.ts` onto the new program and evaluator. Preserve stable `BindingId` and AST-stable `ObjectId` identities across loop iterations. Separate these actions:

1. Read a binding.
2. Create or initialize a binding.
3. Write or invalidate a binding.
4. Evaluate a target reference.
5. Allocate a proven object.
6. Mark a value escaped.

Put allocation, alias identity, writes, invalidation, and escape bookkeeping in `src/analysis/path-object-store.ts` behind an explicit immutable state contract. Keep `path-state.ts` as the public facade and domain adapter. Do not leave object identity, escape analysis, pattern binding, path joins, and syntax traversal in one mutable closure.

Keep all Glide names and protocol transitions in consumers. For a proven complex receiver, populate `displayName` with `getName(receiver) ?? "record"`. Never require the name for a semantic event.

**Verify**: `node scripts/run-tests.mjs tests/analysis/path-state.test.ts` → all direct foundation tests pass.

### Step 6: Add consumer regressions before changing consumers

Add focused cases to `tests/analysis/foundation.test.ts` for the reported integration effects:

- `gr.next(gr.query())` is valid, while `gr.query(gr.next())` reports the inner `next()`.
- `(gr.query(), gr).next()` is valid.
- `cache[gr.next()] = gr.query()` reports the target call before the right-side query.
- `var gr = new GlideRecord(...); var gr; gr.next();` reports.
- Compound/update writes remove proven identity. Logical assignments keep or replace identity according to reachability.
- Computed destructuring keys and defaults execute.
- Mixed normal/abrupt branches retain the abrupt exit.
- Labeled nested `break` and `continue` reach the correct owner.
- All-abrupt switches keep following code unreachable. No-default switches retain no-match.
- `try` without catch does not invent a path. `finally` runs on return, throw, break, and continue and can override each.
- A second loop iteration can change the result. Literal loop tests remove impossible zero/body paths.
- Conditional, logical, sequence, and assignment receivers work for every migrated consumer without requiring an identifier name.

At this red gate, do not change consumer transfer policy to make a test pass.

**Verify**: `node scripts/run-tests.mjs tests/analysis/foundation.test.ts` → exit nonzero. Failures are limited to the new integration cases.

### Step 7: Compose and migrate existing consumers

Add the domain composer and migrate the in-scope consumers. Run their unchanged transfer functions during one shared evaluator execution. Cache the immutable control-flow program and composed result on `FileAnalysis`.

Replace `!objectName` semantic guards with `displayName` use only when creating findings. Add `equals` and `widen` implementations for every existing consumer data type. Widen only to each consumer's existing conservative unknown value. Do not correct query epochs, aggregate epochs, API selection, argument validation, or terminal resets here.

Update counters and `tests/analysis/foundation.test.ts` to assert, for one `SourceCode` identity with all stateful rules enabled:

- one `buildFileAnalysis()` pass,
- one control-flow program build, and
- one composed evaluator execution.

**Verify**: `node scripts/run-tests.mjs tests/analysis/path-state.test.ts tests/analysis/foundation.test.ts` → all tests pass.

### Step 8: Prove host parity and run all gates

Add a minimal real-Oxlint and real-ESLint fixture set to `tests/integration/analysis-hosts.test.ts`. Cover argument order, labeled completion, `try/finally`, a fixed-point loop, and a complex receiver. Assert exact rule IDs and counts.

Run all repository gates. Do not update generated docs because this plan changes no catalog contract.

**Verify**:

1. `npm run test:integration` → all integration tests pass.
2. `npm run typecheck` → exit 0, no errors.
3. `npm run build` → exit 0.
4. `npm test` → all tests pass.
5. `npm run validate` → every stage exits 0.

## Test plan

Add direct evaluator tests first. These tests are the semantic oracle and must not import a lint rule. Then add consumer regressions and real-host parity tests.

The final suite must cover:

- JavaScript receiver, property, argument, assignment-target, right-side, and write order.
- Plain, compound, update, and logical writes.
- Declaration creation versus runtime initialization.
- Nested destructuring, defaults, computed keys, and rest.
- Literal and unknown reachability.
- Every completion kind with unlabeled and labeled owners.
- Full `switch` selection and fall-through.
- Full `try`/`catch`/`finally` completion transformation.
- All loop forms, second-iteration effects, back edges, and widening.
- Complex but proven receivers.
- One control-flow build and one composed evaluation per file.
- Matching Oxlint and ESLint diagnostics for the selected integration fixtures.

## Done criteria

All criteria must hold:

- [ ] Direct evaluator tests fail before implementation and pass afterward.
- [ ] `EnvState` no longer stores one primary completion plus an `abrupt` side map.
- [ ] Calls emit consumer events after receiver, computed property, and argument effects.
- [ ] Computed assignment targets and destructuring pattern expressions execute in JavaScript order.
- [ ] Initializer-less `var` redeclarations do not write `undefined` into a live runtime binding.
- [ ] Compound, update, and logical assignments update or invalidate binding identity correctly.
- [ ] Normal, return, throw, break, and continue paths retain labels until the matching owner consumes them.
- [ ] `switch` and `try` semantics pass the direct completion matrix.
- [ ] Loop back edges reach a fixed point or invoke explicit conservative widening.
- [ ] Literal-known branches exclude impossible paths; unknown branches remain conservative.
- [ ] Proven receiver identity never depends on a diagnostic display name.
- [ ] Object identity and escape state live behind the explicit object-store contract, not the public facade's control-flow closure.
- [ ] One source produces one control-flow program and one composed evaluator execution.
- [ ] No rule-specific lifecycle policy changes appear in the diff.
- [ ] `npm run validate` exits 0.
- [ ] `git diff --name-only` lists only in-scope files and the permitted `plans/README.md` status update.
- [ ] The focused stacked PR contains current-head, diff, red/green, host, and full-gate evidence.

## STOP conditions

Stop and report if any condition occurs:

- Plan 006 did not freeze PR #51, reconstruct the 007 branch, or record matching topology and hunk ownership in `docs/pr-51-stack.json`.
- The live remote head does not match the current PR body or latest check run.
- An in-scope excerpt has changed semantically since `b87972a`.
- A proposed test needs a ServiceNow protocol transition to define JavaScript evaluation semantics.
- The evaluator needs a hard-coded Glide name, query method, diagnostic, rule ID, or settings policy.
- A loop domain cannot supply finite equality and a conservative widening result.
- Correct order requires generic AST object-key traversal for a node with observable evaluation order.
- A consumer migration changes its current lifecycle policy instead of only adopting the new contract.
- The direct foundation suite cannot reproduce a reported defect before implementation.
- Oxlint and ESLint parse the same supported fixture into semantics that the common evaluator cannot represent.
- A verification command fails twice after a reasonable correction.
- The work requires an out-of-scope file.

## Maintenance notes

Treat `path-program.ts` as the JavaScript semantics boundary. Add a lowering test before support for any new syntax.

Every consumer domain must remain finite, monotone, comparable, and widenable. Review `join`, `equals`, and `widen` together when consumer data changes.

Keep display names out of identity and reachability decisions. Diagnostics can fall back to `"record"` without weakening proof.

Plan 008 will change binding, closure, and shared pattern infrastructure on top of this evaluator. Later state-machine plans will change Glide-specific transitions. Review those PRs for accidental changes to the evaluator contract.
