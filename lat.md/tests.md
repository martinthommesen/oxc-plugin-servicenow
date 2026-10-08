---
lat:
  require-code-mention: true
---

Test specifications for the properties in [[invariants]]. Each leaf names what it verifies and the test that verifies it; `lat check` fails when a leaf loses its backlink.

`ruleTester` binds a suite's rule, context and expected diagnostic once; explicit overrides replace defaults. Skip assertions and active-negative assertions keep distinct contracts.

Unit rules run through the harness in `tests/helpers/rule-tester.ts`, which parses with `oxc-parser` and applies selected rules in process. Integration rules run the real `oxlint` binary and a real ESLint `Linter`, and are the only proof of production behavior.

## Silence on unknown facts

The plugin reports only from evidence it has. These specs cover the three ways that shows up: a declined file, an unresolved release, and an unproven binding.

### A declined file is not a passing file

`assertValidActive` proves the rule's gate admitted the file, and `assertSkipped` proves it declined. Asserting only "no diagnostics" would pass for a rule that silently stopped applying.

Every gate-sensitive case under `tests/rules` uses one of the two outcome-aware helpers: a deliberate skip (a client rule on a server filename, a Fluent file under a classic rule, an unknown mode) asserts `assertSkipped`, and a semantic negative asserts `assertValidActive`. Plain `assertValid` is reserved for cases whose contract is only "no diagnostics" (FINDINGS.md TST-004). Engine rules that must decline every non-server execution context use `assertDeclinesNonServerSurfaces`, which asserts the client, Fluent, and UI Action skips together.

### Surface classification holds under real hosts

The context fixtures drive filename, directory, and mutated-globals evidence through real oxlint and ESLint. Each case asserts an exact rule id, message id, and full message text.

### Release-dependent facts stay unknown

The same construct is tested with `release: "zurich"`, with `release: "australia"`, and with no release. The omitted case must not inherit either release's answer.

### Identity decisions follow the binding matrix

`BINDING_MATRIX_CASES` in `tests/helpers/binding-matrix.ts` drives each rule with direct use, alias, reassignment, shadowing, and computed member access, asserting the exact message id and source range.

### Parser failures cannot prove semantic silence

Recovered ASTs with parser errors and fatal or unclassified ESLint messages are rejected before checking rule diagnostics. Invalid input cannot satisfy either a presence or an absence expectation.

Guarded early-return fixtures use valid function bodies; TypeScript-only fixtures select a TypeScript filename.

## The catalog

`ruleCatalog` is the single registry, and its evidence must be checkable. These specs hold the registry closed and the evidence honest.

### The catalog is the only registry

No competing rule metadata, placement, or option registry may exist. Every catalogued rule must export an implementation and implement `createOnce`, and every structured limitation case must be executed.

### Every evidence record resolves

Each rule's evidence entries carry a unique verification id and must resolve to a release-pinned official URL citing a supported release or to an existing non-empty in-repo proof file.

### The export surface is exactly the supported API

The package exports named `servicenow`, `PACKAGE_VERSION` matches `package.json`, every catalogued rule is present, and every rule's documentation URL is pinned to the release tag rather than a branch.

Version 3.1.0 preserves historical per-rule pages; a simulated 3.1.1 module targets the consolidated anchor.

### Declared applicability implies an implemented gate

Every rule whose catalog entry restricts surfaces or modes must call the corresponding gate helper in its implementation, so removing a gate fails the catalog check (FINDINGS.md COR-015).

### Gate agreement counts only executable calls

The gate collector parses the rule module and counts only `CallExpression` callees, so a helper named in a comment or a string literal cannot satisfy a declared restriction (FINDINGS.md TST-005).

### Client-surface gates name a client surface

A client-surface declaration whose only `appliesOnSurface` call names a non-client surface such as `"server"` must fail the agreement check (FINDINGS.md TST-005).

### A declared confidence floor is gated

A rule whose catalog entry claims a `minimumSurfaceConfidence` stronger than the `inferred` default must pass that exact value to every surface gate it calls; weakening the gate argument fails the agreement check.

### Rule files import analysis through the barrel

A rule module that imports `../analysis/<module>.js` for anything other than `internal.js` fails the agreement check, so the analysis barrel stays the only entry point rules can reach (docs/decisions.md MNT-006).

