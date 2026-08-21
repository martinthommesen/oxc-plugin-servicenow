# Plan 008: Make bindings, scopes, closures, and analysis caches authoritative

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Do not improvise. When done, update the status row for this plan in
> `plans/README.md`, unless a reviewer told you that they maintain the index.
>
> **Drift check (run first)**: `git diff --stat b87972a..HEAD -- src/analysis/bindings.ts src/analysis/path-state.ts src/analysis/file-analysis.ts src/analysis/provenance.ts src/analysis/index.ts src/analysis/fluent-imports.ts src/context/resolve.ts src/types.ts src/utils/ast.ts src/utils/immutable.ts src/runtime/apply-rules.ts src/rules/fluent-directives.ts tests/analysis tests/context.test.ts tests/utils/ast.test.ts tests/integration`
> Plan 007 intentionally changes several in-scope files. Compare its final
> evaluator and pattern interfaces with this plan. Stop if the required seam is
> absent or semantically incompatible.

## Status

- **Status**: IN PROGRESS — implemented in PR #78; merge pending.
- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: `plans/006-freeze-and-restack-pr51.md`, `plans/007-rebuild-path-state-semantics.md`
- **Category**: bug / tech-debt / tests
- **Planned at**: commit `b87972a`, 2026-08-20

## Why this matters

The fallback scope tree can give one JavaScript binding several identities, miss class boundaries, and disagree with real hosts. Closure captures also escape values before execution reaches the closure. These errors make binding-aware rules trust the wrong constructor, alias, or program point.

The shared cache can return a client analysis for a Business Rule when one `SourceCode` object is reused. Its script context, sets, arrays, and maps are mutable across rules. This plan makes binding and cache identity explicit, runtime-immutable, and equal across the fallback parser, ESLint, and Oxlint.

## Current state

The following excerpts are from commit `b87972a`. Re-read their post-Plan-007 forms before editing.

- `src/analysis/bindings.ts:56-65` creates a new `BindingId` for every declaration and replaces the previous map entry:

  ```ts
  declare(name: string, kind: BindingKind, node: ESTree.Node): void {
    const target = kind === "var" ? this.varScope() : this.current;
    if (!target) return;
    target.bindings.set(name, {
      id: this.nextBindingId++,
      name,
      kind,
      node,
      scopeId: target.id,
    });
  }
  ```

  Duplicate `var` declarations in one function must share one lexical identity. An initializer-less redeclaration is not a new binding or a runtime write.

- `src/analysis/bindings.ts:15` defines only `module`, `function`, `block`, `loop`, `switch`, and `catch` scopes. `buildScopeTree()` handles `ClassDeclaration` only as an outer declaration at lines 258-261. It never creates a named class-expression scope or a static-block scope.
- `src/analysis/bindings.ts:284-305` asks a host scope whether a defined binding exists. `createFileBindings()` still resolves all identities through the handwritten tree. The fallback `applyRules()` harness has no `getScope()`, as documented at `src/runtime/apply-rules.ts:104-116`.
- `src/analysis/path-state.ts:319-331` pre-collects captures from every function in the file. `markCapturedBinding()` at lines 498-504 then escapes a value as soon as that binding receives it. A later arrow can therefore suppress a diagnostic at an earlier call.
- `src/analysis/path-state.ts:641-654` traverses a nested function using its definition snapshot. A proven direct call does not bind parameters, apply captured state at invocation, or transfer effects back to the caller.
- Pattern structure is repeated in `collectPatternNames()` at `src/analysis/bindings.ts:125-154` and in three path-state helpers at lines 506-597. The path helper for computed keys and defaults has no caller at this commit.
- `src/analysis/file-analysis.ts:54-80` caches by `SourceCode` identity and a manually listed settings JSON. The key omits `context.filename`, `context.physicalFilename`, and `context.cwd`, although those values can define source or project meaning.
- `src/analysis/file-analysis.ts:277-289` returns the same cached object directly:

  ```ts
  const key = settingsKey(getValidatedSettingsResult(context).settings);
  const hit = bucket.get(key);
  if (hit) return hit;
  const created = buildFileAnalysis(context);
  bucket.set(key, created);
  return created;
  ```

