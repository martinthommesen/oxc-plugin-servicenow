Rules must never match platform APIs by name — a local `gs` or `GlideRecord` is a different value. `src/analysis/` proves identity and lifecycle facts so rules can decide on evidence. This file describes that layer.

## Per-file analysis

`getFileAnalysis` in [[src/analysis/file-analysis.ts#getFileAnalysis]] builds and caches one `FileAnalysis` per host `SourceCode` object. The record carries `bindings`, `bindingWrites`, `script` (the context from [[context]]), `provenance`, `mutations`, `browserMutations`, `fluent`, and `nowIdAt`.

Rules reach it through `beginRuleFile` in [[src/rules/helpers.ts#beginRuleFile]], which returns `{ context, analysis, file }`. That is the only supported entry point; a rule that calls the underlying modules directly defeats the cache and the shared invariants.

One lookup owns both cache stores. Its structured identity names the filename, physical filename, host `cwd`, settings fingerprint, default Fluent SDK version, Glide releases, and resolver version. Host and explicit AST entries stay separate.

## Lexical bindings

`createFileBindings` in [[src/analysis/bindings.ts#createFileBindings]] builds a scope tree. `FileBindings` in [[src/analysis/bindings.ts#FileBindings]] exposes lexical resolution, node and id scope lookup, execution-boundary lookup, the root block, and `isPlatformGlobal`.

Callers do not walk `ScopeTree`. The module defines module, function, and static-block execution boundaries once. Its platform-global answer accounts for block scoping, function parameters, declaration order, and host scope data.

## Provenance

`analyzeProvenance` returns a `ProvenanceQuery` that classifies a node's value as a platform API and reports whether the binding is still trustworthy.

For a node it answers whether the value is a `GlideRecord`, `GlideAggregate`, `GlideAjax`, `GlideDateTime`, `g_form`, `gs`, or `current`. `trustedExpression` returns that value only while the binding is neither invalid nor escaped.

Aliases are tracked: `const gr = new GlideRecord("incident")` makes `gr` a `GlideRecord` for as long as the binding survives. Reassignment invalidates it. Escape makes it untrustworthy. Rules use the trust-aware query instead of repeating this check.

The published slice is `AnalysisProvenance` in [[src/analysis/public.ts#AnalysisProvenance]], exported from the `oxc-plugin-servicenow/analysis` entry point. Four of its fields — `queryState`, `windowed`, `sysparmName`, `aggregates` — are `@deprecated`, never computed, and hold constant defaults. The lifecycle facts they were meant to carry live in the per-domain finders instead. `docs/decisions.md` records their removal in 3.0.

## Mutation and authority

A platform global can be overwritten, and a rule must stop trusting the name once it is.

`x_gs` assigned to `gs`, `SOMETHING.current = null`, or a write through a dynamic key all mean the name no longer stands for the platform value at that point. `MutationQuery` in [[src/analysis/mutations.ts#MutationQuery]] exposes `isGlobalWritten`, `isGlobalAuthorityLost`, `isGlobalPathAuthorityLost`, and `isObjectPropertyAuthorityLost`. Rules check these before reporting, which is what keeps diagnostics off files that deliberately replace a global.

`browserMutations` applies the same model with browser-runtime semantics, for client API authority. `bindingWrites` in `src/analysis/binding-writes.ts` additionally reports `hasDynamicScope()` — a `with` block or an indirect write that could reach any binding.

## Path-sensitive analysis

A method call's meaning can depend on what ran before it. `analyzePathBindings` in [[src/analysis/path-state.ts#analyzePathBindings]] is an abstract interpreter that walks the program with a per-point environment, merges states at control-flow joins, and iterates loops to a fixpoint.

Each domain plugs in the hooks it needs — `emptyData`, `cloneData`, `mergeData`, `mergeDistinctData`, `equalsData`, `onCall`, `onRef`, `onValue`, `onExit`. The GlideRecord query lifecycle, `Now.ID` facts, and block function hoisting are all domains over this one interpreter.

Three properties matter for reading rule behavior:

- **Joins converge or give up.** When two incoming branches disagree, `mergeDistinctData` returns `undefined` and the fact becomes unknown rather than picking a branch.
- **Work is budgeted.** `WORK_PER_NODE` and `MAX_DEFAULT_WORK` in [[src/analysis/path-state.ts#analyzePathBindings]] set a deterministic budget that scales with program size, with `MAX_PATH_DEPTH` bounding traversal depth.
- **Exhaustion is explicit.** `analyzePathBindings` returns `complete` or `exhausted`. Each finder returns no findings after exhaustion, and file analysis clears its provenance maps. No callback can forget the silence rule.

## Per-domain finders

Each analysis domain has its own module exposing one finder, so the logic is testable without a rule and shared by rules that need the same fact. Representative examples:

- `src/analysis/query-before-next.ts` — `GlideRecord` used before `query()` or `get()`.
- `src/analysis/glide-windowing.ts` — `deleteMultiple` without windowing.
- `src/analysis/glide-query-lifecycle.ts` — query modifiers applied after the query executes.
- `src/analysis/glideaggregate.ts` and `src/analysis/glide-setnocount.ts` — aggregate and `chooseWindow` usage.
- `src/analysis/glideajax-params.ts` — `GlideAjax` parameter contracts.
- `src/analysis/now-id.ts` — canonical `Now.ID` facts and duplicate ids.
- `src/analysis/availability.ts` — `typeof X !== "undefined"`, `"x" in owner`, and optional-call guards, so a guarded use is not reported as an unguarded one.
- `src/analysis/stable-invocations.ts` — one callable resolver with explicit possible-value or dominating-value time policy. Callers separately require immediate body execution, as cursor-loop expansion does, without rejecting stable generator callbacks or mappers.

These are built on `MutationQuery`, `path-state`, and the [[glide]] manifest rather than on name lists.

## Related

The surrounding layers and the invariant this one exists to serve.

- [[context]] — the classification this layer consumes.
- [[glide]], [[fluent]] — the fact sources the finders consult.
- [[invariants#Silence on unknown facts]] — why exhaustion clears rather than truncates.