### Every rule map has a flat counterpart

Each preset rule map must have a `configs.flat` entry carrying the same rules object with the plugin attached, so the ESLint flat presets cannot drift from the oxlint maps (FINDINGS.md FEAT-003).

## State and settings

State can outlive its file in two places, and must not. Both were the subject of real defects.

### Rule state does not leak across files

One rule instance processed across several files must not carry bindings or counters from an earlier file. This is the FINDINGS.md COR-011 regression guard.

### Validated settings are deeply frozen

Freezing must survive cyclic objects, and the shared empty default must never be mutable or shared between two contexts. Keys, defaults, parsing, freezing, and fingerprints all derive from one descriptor.

### Settings cache identity preserves structural boundaries

Mutating a reused raw settings object into delimiter-containing invalid input must throw exactly as fresh validation does. Typed structural fingerprints distinguish nested arrays, objects and scalar text, including cycles.

### Inherited settings remain equivalent to fresh validation

Inherited fields and effective array slots participate in cache identity. Prototype and Proxy changes revalidate; own values win, actual holes stay distinct, unknown own keys fail, and getters add no fingerprint reads.

### Public contexts reject writes at every frozen level

Strict consumer compilation rejects top-level context writes, nested source-confidence writes and query-method replacement. The declared context matches its existing deeply frozen runtime value.

## Context evidence

A file's surface may come from its name or from its directory, and the two must not conflict. These specs fix the order.

### Filename classification is deterministic

Filename and directory evidence must resolve in a fixed order: UI Actions before client heuristics, specific subtypes over generic server directories, project-bounded directory evidence, and a refusal to guess when evidence conflicts.

### Explicit server naming survives for UI Actions

`approve.server.ui-action.js` and a UI Action under a project-relative `server/` directory resolve to both `ui-action` and `server` at `filename` confidence; explicit `settings.surfaces` still wins and bare UI Actions stay bare (FINDINGS.md COR-017).

### Engine rules run on server-named UI Actions

A mode-gated engine rule such as `no-promise` must report on `approve.server.ui-action.js` in ES5 mode and stay silent on a bare `approve.ui-action.js`; the real-host context fixtures carry the same case (FINDINGS.md COR-017).

### Surface vocabulary has one authored home

The client set and the server-only set must partition all eight surfaces. `ui-action` must remain in both the client-capable and server-capable sets because its execution side varies.

## Analysis behavior

The shared analysis layer carries scaling invariants alongside its facts. Adversarial rule fixtures also pin bounded guard, reference, sibling, mutation-alias, and platform-call analysis.

### Alias resolution scales linearly

Quadrupling aliases and call sites must stay well below quadratic time, proving alias resolution queries the per-file write index instead of re-walking the program (FINDINGS.md PER-005).

### Counter analysis scales linearly

Quadrupling counted cursor loops with post-loop counter writes must stay well below quadratic time while `pathBudgetExhausted` stays false, so an exhausted run can never pass as scaling evidence (FINDINGS.md PER-005).

The measured growth is about n^1.5 against a 9x budget for 4x input, so the guard proves sub-quadratic rather than strictly linear scaling.

Logical-assignment selectors stay within budget when counted loops grow from fifty to two hundred, retain all expected findings, and meet the same subquadratic timing gate.

### Nested cursor loops stay linear

