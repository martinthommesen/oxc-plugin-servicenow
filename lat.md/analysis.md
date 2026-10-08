Rules must never match platform APIs by name — a local `gs` or `GlideRecord` is a different value. `src/analysis/` proves identity and lifecycle facts so rules can decide on evidence. This file describes that layer.

## Per-file analysis

`getFileAnalysis` in [[src/analysis/file-analysis.ts#getFileAnalysis]] builds and caches one `FileAnalysis` per host `SourceCode` object. The record carries `bindings`, `bindingWrites`, `script` (the context from [[context]]), `provenance`, `mutations`, `browserMutations`, `fluent`, and `nowIdAt`.

Rules reach it through `beginRuleFile` in [[src/rules/helpers.ts#beginRuleFile]], which returns the `FileAnalysis` itself, so a rule reads `file.script`, `file.provenance`, `file.bindings`, `file.glide`, `file.mutations`, and `file.fluent` under their own names.

`src/analysis/internal.ts` is the barrel every rule imports from, and the only analysis module a rule file may name. The gate in `scripts/lib/catalog-gates.mjs` rejects any other `../analysis/*.js` import, because a rule that calls an underlying module directly defeats the cache and the shared invariants.

One lookup owns both cache stores. Its structured identity names the filename, physical filename, host `cwd`, and settings fingerprint — the four inputs that can differ for one `SourceCode`. Host and explicit AST entries stay separate.

[[src/settings/validate.ts#structuralFingerprint]] encodes tagged, escaped structural values and reference identities. Reusing a raw settings object after mutation revalidates it; delimiter text cannot impersonate array or object structure.

## Lexical bindings

`createFileBindings` in [[src/analysis/bindings.ts#createFileBindings]] builds a scope tree. `FileBindings` in [[src/analysis/bindings.ts#FileBindings]] exposes lexical resolution, node and id scope lookup, execution-boundary lookup, and `isPlatformGlobal`.

Callers do not walk `ScopeTree`. The module defines module, function, and static-block execution boundaries once. Its platform-global answer accounts for block scoping, function parameters, declaration order, and host scope data.

Known AST nodes carry indexed lexical ownership, so repeated ancestor-free queries avoid scanning every scope and caller ancestors cannot replace an initializer's scope. Foreign or synthetic nodes retain the containing-offset fallback.

[[src/analysis/bindings.ts#buildScopeTree]] records ownership during its existing construction walk through [[src/analysis/bindings.ts#ScopeTree#recordNodeScope]]. The shared `walk` entry callback `*` runs after type-specific visitors enter each scope.

## Provenance

`analyzeProvenance` returns a `ProvenanceQuery` that classifies a node's value as a platform API and reports whether the binding is still trustworthy.

For a node it answers whether the value is a `GlideRecord`, `GlideAggregate`, `GlideAjax`, `GlideDateTime`, `DataView`, `Set`, `g_form`, `gs`, or `current`. A `GlideRecordSecure` construction resolves to the `GlideRecord` kind. `trustedExpression` returns that value only while the binding is neither invalid nor escaped.

Three lists name subsets of that vocabulary: `ProvenanceKind` is all nine, `PublicProvenanceKind` in [[src/analysis/public.ts#AnalysisProvenance]] is the narrower slice the package exports, and `CONSTRUCTED_PROVENANCE_KINDS` is the six a modeled constructor can produce. `provenReceiver` and `provenReceiverMethod` in [[src/analysis/platform-method-authority.ts#provenReceiverMethod]] pair the trust check with the authority check, so a caller asks for a proven receiver, or a proven method on one, in one call.

Aliases are tracked: `const gr = new GlideRecord("incident")` makes `gr` a `GlideRecord` for as long as the binding survives. Reassignment invalidates it. Escape makes it untrustworthy. Rules use the trust-aware query instead of repeating this check.

The published slice is `AnalysisProvenance` in [[src/analysis/public.ts#AnalysisProvenance]], exported from the `oxc-plugin-servicenow/analysis` entry point. It carries only `kind`, `invalid`, `escaped`, `bindingId`, and `objectId`: the never-computed lifecycle fields (`queryState`, `windowed`, `sysparmName`, `aggregates`) were removed in 3.0. The lifecycle facts they were meant to carry live in the per-domain finders instead.

## Mutation and authority

A platform global can be overwritten, and a rule must stop trusting the name once it is.

`x_gs` assigned to `gs`, `SOMETHING.current = null`, or a write through a dynamic key all mean the name no longer stands for the platform value at that point. `MutationQuery` in [[src/analysis/mutations.ts#MutationQuery]] exposes file-wide queries plus `...LostAt` variants for a specific use. The temporal variants ignore only writes proven to occur later in the same execution boundary; writes in another boundary remain conservative.

`mutation-index.ts` collects callable and authority facts into the shared shape in `mutation-facts.ts`; `mutations.ts` exposes queries and temporal filtering.

Destructured and member aliases are bounded while mutation facts are built. Four constants set those bounds: `MAX_NAMESPACE_ESCAPE_DEPTH`, `MAX_REFLECT_APPLY_DEPTH`, and `MAX_GLOBAL_ALIAS_DEPTH` in `src/analysis/mutation-index.ts`, and `MAX_PLATFORM_GLOBAL_ALIAS_DEPTH` in `src/analysis/globals.ts`.

Only `MAX_GLOBAL_ALIAS_DEPTH` records wildcard authority loss on exhaustion, returning the `"*"` path instead of recursing until the host stack fails. The other three stop their walk and return nothing, which is already the conservative answer: an unresolved alias proves no platform identity, so rules that suppress diagnostics when identity is uncertain stay silent.

`browserMutations` applies the same model with browser-runtime semantics, for client API authority. `bindingWrites` in `src/analysis/binding-writes.ts` additionally reports `hasDynamicScope()` — a `with` block or an indirect write that could reach any binding. Its `writesFor()` query returns every recorded write to one binding in program order, so Fluent alias resolution answers from the single shared walk instead of re-walking the program per call site (FINDINGS.md PER-005).

Three rules keep that write model honest:

- **Offsets are portable.** Every write's `start` comes from `nodeStart`, which reads `start`, `range`, or `span`, and is -1 when the host supplies none. Alias resolution in [[src/analysis/fluent-imports.ts#latestSimpleValue]] treats an unknown offset on the use, the declaration, or any write as unknown execution order and suppresses the alias fact; it never falls back to the first initializer (FINDINGS.md COR-007).
- **Initialized `var` redeclarations are writes.** `createFileBindings` coalesces `var T = A; var T = B;` into one binding, so the second declarator is recorded as an `=` write to it. A bare `var T;` is a runtime no-op and records nothing. The same conditional and function-boundary uncertainty applies as for assignments (FINDINGS.md COR-009).
- **References are indexed once.** `bindingReferences` in [[src/analysis/binding-references.ts#createBindingReferenceQuery]] lazily indexes every value reference and every declarator by binding id. A rule that must inspect all uses of a binding, such as the counter check in `prefer-glideaggregate`, queries it instead of walking the program per call site (FINDINGS.md PER-005).

Fluent aliases apply writes at their completion offsets, so a call inside a pending RHS retains the prior origin. Applicable pattern, loop-head, update and uncertain writes invalidate authority. [[src/analysis/fluent-imports.ts#importedBindingFor]] walks aliases iteratively with cycle checks.

[[src/utils/ast.ts#objectProperty]] proves known, absent or unknown effective properties by scanning backward. Later spreads or unresolved computed keys stop certainty; trailing exact properties remain provable for ID and naming checks.

## Path-sensitive analysis

A method call's meaning can depend on what ran before it. `analyzePathBindings` in [[src/analysis/path-interpreter.ts#analyzePathBindings]] is an abstract interpreter that walks the program with a per-point environment, merges states at control-flow joins, and iterates loops to a fixpoint.

The stable `path-state.ts` entry delegates to `path-interpreter.ts` for traversal, `path-values.ts` for value resolution, `path-control-flow.ts` for branches and loops, `path-environment.ts` for joins, `path-budget.ts` for work bounds, and `path-types.ts` for contracts. `path-domains.ts` supplies reusable domain operations.

Each domain plugs in the hooks it needs — `emptyData`, `cloneData`, `mergeData`, `mergeDistinctData`, `equalsData`, `onCall`, `onRef`, `onValue`, `onExit`. The GlideRecord query lifecycle, `Now.ID` facts, and block function hoisting are all domains over this one interpreter.

Four properties matter for reading rule behavior:

- **Joins converge or give up.** When two incoming branches disagree, `mergeDistinctData` returns `undefined` and the fact becomes unknown rather than picking a branch.
- **Constant tests select the reachable branch.** A literal, template without substitutions, `void` expression, or object/array/function expression has known truthiness and nullishness. `if`, conditional, loop, and logical expressions use it to visit only the branch JavaScript can execute: `true && f()` always runs `f()`, `false && f()` never does, and `null ?? f()` always does. An operand whose value depends on a binding or call keeps the conservative join (FINDINGS.md COR-003).
- **Work is budgeted.** [[src/analysis/path-budget.ts#defaultMaxWork]] scales work with program size under a floor and ceiling. Payload work is charged before domain cloning, joins, equality and call hooks; traversal depth is bounded.
- **Exhaustion is explicit.** `analyzePathBindings` returns `complete` or `exhausted`. `collectPathFindings` in [[src/analysis/path-state.ts#collectPathFindings]] owns the findings array and the exhaustion tail for every finder built on it, and file analysis clears its provenance maps. No callback can forget the silence rule. `FileAnalysis` republishes the shared outcome as `pathBudgetExhausted` so hosts can distinguish a fully analyzed file from a budget-truncated one (FINDINGS.md PER-006).

Mutable callable bindings belong to path snapshots and joins, while hoisted declarations form the initial environment. Uncalled-body inspection is isolated; direct helper calls project captured effects back. Constant false loop tests prune entries and backedges after header effects.

States with different callable bindings retain their corresponding record states through following statements and helper invocation. Matching callable maps compact into one state. Reference hooks join repeated source points conservatively, and all extra path work consumes the shared budget.

Expression-selected callable values remain correlated until the enclosing statement completes. Post-RHS assignments, parameter bindings and post-argument invocation effects execute on each normal alternative before joining; saved callee values retain JavaScript's evaluation order.

Return and throw expressions are evaluated before their values escape. This preserves diagnostics during evaluation and prevents newly allocated captured objects from becoming trusted again after crossing a function or exception boundary. Escape tracking follows a sequence's final operand and statically selected conditional or logical values. Logical assignments save the selected object, callable and scalar result before later binding writes, and escape only that result on each path.

Logical assignments use current truthiness and nullishness facts to skip or execute their right operand. [[src/analysis/path-values.ts#createPathValueResolver]] derives these facts from evaluated constructors, literals and callable values; scalar writes replace them and uncertain writes discard them. Captures exposed to unknown calls or unmodeled callable invocation remain uncertain even after later writes, because the callback may run again. Direct helper calls propagate scalar effects through nested calls. Unknown captures follow callable bindings transitively with a visited-function set and budget accounting. Class identities are opaque callable values: invocation or escape makes their scalar captures uncertain, while unused and unreachable classes retain surrounding facts. Joins retain only matching binding facts, while selected assignment results preserve temporary path correlations and clear when the statement completes. Snapshots, joins and comparisons charge this work to the shared budget. Scalar facts are collected only for logical assignment selectors and their alias sources. A bounded dependency walk identifies those bindings, keeping ordinary records out of scalar snapshots.

[[src/analysis/path-values.ts#evaluatedConstantValue]] lets enclosing control flow and value consumers use a logical assignment result already produced in the current expression. Other runtime identifier predicates keep syntax-only uncertainty. Statement and loop-header consumption clears temporary maps before independent headers accumulate correlations.

Known helper calls capture complete argument values before subsequent arguments execute and bind scalar and callable parameter facts alongside object identity. Argument capture and known generator-tag parameter replay also apply without logical assignment selectors, so later arguments cannot replace earlier callable values before a default consumes them. Default parameters execute for missing or definite undefined values, stay skipped for explicit null or non-nullish values, and join possible default effects for unknown arguments. Selector dependencies include known helper arguments and defaults.

Template tags save callable identity before evaluating substitutions and preserve each substitution value before later writes. Proven local callable lookups and function literals avoid impossible early throw snapshots; possible invocation throws follow substitutions. Unknown and member lookups retain possible lookup throws. Normal unmodeled tag invocation exposes captured record effects and discards selector certainty; throwing substitutions skip invocation. Member-tag receivers expose the same uncertain capture effects.

Known generator tags reuse helper parameter initialization with a supplied truthy, non-null strings array followed by the saved substitution values. Applicable defaults and conservative nested pattern effects project to the caller before the body stays deferred; retained iterators expose captures. See [[tests#Analysis behavior#Generator tags initialize parameters before deferring the body]].

Helper alias origins propagate once through reverse dependency edges and are reused at call sites. Added argument dependencies extend this cache under the shared work budget, so repeated calls and alias cycles do not restart full ancestry walks.

Declarations, initializers and later assignments retain every possible direct function origin. A bounded walk follows selected sequence, conditional and logical expression values. These origins seed helper argument dependencies without hoisting assignment-time values or capturing runtime arguments in the index. Known Call defaults and generator Tag defaults seed their parameter and argument sources even when the default parameter is not a logical selector.

Only selected runtime invocations suppress isolated uncalled-body inspection. After normal traversal, pending callers precede their known callees so helper replay can supply actual arguments first. Origin edges order inspection without proving invocation; future assignments, overwritten origins, skipped calls and opaque call methods retain isolated inspection. Pending bodies retain captured callable values observed at definition and exposure, following represented helper captures transitively with a visited-function set. Before isolated body replay, remembered captures join final callable values so later replacements cannot hide possible earlier callback effects. Import happens once before replay; body writes then dominate without old targets being restored at nested calls. Actual runtime replay keeps its path-local environment. Queues, edges, capture snapshots and fresh local callable maps consume the shared budget, and each pending body is inspected once. See [[tests#Analysis behavior#Assigned helper inspection follows actual invocation]].

Implicit arguments captures allocate the enclosing ordinary function's stable object identity when first resolved, so cached arrow captures remain valid before invocation initializes mappings. Strict directives require exact unescaped source spelling in program or function prologues.

Mapped arguments identities belong to sloppy ordinary functions with simple parameters and actually supplied arguments. Direct, compound and update writes or escape through an arguments alias discard mapped selector facts; arrows inherit lexical ownership. Member writes preserve their evaluated receiver before computed-key and right-hand-side effects. Strict functions, non-simple parameters, explicit arguments parameters and replacement aliases remain independent. Exposed callable binding markers track later callback replacements without filling scalar maps with unrelated captures.

Synthetic arguments identities are registered separately from domain records, so matching identities survive flat joins without adding lifecycle payloads. Different mapped receiver identities retain correlated paths under the existing work budget.

Mapped selectors retain their actual argument position. In sloppy simple-parameter functions, only the last occurrence of each parameter name can map, and its position must have a supplied argument. A backward scan records all names before supplied-arity filtering, as specified by [CreateMappedArgumentsObject](https://tc39.es/ecma262/multipage/ordinary-and-exotic-objects-behaviours.html#sec-createmappedargumentsobject). Static property writes discard only the matching mapped selector; known non-index or unmapped properties retain facts, while unknown keys and argument escape discard all mapped facts. Computed binding keys stay conservative instead of being re-read after right-hand-side writes. See [[tests#Analysis behavior#Mapped arguments retain positional ownership]].

Classes evaluate decorator expressions, extends, computed keys and static initialization immediately while deferring instance fields. Class decorator expressions precede heritage; member expressions and keys retain source order. Inner class names become opaque callable values after all keys and before static initialization; a declaration's enclosing name initializes after the definition completes. Heritage, key and early outer references remain conservative. Each unused header result clears locally while enclosing expression values and saved decorator identities remain available.

Decorator application consumes each saved callable on its correlated path: member decorators precede class decorators, followed by static initialization, as described by the [TC39 decorator design](https://github.com/tc39/proposal-decorators#detailed-design). The capture boundary exposes selected functions and opaque target classes, retaining possible throws before and after effects. Sticky scalar capture uncertainty survives later static writes because registered initializers may run afterward. Empty synchronous, non-generator function bodies with only ordinary identifier parameters preserve deferred target facts; defaults, destructuring and rest parameters retain conservative effects. Factory returns remain unknown under the existing callable result model. This conservatively models capture effects rather than decorator replacement values or initializer execution. New decorator capture scans and saved-map work share the bounded traversal budget.

Known class construction replays non-static field and accessor initializers in source order on each selected constructor path after normal argument evaluation. Evaluated superclass identities are saved before keys or static effects replace their bindings, using private callable bindings in each path. Helper projection preserves these bindings; repeated class sites conservatively retain prior base alternatives. Known superclass chains run base fields before derived fields, with separate paths for possible bases and charged depth and cycle guards. Unknown bases retain the existing opaque policy. Class ancestors resolve initializer references; an active-class guard bounds recursive construction. Abrupt initializers preserve earlier effects and skip later fields and invocation exposure. Each completed initializer value escapes to the instance; transient expression maps clear between fields while saved constructor and argument values survive. Static effects and computed keys remain definition-only. Constructor bodies and instance-property values retain their existing opaque policy.

Construction or escape invalidates captured class effects. Unused class identities and empty uncalled bodies avoid unrelated snapshot work. Member receivers retain their selected value on each path before key and argument evaluation.

Call, constructor and tag arguments retain their evaluated object and callable values before later arguments run. [[src/analysis/path-values.ts#savedExpressionValue]] reads raw wrapper snapshots before canonical expression facts. Unknown values stay unknown; callback captures still observe binding effects after argument evaluation. Known generators reuse the shared known-function invocation in [[src/analysis/path-interpreter.ts#analyzePathBindings]] to initialize arguments ownership, bind saved parameter values and evaluate defaults before producing an iterator. Parameter effects project back on each normal or abrupt path; synchronous default throws remain abrupt even for async generators. Their bodies stay deferred, and only retained iterators expose body captures. Nested pattern defaults and computed keys use the bounded conservative pattern visitor.

Generator result discard follows a charged ancestor walk. Void and non-final sequence operands discard immediately; transparent wrappers, final sequence operands and logical or conditional result positions inherit the outer consumer. A discarded expression statement keeps body captures deferred, while bindings, return values, arguments and condition tests retain the existing conservative exposure boundary. Parameter initialization and abrupt effects run before this decision. See [[tests#Analysis behavior#Discarded generator values keep bodies deferred]].

Selected conditional and logical values needed by a call, construction, tag or member receiver survive their join until consumption. The existing temporary-result and correlated-path budgets cover these facts; ordinary scalar selectors keep their prior inference boundaries. Strict parameter mapping checks only Program and function-body directive prologues, while class and module strictness remain inherited.

Mapped member writes retain the evaluated receiver before key and RHS effects. Assignment and invalidation occur only on normal completion; an abrupt or suspended RHS keeps its earlier effects without performing the skipped write.

Nullish scalar facts optionally distinguish definite null from undefined. Helper defaults consume the saved argument kind: null skips initialization, undefined runs it, and mixed null-or-undefined joins retain both possible effects while preserving common truthiness and nullishness.

Construction saves the selected callable before argument evaluation. Capture invalidation and argument escapes occur on each normal post-argument path, before possible construction throws and allocation. An argument that replaces a captured record leaves its prior aliases trusted and exposes the new record to the selected constructor. An abrupt argument skips constructor effects.

Escaping function and arrow literals make their captured platform objects untrusted, just as named callbacks do. This applies both to exported values and callbacks passed to unknown callees; a known directly invoked helper retains its modeled effects.

[[src/analysis/constant-value.ts#constantValue]] supplies syntax-only truthiness and nullishness to path and availability analysis, including nested sequence final operands within [[src/analysis/path-budget.ts#MAX_PATH_DEPTH]]. Deeper sequences and runtime binding values remain unknown; earlier operand effects still execute before branch selection. Benchmarks exercise used lexical bindings and correlated helper branches alongside nested scopes.

Retention has its own deterministic counter for `(node, cursor-state)` traversal and set construction, because distinct cursors can defeat memoization. [[src/analysis/path-budget.ts#exhaustedPathAnalysis]] notifies the file owner and the finder discards its complete result.

## Per-domain finders

Each analysis domain has its own module exposing one finder, so the logic is testable without a rule and shared by rules that need the same fact. Representative examples:

- `src/analysis/query-before-next.ts` — `GlideRecord` used before `query()` or `get()`.
- `src/analysis/glide-windowing.ts` — `deleteMultiple` without windowing.
- `src/analysis/glide-query-lifecycle.ts` — query modifiers applied after the query executes.
- `src/analysis/glideaggregate.ts` and `src/analysis/glide-setnocount.ts` — aggregate and `chooseWindow` usage.
- `src/analysis/glideajax-params.ts` — `GlideAjax` parameter contracts.
- `src/analysis/now-id.ts` — canonical `Now.ID` facts and duplicate ids.
- [[src/analysis/availability.ts#isAvailabilityGuarded]] — availability proofs follow evaluation order. Later condition or body mutations invalidate them; a trailing recheck can restore them. A structural block index bounds preceding-exit guard queries.
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