- `src/context/resolve.ts:196-220` returns a mutable object containing a mutable `Set`, source map, and deprecation array. `ServiceNowScriptContext` fields in `src/types.ts:57-68` are not readonly.
- `src/utils/ast.ts:249-293` scans raw slash pairs as comments. It does not lex strings, templates, regular expressions, or JavaScript/TypeScript token contexts. It is used by `context/resolve.ts`, `runtime/apply-rules.ts`, and `rules/fluent-directives.ts` when parser comments are absent.
- The existing tests do not cover mutation of cached script/file analysis products. The fallback comment tests in `tests/utils/ast.test.ts` validate slash scanning, not lexical correctness.

## Target architecture

Implement these contracts:

1. **Canonical lexical binding**: One binding owns one stable ID and a readonly declaration list. Duplicate `var` declarations in the same var scope append declarations to that binding. Do not coalesce `let`, `const`, parameter, import, class, or catch bindings.
2. **Complete scope grammar**: Model named class expressions and static initialization blocks. Treat a static block as a lexical and `var` boundary. Keep class names visible at the same places as the supported host scope managers.
3. **One resolver facade**: Make `FileBindings.resolve()` the only binding-resolution entry for analysis consumers. Use host variable identity when a usable scope manager exists. Use the fallback tree otherwise. Preserve the rule that a host “not configured global” result does not prove a ServiceNow name is local or global.
4. **Structural pattern walker**: Add `src/analysis/patterns.ts` with hooks for identifiers, computed keys, defaults, and rest elements. It describes syntax only. Plan 007's evaluator still decides when a default executes.
5. **Closure summary**: Record a function node, parameters, local bindings, and captured binding IDs. Instantiate function expressions and arrows at their evaluation point. Treat declarations as hoisted without mutating captured objects merely because the function exists.
6. **Invocation model**: Replay a proven direct function, stable local alias, or immediately invoked function expression against the current abstract environment. Bind arguments to parameters. Propagate generic object effects back through aliases. For an unknown target, escaped callback, or recursive cycle, conservatively invalidate or escape affected captured and argument objects.
7. **Semantic cache identity**: Keep `SourceCode` object identity as the outer WeakMap key. Add a canonical inner key containing logical filename, physical filename, current working directory/project identity, the complete validated settings fingerprint, manifest/resolver version, and other semantic inputs. Never share globally by filename or text.
8. **Runtime-immutable publication**: Build with private mutable maps and sets. Publish frozen records plus immutable `ReadonlyMap`/`ReadonlySet` views whose runtime API has no mutators. `Object.freeze(new Map())` and `Object.freeze(new Set())` are not sufficient.
9. **Parser comments only**: Use `sourceCode.getAllComments()` or `ParsedSource.comments`. When neither exists, return no comment evidence. Do not infer a pragma or directive from raw text and do not build another JavaScript lexer.

This plan creates the project identity and immutable analysis primitives used by the later Fluent barrel resolver. It does not resolve modules or decide Fluent factory authority.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `npm ci` | exit 0 |
| Focused unit tests | `node scripts/run-tests.mjs tests/analysis/bindings.test.ts tests/analysis/patterns.test.ts tests/analysis/file-analysis.test.ts tests/analysis/foundation.test.ts tests/context.test.ts tests/utils/ast.test.ts` | all listed tests pass |
| Integration tests | `npm run test:integration` | all integration tests pass |
| Typecheck | `npm run typecheck` | exit 0, no errors |
| Build | `npm run build` | exit 0 |
| Full tests | `npm test` | all tests pass |
| Full local gate | `npm run validate` | every validation stage exits 0 |

Do not use a quoted `tests/**/*.test.ts` glob. Use `scripts/run-tests.mjs` as required by `CONTRIBUTING.md`.

## Scope

**In scope** (the only files you may modify or create):

- `src/analysis/bindings.ts`
- `src/analysis/patterns.ts` (create)
- `src/analysis/path-state.ts` or the Plan 007 object-adapter replacement
- `src/analysis/file-analysis.ts`
- `src/analysis/provenance.ts`
- `src/analysis/index.ts`
- `src/analysis/fluent-imports.ts` (only to use point-in-time binding facts; do not add module resolution or authority policy)
- `src/context/resolve.ts` (only immutability and parser-comment acquisition)
- `src/types.ts`
- `src/utils/ast.ts`
- `src/utils/immutable.ts` (create if immutable collection views need a shared home)
- `src/runtime/apply-rules.ts` (only the parsed-comment contract and host-scope test adapter)
- `src/rules/fluent-directives.ts` (only parser-comment acquisition)
- `tests/analysis/bindings.test.ts` (create)
- `tests/analysis/patterns.test.ts` (create)
- `tests/analysis/file-analysis.test.ts` (create)
- `tests/analysis/foundation.test.ts`
- `tests/context.test.ts`
- `tests/utils/ast.test.ts`
- `tests/helpers/binding-matrix.ts` (correct the false `var` block-shadow fixture)
- `tests/integration/analysis-hosts.test.ts`
- `tests/integration/adversarial.test.ts` or the equivalent existing real-host analysis suite
- `tests/integration/profiles/` (only new binding/scope parity fixtures and their exact expected diagnostics)