Nested loops sharing one cursor avoid repeated traversal through `(node, cursor-state)` memoization. Distinct cursor subsets instead obey [[tests#Analysis behavior#Independent retention work is bounded]] and can explicitly exhaust.

### Nested sequence selectors scale with complete findings

Quadrupling independent functions with nested sequence conditions stays sub-quadratic without exhausting path analysis. Every unopened cursor still reports once, while a query in the selected branch prevents a second finding.

### The path budget grows with the program

An ordinary script must be analyzed completely: the budget scales with program size, so a longer file keeps producing findings instead of silently dropping them once a fixed work budget is spent (FINDINGS.md PER-003).

### Constant logical operands select the reachable branch

A query in the necessarily evaluated operand of a constant `&&`, `||`, or `??` counts as definite, a call in the skipped operand is never reported, and an unknown or interpolated operand keeps the join (FINDINGS.md COR-003).

### Alias writes resolve identically on every offset shape

A range-only host must resolve a rebound Fluent alias exactly like an offset host in both write directions, and a host with no offsets must suppress the alias fact rather than choose the first initializer (FINDINGS.md COR-007).

### Initialized var redeclarations are alias writes

`var T = A; var T = B;` resolves to `B` in both directions, a bare `var T;` changes nothing, and conditional or function-boundary redeclarations stay uncertain (FINDINGS.md COR-009).

### Regex features respect lexical boundaries

Lookbehind-like characters inside classes or escaped literals produce no compatibility diagnostic. Actual assertions after those forms remain diagnosed in literals and stable RegExp constructor calls.

### Template tokens require known boundaries

Each static run after a dynamic interpolation is inspected for delimited sys_ids. Unknown text cannot supply a token boundary or join separated fragments; known interpolation joins and digest-owner exceptions remain intact.

### Availability proofs respect condition effect order

Later condition writes and authoritative mutators invalidate earlier constructor or static-method availability checks. A trailing recheck restores proof across if, loop, conditional and preceding-exit guards.

### Availability proofs ignore unreachable suffix effects

Constant branches and false-loop bodies or updates do not invalidate an earlier availability check. Evaluated or unknown suffix writes still invalidate the proof before invocation.

### Alternative payload work consumes the path budget

Distinct aggregate alternatives charge clone, join, equality and enumeration work. Exhaustion discards the complete findings set; repeating equivalent tuples avoids distinct-state growth.

### Independent retention work is bounded

Distinct nested cursor states cannot multiply retention traversal indefinitely. A deterministic work cap records exhaustion, suppresses all partial findings and preserves ordinary retention diagnostics.

### Constant loop entries respect runtime reachability

False while and for conditions execute header effects but skip bodies. A false do-while test permits exactly one body execution, preserving cursor facts and unreachable-call suppression.

### Callable identities follow their execution paths

Mutable helper identities are cloned and joined with path state. Conditional reassignments cannot become definite, and inspecting uncalled bodies cannot change the enclosing callable binding.

### Callable alternatives retain branch state correlations

A query performed before a no-op helper stays paired with that helper. Querying helpers retain the unopened branch they repair. Both branch orders and helper aliases prove every actual path queries without budget exhaustion.

Conditional expression results retain their selected callable through outer assignments and aliases. Argument-created alternatives receive parameter bindings and call effects before joining; unopened controls continue to report.

### Template tags invalidate captured selectors after substitutions

Template tags retain their selected callable before substitutions and expose capture effects after normal evaluation. Saved receivers, rebinding, throwing substitutions and immediate generator defaults preserve execution order.

### Generator tags initialize parameters before deferring the body

Known generator tags bind the supplied strings array and saved substitutions before evaluating applicable defaults. Parameter effects reach the caller while discarded iterator bodies stay deferred.

The strings argument skips its default. Missing or undefined substitutions execute defaults; null and non-nullish substitutions skip them, while unknown values join possible effects. Saved scalar, callable and record arguments retain their identities across later substitutions. Ordered defaults stop on throws; nested patterns stay conservative and retained iterators expose captures. Repeated invocation preserves diagnostics within the existing work budget.

### Proven template tag lookups retain substitution effects on catches

Proven local callable lookups and function literals do not create catch paths before substitutions. Invocation throws retain completed substitution effects, while unknown and member lookups preserve possible earlier throws.

An alias assigned inside a scalar substitution remains trusted across catch joins. Passing the record value itself retains the existing argument escape policy; callable rebinding and parameter initialization do not change the selected tag.

### Logical assignments export their selected values

Returned and thrown logical assignments export only the selected object or callback on each path. Skipped operands neither execute cursor advances nor escape captures; retained aliases and mutable scalar selectors keep their runtime facts.

Direct and nested helper writes update captured selectors. Updates, destructuring, differing branch facts, escaped callbacks and unmodeled constructor or callable-method invocation discard certainty. Escaped captures remain uncertain after later scalar writes; constructor arguments cannot replace the callee before its capture effects are considered. Wrapper callbacks, cycles, exposed helper replacements and opaque class effects cannot restore false scalar certainty. Unused and unreachable class bodies preserve surrounding selector facts. Real ESLint and Oxlint fixtures exercise selected objects, skipped effects and captures, and callback invalidation.

### Logical assignment headers release transient correlations

Independent logical-assignment headers discard selected expression results after statement or loop-header consumption, keeping ordinary if, switch, loop, with and class traversal within its deterministic budget.

With uses a fixed-authority low-level fixture because dynamic scope deliberately suppresses rule diagnostics. Fifty independent class headers retain the final finding; evaluated header effects remain visible.

### Logical assignment parameters retain evaluated scalars

Known helpers receive scalar, object and callable arguments captured before later argument effects. Missing or undefined parameters evaluate defaults in order; uncertain arguments preserve possible default effects and explicit null skips defaults.

Callback parameters export the selected callable, and enclosing conditional or logical consumers escape only the selected result.

### Nullish helper arguments select only applicable defaults

Evaluated null arguments skip defaults, while undefined arguments run them. Aliases, selected expressions and saved helper parameters retain this distinction without losing shared truthiness and nullishness at mixed joins.

Null arguments preserve a later unfiltered bulk finding and skip operations placed in defaults. Unknown null-or-undefined values retain possible default effects; later arguments cannot change an earlier captured argument value.

### Hoisted callable logical selectors are defined values

Hoisted functions are truthy and non-nullish before their declaration position. Reassignments, unknown alternatives and escaped capture markers prevent stale certainty from suppressing reachable operands.

### Unrelated callback scalars do not enlarge selector snapshots

Two hundred unrelated scalar captures preserve all two hundred counted-loop findings without exhausting analysis. Callback exposure follows callable dependencies without retaining nonselector scalar facts.

### Evaluated logical selectors choose reachable control flow

Produced logical-assignment values select the reachable if, conditional, logical and loop paths. Header effects and abrupt alternatives survive consumption, while ordinary unresolved identifiers remain conservative.

### Generator invocation evaluates parameters before deferring bodies

Known generator calls bind saved arguments and execute applicable defaults before producing their iterator. Null skips defaults, undefined runs them, and possible defaults keep diagnostics and synchronous throws without replaying the body.

Earlier parameters feed later defaults, argument replacements cannot rewrite saved values, and definite default writes project back to the caller. Nested pattern defaults and computed keys retain possible immediate effects. Retained iterators preserve the existing capture boundary; ordinary and async generator default throws skip later caller effects.

### Discarded generator values keep bodies deferred

Generator calls and tags discard iterator values through void, parentheses and non-final sequences while preserving immediate parameter effects. Enclosing discarded logical and conditional results also keep their body captures deferred.

Retained bindings, arguments, condition tests and assignments inside void preserve the conservative capture boundary. Defaults still query, mutate selectors or throw synchronously; transparent TypeScript wrappers preserve whether a result is retained.

### External consumers escape evaluated argument values

Calls, construction and template tags consume argument values saved before later arguments replace their bindings. Unknown and wrapped values retain their own object and callable identities on each completed path.

Saved callbacks still observe capture bindings after all arguments run. Abrupt arguments skip exports, and generator invocation executes parameter initialization while leaving its ordinary body deferred.

### Mapped receiver alternatives retain evaluated identities

Conditional and logical member receivers preserve each selected arguments-object identity before joins. Writes invalidate only possibly mapped parameters; definitely skipped receiver arms retain selector facts.

Fixed-authority execution tests isolate mapping from the existing conservative method-authority policy for unresolved compound receivers. Prefix, compound and direct writes all retain the evaluated receiver before the write occurs.

### Strict directives retain their original spelling

Only unescaped use-strict string literals enable strict mode. Hex, Unicode and line-continuation spellings remain sloppy, while later exact directives and prologue boundaries retain mapped-arguments semantics.

### Lexical arguments captures allocate stable owner identities

Nested arrows retain the owning function’s mapped arguments even when captures are cached before invocation. Sequence and alias calls must reuse that owner identity; ordinary nested functions and strict scopes stay isolated.

### Strict directives belong to script and function prologues

Only script and function-body directive prologues enable strict argument semantics. A string expression at the start of an ordinary, nested, conditional or catch block leaves sloppy parameter mapping intact.

Inherited actual strict directives and modules keep parameters independent from argument-object writes. An explicit strict function inside an ordinary block remains strict even when the block itself is not a directive scope.

### Constructor capture effects follow argument evaluation

Construction saves its callable identity before arguments run and applies capture effects on each completed argument path. Earlier aliases retain trust; newly installed captured records escape, and throwing arguments skip invocation effects.

Spread arguments and replacement of the constructor binding preserve evaluation order. Unknown constructors cannot acquire the capture effects of a class installed by an argument, and no-capture constructors retain record diagnostics.

### Known construction evaluates instance field initializers

Known construction runs instance field values in source order after normal arguments. Saved constructor alternatives retain their class; unconstructed fields stay deferred, and static values and computed keys execute only at definition.

Ordered scalar fields preserve reachable operations; abrupt arguments skip every field, and a throwing initializer skips later fields while retaining earlier effects. Each constructor alternative keeps its own record state, recursion terminates conservatively, and locally queried initializers stay quiet. Completed field values escape before later fields, and fifty independent selectors release temporary correlations while preserving enclosing argument snapshots. Instance properties and constructor bodies retain their existing opaque policy.

### Known construction retains evaluated superclass field chains

Known superclass fields run before derived fields using the heritage value saved at class definition. Rebinding, keys and static effects cannot replace that value; unknown bases retain their existing opaque policy.

Alternative and correlated bases run on separate paths; helper-created and repeated class sites preserve saved heritage. Abrupt arguments skip every field, while a thrown base initializer skips derived fields and retains prior effects. Static values and computed keys remain definition-only. Recursive construction and fifty known hierarchy levels complete within the existing budget, and field cleanup preserves enclosing constructor and argument values.

### Class definitions evaluate only immediate class effects

Class extends expressions, computed keys and static initialization run at definition time. Instance field values stay deferred; constructing an opaque class discards trust in its captured effects.

### Class expressions consume headers and initialize names in order

Class expressions discard temporary header results while retaining enclosing values. Inner class names become truthy after keys and before static initialization; declaration outer names initialize after the definition completes.

Fifty independent unknown keys complete within the existing work budget, both without heritage and with a definite selected base. A separate unknown base stays conservative. Heritage and key self-references remain uncertain; static names retain their own class identity instead of an enclosing binding.

Earlier scalar, callable and logical-assignment arguments survive class keys that replace their bindings. Constructor callee values likewise remain available after a class expression argument completes.

### Class decorator expressions preserve evaluation effects

Class and member decorator expressions retain their calls and scalar effects. Class decorators precede heritage; member decorators precede their keys in source order, before static initialization.

Real TypeScript parser nodes run through an active server rule context. Decorator queries open the record before later cursor advances, decorator advances remain diagnosed, and member ordering cannot retroactively repair an earlier cursor use.

### Decorator applications retain saved captures through static initialization

Decorator applications consume saved identities after keys, before static initialization. Capture uncertainty survives static writes; empty synchronous non-generator functions with ordinary unused parameters preserve deferred class facts.

Named and member decorators invalidate selector captures even without an explicit call in source. Computed keys cannot replace an earlier selected decorator; opaque factory returns and unknown decorators conservatively expose target captures. Application uses current captured records after keys.

Raw traversal proves that affected static selectors execute even when target exposure suppresses rule authority. Possible decorator throws retain catch paths before and after capture effects. Empty synchronous non-generator bodies with only ordinary unused parameters retain records and scalar facts and do not invent catch paths. Defaults, destructuring and rest parameters, plus async and generator returns, remain conservative.

Fifty independent discarded keys complete under the existing work budget while one decorator value stays live. Capture scans and transient-map work are charged, with no budget increase.

### Logical member receivers retain path-specific values

A member call uses the object selected on each correlated path before computed keys or arguments can replace its binding. Unknown receiver alternatives retain reachable cursor diagnostics.

### Mapped arguments writes invalidate scalar selectors

Sloppy simple-parameter functions invalidate mapped selector facts when arguments aliases mutate or escape. Strict, non-simple, absent arguments and shadowed or replaced aliases preserve separate parameter values.

Arrows inherit the nearest ordinary function's arguments owner; nested ordinary functions own separate arguments. A hoisted no-op var declaration preserves mapping in fixed-authority traversal, while unknown bound aliases retain conservative method-authority silence.

### Mapped member writes obey evaluation order

A mapped member write retains its receiver before computed-key and RHS effects, and runs only after normal RHS completion. Throwing or suspended expressions skip the write while keeping effects that already occurred.

Fixed-authority tests distinguish an unknown receiver later replaced by arguments from a mapped receiver later replaced by an array. Computed-key throws and normal prefix, postfix, direct and compound writes retain their expected execution paths.

### Mapped arguments compound writes invalidate selectors

Mapped prefix, postfix and compound writes discard stale selector facts in sloppy simple-parameter helpers. Strict, non-simple and absent-argument cases remain independent, and writes retain their receiver before key or right-hand-side effects.

### Mapped arguments retain positional ownership

Only supplied last-occurrence parameter positions map to arguments. Earlier duplicates, missing final positions and unrelated properties retain selector facts; known mapped indices invalidate only their owning selector.

Numeric and canonical string indices, aliases, lexical arrows, unknown keys and unknown arity obey positional ownership. Direct, compound and update writes preserve the evaluated receiver; right-hand-side key rewrites cannot introduce stale precision. Strict and non-simple functions remain independent. Duplicate initialization uses the final parameter value, and every public-rule control asserts complete analysis.

### Selector alias dependencies reuse callable origins

Repeated calls through a deep alias chain retain security findings within budget. Quadrupling aliases and calls stays subquadratic; cycles, diamonds and distinct helper arguments preserve dependency facts.

### Assigned helpers preserve every callable origin

Assigned function and arrow expressions retain helper argument facts. Branches and replacements preserve every origin without hoisting runtime values; repeated calls remain active within bounded subquadratic work.

Disabled arguments skip cursor effects for named expressions, defaults, aliases and selected sequence, conditional or logical results. Distinct parameter positions and scalar bindings distinguish successive origins. Enabled and unknown arguments retain reachable diagnostics, while five hundred calls preserve the final cursor finding without exhaustion.

### Assigned helper inspection follows actual invocation

Selected runtime invocations suppress isolated body inspection; static origins alone cannot hide a function assigned after a call, overwritten before its only call, or reached only by skipped or opaque calls.

Direct and aliased calls use actual false arguments, including hoisted declarations and later nested invocation. Uncalled callers precede their known callees regardless of declaration order, preserving helper arguments without losing genuinely uncalled local cursor and bulk-operation findings. Cycles and diamonds terminate conservatively. Five hundred calls inside a pending caller retain a positive finding within the default budget, and quadrupling calls remains subquadratic.

Deferred opaque callbacks retain callable captures observed at definition and exposure, including an intermediate replacement hidden by the final callable state. One or two wrappers and cycles preserve transitive captures; a dominating body write replaces imported targets, and disabled nested arguments remain quiet. Actual direct calls before and after replacement still replay their selected temporal target.

### Known default patterns preserve argument facts

Known Call and generator Tag pattern defaults distinguish definite null from undefined even when their target has no single binding identity, preserving literal and aliased argument facts.

Object and array patterns skip defaults for supplied null and evaluate defaults for undefined. Transparent sequences and selected conditional or logical argument values keep their facts, while skipped logical right operands remain skipped. Catch paths retain the final cursor finding, and every case completes within the default budget.

### Return and throw escape evaluated values

Returned and thrown allocations lose trust after expression evaluation, including captured assignments and sequences. Cursor advances within those expressions remain diagnosed; exporting another value retains the captured object's trust.

Real ESLint and Oxlint fixtures verify escaping allocations, cursor advances evaluated before escape, and retained trust when a sequence exports another value.

Constant conditional and logical selectors export only the selected value, preserving trust when newly allocated records occur in evaluated operands but the result is scalar.

Nested sequence classification is bounded and becomes unknown beyond the depth limit. Arithmetic compound assignments export primitive results, retaining trust in captured objects allocated on their right-hand side.

Selected function and arrow literals escape their captured platform objects, including when they are returned or thrown through a sequence or passed to an unknown callee. Known no-op callees retain trusted captured state and remain diagnosable.

### Selected logical assignment literals escape constructed payloads

Constructed array and object payloads escape before their selected logical assignment value is exported. A skipped literal leaves its captured records trusted, preventing structural recursion from changing the selected value.

Returned array, object and nested callback literals preserve construction-time escape effects for selected `||=`, `&&=` and `??=` results. Skipped right-hand sides retain cursor diagnostics; thrown array and object payloads likewise escape their records without budget exhaustion.

### Callable correlations remain bounded

Independent helper choices exhaust deterministic work and suppress earlier findings. Replacing one helper repeatedly compacts equivalent callable states, preserving ordinary diagnostics without exhaustion.

### Known-node scope construction and lookup scale together

Quadrupling function and block scopes keeps scope construction plus ancestor-free identifier resolution below quadratic growth. Every identifier must retain a binding, so early termination cannot satisfy the scaling check.

### Constant expressions retain the selected alias

Constant conditional and logical expressions preserve the selected value's identity while ignoring unreachable writes. Unknown choices continue to join conservatively.

### Fluent alias writes preserve execution order and invalidate unknown values

Pending RHS uses retain the pre-write factory; completed pattern and loop-head writes invalidate it, including var targets. Earlier uses, lexical shadows, function uncertainty and host offset shapes stay consistent.

### Fluent properties require effective value proof

ID and table-name checks scan properties backward, suppressing uncertain spreads and computed keys while preserving trailing explicit properties and exact missing/raw diagnostics.

### Fluent directives attach to brace-free branches

Previous-line directives attach symmetrically to consequent and alternate statements, including mixed and nested branches. Blank-line placement and actual block tails still report.

### Deep Fluent alias chains are stack safe

A 6000-binding Fluent alias chain resolves without native recursion. Initializers retain their lexical scope across caller shadows, cycles stay unknown, and namespace module/member authority remains intact on source and real hosts.

### Known AST nodes retain lexical scope ownership

Known nodes resolve through their indexed lexical scope even when callers supply unrelated ancestors or hosts omit offsets. Foreign nodes retain conservative offset-based containment and root fallback.

### Mapped arguments identities survive preceding joins

Implicit arguments objects and aliases retain their owner identity through branches, catches and loops without becoming domain records. Replaced and strict arguments remain independent; possible mapped receivers retain correlated paths.

### Known parameter replay retains evaluated arguments without selectors

Earlier callable arguments retain their evaluated identities when later arguments replace their bindings, even without logical assignments. Known ordinary calls and generator defaults invoke the original callback without executing deferred bodies.

Provided second arguments skip their defaults, including the exact reviewed example. Missing and explicit undefined defaults execute; explicit null skips them. Selected sequence, conditional and logical values retain callbacks, generator tags evaluate defaults, and unknown or originally empty callbacks remain conservative. Five hundred repeated saved-argument defaults retain the final bulk-operation finding within the existing budget.

## Integration

Real lint hosts must agree on conservative fact boundaries and applicability, with parser and process success established before semantic filtering.

### Correctness proofs agree across lint hosts

ESLint and Oxlint agree on dynamic template boundaries, lexical regex features and condition-ordered availability, including unreachable suffix writes. Each case checks exact diagnostics with host failures rejected.

### Mixed UI Action gates remain rule-specific

Explicit client/server UI Actions still run query, aggregate, getReference and GlideAjax checks while engine rules suppress mixed regions. Generated common applicability must preserve this distinction.

## Scripts and tooling

The repository's own tooling carries invariants separate from the plugin's behavior.

### Scripts are checked JavaScript with no separate declarations

JSDoc-typed `scripts/*.mjs` is the single source of truth: `tsconfig.scripts.json` runs `checkJs` in the validate chain and no `scripts/*.d.mts` may exist (FINDINGS.md MNT-005).

### Benchmark output records the measured source state

A benchmark summary carries `sourceState`, and a dirty worktree lists the differing `dirtyFiles`, so a clean checkout and a modified one at the same HEAD produce distinguishable metadata (FINDINGS.md DX-001).

### Benchmark outputs never mark their own run dirty

The run's output path and the reviewed baseline path are excluded from the porcelain scan, and untracked files count only under source, script, test, and manifest paths (FINDINGS.md DX-001).

### Source state is required for new runs and tolerated in old baselines

`validateBenchmarkSummary` rejects a newly written summary without `sourceState` and accepts the reviewed baseline that predates the field, so older readers keep working (FINDINGS.md DX-001).

### Cleanup rejects symlinked artifact paths

Verifier cleanup must reject a symbolic link in the artifact root or selected run path and leave the linked target unchanged.

### Cloud tooling dependencies are locked

The Cloud Agent installs Bun at the exact version and integrity recorded in its committed npm lockfile before exposing the binary to the unprivileged user.

### Generated artifacts share one manifest

The documentation generators, the catalog checker, and `docs:check` must use one path list. README marker replacement must reject unregistered section names.

Both README formatter-guide links, the compatibility link, and the Australia engine-update ledger link must use generated repository references, whose URLs track the package release tag rather than a hand-written version.

### Test report queries use one clean-pass rule

A proof passes only when its `file::fullName` key occurs once and the outcome is a clean pass.

A clean pass has status `passed` without skip or todo. Summary counts use the same definition.

### Evidence captures use private reports and atomic artifacts

Evidence tests use unique temporary report directories, remove them after capture, and leave a complete JSON artifact after replacement.

### Compatibility reports reject raw host failures

Malformed JSON, parser/plugin-load diagnostics, nonstandard exit statuses, signals, spawn errors and timeouts fail compatibility validation before diagnostic filtering, even if stdout contains plausible JSON.

## Release governance

Claims made about a release must be reconstructible from the repository, not asserted in prose.

### Recoverable registry failures retain bounded retries

Native aborts/timeouts, Undici socket and connection/header/body timeouts, response-read transport failures and HTTP/npm 500 errors recover within bounded attempts. Malformed JSON and identity or integrity failures remain permanent.

### Hosted jobs run every static gate

The CI `test` job and the release `validate` job must both invoke `typecheck`, `typecheck:fixtures`, and `typecheck:scripts`, so a script-body type error cannot pass hosted validation while failing the local chain (FINDINGS.md TST-006).

### The migration guide quotes the declared peer ranges

`docs/migration-3.0.md` must state the exact `oxlint` and `oxfmt` peer ranges from `package.json`, use an install example inside them, and link the compatibility table (FINDINGS.md DOC-006).

### Strict consumers distinguish omitted settings from undefined

A strict consumer compiles omitted settings and mutable context projections through emitted package exports. It rejects explicit undefined optional settings and writes through both public context entry points.

### Foreign package execution is isolated from release inputs

Registry-installed package code runs only after the release tarball is immutable and cannot provide an artifact to the npm publish or GitHub release jobs.

### Merging a version tags it exactly once

The tag script creates one tag at the exact `main` commit, defaults the version to `package.json`, and returns an existing tag without a push.

It refuses a version the changelog does not name before touching `main`.

### The tag workflow runs only through the controlled actor

The workflow runs on a push to `main` that changes `package.json` or `CHANGELOG.md`, with a read-only token, no dependency install, and the app token scoped to this repository.

### One command prepares a release pull request

`releaseChangelog` moves the `Unreleased` notes under a dated version heading, leaves `Unreleased` empty, and the result passes the release changelog check.

It refuses an empty `Unreleased` section, a heading the changelog already has, and a changelog without `Unreleased`. Isolated fixtures cover consecutive releases after new notes are added, so the tests also pass when the repository's `Unreleased` section is empty after preparation. `prepareRelease` sets the same version in `package.json` and both lockfile entries and rejects a repeated or non-SemVer version.

### The unattended release environment is audited as such

The authoritative policy names no environment reviewers, and the audit holds the live environment to that shape.

The audit accepts a live environment with no protection rules and reports drift when the live environment gains reviewers or a self-review setting.

## Fluent manifest

The SDK model has two trust boundaries: the reviewed API inventory, and the published artifact it was read from.

### The manifest matches the pinned fixture

The reviewed manifest must match `tests/fixtures/fluent-manifest-current.json`, carry evidence on every API and directive, require `$id` where the SDK requires it, and reject deleted lifecycle fields.

### The SDK tarball trust boundary holds

The audit script must accept only the exact npm registry artifact URL, cap declared, streamed, and decompressed byte counts, verify the pinned SHA-512 digest, and reject unsafe, duplicate, or linked tar entries.

### Shared declaration evidence expands without loss

The canonical fixture round-trips every reviewed version, keeps expanded versions independent and rejects missing references or unsupported schemas.

### Malformed shared evidence cannot erase verification

Missing lifecycle inventory entries and malformed lists, declarations, lifecycle records or references must be rejected, so damaged fixtures cannot silently remove manifest verification coverage.
