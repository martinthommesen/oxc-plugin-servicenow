Rules must never match platform APIs by name — a local `gs` or `GlideRecord` is a different value. `src/analysis/` proves identity and lifecycle facts so rules can decide on evidence. This file describes that layer.

## Per-file analysis

`getFileAnalysis` in [[src/analysis/file-analysis.ts#getFileAnalysis]] builds and caches one `FileAnalysis` per host `SourceCode` object. The record carries `bindings`, `bindingWrites`, `script` (the context from [[context]]), `provenance`, `mutations`, `browserMutations`, `fluent`, and `nowIdAt`.

Rules reach it through `beginRuleFile` in [[src/rules/helpers.ts#beginRuleFile]], which returns the `FileAnalysis` itself, so a rule reads `file.script`, `file.provenance`, `file.bindings`, `file.glide`, `file.mutations`, and `file.fluent` under their own names.

`src/analysis/internal.ts` is the barrel every rule imports from, and the only analysis module a rule file may name. The gate in `scripts/lib/catalog-gates.mjs` rejects any other `../analysis/*.js` import, because a rule that calls an underlying module directly defeats the cache and the shared invariants.

One lookup owns both cache stores. Its structured identity names the filename, physical filename, host `cwd`, and settings fingerprint — the four inputs that can differ for one `SourceCode`. Host and explicit AST entries stay separate.

## Lexical bindings

`createFileBindings` in [[src/analysis/bindings.ts#createFileBindings]] builds a scope tree. `FileBindings` in [[src/analysis/bindings.ts#FileBindings]] exposes lexical resolution, node and id scope lookup, execution-boundary lookup, and `isPlatformGlobal`.

Callers do not walk `ScopeTree`. The module defines module, function, and static-block execution boundaries once. Its platform-global answer accounts for block scoping, function parameters, declaration order, and host scope data.

## Provenance

`analyzeProvenance` returns a `ProvenanceQuery` that classifies a node's value as a platform API and reports whether the binding is still trustworthy.

For a node it answers whether the value is a `GlideRecord`, `GlideAggregate`, `GlideAjax`, `GlideDateTime`, `DataView`, `Set`, `g_form`, `gs`, or `current`. A `GlideRecordSecure` construction resolves to the `GlideRecord` kind. `trustedExpression` returns that value only while the binding is neither invalid nor escaped.

Three lists name subsets of that vocabulary: `ProvenanceKind` is all nine, `PublicProvenanceKind` in [[src/analysis/public.ts#AnalysisProvenance]] is the narrower slice the package exports, and `CONSTRUCTED_PROVENANCE_KINDS` is the six a modeled constructor can produce. `provenReceiver` and `provenReceiverMethod` in [[src/analysis/platform-method-authority.ts#provenReceiverMethod]] pair the trust check with the authority check, so a caller asks for a proven receiver, or a proven method on one, in one call.

Aliases are tracked: `const gr = new GlideRecord("incident")` makes `gr` a `GlideRecord` for as long as the binding survives. Reassignment invalidates it. Escape makes it untrustworthy. Rules use the trust-aware query instead of repeating this check.

The published slice is `AnalysisProvenance` in [[src/analysis/public.ts#AnalysisProvenance]], exported from the `oxc-plugin-servicenow/analysis` entry point. It carries only `kind`, `invalid`, `escaped`, `bindingId`, and `objectId`: the never-computed lifecycle fields (`queryState`, `windowed`, `sysparmName`, `aggregates`) were removed in 3.0. The lifecycle facts they were meant to carry live in the per-domain finders instead.

## Mutation and authority

A platform global can be overwritten, and a rule must stop trusting the name once it is.

`x_gs` assigned to `gs`, `SOMETHING.current = null`, or a write through a dynamic key all mean the name no longer stands for the platform value at that point. `MutationQuery` in [[src/analysis/mutations.ts#MutationQuery]] exposes file-wide queries plus `...LostAt` variants for a specific use. The temporal variants ignore only writes proven to occur later in the same execution boundary; writes in another boundary remain conservative.

Destructured and member aliases are bounded while mutation facts are built. Four constants set those bounds: `MAX_NAMESPACE_ESCAPE_DEPTH`, `MAX_REFLECT_APPLY_DEPTH`, and `MAX_GLOBAL_ALIAS_DEPTH` in `src/analysis/mutations.ts`, and `MAX_PLATFORM_GLOBAL_ALIAS_DEPTH` in `src/analysis/globals.ts`.

Only `MAX_GLOBAL_ALIAS_DEPTH` records wildcard authority loss on exhaustion, returning the `"*"` path instead of recursing until the host stack fails. The other three stop their walk and return nothing, which is already the conservative answer: an unresolved alias proves no platform identity, so rules that suppress diagnostics when identity is uncertain stay silent.

`browserMutations` applies the same model with browser-runtime semantics, for client API authority. `bindingWrites` in `src/analysis/binding-writes.ts` additionally reports `hasDynamicScope()` — a `with` block or an indirect write that could reach any binding. Its `writesFor()` query returns every recorded write to one binding in program order, so Fluent alias resolution answers from the single shared walk instead of re-walking the program per call site (FINDINGS.md PER-005).

Three rules keep that write model honest:

- **Offsets are portable.** Every write's `start` comes from `nodeStart`, which reads `start`, `range`, or `span`, and is -1 when the host supplies none. Alias resolution in [[src/analysis/fluent-imports.ts#latestSimpleValue]] treats an unknown offset on the use, the declaration, or any write as unknown execution order and suppresses the alias fact; it never falls back to the first initializer (FINDINGS.md COR-007).
- **Initialized `var` redeclarations are writes.** `createFileBindings` coalesces `var T = A; var T = B;` into one binding, so the second declarator is recorded as an `=` write to it. A bare `var T;` is a runtime no-op and records nothing. The same conditional and function-boundary uncertainty applies as for assignments (FINDINGS.md COR-009).
- **References are indexed once.** `bindingReferences` in [[src/analysis/binding-references.ts#createBindingReferenceQuery]] lazily indexes every value reference and every declarator by binding id. A rule that must inspect all uses of a binding, such as the counter check in `prefer-glideaggregate`, queries it instead of walking the program per call site (FINDINGS.md PER-005).

## Path-sensitive analysis

A method call's meaning can depend on what ran before it. `analyzePathBindings` in [[src/analysis/path-state.ts#analyzePathBindings]] is an abstract interpreter that walks the program with a per-point environment, merges states at control-flow joins, and iterates loops to a fixpoint.

Each domain plugs in the hooks it needs — `emptyData`, `cloneData`, `mergeData`, `mergeDistinctData`, `equalsData`, `onCall`, `onRef`, `onValue`, `onExit`. The GlideRecord query lifecycle, `Now.ID` facts, and block function hoisting are all domains over this one interpreter.

Four properties matter for reading rule behavior:

- **Joins converge or give up.** When two incoming branches disagree, `mergeDistinctData` returns `undefined` and the fact becomes unknown rather than picking a branch.
- **Constant tests select the reachable branch.** A literal, template without substitutions, `void` expression, or object/array/function expression has known truthiness and nullishness. `if`, conditional, loop, and logical expressions use it to visit only the branch JavaScript can execute: `true && f()` always runs `f()`, `false && f()` never does, and `null ?? f()` always does. An operand whose value depends on a binding or call keeps the conservative join (FINDINGS.md COR-003).
- **Work is budgeted.** The default budget is `WORK_PER_NODE` (128) per program node, clamped to the `MIN_WORK_BUDGET` floor and the `MAX_WORK_BUDGET` ceiling in [[src/analysis/path-state.ts#analyzePathBindings]], with `MAX_PATH_DEPTH` bounding traversal depth.
- **Exhaustion is explicit.** `analyzePathBindings` returns `complete` or `exhausted`. `collectPathFindings` in [[src/analysis/path-state.ts#collectPathFindings]] owns the findings array and the exhaustion tail for every finder built on it, and file analysis clears its provenance maps. No callback can forget the silence rule. `FileAnalysis` republishes the shared outcome as `pathBudgetExhausted` so hosts can distinguish a fully analyzed file from a budget-truncated one (FINDINGS.md PER-006).

## Per-domain finders

Each analysis domain has its own module exposing one finder, so the logic is testable without a rule and shared by rules that need the same fact. Representative examples:

- `src/analysis/query-before-next.ts` — `GlideRecord` used before `query()` or `get()`.
- `src/analysis/glide-windowing.ts` — `deleteMultiple` without windowing.
- `src/analysis/glide-query-lifecycle.ts` — query modifiers applied after the query executes.
- `src/analysis/glideaggregate.ts` and `src/analysis/glide-setnocount.ts` — aggregate and `chooseWindow` usage.
- `src/analysis/glideajax-params.ts` — `GlideAjax` parameter contracts.
- `src/analysis/now-id.ts` — canonical `Now.ID` facts and duplicate ids.
- `src/analysis/availability.ts` — `typeof X !== "undefined"`, `"x" in owner`, and optional-call guards, so a guarded use is not reported as an unguarded one. One structural index is shared per block; receiver-specific proof checks scan only bounded guard candidates.
- `src/analysis/glideelement-retention.ts` — GlideElement values pushed into a collection while a cursor loop still advances.
- `src/analysis/array-from-thisarg.ts` — `Array.from` mapper `this` semantics.
- `src/analysis/stable-invocations.ts` — one callable resolver with explicit possible-value or dominating-value time policy. Callers separately require immediate body execution, as cursor-loop expansion does, without rejecting stable generator callbacks or mappers.

Repeated-query finders cache structural facts rather than re-walking earlier siblings or binding references. Platform constructor aliases resolve iteratively, and the call-site budget disables only alias following after its limit; direct platform calls remain diagnosable.

These are built on `MutationQuery`, `path-state`, and the [[glide]] manifest rather than on name lists.

## Related

The surrounding layers and the invariant this one exists to serve.

- [[context]] — the classification this layer consumes.
- [[glide]], [[fluent]] — the fact sources the finders consult.
- [[invariants#Silence on unknown facts]] — why exhaustion clears rather than truncates.