**Out of scope** (do not touch):

- Rule-specific lifecycle transitions, query method selection, protocol epochs, filter evidence, cursor-loop policy, or diagnostics. Plan 009 owns them.
- Fluent cross-file resolution, SDK authority, project-barrel traversal, mutable namespace-alias decisions, factory policy, and `Now.ID` semantics. Plans 010 and 011 own them.
- Directive adjacency, first-line checks, diagnostic locations, or supported directive kinds. Plan 011 owns them.
- Settings memoization, raw-settings mutation, context inference, profile globs, conflicting surfaces, applicability, and rule contracts. Plan 012 owns them.
- Root/package exports and packed public API tests. Plan 013 decides and verifies the `oxc-plugin-servicenow/analysis` subpath after this plan makes it safe.
- Catalog metadata, docs, changelog, generated files, release automation, and compatibility claims.
- `plans/README.md`, except the final status update required by the executor instructions.

## Git workflow

Plan 006 establishes the remediation stack. Confirm its branch map before you start.

- Confirm Plan 006 created `docs/pr-51-stack.json` and reconstructed the remote `pr51-remediation/008-bindings-scopes` branch.
- Confirm the manifest assigns the expected base topology, archived ownership/hunks, reconstruction commit, and rollback rule. It must not store mutable current head SHAs.
- Query the live stack and PR with `gh stack view --json` and `gh pr view`. Confirm the remote branch head matches the current PR body and latest check run.
- Confirm the live PR base equals the tested `pr51-remediation/007-path-state` head. Confirm its three-dot diff contains only the 008-owned paths and hunks from the manifest.
- Check out that reconstructed branch. Do not restore archive files, cherry-pick monolith commits, or import a later layer.
- Open or update the real focused PR with `pr51-remediation/007-path-state` as its base. Do not add these commits to PR #51.
- Use commit subjects such as `test(analysis): expose binding and cache regressions` and `fix(analysis): make scopes and caches authoritative`.
- Show both base and head SHAs, the focused diff, red-before-green evidence, host parity, and `npm run validate` in the PR description.
- Do not push or open a PR unless the operator instructed it. If the branch or manifest check fails, STOP and return to Plan 006.

## Steps

### Step 1: Add red binding and scope tests

Create `tests/analysis/bindings.test.ts`. Assert binding IDs and declaration metadata directly.

Add these cases:

- Two `var x` declarations in one function resolve to one ID and two ordered declaration nodes.
- A nested block `var x` resolves to the function binding. A nested function `var x` has a different ID.
- `let`, `const`, parameters, imports, class declarations, class expressions, and catch parameters never coalesce with a same-spelled outer binding.
- A named class-expression name resolves inside its body and not outside it.
- A class declaration remains resolvable where the host resolves it inside and outside its body.
- `let`, `const`, and `var` inside a static block do not leak after the block.
- Computed class keys, fields, methods, and nested static blocks use the same scope as ESLint and Oxlint.

Change the `var` “block shadowing” fixture in `tests/helpers/binding-matrix.ts` to a real `let` or `const` block shadow.

**Verify**: `node scripts/run-tests.mjs tests/analysis/bindings.test.ts` → exit nonzero. Only the new coalescing, class, and static-block assertions fail.

### Step 2: Coalesce bindings and complete the fallback scope tree

Extend `LexicalBinding` with an immutable ordered declaration collection. Keep a documented canonical declaration only if an existing consumer still needs one node. Do not select the last declaration silently.

Update `ScopeTree.declare()` to return the binding. Reuse an existing same-name `var` binding only in the same var scope. Update `varScope()` so a static block is a var boundary. Add class and static-block scopes to `buildScopeTree()` with balanced enter/exit handlers.

Expose scope children or a binding-by-ID lookup if consumers currently walk only the root or rescan the AST. Do not add another whole-file scan.

**Verify**: `node scripts/run-tests.mjs tests/analysis/bindings.test.ts` → all direct binding tests pass.

### Step 3: Prove fallback, ESLint, and Oxlint scope parity

Add the same observable fixtures to the fallback harness and both real hosts:

1. A named `class GlideRecord` expression self-reference is local and silent.
2. A local constructor inside a static block is silent.
3. A later platform `new GlideRecord()` outside that static block reports exactly once in a client file.
4. Nested class/static/function scopes resolve same-spelled bindings independently.

Implement `FileBindings.resolve(name, node, ancestors)` and stable host-variable-to-binding-ID mapping. Route `isLocalName()`, `isPlatformGlobal()`, path state, Fluent import resolution, and provenance through this facade. Use the fallback tree only when the host scope API is absent, throws, or cannot identify the variable.

Do not interpret a host false result as proof that an unresolved ServiceNow identifier is a configured global.

**Verify**:

1. `node scripts/run-tests.mjs tests/analysis/bindings.test.ts tests/integration/analysis-hosts.test.ts tests/integration/adversarial.test.ts` → all listed tests pass.
2. `npm run test:integration` → all integration tests pass with matching ESLint and Oxlint rule IDs and counts.

### Step 4: Add red temporal closure tests

Add these cases to `tests/analysis/foundation.test.ts` before changing closure behavior:

- A later function expression or arrow capture does not suppress an earlier `next()` or bulk-operation finding.
- Merely declaring an uncalled capturing function does not mutate an outer object.
- A direct function declaration, function expression, arrow, and immediately invoked function expression bind arguments at invocation.
- A direct helper query changes the caller-visible record before a later `next()`.
- A direct helper call with a fresh record reports an unsafe call inside the helper.
- The same helper called under two different object states does not reuse stale captured facts.
- Shadowed parameters and sibling closures remain independent.
- Passing or storing a closure through unknown code conservatively escapes its captured objects only from that program point forward.
- Direct and mutual recursion terminate and fall back to conservative unknown state without duplicate diagnostics.

**Verify**: `node scripts/run-tests.mjs tests/analysis/foundation.test.ts` → exit nonzero. The new temporal and invocation assertions fail for the reported reasons.

### Step 5: Add structural summaries and conservative invocation

Remove the whole-file `capturedBindingIds` escape prepass. Build function summaries from lexical binding IDs without reading or mutating consumer data.

Apply these rules:

- Analyze a function's local syntax independently, but do not treat definition-time captured object state as invocation-time truth.
- Instantiate expressions and arrows when execution reaches them. Record declarations as hoisted callable bindings.
- At a proven direct invocation, snapshot the current captured environment, bind evaluated arguments to parameters, execute through Plan 007's evaluator, and merge returned outer-object effects into the caller.
- Treat a stable local alias of a known function as proven. Treat computed, reassigned, returned, stored, or otherwise unknown call targets conservatively.
- On unknown callback escape or an active recursive invocation cycle, invalidate or escape the affected captured and argument records at that program point. Use an active invocation key and a documented maximum summary depth. Never execute future syntax at an earlier point.
- Deduplicate observations by source node and abstract invocation key so fixed points and recursion do not emit duplicate diagnostics.

Keep the model generic. Do not mention `current`, query methods, `Now.ID`, or rule messages in the summary layer.

**Verify**: `node scripts/run-tests.mjs tests/analysis/foundation.test.ts` → all matching tests pass.

Before the next step, add a red registry test for every supported platform constructor. Export one typed constructor-to-provenance registry from `provenance.ts`. Derive the path evaluator's supported constructor kinds and `file-analysis.ts` kind list from it. Delete the three manual registries. The test must fail if one consumer omits a newly added constructor.

### Step 6: Unify structural pattern walking

Create red `tests/analysis/patterns.test.ts` cases first. Cover nested object/array patterns, holes, properties, computed keys, defaults, and rest. Assert hook order. Assert that keys and default references are not declaration names.

Create `src/analysis/patterns.ts`. Give it explicit callbacks such as `onBinding`, `onComputedKey`, `onDefault`, and `onRest`. Replace `collectPatternNames()` and the post-Plan-007 pattern switches with wrappers over this walker. The evaluator controls reachability and execution of defaults.

Remove the duplicate recursive pattern cases from `bindings.ts` and the evaluator adapter.

**Verify**: `node scripts/run-tests.mjs tests/analysis/patterns.test.ts tests/analysis/path-state.test.ts tests/analysis/bindings.test.ts` → all tests pass, including every Plan 007 pattern-order test.

### Step 7: Add red source/project cache identity tests

Create `tests/analysis/file-analysis.test.ts`. Use controlled context and `SourceCode` objects.

Test this identity matrix:

- Same source object, logical filename, physical filename, working directory, validated settings, and resolver version returns the same `FileAnalysis` and increments each Plan 007 build counter once.
- The same source object under different logical filenames returns distinct contexts.
- Different physical filenames or working directories return distinct project identities.
- Different source objects with the same filename and text never share a file analysis.
- Every validated settings field changes the canonical fingerprint when its semantic value changes. Property insertion order does not change it.
- Distinct validated settings products produce distinct file analyses.
- An identical frozen validated settings product can reuse its file analysis.

Do not test raw-settings mutation; Plan 012 owns the settings memo. Do not add cross-file Fluent resolution here.

**Verify**: `node scripts/run-tests.mjs tests/analysis/file-analysis.test.ts` → exit nonzero. Only the new filename and project identity assertions fail.

### Step 8: Fix analysis cache identity

Consume the validated settings product as an input without changing settings memoization. Define one canonical fingerprint for the complete validated settings object. Do not repeat a hand-selected field list in `file-analysis.ts`. Build an explicit semantic identity record from:

- `SourceCode` object identity,
- normalized `context.filename`,
- normalized `context.physicalFilename`,
- normalized `context.cwd`,
- the validated-settings fingerprint,
- the Fluent manifest version,
- the project resolver/version token added for later cross-file analysis.

Keep the outer WeakMap. Do not use a process-global filename/text cache. Preserve Plan 007's one-program and one-evaluation counters for an identical key.

**Verify**: `node scripts/run-tests.mjs tests/analysis/file-analysis.test.ts` → all cache identity tests pass.

### Step 9: Publish runtime-immutable analysis products

Add red mutation tests before the implementation. Attempt all of these actions and then read the cached object again:

- assign a top-level `ServiceNowScriptContext` or `FileAnalysis` field,
- change `sources`, settings, or deprecation entries,
- add/delete/clear a surface,
- push or replace a deprecation,
- mutate Fluent imports, `nowIdAt`, provenance aggregates, scope bindings, or declaration lists.

Each mutation must throw or be impossible because no mutator exists. Later consumers must observe the original data.

Make public types readonly. Freeze plain records and arrays recursively. Publish maps and sets through immutable wrappers, not frozen native collections. Keep all builders private.

Do not add a package-root export. Keep the stable facade in `src/analysis/index.ts`; Plan 013 will expose and pack-test `oxc-plugin-servicenow/analysis` after this contract is stable.

**Verify**: `node scripts/run-tests.mjs tests/analysis/file-analysis.test.ts tests/context.test.ts` → all mutation tests pass.

### Step 10: Remove raw-text comment inference

Replace `fallbackComments()` use with this policy:

- `context.sourceCode.getAllComments()` is authoritative when available.
- `applyRules()` uses `ParsedSource.comments` when supplied.
- If neither source exists, expose an empty comment list. Keep the optional `ParsedSource.comments` signature for compatibility.

Delete or privatize `fallbackComments()`. Do not replace it with another lexer. Update tests so slash pairs and pragma/directive text inside strings, templates, and regular expressions never become comment evidence. Keep tests that real parser comment tokens enable the existing pragma and directive behavior.

Do not fix directive adjacency or locations in this step.

**Verify**: `node scripts/run-tests.mjs tests/utils/ast.test.ts tests/context.test.ts tests/integration/analysis-hosts.test.ts` → all comment-source tests pass.

### Step 11: Run all gates and prepare the stacked PR

Run the focused suite, integration suite, and full local gate. Confirm the diff contains no lifecycle, context-profile, directive-placement, generated-doc, or root-export changes.

**Verify**:

1. `node scripts/run-tests.mjs tests/analysis/bindings.test.ts tests/analysis/patterns.test.ts tests/analysis/file-analysis.test.ts tests/analysis/path-state.test.ts tests/analysis/foundation.test.ts tests/context.test.ts tests/utils/ast.test.ts` → all listed tests pass.
2. `npm run test:integration` → all integration tests pass.
3. `npm run typecheck` → exit 0, no errors.
4. `npm run build` → exit 0.
5. `npm test` → all tests pass.
6. `npm run validate` → every stage exits 0.

## Test plan

Use direct binding, pattern, and cache tests as the primary oracle. Use lint rules only to prove identical behavior across the fallback harness, ESLint, and Oxlint.

The final suite must cover:

- Canonical duplicate-`var` identity and declaration metadata.
- Function, block, loop, catch, switch, class, and static-block scope boundaries.
- Host/fallback binding parity for same-spelled platform constructors.
- Program-point closure creation, direct invocation, parameter binding, unknown escape, and recursive fallback.
- One shared structural pattern walker with ordered hooks.
- Source, virtual filename, physical file, working directory/project, settings, manifest, and resolver cache identity.
- Runtime mutation attempts on every cached collection and nested record.
- Parser-token-only comments, with strings, templates, and regular expressions ignored.

## Done criteria

All criteria must hold:

- [ ] Duplicate `var` declarations in one var scope share one `BindingId` and ordered declaration list.
- [ ] Class-expression names and static-block declarations match ESLint and Oxlint scope behavior.
- [ ] All binding consumers use one host/fallback resolver facade.
- [ ] A future closure never changes an earlier program point.
- [ ] Proven direct calls bind parameters and propagate generic effects; unknown and recursive calls degrade conservatively.
- [ ] One typed constructor registry supplies provenance, path kinds, and file-analysis kinds.
- [ ] One structural pattern walker replaces all binding/evaluator pattern switches.
- [ ] The source cache key includes filename, physical filename, working directory/project identity, complete settings, manifest, and resolver version.
- [ ] `ServiceNowScriptContext`, `FileAnalysis`, maps, sets, arrays, declarations, and nested records are runtime-immutable.
- [ ] No `fallbackComments()` caller infers semantic comments from raw text.
- [ ] Plan 007's one-program and one-evaluation assertions remain green.
- [ ] No Fluent authority, `Now.ID`, lifecycle, profile, or directive-placement policy changed.
- [ ] `npm run validate` exits 0.
- [ ] `git diff --name-only` lists only in-scope files and the permitted `plans/README.md` status update.
- [ ] The focused stacked PR records its exact base/head, diff, red/green, host-parity, and full-gate evidence.

## STOP conditions

Stop and report if any condition occurs:

- Plan 006 did not reconstruct the 008 branch, its manifest topology or ownership check fails, or Plan 007 is not its tested base.
- The live remote head does not match the current PR body or latest check run.
- Plan 007's evaluator lacks a consumer-neutral closure/pattern seam, or its in-scope semantics differ from this plan.
- Coalescing `var` would also merge lexical, parameter, import, class, or catch bindings.
- A singular `binding.node` would remain with an undocumented arbitrary declaration choice.
- ESLint and Oxlint disagree on a supported class/static-block scope and one tested adapter cannot represent both.
- A host “false” result must be treated as proof of a platform global to make a test pass.
- Closure evaluation requires a consumer-specific protocol transition or executes future syntax at an earlier point.
- Summary recursion does not terminate or fixed-point evaluation duplicates diagnostics.
- The structural pattern walker must decide whether a default executes.
- Any file-analysis semantic cache input cannot be named and tested.
- A proposed cache shares globally by text or filename.
- Immutability relies only on `Object.freeze()` around a native `Map` or `Set`.
- Safe comment handling would require a handwritten partial JavaScript/TypeScript lexer.
- The work requires Fluent module resolution, directive placement, lifecycle policy, context applicability, root exports, or another out-of-scope change.
- A focused verification fails twice after a reasonable correction.

## Maintenance notes

Use `FileBindings.resolve()` for all new binding-aware analysis. Never compare platform globals by spelling alone.

Keep closure summaries structural and consumer-neutral. Add conservative fallback tests when a new function or call shape is unsupported.

Update the canonical settings fingerprint whenever `ValidatedServiceNowSettings` changes. A test must enumerate the runtime keys and fail when the fingerprint schema drifts.

Treat `SourceCode` identity as the file cache boundary and normalized `cwd`/physical filename as project identity. Plan 010 may build an immutable module resolver on this key; it must not create a second incompatible cache. It also owns Fluent decisions before and after namespace-alias writes.

Use parser-provided comment tokens for all semantic comment features. Plan 011 owns directive placement and precise occurrence locations.

Plan 013 owns the public `oxc-plugin-servicenow/analysis` subpath. It must depend on this plan and must not re-export mutable builders.
