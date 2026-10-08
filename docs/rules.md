# Rule reference

Generated from the rule catalog. Rules report diagnostics only; none rewrites code. Each section records applicability, examples, boundaries and evidence.

See [rule authoring](rule-authoring.md) and [non-goals](non-goals.md).

## no-hardcoded-sysid

Hardcoded 32-character sys_ids break when an app is installed on another instance. Store them in a system property, a named constant, or Fluent `Now.ID`.

**Placements:** recommended (error). **Last verified:** 2026-08-24

### Applicability

classic; surfaces: Applies to client, server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Action applicability also depends on explicit client/server surfaces and the rule's execution-context gate. Unknown surfaces stay silent.; confidence: inferred; modes: n/a; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.

### Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `allowedSysIds` | string[] | `[]` | Additional sys_ids that this rule allows. Settings `allowedSysIds` are also allowed. |
| `ignoreHashNames` | boolean | `true` | Ignore 32-character hex values whose nearest variable, property, or assignment owner name looks like an MD5 hash. |

#### Incorrect: literal sys_id

```js
var assignmentGroup = "97c04b3b1b12100043ab85e5bd0713e2";
current.assignment_group = assignmentGroup;
```

#### Correct: system property

```js
var assignmentGroup = gs.getProperty("x_acme.default_assignment_group");
current.assignment_group = assignmentGroup;
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. false-negative: Default MD5-owner suppression can hide a real sys_id stored under an MD5-like name; set `ignoreHashNames: false` when that false-negative tradeoff is unacceptable.

- False negative: Default MD5-owner suppression can hide a real sys_id stored under an MD5-like name; set `ignoreHashNames: false` when that false-negative tradeoff is unacceptable.


Overlaps: `servicenow/no-now-id-as-reference`, `core no-restricted-syntax`.

### Evidence

- [Named Fluent Now.ID keys are the supported portable identity, not raw sys_id literals.](https://www.servicenow.com/docs/r/application-development/servicenow-sdk/fluent-constructs.html) — manual, 2026-08-20; `rule-evidence-2d6f67d8`.
- [Literal, uppercase, concatenated, and static-template sys_ids report; exact allow-lists and structurally owned algorithm-specific hash contexts suppress.](../tests/rules/no-hardcoded-sysid.test.ts) — fixture, 2026-08-24; `rule-evidence-7930a0f5`.
- [Real Oxlint and ESLint valid-profile contracts preserve an outer MD5 owner across nested sibling expressions.](../tests/integration/profiles/valid/hash-context.br.js) — integration-test, 2026-08-24; `rule-evidence-a0628420`.

[Catalog source](../src/catalog/no-hardcoded-sysid.ts).

## no-promise

Compatibility and ES5 Standards modes do not implement Promises. Direct calls plus stable same-execution constructor and static-method owner aliases report; bare aliases must be captured under an owner guard, while fully guarded, visibly polyfilled, unknown-mode, and local `Promise` uses stay silent.

**Placements:** classic-es5 (error). **Last verified:** 2026-08-24

### Applicability

classic; surfaces: Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Action applicability also depends on explicit client/server surfaces and the rule's execution-context gate. An explicit javascriptMode also enables documented engine checks in otherwise unclassified files.; confidence: inferred; modes: compatibility, es5; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.


#### Incorrect: constructor

```js
var p = new Promise(function (resolve) { resolve(1); });
```

#### Correct: synchronous Glide

```js
var gr = new GlideRecord("incident");
if (gr.get(sysId)) {
  gs.info(gr.number);
}
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: Local bindings named Promise are not platform Promises. scope-boundary: A possible callable replacement for Promise or a used static method suppresses matching diagnostics throughout the file, regardless of source order. scope-boundary: A constructor call protected by a structurally dominating owner guard stays silent; static calls require both the Promise owner and selected method to be guarded. false-negative: A Promise alias used from another function body stays silent because source order cannot prove that its initializer ran before the function was called. false-negative: Direct aliases of individual Promise static methods stay silent; the shared resolver proves stable aliases of the Promise owner instead.

- False negative: A Promise alias used from another function body stays silent because source order cannot prove that its initializer ran before the function was called.
- False negative: Direct aliases of individual Promise static methods stay silent; the shared resolver proves stable aliases of the Promise owner instead.
- Scope: Local bindings named Promise are not platform Promises.
- Scope: A possible callable replacement for Promise or a used static method suppresses matching diagnostics throughout the file, regardless of source order.
- Scope: A constructor call protected by a structurally dominating owner guard stays silent; static calls require both the Promise owner and selected method to be guarded.


Overlaps: `servicenow/no-async-await`, `eslint no-restricted-globals`.

### Evidence

- [Promises are unsupported in Compatibility and ES5 Standards modes.](https://www.servicenow.com/docs/r/zurich/api-reference/scripts/javascript-engine-feature-support.html) — manual, 2026-08-20; `rule-evidence-d22e5ebe`.
- [Fixtures cover stable Promise constructor and static-method owner aliases, guarded alias capture, owner-and-method availability checks, modeled built-in invalidation, visible polyfills, mutation, and dynamic scope.](../tests/rules/no-promise.test.ts) — fixture, 2026-08-24; `rule-evidence-45fae05c`.
- [Real Oxlint and ESLint classic-es5 profiles report a stable Promise alias and accept an explicit callable polyfill.](../tests/integration/profiles.test.ts) — integration-test, 2026-08-24; `rule-evidence-ae60ea43`.
- [The Australia JavaScript engine feature table was reviewed for this rule's modeled capability cells.](https://www.servicenow.com/docs/r/api-reference/scripts/javascript-engine-feature-support.html) — manual, 2026-08-22; `rule-evidence-14208b4e`.

[Catalog source](../src/catalog/no-promise.ts).

## no-async-await

async/await is not implemented in Compatibility or ES5 Standards mode.

**Placements:** classic-es5 (error). **Last verified:** 2026-08-22

### Applicability

classic; surfaces: Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Action applicability also depends on explicit client/server surfaces and the rule's execution-context gate. An explicit javascriptMode also enables documented engine checks in otherwise unclassified files.; confidence: inferred; modes: compatibility, es5; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.


#### Incorrect: async function

```js
async function loadIncident(id) {
  return await fetchIncident(id);
}
```

#### Correct: sync function

```js
function loadIncident(id) {
  var gr = new GlideRecord("incident");
  return gr.get(id) ? gr : null;
}
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing.

- None recorded.


Overlaps: `servicenow/no-promise`, `servicenow/no-async-iterators`.

### Evidence

- [async/await is unsupported in Compatibility and ES5 Standards modes.](https://www.servicenow.com/docs/r/zurich/api-reference/scripts/javascript-engine-feature-support.html) — manual, 2026-08-20; `rule-evidence-c494572f`.
- [async functions and await expressions report in ES5 mode.](../tests/rules/no-async-await.test.ts) — fixture, 2026-08-20; `rule-evidence-75462ec9`.
- [The Australia JavaScript engine feature table was reviewed for this rule's modeled capability cells.](https://www.servicenow.com/docs/r/api-reference/scripts/javascript-engine-feature-support.html) — manual, 2026-08-22; `rule-evidence-271ddeb4`.

[Catalog source](../src/catalog/no-async-await.ts).

## no-bigint

BigInt literals and `BigInt()` are unsupported in Compatibility or ES5 Standards mode. Direct calls and stable same-execution aliases report; bare aliases must be captured under an availability guard, while visibly polyfilled, guarded, unknown-mode, and local `BigInt` calls stay silent.

**Placements:** classic-es5 (error). **Last verified:** 2026-08-24

### Applicability

classic; surfaces: Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Action applicability also depends on explicit client/server surfaces and the rule's execution-context gate. An explicit javascriptMode also enables documented engine checks in otherwise unclassified files.; confidence: inferred; modes: compatibility, es5; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.


#### Incorrect: literal

```js
var n = 9007199254740993n;
```

#### Correct: number

```js
var n = 9007199254740991;
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: A possible callable BigInt replacement suppresses call diagnostics throughout the file, regardless of source order; BigInt literal diagnostics are unaffected. scope-boundary: A call protected by a structurally dominating BigInt availability guard stays silent for code shared with another runtime. false-negative: A BigInt alias used from another function body stays silent because source order cannot prove that its initializer ran before the function was called.

- False negative: A BigInt alias used from another function body stays silent because source order cannot prove that its initializer ran before the function was called.
- Scope: A possible callable BigInt replacement suppresses call diagnostics throughout the file, regardless of source order; BigInt literal diagnostics are unaffected.
- Scope: A call protected by a structurally dominating BigInt availability guard stays silent for code shared with another runtime.


Overlaps: `servicenow/no-unsupported-syntax`.

### Evidence

- [BigInt is unsupported in Compatibility and ES5 Standards modes.](https://www.servicenow.com/docs/r/zurich/api-reference/scripts/javascript-engine-feature-support.html) — manual, 2026-08-20; `rule-evidence-d1b19fa7`.
- [BigInt literals, stable call aliases, guarded capture, modeled invalidation, visible polyfills, shadowing, and dynamic scope are covered.](../tests/rules/no-bigint.test.ts) — fixture, 2026-08-24; `rule-evidence-396a0363`.
- [Real Oxlint and ESLint classic-es5 profiles report a stable BigInt alias and accept an explicit callable polyfill.](../tests/integration/profiles.test.ts) — integration-test, 2026-08-24; `rule-evidence-e66056ed`.
- [The Australia JavaScript engine feature table was reviewed for this rule's modeled capability cells.](https://www.servicenow.com/docs/r/api-reference/scripts/javascript-engine-feature-support.html) — manual, 2026-08-22; `rule-evidence-2aae7d4a`.

[Catalog source](../src/catalog/no-bigint.ts).

## no-incorrect-array-from-thisarg

Zurich throws when Array.from receives an explicit primitive mapper thisArg—even for an empty source, because conversion precedes iteration—and gives a non-strict mapper the wrong this when that argument is omitted. Australia corrects both ES2021 behaviors. The rule reports only stable native calls with a syntax-proven callable mapper.

**Placements:** es2021 (error). **Last verified:** 2026-08-24

### Applicability

classic; surfaces: Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Action applicability also depends on explicit client/server surfaces and the rule's execution-context gate. An explicit javascriptMode also enables documented engine checks in otherwise unclassified files.; confidence: inferred; modes: es2021; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.


#### Incorrect: explicit null mapper thisArg in Zurich

```js
var values = Array.from(source, function (value) { return value; }, null);
```

#### Incorrect: omitted mapper thisArg in Zurich

```js
var values = Array.from(source, function (value) { return this.normalize(value); });
```

#### Correct: null mapper thisArg in Australia

```js
var values = Array.from(source, function (value) { return value; }, null);
```

#### Correct: explicit object mapper thisArg in Zurich

```js
var values = Array.from(source, function (value) {
  return this.normalize(value);
}, normalizer);
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. false-negative: Member expressions, parameters, mutable variables, and callable aliases crossing an execution boundary stay silent because the rule cannot prove the mapper's function semantics. scope-boundary: The omitted-third-argument diagnostic requires a syntax-proven non-strict ordinary mapper that reads its own this; strict functions, arrows, and mappers without such a read stay silent. false-negative: A nested arrow contributes mapper-this usage only when syntax proves that it is directly invoked, returned, thrown, or yielded. Arrows whose later invocation or escape requires alias analysis stay silent. scope-boundary: The omitted-this diagnostic stays silent for a definitely empty source because the mapper cannot run. An empty const array remains proven only across non-mutating reads and direct const aliases. false-negative: Spread arguments and calls with a definitely nullish source stay silent because argument positions or whether execution reaches mapper-this handling cannot be proven. false-negative: Primitive this arguments produced by calls, substitutions, or non-nullish compound expressions stay silent; the rule proves nullish expressions (including void), primitive literals, and no-substitution templates through dominating const aliases. scope-boundary: A possible Array owner or Array.from replacement suppresses diagnostics throughout the file; direct aliases of Array.from also stay silent because native method identity is not proven. scope-boundary: Calls stay silent when settings.servicenow.release is omitted because Zurich and Australia have different native behavior.

- False negative: Member expressions, parameters, mutable variables, and callable aliases crossing an execution boundary stay silent because the rule cannot prove the mapper's function semantics.
- False negative: A nested arrow contributes mapper-this usage only when syntax proves that it is directly invoked, returned, thrown, or yielded. Arrows whose later invocation or escape requires alias analysis stay silent.
- False negative: Spread arguments and calls with a definitely nullish source stay silent because argument positions or whether execution reaches mapper-this handling cannot be proven.
- False negative: Primitive this arguments produced by calls, substitutions, or non-nullish compound expressions stay silent; the rule proves nullish expressions (including void), primitive literals, and no-substitution templates through dominating const aliases.
- Scope: The omitted-third-argument diagnostic requires a syntax-proven non-strict ordinary mapper that reads its own this; strict functions, arrows, and mappers without such a read stay silent.
- Scope: The omitted-this diagnostic stays silent for a definitely empty source because the mapper cannot run. An empty const array remains proven only across non-mutating reads and direct const aliases.
- Scope: A possible Array owner or Array.from replacement suppresses diagnostics throughout the file; direct aliases of Array.from also stay silent because native method identity is not proven.
- Scope: Calls stay silent when settings.servicenow.release is omitted because Zurich and Australia have different native behavior.


### Evidence

- [The Australia engine update lists Rhino PR 1982, Correct this in Array.from, as an ECMAScript 2021 fix.](https://www.servicenow.com/docs/r/api-reference/scripts/updates-javascript-engine.html) — manual, 2026-08-24; `rule-evidence-8b67060f`.
- [Fixtures prove explicit-primitive throws and omitted-this mismatches while covering strictness, lexical arrows, callable aliases, source validity, spread ambiguity, native authority, release selection, and unsupported contexts.](../tests/rules/no-incorrect-array-from-thisarg.test.ts) — fixture, 2026-08-24; `rule-evidence-fb9ff90a`.
- [Real Oxlint and ESLint contracts verify explicit-nullish and omitted-this behavior in Zurich, Australia, and omitted-release configurations.](../tests/integration/release-contracts.test.ts) — integration-test, 2026-08-24; `rule-evidence-b119dc04`.

[Catalog source](../src/catalog/no-incorrect-array-from-thisarg.ts).

## no-unhoisted-block-function-use

Before Australia, ServiceNow does not correctly hoist nested block function declarations to block entry. This rule reports binding-proven reads before the declaration in the same execution body across every instance JavaScript mode.

**Placements:** classic-es5 (error), es2021 (error). **Last verified:** 2026-08-24

### Applicability

classic; surfaces: Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Action applicability also depends on explicit client/server surfaces and the rule's execution-context gate. An explicit javascriptMode also enables documented engine checks in otherwise unclassified files.; confidence: inferred; modes: compatibility, es5, es2021, unknown; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.


#### Incorrect: nested helper called before declaration in Zurich

```js
function calculate() {
  try {
    return add(2, 3);
    function add(left, right) { return left + right; }
  } catch (error) {
    return 0;
  }
}
```

#### Correct: helper declared before use

```js
function calculate() {
  try {
    function add(left, right) { return left + right; }
    return add(2, 3);
  } catch (error) {
    return 0;
  }
}
```

#### Correct: Australia block hoisting

```js
{
  helper();
  function helper() { return 1; }
}
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. false-negative: References inside nested functions or classes stay silent because their invocation can occur after the block declaration has executed. false-negative: A reassigned function binding or direct eval/with makes pre-declaration identity unknown, so every matching use in that file stays silent. scope-boundary: Function declarations directly owned by switch cases stay silent because Rhino PR 1806 explicitly left switch hoisting outside its proven implementation. scope-boundary: Pre-declaration uses stay silent when settings.servicenow.release is omitted because Zurich and Australia have different hoisting behavior.

- False negative: References inside nested functions or classes stay silent because their invocation can occur after the block declaration has executed.
- False negative: A reassigned function binding or direct eval/with makes pre-declaration identity unknown, so every matching use in that file stays silent.
- Scope: Function declarations directly owned by switch cases stay silent because Rhino PR 1806 explicitly left switch hoisting outside its proven implementation.
- Scope: Pre-declaration uses stay silent when settings.servicenow.release is omitted because Zurich and Australia have different hoisting behavior.


### Evidence

- [The Australia engine update lists Rhino PR 1806, Fix hoisting behavior, as a fix applicable to all JavaScript modes.](https://www.servicenow.com/docs/r/api-reference/scripts/updates-javascript-engine.html) — manual, 2026-08-24; `rule-evidence-0dcef443`.
- [Fixtures cover nested blocks, loops, try/catch, reads, shadowing, deferred bodies, mutation, dynamic scope, switch boundaries, releases, modes, and execution contexts.](../tests/rules/no-unhoisted-block-function-use.test.ts) — fixture, 2026-08-24; `rule-evidence-f23df002`.
- [Real Oxlint and ESLint contracts verify the nested-block hoisting delta in Zurich, Australia, omitted-release, ES5, and ES2021 configurations.](../tests/integration/release-contracts.test.ts) — integration-test, 2026-08-24; `rule-evidence-383d0f82`.

[Catalog source](../src/catalog/no-unhoisted-block-function-use.ts).

## no-object-method-constructor

ServiceNow Australia enforces ECMAScript's non-constructible shorthand object methods, while Zurich's ES2021 engine incorrectly permits them. This rule reports direct `new` calls through a stable object or method alias only when method identity cannot have changed.

**Placements:** es2021 (error). **Last verified:** 2026-08-24

### Applicability

classic; surfaces: Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Action applicability also depends on explicit client/server surfaces and the rule's execution-context gate. An explicit javascriptMode also enables documented engine checks in otherwise unclassified files.; confidence: inferred; modes: es2021; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.


#### Incorrect: shorthand method used as a constructor in Australia

```js
const definitions = { Task() {} };
const task = new definitions.Task();
```

#### Correct: function-valued constructible property

```js
const definitions = { Task: function Task() {} };
const task = new definitions.Task();
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. false-negative: An object with any unrecognized reference, call, mutation, or escape stays silent because its method property may have been replaced before construction. false-negative: Destructured, mutable, conditional, and cross-execution aliases stay silent because their exact callable identity is not proven at the construction site. scope-boundary: Class prototype and static methods stay outside this rule until their pre-Australia ServiceNow behavior is independently proven. scope-boundary: Method construction stays silent when settings.servicenow.release is omitted because Zurich permits it and Australia throws.

- False negative: An object with any unrecognized reference, call, mutation, or escape stays silent because its method property may have been replaced before construction.
- False negative: Destructured, mutable, conditional, and cross-execution aliases stay silent because their exact callable identity is not proven at the construction site.
- Scope: Class prototype and static methods stay outside this rule until their pre-Australia ServiceNow behavior is independently proven.
- Scope: Method construction stays silent when settings.servicenow.release is omitted because Zurich permits it and Australia throws.


### Evidence

- [The Australia engine update lists Rhino PR 1774, Don't allow methods to be used as constructors, as an ECMAScript 2021 fix.](https://www.servicenow.com/docs/r/api-reference/scripts/updates-javascript-engine.html) — manual, 2026-08-24; `rule-evidence-304f9a1e`.
- [Fixtures cover direct and computed methods, immutable object and method aliases, generators, final-property selection, mutation, escape, shadowing, dynamic scope, releases, modes, and execution contexts.](../tests/rules/no-object-method-constructor.test.ts) — fixture, 2026-08-24; `rule-evidence-a4d67dde`.
- [Real Oxlint and ESLint contracts verify the object-method construction delta in Zurich, Australia, and omitted-release ES2021 configurations.](../tests/integration/release-contracts.test.ts) — integration-test, 2026-08-24; `rule-evidence-dbdc25a7`.

[Catalog source](../src/catalog/no-object-method-constructor.ts).

## no-incorrect-bigint-asuintn

Zurich can return a negative input unchanged from BigInt.asUintN() when the requested width exceeds the input's signed byte representation; Australia corrects the ES2021 behavior. The rule reports only direct literal pairs that prove the two results differ.

**Placements:** es2021 (error). **Last verified:** 2026-08-24

### Applicability

classic; surfaces: Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Action applicability also depends on explicit client/server surfaces and the rule's execution-context gate. An explicit javascriptMode also enables documented engine checks in otherwise unclassified files.; confidence: inferred; modes: es2021; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.


#### Incorrect: negative 64-bit unsigned narrowing in Zurich

```js
var unsigned = BigInt.asUintN(64, -1n);
```

#### Correct: negative 64-bit unsigned narrowing in Australia

```js
var unsigned = BigInt.asUintN(64, -1n);
```

#### Correct: Zurich narrowing below the legacy early-return boundary

```js
var unsigned = BigInt.asUintN(7, -1n);
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. false-negative: Dynamic operands and const aliases stay silent; the rule requires both arguments directly in the call so a diagnostic proves the exact legacy result. scope-boundary: A possible BigInt owner or asUintN replacement suppresses diagnostics throughout the file because the call may no longer reach Rhino's native implementation. false-negative: Bit counts above 4096 and normalized BigInt literal text longer than 256 characters stay silent to bound per-file analysis cost. scope-boundary: BigInt.asIntN calls stay silent because the reviewed regression proves a negative unsigned-result mismatch; the rule does not extrapolate that defect to signed narrowing. scope-boundary: Calls stay silent when settings.servicenow.release is omitted because Zurich and Australia have different native behavior.

- False negative: Dynamic operands and const aliases stay silent; the rule requires both arguments directly in the call so a diagnostic proves the exact legacy result.
- False negative: Bit counts above 4096 and normalized BigInt literal text longer than 256 characters stay silent to bound per-file analysis cost.
- Scope: A possible BigInt owner or asUintN replacement suppresses diagnostics throughout the file because the call may no longer reach Rhino's native implementation.
- Scope: BigInt.asIntN calls stay silent because the reviewed regression proves a negative unsigned-result mismatch; the rule does not extrapolate that defect to signed narrowing.
- Scope: Calls stay silent when settings.servicenow.release is omitted because Zurich and Australia have different native behavior.


Overlaps: `servicenow/no-bigint`.

### Evidence

- [The Australia engine update lists Rhino PR 1979 as the ECMAScript 2021 fix for BigInt.asUintN and BigInt.asIntN.](https://www.servicenow.com/docs/r/api-reference/scripts/updates-javascript-engine.html) — manual, 2026-08-24; `rule-evidence-0d06eb0f`.
- [Fixtures prove the legacy byte-width boundary, safe near misses, owner authority, aliases, mutation, release selection, and unsupported contexts.](../tests/rules/no-incorrect-bigint-asuintn.test.ts) — fixture, 2026-08-24; `rule-evidence-d67ac3dd`.
- [Real Oxlint and ESLint contracts verify the same literal call in Zurich, Australia, and omitted-release configurations.](../tests/integration/release-contracts.test.ts) — integration-test, 2026-08-24; `rule-evidence-4f70996d`.

[Catalog source](../src/catalog/no-incorrect-bigint-asuintn.ts).

## prefer-glideaggregate

`GlideRecord.getRowCount()` (and iterate-to-count loops) load every matching row. `GlideAggregate` counts in the database.

**Placements:** strict (warn). **Last verified:** 2026-08-24

### Applicability

classic; surfaces: Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Action applicability also depends on explicit client/server surfaces and the rule's execution-context gate. Unknown surfaces stay silent.; confidence: inferred; modes: n/a; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.


#### Incorrect: getRowCount

```js
var gr = new GlideRecord("incident");
gr.addActiveQuery();
gr.query();
var count = gr.getRowCount();
```

#### Correct: GlideAggregate COUNT

```js
var ga = new GlideAggregate("incident");
ga.addActiveQuery();
ga.addAggregate("COUNT");
ga.query();
var count = ga.next() ? parseInt(ga.getAggregate("COUNT"), 10) : 0;
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. false-negative: A possible platform constructor namespace reassignment, prototype or relevant instance-method mutation, or dynamic-scope uncertainty suppresses matching diagnostics throughout the file.

- False negative: A possible platform constructor namespace reassignment, prototype or relevant instance-method mutation, or dynamic-scope uncertainty suppresses matching diagnostics throughout the file.


Overlaps: `servicenow/validate-glideaggregate-calls`.

### Evidence

- [The Australia GlideAggregate API documents database-side COUNT and other aggregate queries.](https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideAggregateScopedAPI.html) — manual, 2026-08-22; `rule-evidence-3b04a8f8`.
- [The Australia global GlideAggregate API provides the same database aggregation surface.](https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideAggregateAPI.html) — manual, 2026-08-22; `rule-evidence-44699dce`.
- [The Australia GlideRecord API recommends GlideAggregate when only a record count is needed because it does not retrieve matching records.](https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html) — manual, 2026-08-22; `rule-evidence-ac7542f1`.
- [Iterate-to-count loops using next() or _next() report; if (gr.next()) stays silent.](../tests/rules/prefer-glideaggregate.test.ts) — fixture, 2026-08-20; `rule-evidence-8e25a98b`.
- [Constructor namespace, prototype, instance-method, and dynamic-scope mutations are covered by shared platform-authority fixtures.](../tests/rules/platform-method-authority.test.ts) — fixture, 2026-08-24; `rule-evidence-485e1a9d`.

[Catalog source](../src/catalog/prefer-glideaggregate.ts).

## no-client-gliderecord

Proven platform GlideRecord calls are unsupported in scoped client applications. Query on the server with GlideAjax or Scripted REST.

**Placements:** recommended (error), client (error). **Last verified:** 2026-08-24

### Applicability

classic; surfaces: Applies to client, ui-action when those surfaces are known. UI Action applicability also depends on explicit client/server surfaces and the rule's execution-context gate. Unknown surfaces stay silent.; confidence: inferred; modes: n/a; scopes: scoped; releases: zurich, australia; SDK: n/a.


#### Incorrect: client script

```js
function onChange() {
  var gr = new GlideRecord("sys_user");
  gr.addQuery("user_name", g_user.userName);
  gr.query();
}
```

#### Correct: GlideAjax

```js
function onChange() {
  var ga = new GlideAjax("x_acme.UserUtils");
  ga.addParam("sysparm_name", "getUser");
  ga.getXMLAnswer(function (answer) {
    g_form.setValue("caller_id", answer);
  });
}
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: Mixed client/server UI Actions stay silent because the rule cannot classify execution regions. scope-boundary: Global and unknown application scope stay silent because ServiceNow documents the client API in global applications and only marks scoped applications unsupported. false-negative: Aliases assigned outside their declaration stay silent even when every visible branch selects a platform constructor; proving that identity requires path-sensitive constructor-value analysis. false-negative: Aliases used from another function body stay silent because source order alone cannot prove that the initializer ran before the function was called. false-negative: A possible platform-constructor or namespace replacement suppresses matching calls throughout the file, including calls that appear before the replacement; source order alone does not establish runtime order across function bodies.

- False negative: Aliases assigned outside their declaration stay silent even when every visible branch selects a platform constructor; proving that identity requires path-sensitive constructor-value analysis.
- False negative: Aliases used from another function body stay silent because source order alone cannot prove that the initializer ran before the function was called.
- False negative: A possible platform-constructor or namespace replacement suppresses matching calls throughout the file, including calls that appear before the replacement; source order alone does not establish runtime order across function bodies.
- Scope: Mixed client/server UI Actions stay silent because the rule cannot classify execution regions.
- Scope: Global and unknown application scope stay silent because ServiceNow documents the client API in global applications and only marks scoped applications unsupported.


Overlaps: `servicenow/require-query-before-next`.

### Evidence

- [The Australia client GlideRecord API is unsupported in scoped applications.](https://www.servicenow.com/docs/r/api-reference/c_GlideRecordClientSideAPI.html) — manual, 2026-08-22; `rule-evidence-063e6d0e`.
- [ServiceNow no longer recommends client GlideRecord or getReference for performance because they retrieve all fields.](https://www.servicenow.com/docs/r/api-reference/scripts/client-script-best-practices.html) — manual, 2026-08-22; `rule-evidence-efff6b3b`.
- [Recommended Oxlint and ESLint flag GlideRecord in client files.](../tests/integration/profiles/invalid/client-gliderecord.client.js) — integration-test, 2026-08-20; `rule-evidence-a0a91c4c`.
- [Oxlint and ESLint flag direct, global namespace, computed, stable aliased, and destructured constructors without leaking mutually exclusive alias assignments.](../tests/integration/context-contracts.test.ts) — integration-test, 2026-08-24; `rule-evidence-601c887d`.
- [Adversarial fixtures cover branch order, alias writes and dominance, shadowing, dynamic scope, namespace escape, and visible platform replacement.](../tests/rules/no-client-gliderecord.test.ts) — fixture, 2026-08-24; `rule-evidence-759a7da8`.

[Catalog source](../src/catalog/no-client-gliderecord.ts).

## no-gs-now

`gs.now()` and `gs.nowDateTime()` return timezone-sensitive display strings. `gs.now()` is also gone from client scripts since London. Prefer `new GlideDateTime()`.

**Placements:** recommended (error), client (error). **Last verified:** 2026-08-24

### Applicability

classic; surfaces: Applies to client, server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Action applicability also depends on explicit client/server surfaces and the rule's execution-context gate. Unknown surfaces stay silent.; confidence: filename; modes: n/a; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.


#### Incorrect: gs.now

```js
current.u_opened = gs.now();
```

#### Incorrect: gs.nowDateTime

```js
current.u_opened = gs.nowDateTime();
```

#### Correct: GlideDateTime

```js
current.u_opened = new GlideDateTime();
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: Local objects named gs are not the platform global.

- Scope: Local objects named gs are not the platform global.


Overlaps: `servicenow/no-display-value-date-comparison`.

### Evidence

- [gs.now() and gs.nowDateTime() return display strings, not GlideDateTime objects.](https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideDateTimeAPI.html) — manual, 2026-08-20; `rule-evidence-b0fb0fe2`.
- [Host fixtures report gs.now on Business Rule files.](../tests/integration/fixtures/bad-business-rule.br.js) — integration-test, 2026-08-20; `rule-evidence-af5507fd`.
- [Oxlint and ESLint stay silent when visible writes make the gs global or target method identity unknown.](../tests/integration/context-contracts.test.ts) — integration-test, 2026-08-24; `rule-evidence-0c8164bf`.

[Catalog source](../src/catalog/no-gs-now.ts).

## require-query-before-next

Require a documented, scope-supported GlideRecord query executor before `.next()` or `._next()`. A cursor advance reports when a reachable path lacks even a possible executor for the configured scope; unproven receivers stay silent.

**Placements:** recommended (error), business-rule (error). **Last verified:** 2026-08-24

### Applicability

classic; surfaces: Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Action applicability also depends on explicit client/server surfaces and the rule's execution-context gate. Unknown surfaces stay silent.; confidence: inferred; modes: n/a; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.


#### Incorrect: next without query

```js
var gr = new GlideRecord("incident");
gr.addActiveQuery();
gr.next();
```

#### Correct: query + checked next

```js
var gr = new GlideRecord("incident");
gr.addActiveQuery();
gr.query();
while (gr.next()) {
  gs.info(gr.number);
}
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: A query through a proven alias opens the same record cursor. false-negative: A possible platform constructor namespace reassignment, prototype or relevant instance-method mutation, or dynamic-scope uncertainty suppresses matching diagnostics throughout the file. lifecycle: Executors are selected by release and scope. A possible scope-specific executor suppresses a missing-query finding without becoming a definite fact for positive rules. chooseWindow does not execute a query.

- False negative: A possible platform constructor namespace reassignment, prototype or relevant instance-method mutation, or dynamic-scope uncertainty suppresses matching diagnostics throughout the file.
- Scope: A query through a proven alias opens the same record cursor.

Lifecycle: Executors are selected by release and scope. A possible scope-specific executor suppresses a missing-query finding without becoming a definite fact for positive rules. chooseWindow does not execute a query.


Overlaps: `servicenow/validate-glideaggregate-calls`.

### Evidence

- [query(), _query(), and get() execute a query before next() or _next() advances the cursor.](https://www.servicenow.com/docs/r/zurich/api-reference/server-api-reference/c_GlideRecordScopedAPI.html) — manual, 2026-08-22; `rule-evidence-434533fa`.
- [queryNoDomain() is documented on the global API and executes a query while ignoring domains.](https://www.servicenow.com/docs/r/zurich/api-reference/server-api-reference/c_GlideRecordAPI.html) — manual, 2026-08-22; `rule-evidence-22e6da64`.
- [Oxlint and ESLint enforce _query(), _next(), and scope-sensitive queryNoDomain() lifecycle contracts.](../tests/integration/binding-host-contracts.test.ts) — integration-test, 2026-08-22; `rule-evidence-fbeb4c62`.
- [Aliases, sibling reassignment, and completion-aware paths are unit-tested.](../tests/rules/stateful-lifecycle.test.ts) — fixture, 2026-08-20; `rule-evidence-2620ec5c`.
- [Constructor namespace, prototype, instance-method, and dynamic-scope mutations are covered by shared platform-authority fixtures.](../tests/rules/platform-method-authority.test.ts) — fixture, 2026-08-24; `rule-evidence-9ec7891e`.
- [The Australia-scoped GlideRecord API was reviewed for the methods and lifecycle facts used by this rule.](https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html) — manual, 2026-08-22; `rule-evidence-ca1b2e7a`.
- [The Australia-global GlideRecord API was reviewed for the methods and lifecycle facts used by this rule.](https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordAPI.html) — manual, 2026-08-22; `rule-evidence-130391d9`.

[Catalog source](../src/catalog/require-query-before-next.ts).

## no-br-current-update

`current.update()` retriggers other Business Rules and can recurse. Set fields on `current` and let the platform save. Reports only when the file is a Business Rule. Shadowed `current` bindings are ignored.

**Placements:** recommended (error), business-rule (error). **Last verified:** 2026-08-24

### Applicability

classic; surfaces: Applies to business-rule when those surfaces are known. Unknown surfaces stay silent.; confidence: inferred; modes: n/a; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.


#### Incorrect: current.update

```js
current.state = 2;
current.update();
```

#### Correct: assign and return

```js
current.state = 2;
current.work_notes = "Moved to In Progress";
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. false-negative: A possible current.update or GlideRecord.prototype.update mutation suppresses matching calls throughout the file.

- False negative: A possible current.update or GlideRecord.prototype.update mutation suppresses matching calls throughout the file.


### Evidence

- [Business Rules should not call current.update() because the engine already writes the row.](https://www.servicenow.com/docs/r/application-development/business-rules-classic/c_BusinessRules.html) — manual, 2026-08-20; `rule-evidence-d36b7abe`.
- [Host fixtures report current.update on Business Rule files.](../tests/integration/fixtures/bad-business-rule.br.js) — integration-test, 2026-08-20; `rule-evidence-0d912f8c`.
- [Oxlint and ESLint stay silent when visible current binding replacement makes identity uncertain while canonical wrapper calls still report.](../tests/integration/context-contracts.test.ts) — integration-test, 2026-08-24; `rule-evidence-83d892a6`.
- [Canonical wrapper fixtures distinguish the required synchronous current argument from pre-call escape, receiver replacement, and GlideRecord prototype mutation.](../tests/rules/platform-binding-identity.test.ts) — fixture, 2026-08-24; `rule-evidence-9fafc4ba`.

[Catalog source](../src/catalog/no-br-current-update.ts).

## no-hardcoded-table-names

Optional organizational policy. String-literal table names in `GlideRecord` / `GlideRecordSecure` / `GlideAggregate` are hard to rename. Prefer named constants or Fluent table exports.

**Placements:** policy (warn). **Last verified:** 2026-08-20

### Applicability

classic; surfaces: Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Action applicability also depends on explicit client/server surfaces and the rule's execution-context gate. Unknown surfaces stay silent.; confidence: inferred; modes: n/a; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.

### Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `allowedTables` | string[] | `[]` | Additional table names this rule allows. Settings `allowedTables` are also allowed. |
| `allowBuiltins` | boolean | `false` | Allow the built-in platform table list from `BUILTIN_TABLES`. |

#### Incorrect: literal table

```js
var gr = new GlideRecord("x_acme_widget");
```

#### Correct: named constant

```js
var TABLE = { WIDGET: "x_acme_widget" };
var gr = new GlideRecord(TABLE.WIDGET);
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing.

- None recorded.


Overlaps: `servicenow/fluent-naming-convention`.

### Evidence

- [Table names passed to GlideRecord constructors are string identities that do not rename safely.](https://www.servicenow.com/docs/r/zurich/api-reference/server-api-reference/c_GlideRecordScopedAPI.html) — manual, 2026-08-20; `rule-evidence-cdad38f6`.
- [Literal tables report; named constants and allow-lists stay silent.](../tests/rules/glide-and-engine.test.ts) — fixture, 2026-08-20; `rule-evidence-413d1e54`.

[Catalog source](../src/catalog/no-hardcoded-table-names.ts).

## fluent-proper-imports

Fluent entity and column APIs must be imported from the module recorded in the selected SDK manifest. Aliases and namespace imports resolve by lexical binding identity.

**Placements:** recommended (error), fluent (error). **Last verified:** 2026-08-20

### Applicability

fluent; surfaces: Fluent `.now.ts` metadata only.; confidence: inferred; modes: n/a; scopes: global, scoped, unknown; releases: SDK-versioned; SDK: 3.0.0 || 3.0.1 || 3.0.2 || 3.0.3 || 4.0.0 || 4.0.1 || 4.0.2 || 4.1.0 || 4.1.1 || 4.2.0 || 4.3.0 || 4.4.0 || 4.4.1 || 4.5.0 || 4.6.0 || 4.6.1 || 4.7.0 || 4.7.1 || 4.7.2 || 4.8.0 || 4.8.1 || 4.9.0 || 4.9.1 || 4.9.2 || 4.10.0 || 4.10.1 || 4.11.0.


#### Incorrect: wrong module

```ts
import { BusinessRule } from "@servicenow/sdk";

BusinessRule({
  $id: Now.ID["log-change"],
  table: "incident",
  name: "Log change",
  when: "after",
  action: ["update"],
});
```

#### Correct: core import

```ts
import { BusinessRule } from "@servicenow/sdk/core";

BusinessRule({
  $id: Now.ID["log-change"],
  table: "incident",
  name: "Log change",
  when: "after",
  action: ["update"],
});
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: Local functions that share a Fluent factory name are not SDK factories.

- Scope: Local functions that share a Fluent factory name are not SDK factories.


Overlaps: `servicenow/require-fluent-id`.

### Evidence

- [Fluent factories are imported from the documented @servicenow/sdk modules.](https://www.servicenow.com/docs/r/api-reference/servicenow-fluent.html) — manual, 2026-08-20; `rule-evidence-38e89461`.
- [Host fixtures report factories imported from the wrong module.](../tests/integration/fixtures/bad-fluent.now.ts) — integration-test, 2026-08-20; `rule-evidence-b9e2415f`.

[Catalog source](../src/catalog/fluent-proper-imports.ts).

## fluent-directives

Validate documented ServiceNow Fluent SDK directive names and placement. SDK directives are not Oxlint or ESLint disable comments.

**Placements:** recommended (warn), fluent (warn). **Last verified:** 2026-08-20

### Applicability

fluent; surfaces: Fluent `.now.ts` metadata only.; confidence: inferred; modes: n/a; scopes: global, scoped, unknown; releases: SDK-versioned; SDK: 3.0.0 || 3.0.1 || 3.0.2 || 3.0.3 || 4.0.0 || 4.0.1 || 4.0.2 || 4.1.0 || 4.1.1 || 4.2.0 || 4.3.0 || 4.4.0 || 4.4.1 || 4.5.0 || 4.6.0 || 4.6.1 || 4.7.0 || 4.7.1 || 4.7.2 || 4.8.0 || 4.8.1 || 4.9.0 || 4.9.1 || 4.9.2 || 4.10.0 || 4.10.1 || 4.11.0.


#### Incorrect: typo + ts-ignore

```ts
// @ts-ignore
// @fluent-ignre
export const demo = 1;
```

#### Correct: documented directive

```ts
// @fluent-disable-sync
import { Record } from "@servicenow/sdk/core";

Record({
  $id: Now.ID["seed-incident"],
  table: "incident",
  data: { short_description: "Seed" },
});
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: ServiceNow Fluent directives are SDK controls; they are not Oxlint or ESLint disable comments and do not suppress this plugin's diagnostics.

- Scope: ServiceNow Fluent directives are SDK controls; they are not Oxlint or ESLint disable comments and do not suppress this plugin's diagnostics.


### Evidence

- [The documented Fluent directives are line- or file-scoped comments consumed by the SDK toolchain.](https://www.servicenow.com/docs/r/api-reference/servicenow-fluent.html) — manual, 2026-08-20; `rule-evidence-4440bc5b`.
- [A trailing @fluent-ignore without a following statement reports.](../tests/integration/profiles/invalid/dangling-fluent-ignore.now.ts) — integration-test, 2026-08-20; `rule-evidence-f7dd387a`.

[Catalog source](../src/catalog/fluent-directives.ts).

## prefer-now-include

Large inline `script` / HTML / CSS payloads belong in their own file and should be loaded with `Now.include()`.

**Placements:** strict (warn). **Last verified:** 2026-08-20

### Applicability

fluent; surfaces: Fluent `.now.ts` metadata only.; confidence: inferred; modes: n/a; scopes: global, scoped, unknown; releases: SDK-versioned; SDK: 3.0.0 || 3.0.1 || 3.0.2 || 3.0.3 || 4.0.0 || 4.0.1 || 4.0.2 || 4.1.0 || 4.1.1 || 4.2.0 || 4.3.0 || 4.4.0 || 4.4.1 || 4.5.0 || 4.6.0 || 4.6.1 || 4.7.0 || 4.7.1 || 4.7.2 || 4.8.0 || 4.8.1 || 4.9.0 || 4.9.1 || 4.9.2 || 4.10.0 || 4.10.1 || 4.11.0.

### Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `maxLines` | integer | `8` | Line count that treats an inline payload as large. |
| `maxChars` | integer | `400` | Character count that treats an inline payload as large. |

#### Incorrect: inline novel

```ts
import { BusinessRule } from "@servicenow/sdk/core";

BusinessRule({
  $id: Now.ID["log-state"],
  table: "incident",
  name: "Log state",
  when: "after",
  action: ["update"],
  script: `
    (function executeRule(current, previous) {
      var gr = new GlideRecord("sys_journal_field");
      gr.initialize();
      gr.element_id = current.sys_id;
      gr.value = "state changed";
      gr.insert();
      gs.info(current.number);
      gs.info(previous.state);
      gs.info(current.state);
    })(current, previous);
  `,
});
```

#### Correct: Now.include

```ts
import { BusinessRule } from "@servicenow/sdk/core";

BusinessRule({
  $id: Now.ID["log-state"],
  table: "incident",
  name: "Log state",
  when: "after",
  action: ["update"],
  script: Now.include("../server/log-state.server.js"),
});
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing.

- None recorded.


Overlaps: `servicenow/no-complex-fluent-logic`.

### Evidence

- [Now.include() loads script and markup files so Fluent metadata stays declarative.](https://www.servicenow.com/docs/r/application-development/servicenow-sdk/fluent-constructs.html) — manual, 2026-08-20; `rule-evidence-cf5549c7`.
- [Catalog examples cover large inline script versus Now.include.](../src/catalog/prefer-now-include.ts) — fixture, 2026-08-20; `rule-evidence-0e42c1c0`.

[Catalog source](../src/catalog/prefer-now-include.ts).

## require-fluent-id

Fluent entities must declare `$id` when the selected SDK manifest marks the imported factory as requiring an id. Prefer canonical `Now.ID['descriptive-key']`.

**Placements:** recommended (error), fluent (error). **Last verified:** 2026-08-20

### Applicability

fluent; surfaces: Fluent `.now.ts` metadata only.; confidence: inferred; modes: n/a; scopes: global, scoped, unknown; releases: SDK-versioned; SDK: 3.0.0 || 3.0.1 || 3.0.2 || 3.0.3 || 4.0.0 || 4.0.1 || 4.0.2 || 4.1.0 || 4.1.1 || 4.2.0 || 4.3.0 || 4.4.0 || 4.4.1 || 4.5.0 || 4.6.0 || 4.6.1 || 4.7.0 || 4.7.1 || 4.7.2 || 4.8.0 || 4.8.1 || 4.9.0 || 4.9.1 || 4.9.2 || 4.10.0 || 4.10.1 || 4.11.0.

### Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `preferNowId` | boolean | `true` | Warn when `$id` is a raw string or sys_id instead of `Now.ID`. |

#### Incorrect: missing $id

```ts
import { BusinessRule } from "@servicenow/sdk/core";

BusinessRule({
  table: "incident",
  name: "Log state",
  when: "after",
  action: ["update"],
});
```

#### Correct: Now.ID

```ts
import { BusinessRule } from "@servicenow/sdk/core";

BusinessRule({
  $id: Now.ID["log-state"],
  table: "incident",
  name: "Log state",
  when: "after",
  action: ["update"],
});
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: An unresolved spread or computed key that may supply or overwrite `$id` suppresses ID diagnostics. An explicit `$id` after that property remains checked.

- Scope: An unresolved spread or computed key that may supply or overwrite `$id` suppresses ID diagnostics. An explicit `$id` after that property remains checked.


Overlaps: `servicenow/no-duplicate-fluent-id`, `servicenow/no-now-id-as-reference`.

### Evidence

- [Factories whose manifest marks $id as required must declare Now.ID or an equivalent id.](https://www.servicenow.com/docs/r/application-development/servicenow-sdk/fluent-constructs.html) — manual, 2026-08-20; `rule-evidence-54675457`.
- [Aliased factory imports still require $id under recommended.](../tests/integration/profiles/invalid/fluent-alias-missing-id.now.ts) — integration-test, 2026-08-20; `rule-evidence-d1c9fc71`.

[Catalog source](../src/catalog/require-fluent-id.ts).

## fluent-naming-convention

`.now.ts` files and `Now.ID` keys should be kebab-case. Exported `Table` bindings should match the table `name`.

**Placements:** strict (warn). **Last verified:** 2026-08-20

### Applicability

fluent; surfaces: Fluent `.now.ts` metadata only.; confidence: inferred; modes: n/a; scopes: global, scoped, unknown; releases: SDK-versioned; SDK: 3.0.0 || 3.0.1 || 3.0.2 || 3.0.3 || 4.0.0 || 4.0.1 || 4.0.2 || 4.1.0 || 4.1.1 || 4.2.0 || 4.3.0 || 4.4.0 || 4.4.1 || 4.5.0 || 4.6.0 || 4.6.1 || 4.7.0 || 4.7.1 || 4.7.2 || 4.8.0 || 4.8.1 || 4.9.0 || 4.9.1 || 4.9.2 || 4.10.0 || 4.10.1 || 4.11.0.

### Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `idStyle` | "kebab-case" \| "snake_case" \| "either" | `"kebab-case"` | Required style for `Now.ID` keys. |
| `fileStyle` | "kebab-case" \| "snake_case" \| "either" | `"kebab-case"` | Required style for `.now.ts` filenames. |

#### Incorrect: PascalCase file + id

```ts
import { BusinessRule } from "@servicenow/sdk/core";

BusinessRule({
  $id: Now.ID["LogState"],
  table: "incident",
  name: "Log state",
});
```

#### Correct: kebab-case

```ts
import { BusinessRule } from "@servicenow/sdk/core";

BusinessRule({
  $id: Now.ID["log-state"],
  table: "incident",
  name: "Log state",
});
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: Table-name checks require an effective explicit `name`; a later unresolved spread or computed key suppresses them. File and `Now.ID` key checks remain independent.

- Scope: Table-name checks require an effective explicit `name`; a later unresolved spread or computed key suppresses them. File and `Now.ID` key checks remain independent.


Overlaps: `servicenow/require-fluent-id`.

### Evidence

- [Fluent file stems and Now.ID keys should stay stable kebab-case or snake_case identifiers.](https://www.servicenow.com/docs/r/api-reference/servicenow-fluent.html) — manual, 2026-08-20; `rule-evidence-4404071b`.
- [Catalog examples cover PascalCase files and kebab-case corrections.](../src/catalog/fluent-naming-convention.ts) — fixture, 2026-08-20; `rule-evidence-994c1e98`.

[Catalog source](../src/catalog/fluent-naming-convention.ts).

## no-complex-fluent-logic

Optional architectural policy. `.now.ts` files should declare metadata. Loops, classes, try/catch, and multi-statement functions belong in `src/server/`. Not enabled in recommended or strict.

**Placements:** policy (warn). **Last verified:** 2026-08-22

### Applicability

fluent; surfaces: Fluent `.now.ts` metadata only.; confidence: inferred; modes: n/a; scopes: global, scoped, unknown; releases: SDK-versioned; SDK: 3.0.0 || 3.0.1 || 3.0.2 || 3.0.3 || 4.0.0 || 4.0.1 || 4.0.2 || 4.1.0 || 4.1.1 || 4.2.0 || 4.3.0 || 4.4.0 || 4.4.1 || 4.5.0 || 4.6.0 || 4.6.1 || 4.7.0 || 4.7.1 || 4.7.2 || 4.8.0 || 4.8.1 || 4.9.0 || 4.9.1 || 4.9.2 || 4.10.0 || 4.10.1 || 4.11.0.


#### Incorrect: runtime loop

```ts
import { Record } from "@servicenow/sdk/core";

for (var i = 0; i < 10; i++) {
  Record({
    $id: Now.ID["seed-" + i],
    table: "incident",
    data: { short_description: "n" },
  });
}
```

#### Correct: declarative records

```ts
import { Record } from "@servicenow/sdk/core";

Record({
  $id: Now.ID["seed-incident"],
  table: "incident",
  data: { short_description: "Seed" },
});
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing.

- None recorded.


Overlaps: `servicenow/prefer-now-include`.

### Evidence

- [Fluent .now.ts files declare metadata; runtime loops belong in src/server.](https://www.servicenow.com/docs/r/api-reference/servicenow-fluent.html) — manual, 2026-08-20; `rule-evidence-02861454`.
- [Fixtures cover loops, async functions, function expressions, and arrow-function complexity thresholds.](../tests/rules/fluent.test.ts) — fixture, 2026-08-22; `rule-evidence-78df3f0c`.

[Catalog source](../src/catalog/no-complex-fluent-logic.ts).

## no-at-method

`.at()` is not implemented in Compatibility or ES5 Standards mode. Proven array/string literal receivers report unless the matching built-in authority is visibly replaced or a structural prototype-availability guard protects the call.

**Placements:** classic-es5 (error). **Last verified:** 2026-08-24

### Applicability

classic; surfaces: Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Action applicability also depends on explicit client/server surfaces and the rule's execution-context gate. An explicit javascriptMode also enables documented engine checks in otherwise unclassified files.; confidence: inferred; modes: compatibility, es5; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.


#### Incorrect: at

```js
var last = [1, 2].at(-1);
```

#### Correct: index

```js
var last = list[list.length - 1];
```

#### Correct: guarded polyfill use

```js
if (typeof Array.prototype.at === "function") {
  var last = [1, 2].at(-1);
}
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: Unknown receivers with a method named at stay silent. scope-boundary: A possible Array or String constructor, prototype, or at-method replacement suppresses matching diagnostics throughout the file, regardless of source order.

- Scope: Unknown receivers with a method named at stay silent.
- Scope: A possible Array or String constructor, prototype, or at-method replacement suppresses matching diagnostics throughout the file, regardless of source order.


Overlaps: `servicenow/no-unsupported-syntax`.

### Evidence

- [Array.prototype.at is unsupported in Compatibility and ES5 Standards modes.](https://www.servicenow.com/docs/r/zurich/api-reference/scripts/javascript-engine-feature-support.html) — manual, 2026-08-20; `rule-evidence-a60aceba`.
- [String.prototype.at is unsupported in Compatibility and ES5 Standards modes.](https://www.servicenow.com/docs/r/zurich/api-reference/scripts/javascript-engine-feature-support.html) — manual, 2026-08-24; `rule-evidence-e7d36936`.
- [Fixtures cover Array/String prototype authority, modeled built-in replacement, dynamic scope, dominating feature guards, optional invocation, and shadowed near misses.](../tests/rules/no-at-method.test.ts) — fixture, 2026-08-24; `rule-evidence-1c146037`.
- [Real Oxlint and ESLint classic-es5 profiles accept an explicit Array.prototype.at polyfill.](../tests/integration/profiles.test.ts) — integration-test, 2026-08-24; `rule-evidence-b8647693`.
- [The Australia JavaScript engine feature table was reviewed for this rule's modeled capability cells.](https://www.servicenow.com/docs/r/api-reference/scripts/javascript-engine-feature-support.html) — manual, 2026-08-22; `rule-evidence-6a554922`.

[Catalog source](../src/catalog/no-at-method.ts).

## no-packages-calls

Optional migration policy. Review Rhino `Packages.*` bridge calls; Australia's removal tool specifically targets ServiceNow Java classes and distinguishes MID Server execution.

**Placements:** policy (warn). **Last verified:** 2026-08-22

### Applicability

classic; surfaces: Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Action applicability also depends on explicit client/server surfaces and the rule's execution-context gate. Unknown surfaces stay silent.; confidence: inferred; modes: n/a; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.


#### Incorrect: Packages call

```js
var result = Packages.com.glide.sys.GlideSystem.now();
```

#### Correct: Glide API

```js
var result = new GlideDateTime();
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. false-positive: The syntax-only review also flags Java classes outside the scope of the ServiceNow class-removal tool. false-positive: Static source alone cannot prove that a record executes on a MID Server, which Australia documents as a separate review outcome.

- False positive: The syntax-only review also flags Java classes outside the scope of the ServiceNow class-removal tool.
- False positive: Static source alone cannot prove that a record executes on a MID Server, which Australia documents as a separate review outcome.


### Evidence

- [The Australia Packages Call Removal Tool says Packages calls to ServiceNow Java classes will be prevented in a future release.](https://www.servicenow.com/docs/r/api-reference/scripts/c_PackagesCallRemovalTool.html) — manual, 2026-08-22; `rule-evidence-3a0c56bc`.
- [Fixtures cover static and dynamic Packages access versus local bindings named Packages.](../tests/rules/glide-and-engine.test.ts) — fixture, 2026-08-21; `rule-evidence-842a8fbc`.

[Catalog source](../src/catalog/no-packages-calls.ts).

## no-weak-references

WeakRef and FinalizationRegistry are disallowed in every instance JavaScript mode, including ES2021. Direct calls and stable same-execution aliases report; a bare alias must be captured inside its availability guard, while visibly polyfilled calls stay silent.

**Placements:** recommended (error), classic-es5 (error), es2021 (error). **Last verified:** 2026-08-24

### Applicability

classic; surfaces: Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Action applicability also depends on explicit client/server surfaces and the rule's execution-context gate. An explicit javascriptMode also enables documented engine checks in otherwise unclassified files.; confidence: inferred; modes: compatibility, es5, es2021, unknown; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.


#### Incorrect: WeakRef

```js
var ref = new WeakRef(obj);
```

#### Correct: Map in ES2021

```js
var cache = new Map();
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: A possible callable replacement for WeakRef or FinalizationRegistry suppresses matching diagnostics throughout the file, regardless of source order. scope-boundary: A call protected by a structurally dominating availability guard stays silent for code shared with other runtimes. false-negative: A constructor alias used from another function body stays silent because source order cannot prove that its initializer ran before the function was called.

- False negative: A constructor alias used from another function body stays silent because source order cannot prove that its initializer ran before the function was called.
- Scope: A possible callable replacement for WeakRef or FinalizationRegistry suppresses matching diagnostics throughout the file, regardless of source order.
- Scope: A call protected by a structurally dominating availability guard stays silent for code shared with other runtimes.


Overlaps: `servicenow/no-weak-collections`.

### Evidence

- [WeakRef and FinalizationRegistry are unsupported in instance JavaScript modes.](https://www.servicenow.com/docs/r/zurich/api-reference/scripts/javascript-engine-feature-support.html) — manual, 2026-08-20; `rule-evidence-23eb8b49`.
- [Fixtures cover stable aliases, guarded alias capture, built-in guard invalidation, callable polyfills, non-callable replacements, lexical shadows, and dynamic scope.](../tests/rules/unsupported-constructors.test.ts) — fixture, 2026-08-24; `rule-evidence-46d6a600`.
- [The Australia JavaScript engine feature table was reviewed for this rule's modeled capability cells.](https://www.servicenow.com/docs/r/api-reference/scripts/javascript-engine-feature-support.html) — manual, 2026-08-22; `rule-evidence-3c070a1e`.

[Catalog source](../src/catalog/no-weak-references.ts).

## no-map-set

ServiceNow supports Map and Set in ES2021 but not in Compatibility or ES5 Standards mode in either Zurich or Australia. Direct calls and stable same-execution aliases report, while visibly polyfilled or availability-guarded calls stay silent.

**Placements:** classic-es5 (error). **Last verified:** 2026-08-24

### Applicability

classic; surfaces: Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Action applicability also depends on explicit client/server surfaces and the rule's execution-context gate. An explicit javascriptMode also enables documented engine checks in otherwise unclassified files.; confidence: inferred; modes: compatibility, es5; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.


#### Incorrect: Map

```js
var cache = new Map();
```

#### Incorrect: Set

```js
var seen = new Set();
```

#### Correct: object keyed by a stable primitive ID

```js
var seenBySysId = {};
seenBySysId[record.getUniqueValue()] = true;
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: A possible callable replacement for Map or Set suppresses matching diagnostics throughout the file, regardless of source order. scope-boundary: A call protected by a structurally dominating availability guard stays silent for code shared with other runtimes. false-negative: A constructor alias used from another function body stays silent because source order cannot prove that its initializer ran before the function was called.

- False negative: A constructor alias used from another function body stays silent because source order cannot prove that its initializer ran before the function was called.
- Scope: A possible callable replacement for Map or Set suppresses matching diagnostics throughout the file, regardless of source order.
- Scope: A call protected by a structurally dominating availability guard stays silent for code shared with other runtimes.


Overlaps: `servicenow/no-weak-collections`.

### Evidence

- [The Zurich table marks Map and Set basic functionality Supported in ES2021 and Not Supported in ES5 Standards.](https://www.servicenow.com/docs/r/zurich/api-reference/scripts/javascript-engine-feature-support.html) — manual, 2026-08-24; `rule-evidence-324cc720`.
- [The Australia table marks Map and Set basic functionality Supported in ES2021 and Not Supported in ES5 Standards.](https://www.servicenow.com/docs/r/api-reference/scripts/javascript-engine-feature-support.html) — manual, 2026-08-24; `rule-evidence-df01246f`.
- [Fixtures cover both constructors, Compatibility and ES5 modes, both releases, aliases, guards, polyfills, shadowing, dynamic scope, and unsupported contexts.](../tests/rules/no-map-set.test.ts) — fixture, 2026-08-24; `rule-evidence-19c8b8b2`.
- [Real Oxlint and ESLint contracts verify Map and Set behavior across Zurich, Australia, omitted-release ES5, and ES2021 settings.](../tests/integration/release-contracts.test.ts) — integration-test, 2026-08-24; `rule-evidence-03388c55`.

[Catalog source](../src/catalog/no-map-set.ts).

## no-weak-collections

WeakMap and WeakSet are disallowed in Compatibility and ES5 Standards mode. ES2021 supports them. Direct calls and stable same-execution aliases report; bare aliases captured before a later guard still report, while visibly polyfilled calls stay silent.

**Placements:** classic-es5 (error). **Last verified:** 2026-08-24

### Applicability

classic; surfaces: Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Action applicability also depends on explicit client/server surfaces and the rule's execution-context gate. An explicit javascriptMode also enables documented engine checks in otherwise unclassified files.; confidence: inferred; modes: compatibility, es5; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.


#### Incorrect: WeakMap

```js
var cache = new WeakMap();
```

#### Correct: object keyed by a stable primitive ID

```js
var cacheBySysId = {};
cacheBySysId[sysId] = value;
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: A possible callable replacement for WeakMap or WeakSet suppresses matching diagnostics throughout the file, regardless of source order. scope-boundary: A call protected by a structurally dominating availability guard stays silent for code shared with other runtimes.

- Scope: A possible callable replacement for WeakMap or WeakSet suppresses matching diagnostics throughout the file, regardless of source order.
- Scope: A call protected by a structurally dominating availability guard stays silent for code shared with other runtimes.


Overlaps: `servicenow/no-map-set`, `servicenow/no-weak-references`.

### Evidence

- [WeakMap and WeakSet are unsupported in Compatibility and ES5 Standards modes.](https://www.servicenow.com/docs/r/zurich/api-reference/scripts/javascript-engine-feature-support.html) — manual, 2026-08-20; `rule-evidence-387ab368`.
- [Fixtures cover WeakMap aliases, guarded alias capture, availability invalidation, and shared constructor-provenance behavior.](../tests/rules/unsupported-constructors.test.ts) — fixture, 2026-08-24; `rule-evidence-eccf608c`.
- [The Australia JavaScript engine feature table was reviewed for this rule's modeled capability cells.](https://www.servicenow.com/docs/r/api-reference/scripts/javascript-engine-feature-support.html) — manual, 2026-08-22; `rule-evidence-dcd2c521`.

[Catalog source](../src/catalog/no-weak-collections.ts).

## no-object-hasown

`Object.hasOwn()` is Not Supported in Zurich ES2021 and Australia ES5; Australia ES2021 Supports it. Compatibility follows the ES5 cell by package policy.

**Placements:** classic-es5 (error), es2021 (error). **Last verified:** 2026-08-22

### Applicability

classic; surfaces: Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Action applicability also depends on explicit client/server surfaces and the rule's execution-context gate. An explicit javascriptMode also enables documented engine checks in otherwise unclassified files.; confidence: inferred; modes: compatibility, es5, es2021, unknown; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.


#### Incorrect: Object.hasOwn in Zurich ES2021

```js
var ownsNumber = Object.hasOwn(record, "number");
```

#### Correct: portable hasOwnProperty call

```js
var ownsNumber = Object.prototype.hasOwnProperty.call(record, "number");
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: Dynamic property names stay silent because they do not prove a hasOwn call. scope-boundary: Any possible direct write to Object or Object.hasOwn in the file conservatively suppresses diagnostics for that file, regardless of source order. scope-boundary: Passing Object to an unknown call or constructor suppresses diagnostics because that code can install replacement methods on the namespace object. scope-boundary: Calls protected by a proven Object.hasOwn availability guard or optional call stay silent for release-portable code. false-negative: Calls through a reassigned Object mutation helper are treated as unknown; the rule does not try to prove that a custom helper installed the feature.

- False negative: Calls through a reassigned Object mutation helper are treated as unknown; the rule does not try to prove that a custom helper installed the feature.
- Scope: Dynamic property names stay silent because they do not prove a hasOwn call.
- Scope: Any possible direct write to Object or Object.hasOwn in the file conservatively suppresses diagnostics for that file, regardless of source order.
- Scope: Passing Object to an unknown call or constructor suppresses diagnostics because that code can install replacement methods on the namespace object.
- Scope: Calls protected by a proven Object.hasOwn availability guard or optional call stay silent for release-portable code.


### Evidence

- [The Zurich table marks Object.hasOwn Not Supported in ES2021 and ES5 Standards.](https://www.servicenow.com/docs/r/zurich/api-reference/scripts/javascript-engine-feature-support.html) — manual, 2026-08-22; `rule-evidence-137f2a8f`.
- [The Australia table marks Object.hasOwn Supported in ES2021 and Not Supported in ES5 Standards.](https://www.servicenow.com/docs/r/api-reference/scripts/javascript-engine-feature-support.html) — manual, 2026-08-22; `rule-evidence-1e3d2b83`.
- [ServiceNow documents Compatibility as a third mode; the plugin explicitly applies ES5 feature cells to it as package policy.](https://www.servicenow.com/docs/r/api-reference/scripts/c_JS_modes.html) — manual, 2026-08-22; `rule-evidence-ac761b0e`.
- [Fixtures cover release deltas, immutable aliases, reassignment, computed access, shadowing, mutation, and namespace escape.](../tests/rules/glide-and-engine.test.ts) — fixture, 2026-08-22; `rule-evidence-95bc0eeb`.

[Catalog source](../src/catalog/no-object-hasown.ts).

## no-unsupported-date-fraction

Australia adds variable-length ISO fractional-second parsing to all JavaScript modes, while Zurich accepts fractional seconds only when exactly three digits are present. This rule reports statically proven native Date constructor or Date.parse calls whose otherwise valid timestamp uses a different length.

**Placements:** classic-es5 (error), es2021 (error). **Last verified:** 2026-08-24

### Applicability

classic; surfaces: Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Action applicability also depends on explicit client/server surfaces and the rule's execution-context gate. An explicit javascriptMode also enables documented engine checks in otherwise unclassified files.; confidence: inferred; modes: compatibility, es5, es2021, unknown; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.


#### Incorrect: two fractional digits in Zurich

```js
var parsed = new Date("2025-05-07T09:05:20.78Z");
```

#### Correct: two fractional digits in Australia

```js
var parsed = new Date("2025-05-07T09:05:20.78Z");
```

#### Correct: portable three-digit fraction

```js
var parsed = new Date("2025-05-07T09:05:20.780Z");
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. false-negative: Dynamic date strings stay silent; the rule requires a static string or a dominating same-execution const alias. false-negative: Extended years, timezone offsets without a colon, and other legacy Date string forms stay silent; the rule validates a narrow complete ISO timestamp before diagnosing. false-negative: Extracted Date.parse methods, call/apply/bind helpers, Reflect.construct, subclasses, and constructor or string aliases crossing an execution boundary stay silent; the rule models direct native parsing operations and stable same-execution owner aliases. scope-boundary: A possible Date binding replacement suppresses constructor diagnostics; a Date namespace escape or Date.parse replacement suppresses static-method diagnostics because those operations can select different parsing semantics. scope-boundary: Variable-length fractional seconds stay silent when settings.servicenow.release is omitted because Zurich and Australia disagree.

- False negative: Dynamic date strings stay silent; the rule requires a static string or a dominating same-execution const alias.
- False negative: Extended years, timezone offsets without a colon, and other legacy Date string forms stay silent; the rule validates a narrow complete ISO timestamp before diagnosing.
- False negative: Extracted Date.parse methods, call/apply/bind helpers, Reflect.construct, subclasses, and constructor or string aliases crossing an execution boundary stay silent; the rule models direct native parsing operations and stable same-execution owner aliases.
- Scope: A possible Date binding replacement suppresses constructor diagnostics; a Date namespace escape or Date.parse replacement suppresses static-method diagnostics because those operations can select different parsing semantics.
- Scope: Variable-length fractional seconds stay silent when settings.servicenow.release is omitted because Zurich and Australia disagree.


### Evidence

- [The Australia JavaScript engine update lists Rhino PR 1896, Enhance date string parsing with optional millisecond digits, as a feature applicable to all JavaScript modes.](https://www.servicenow.com/docs/r/api-reference/scripts/updates-javascript-engine.html) — manual, 2026-08-24; `rule-evidence-b608b229`.
- [Fixtures cover one, two, and more than three fraction digits; calendar, time, and offset validity; all modes; release omission; static aliases; native Date authority; shadowing; and unsupported contexts.](../tests/rules/no-unsupported-date-fraction.test.ts) — fixture, 2026-08-24; `rule-evidence-9e667042`.
- [Real Oxlint and ESLint contracts verify Zurich, Australia, and omitted-release behavior for native Date construction and Date.parse.](../tests/integration/release-contracts.test.ts) — integration-test, 2026-08-24; `rule-evidence-17ae981b`.

[Catalog source](../src/catalog/no-unsupported-date-fraction.ts).

## no-unsupported-set-methods

Set.prototype.intersection(), union(), difference(), symmetricDifference(), isSubsetOf(), isSupersetOf(), and isDisjointFrom() are available in Australia ES2021 but not Zurich ES2021. Only direct calls on a proven, authoritative Set receiver are reported; classic Map/Set availability is outside this method-level rule.

**Placements:** es2021 (error). **Last verified:** 2026-08-24

### Applicability

classic; surfaces: Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Action applicability also depends on explicit client/server surfaces and the rule's execution-context gate. An explicit javascriptMode also enables documented engine checks in otherwise unclassified files.; confidence: inferred; modes: es2021; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.


#### Incorrect: Set union in Zurich ES2021

```js
const merged = new Set(left).union(right);
```

#### Correct: Set union in Australia ES2021

```js
const merged = new Set(left).union(right);
```

#### Correct: unrelated set-like object

```js
const merged = customCollection.union(other);
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. false-negative: Calls through extracted method values or call/apply/bind helpers stay silent; the rule reports direct calls on a proven Set receiver. scope-boundary: A possible Set constructor, prototype, or matching instance-method replacement suppresses the diagnostic throughout the file, regardless of source order. false-negative: A Set passed to unknown code stays silent because that code could install an instance method before the modeled call. false-negative: Instances of user-defined Set subclasses stay silent because the shared provenance model does not infer built-in identity through class inheritance. scope-boundary: Set composition calls stay silent when settings.servicenow.release is omitted because Zurich and Australia disagree.

- False negative: Calls through extracted method values or call/apply/bind helpers stay silent; the rule reports direct calls on a proven Set receiver.
- False negative: A Set passed to unknown code stays silent because that code could install an instance method before the modeled call.
- False negative: Instances of user-defined Set subclasses stay silent because the shared provenance model does not infer built-in identity through class inheritance.
- Scope: A possible Set constructor, prototype, or matching instance-method replacement suppresses the diagnostic throughout the file, regardless of source order.
- Scope: Set composition calls stay silent when settings.servicenow.release is omitted because Zurich and Australia disagree.


### Evidence

- [The Australia JavaScript engine update adds the new Set methods from Rhino PR 2029 in ECMAScript 2021 mode.](https://www.servicenow.com/docs/r/api-reference/scripts/updates-javascript-engine.html) — manual, 2026-08-24; `rule-evidence-14f80217`.
- [The official Australia update links Rhino PR 2029, whose implementation identifies intersection, union, difference, symmetricDifference, isSubsetOf, isSupersetOf, and isDisjointFrom as the added Set methods.](https://www.servicenow.com/docs/r/api-reference/scripts/updates-javascript-engine.html) — manual, 2026-08-24; `rule-evidence-0820b7c9`.
- [Fixtures cover all seven methods, release selection, object identity, aliases, joins, directly invoked and escaping closures, shadowing, mutation, availability guards, and unsupported contexts.](../tests/rules/no-unsupported-set-methods.test.ts) — fixture, 2026-08-24; `rule-evidence-fe4bc740`.
- [Real Oxlint and ESLint contracts verify Zurich, Australia, and omitted-release behavior for a proven Set receiver.](../tests/integration/release-contracts.test.ts) — integration-test, 2026-08-24; `rule-evidence-8b1b5177`.

[Catalog source](../src/catalog/no-unsupported-set-methods.ts).

## no-unsupported-static-methods

Error.isError(), Promise.try(), and Promise.withResolvers() are available in Australia ES2021 but not Zurich ES2021. Error.isError() is also unavailable in Compatibility and ES5 modes; Promise calls there remain owned by no-promise to avoid duplicate diagnostics. Omitted releases and unknown modes stay silent.

**Placements:** classic-es5 (error), es2021 (error). **Last verified:** 2026-08-24

### Applicability

classic; surfaces: Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Action applicability also depends on explicit client/server surfaces and the rule's execution-context gate. An explicit javascriptMode also enables documented engine checks in otherwise unclassified files.; confidence: inferred; modes: compatibility, es5, es2021; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.


#### Incorrect: Error.isError in Zurich ES2021

```js
var isPlatformError = Error.isError(value);
```

#### Correct: Error.isError in Australia ES2021

```js
var isPlatformError = Error.isError(value);
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. false-negative: Direct aliases of individual static methods stay silent; the shared resolver proves stable aliases of the owning Error or Promise object instead. scope-boundary: A possible callable replacement for a modeled method suppresses matching diagnostics throughout the file, regardless of source order. false-negative: An owner alias used from another function body stays silent because source order cannot prove that its initializer ran before the function was called. scope-boundary: Release-dependent ES2021 calls stay silent when settings.servicenow.release is omitted because Zurich and Australia disagree.

- False negative: Direct aliases of individual static methods stay silent; the shared resolver proves stable aliases of the owning Error or Promise object instead.
- False negative: An owner alias used from another function body stays silent because source order cannot prove that its initializer ran before the function was called.
- Scope: A possible callable replacement for a modeled method suppresses matching diagnostics throughout the file, regardless of source order.
- Scope: Release-dependent ES2021 calls stay silent when settings.servicenow.release is omitted because Zurich and Australia disagree.


Overlaps: `servicenow/no-promise`.

### Evidence

- [The Australia engine update adds Error.isError, Promise.try, and Promise.withResolvers in ECMAScript 2021 mode.](https://www.servicenow.com/docs/r/api-reference/scripts/updates-javascript-engine.html) — manual, 2026-08-24; `rule-evidence-e5b10f35`.
- [ServiceNow documents Compatibility as a third mode; the plugin applies the ES5 Error.isError capability cell to it as package policy.](https://www.servicenow.com/docs/r/api-reference/scripts/c_JS_modes.html) — manual, 2026-08-24; `rule-evidence-368a42a4`.
- [Fixtures cover release deltas, owner aliases, shadowing, reassignment, dynamic scope, callable polyfills, non-callable replacements, availability guards, and guard invalidation.](../tests/rules/no-unsupported-static-methods.test.ts) — fixture, 2026-08-24; `rule-evidence-55217204`.
- [Real Oxlint and ESLint contracts verify Zurich, Australia, omitted-release, and ES5 behavior for the modeled static methods.](../tests/integration/release-contracts.test.ts) — integration-test, 2026-08-24; `rule-evidence-e814fe7b`.

[Catalog source](../src/catalog/no-unsupported-static-methods.ts).

## no-typed-arrays

General TypedArray constructors and DataView construction are Disallowed by the ES5 cell, while BigInt64Array and BigUint64Array are Not Supported there. Zurich ES2021 supports general constructors but not static TypedArray.from/of factories; Australia adds those factories and Supports BigInt arrays. DataView BigInt getters remain Not Supported. Compatibility follows ES5 by package policy.

**Placements:** classic-es5 (error), es2021 (error). **Last verified:** 2026-08-24

### Applicability

classic; surfaces: Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Action applicability also depends on explicit client/server surfaces and the rule's execution-context gate. An explicit javascriptMode also enables documented engine checks in otherwise unclassified files.; confidence: inferred; modes: compatibility, es5, es2021, unknown; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.


#### Incorrect: Int8Array

```js
var bytes = new Int8Array(16);
```

#### Incorrect: DataView BigInt getter

```js
var view = new DataView(buffer);
var value = view.getBigInt64(0);
```

#### Incorrect: Int8Array static factory in Zurich

```js
var values = Int8Array.from(source);
```

#### Incorrect: BigInt64Array static factory in Zurich

```js
var values = BigInt64Array.from(source);
```

#### Correct: plain array

```js
var bytes = [0, 1, 2];
```

#### Correct: Int8Array static factory in Australia

```js
var values = Int8Array.from(source);
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: DataView BigInt setters stay silent because the reviewed ServiceNow tables establish only the getter methods. scope-boundary: Any possible direct constructor, prototype, or instance-method write in the file conservatively suppresses affected diagnostics, regardless of source order. scope-boundary: Passing a typed-array constructor or DataView.prototype to unknown code suppresses affected method diagnostics because that code can install replacements. false-negative: Calls through a reassigned property-mutation helper are treated as unknown; the rule does not assume the custom helper failed to install a DataView method.

- False negative: Calls through a reassigned property-mutation helper are treated as unknown; the rule does not assume the custom helper failed to install a DataView method.
- Scope: DataView BigInt setters stay silent because the reviewed ServiceNow tables establish only the getter methods.
- Scope: Any possible direct constructor, prototype, or instance-method write in the file conservatively suppresses affected diagnostics, regardless of source order.
- Scope: Passing a typed-array constructor or DataView.prototype to unknown code suppresses affected method diagnostics because that code can install replacements.


Overlaps: `servicenow/no-unsupported-syntax`.

### Evidence

- [The Zurich table marks general typed-array/DataView constructors Disallowed in ES5 Standards, while BigInt64 arrays and DataView BigInt getters are Not Supported.](https://www.servicenow.com/docs/r/zurich/api-reference/scripts/javascript-engine-feature-support.html) — manual, 2026-08-22; `rule-evidence-e13253e3`.
- [The Australia table marks BigInt64 array constructors Supported in ES2021 and Not Supported in ES5; DataView BigInt getters remain Not Supported.](https://www.servicenow.com/docs/r/api-reference/scripts/javascript-engine-feature-support.html) — manual, 2026-08-22; `rule-evidence-7da2cbb4`.
- [The Australia engine update lists Rhino PR 1966 as adding TypedArray.from and TypedArray.of in ES2021 mode.](https://www.servicenow.com/docs/r/api-reference/scripts/updates-javascript-engine.html) — manual, 2026-08-24; `rule-evidence-3d19a43b`.
- [ServiceNow documents Compatibility as a third mode; the plugin explicitly applies ES5 feature cells to it as package policy.](https://www.servicenow.com/docs/r/api-reference/scripts/c_JS_modes.html) — manual, 2026-08-22; `rule-evidence-0d677df1`.
- [Fixtures cover constructor-independent Zurich factory diagnostics, method guards, release omission, constructors, aliases, DataView BigInt getters, mutation, and namespace escape.](../tests/rules/glide-and-engine.test.ts) — fixture, 2026-08-24; `rule-evidence-7b500c7f`.
- [Real Oxlint and ESLint contracts verify general TypedArray factories in Zurich, Australia, and omitted-release ES2021 configurations.](../tests/integration/release-contracts.test.ts) — integration-test, 2026-08-24; `rule-evidence-b6da498a`.

[Catalog source](../src/catalog/no-typed-arrays.ts).

## no-proxy

`Proxy` is unsupported in Compatibility and ES5 Standards mode. Direct calls plus stable same-execution constructor and `revocable` owner aliases report; bare aliases must be captured under an owner guard, while fully guarded or visibly polyfilled calls stay silent.

**Placements:** classic-es5 (error). **Last verified:** 2026-08-24

### Applicability

classic; surfaces: Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Action applicability also depends on explicit client/server surfaces and the rule's execution-context gate. An explicit javascriptMode also enables documented engine checks in otherwise unclassified files.; confidence: inferred; modes: compatibility, es5; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.


#### Incorrect: new Proxy

```js
var p = new Proxy(target, handler);
```

#### Correct: plain object

```js
var p = { prop: value };
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: A possible callable replacement for Proxy or Proxy.revocable suppresses matching diagnostics throughout the file, regardless of source order. scope-boundary: A constructor call protected by a structurally dominating owner guard stays silent; revocable calls require both the Proxy owner and method to be guarded. false-negative: A Proxy alias used from another function body stays silent because source order cannot prove that its initializer ran before the function was called. false-negative: Direct aliases of Proxy.revocable stay silent; the shared resolver proves stable aliases of the Proxy owner instead.

- False negative: A Proxy alias used from another function body stays silent because source order cannot prove that its initializer ran before the function was called.
- False negative: Direct aliases of Proxy.revocable stay silent; the shared resolver proves stable aliases of the Proxy owner instead.
- Scope: A possible callable replacement for Proxy or Proxy.revocable suppresses matching diagnostics throughout the file, regardless of source order.
- Scope: A constructor call protected by a structurally dominating owner guard stays silent; revocable calls require both the Proxy owner and method to be guarded.


Overlaps: `servicenow/no-unsupported-syntax`.

### Evidence

- [Proxy is unsupported in Compatibility and ES5 Standards modes.](https://www.servicenow.com/docs/r/zurich/api-reference/scripts/javascript-engine-feature-support.html) — manual, 2026-08-20; `rule-evidence-b5644e0d`.
- [Fixtures cover stable Proxy constructor and revocable-owner aliases, guarded alias capture, owner-and-method availability checks, modeled built-in invalidation, visible polyfills, mutation, and dynamic scope.](../tests/rules/no-proxy.test.ts) — fixture, 2026-08-24; `rule-evidence-00127b01`.
- [Real Oxlint and ESLint classic-es5 profiles report a stable Proxy alias and accept an explicit callable polyfill.](../tests/integration/profiles.test.ts) — integration-test, 2026-08-24; `rule-evidence-952b4455`.
- [The Australia JavaScript engine feature table was reviewed for this rule's modeled capability cells.](https://www.servicenow.com/docs/r/api-reference/scripts/javascript-engine-feature-support.html) — manual, 2026-08-22; `rule-evidence-cb39620b`.

[Catalog source](../src/catalog/no-proxy.ts).

## no-unsupported-syntax

The ES5 table marks ordinary object shorthand methods Not Supported and async/generator methods Disallowed. It also marks optional chaining, nullish coalescing, logical assignment, private members, and RegExp lookbehind Not Supported. Constructor-string lookbehind detection follows direct and stable same-execution built-in RegExp identity. Private instance members remain Not Supported in ES2021; Compatibility follows ES5 by package policy.

**Placements:** classic-es5 (error), es2021 (error). **Last verified:** 2026-08-24

### Applicability

classic; surfaces: Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Action applicability also depends on explicit client/server surfaces and the rule's execution-context gate. An explicit javascriptMode also enables documented engine checks in otherwise unclassified files.; confidence: inferred; modes: compatibility, es5, es2021, unknown; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.


#### Incorrect: optional chaining and ??

```js
var name = current.caller_id?.name ?? "unknown";
```

#### Incorrect: private instance member in Australia ES2021

```js
class State { #value = 1; }
```

#### Incorrect: RegExp alias with lookbehind

```js
const Regex = RegExp;
var matcher = Regex("(?<=a)b");
```

#### Incorrect: object shorthand method in ES5

```js
var definitions = { create() {} };
```

#### Correct: explicit check

```js
var name = current.caller_id ? current.caller_id.name : "unknown";
```

#### Correct: private static member in Australia ES2021

```js
class State { static #value = 1; }
```

#### Correct: explicit RegExp replacement

```js
RegExp = LocalRegExp;
var matcher = RegExp("(?<=a)b");
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: Any visible RegExp replacement suppresses constructor-string diagnostics throughout the file because the replacement may implement different pattern syntax. RegExp literal diagnostics remain active. false-negative: A RegExp alias used from another function body stays silent because source order cannot prove that its initializer ran before the function was called.

- False negative: A RegExp alias used from another function body stays silent because source order cannot prove that its initializer ran before the function was called.
- Scope: Any visible RegExp replacement suppresses constructor-string diagnostics throughout the file because the replacement may implement different pattern syntax. RegExp literal diagnostics remain active.


Overlaps: `servicenow/no-async-await`, `servicenow/no-bigint`.

### Evidence

- [The feature table marks ordinary shorthand object methods Not Supported and async/generator object methods Disallowed in ES5 Standards mode; Compatibility follows those cells by package policy.](https://www.servicenow.com/docs/r/zurich/api-reference/scripts/javascript-engine-feature-support.html) — manual, 2026-08-24; `rule-evidence-aec5a123`.
- [The Australia table marks private instance fields, methods, and accessors Not Supported in ES2021.](https://www.servicenow.com/docs/r/api-reference/scripts/javascript-engine-feature-support.html) — manual, 2026-08-22; `rule-evidence-da85fc02`.
- [ServiceNow documents Compatibility as a third mode; the plugin explicitly applies ES5 feature cells to it as package policy.](https://www.servicenow.com/docs/r/api-reference/scripts/c_JS_modes.html) — manual, 2026-08-22; `rule-evidence-1d7367a9`.
- [classic-es5 Oxlint flags unsupported syntax on the ES2021 fixture.](../tests/integration/profiles/invalid/es5-promise.server.js) — integration-test, 2026-08-20; `rule-evidence-dbced4b7`.
- [Fixtures cover shorthand object methods plus direct, namespace-qualified, and stable same-execution RegExp aliases, shadows, mutation, dynamic scope, and constructor-versus-literal authority boundaries.](../tests/rules/no-unsupported-syntax.test.ts) — fixture, 2026-08-24; `rule-evidence-034df13d`.
- [Real Oxlint and ESLint classic-es5 profiles resolve stable RegExp aliases and accept explicit constructor replacements.](../tests/integration/profiles.test.ts) — integration-test, 2026-08-24; `rule-evidence-7c9c7159`.

[Catalog source](../src/catalog/no-unsupported-syntax.ts).

## no-delete-multiple-with-windowing

`setLimit()` and `chooseWindow()` do not limit `deleteMultiple()`. The call deletes every row that matches the query. Evidence: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html

**Placements:** recommended (error), business-rule (error). **Last verified:** 2026-08-24

### Applicability

classic; surfaces: Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Action applicability also depends on explicit client/server surfaces and the rule's execution-context gate. Unknown surfaces stay silent.; confidence: inferred; modes: n/a; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.


#### Incorrect: setLimit then deleteMultiple

```js
var stale = new GlideRecord("x_acme_staging");
stale.addQuery("state", "expired");
stale.setLimit(100);
stale.deleteMultiple();
```

#### Correct: intentional bulk delete

```js
var stale = new GlideRecord("x_acme_staging");
stale.addQuery("state", "expired");
stale.deleteMultiple();
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. false-negative: A possible platform constructor namespace reassignment, prototype or relevant instance-method mutation, or dynamic-scope uncertainty suppresses matching diagnostics throughout the file. lifecycle: Window methods must resolve to the same GlideRecord object identity as deleteMultiple.

- False negative: A possible platform constructor namespace reassignment, prototype or relevant instance-method mutation, or dynamic-scope uncertainty suppresses matching diagnostics throughout the file.

Lifecycle: Window methods must resolve to the same GlideRecord object identity as deleteMultiple.


Overlaps: `servicenow/no-unfiltered-gliderecord-bulk-operation`.

### Evidence

- [setLimit and chooseWindow do not limit deleteMultiple(); the call deletes every matching row.](https://www.servicenow.com/docs/r/zurich/api-reference/server-api-reference/c_GlideRecordScopedAPI.html) — manual, 2026-08-20; `rule-evidence-edfe6e7c`.
- [Recommended hosts report windowed deleteMultiple.](../tests/integration/profiles/invalid/windowed-delete.br.js) — integration-test, 2026-08-20; `rule-evidence-c8bf267c`.
- [Constructor namespace, prototype, instance-method, and dynamic-scope mutations are covered by shared platform-authority fixtures.](../tests/rules/platform-method-authority.test.ts) — fixture, 2026-08-24; `rule-evidence-b7d88284`.
- [The Australia-scoped GlideRecord API was reviewed for the methods and lifecycle facts used by this rule.](https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html) — manual, 2026-08-22; `rule-evidence-0128acb8`.
- [The Australia-global GlideRecord API was reviewed for the methods and lifecycle facts used by this rule.](https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordAPI.html) — manual, 2026-08-22; `rule-evidence-0f21a303`.

[Catalog source](../src/catalog/no-delete-multiple-with-windowing.ts).

## require-callback-for-getreference

`g_form.getReference(field)` without a callback is a synchronous server request. Pass a callback.

**Placements:** recommended (error), client (error). **Last verified:** 2026-08-24

### Applicability

classic; surfaces: Applies to client, ui-action when those surfaces are known. UI Action applicability also depends on explicit client/server surfaces and the rule's execution-context gate. Unknown surfaces stay silent.; confidence: inferred; modes: n/a; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.


#### Incorrect: sync getReference

```js
function onChange() {
  var caller = g_form.getReference("caller_id");
  g_form.setValue("u_manager", caller.manager);
}
```

#### Correct: async getReference

```js
function onChange() {
  g_form.getReference("caller_id", function (caller) {
    g_form.setValue("u_manager", caller.manager);
  });
}
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: Local objects named g_form are not the platform global. false-negative: A possible g_form, GlideForm prototype, or getReference mutation suppresses matching calls throughout the file because deferred runtime order cannot be inferred from source order.

- False negative: A possible g_form, GlideForm prototype, or getReference mutation suppresses matching calls throughout the file because deferred runtime order cannot be inferred from source order.
- Scope: Local objects named g_form are not the platform global.


### Evidence

- [g_form.getReference without a callback is a synchronous server request.](https://www.servicenow.com/docs/r/api-reference/c_GlideFormAPI.html) — manual, 2026-08-20; `rule-evidence-4ebf3172`.
- [Recommended hosts report the one-argument form.](../tests/integration/profiles/invalid/sync-getreference.client.js) — integration-test, 2026-08-20; `rule-evidence-491de6a1`.
- [Immutable callback aliases and visible method mutations are covered adversarially.](../tests/rules/require-callback-for-getreference.test.ts) — fixture, 2026-08-24; `rule-evidence-ec5927b5`.

[Catalog source](../src/catalog/require-callback-for-getreference.ts).

## require-glideajax-sysparm-name

GlideAjax requires a non-empty `addParam("sysparm_name", method)` before `getXML` / `getXMLAnswer` / `getXMLWait`. Extra static keys must start with `sysparm_`.

**Placements:** recommended (error), client (error). **Last verified:** 2026-08-24

### Applicability

classic; surfaces: Applies to client, ui-action when those surfaces are known. UI Action applicability also depends on explicit client/server surfaces and the rule's execution-context gate. Unknown surfaces stay silent.; confidence: inferred; modes: n/a; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.


#### Incorrect: missing sysparm_name

```js
var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_user_id", g_form.getValue("caller_id"));
ajax.getXMLAnswer(handleAnswer);
```

#### Correct: named method

```js
var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_name", "getManager");
ajax.addParam("sysparm_user_id", g_form.getValue("caller_id"));
ajax.getXMLAnswer(handleAnswer);
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. false-negative: A possible GlideAjax constructor, prototype, addParam, or request-method mutation suppresses affected lifecycle findings throughout the file. lifecycle: A later request on the same object requires a new usable sysparm_name.

- False negative: A possible GlideAjax constructor, prototype, addParam, or request-method mutation suppresses affected lifecycle findings throughout the file.

Lifecycle: A later request on the same object requires a new usable sysparm_name.


Overlaps: `servicenow/no-glideajax-getanswer`, `servicenow/no-sync-glideajax`.

### Evidence

- [GlideAjax requires a non-empty sysparm_name before getXML, getXMLAnswer, or getXMLWait.](https://www.servicenow.com/docs/r/api-reference/scripts/p_AJAX.html) — manual, 2026-08-20; `rule-evidence-49915d92`.
- [Empty or missing sysparm_name values report on the client host fixtures.](../tests/integration/profiles/invalid/glideajax-empty-sysparm.client.js) — integration-test, 2026-08-20; `rule-evidence-02bfea04`.
- [Constructor, prototype, instance-method, and dynamic-scope mutations remain silent.](../tests/rules/require-glideajax-sysparm-name.test.ts) — fixture, 2026-08-24; `rule-evidence-33a8209c`.

[Catalog source](../src/catalog/require-glideajax-sysparm-name.ts).

## validate-glideaggregate-calls

A proven GlideAggregate must call `query()` before `next()` or `getAggregate()`. Static `getAggregate(type, field?)` must match an exact `addAggregate` tuple that was registered before that `query()`.

**Placements:** recommended (error), business-rule (error). **Last verified:** 2026-08-24

### Applicability

classic; surfaces: Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Action applicability also depends on explicit client/server surfaces and the rule's execution-context gate. Unknown surfaces stay silent.; confidence: inferred; modes: n/a; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.


#### Incorrect: next before query

```js
var count = new GlideAggregate("incident");
count.addAggregate("COUNT");
if (count.next()) {
  gs.info(count.getAggregate("COUNT"));
}
```

#### Correct: query then next

```js
var count = new GlideAggregate("incident");
count.addAggregate("COUNT");
count.query();
if (count.next()) {
  gs.info(count.getAggregate("COUNT"));
}
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. false-negative: A possible platform constructor namespace reassignment, prototype or relevant instance-method mutation, or dynamic-scope uncertainty suppresses matching diagnostics throughout the file. lifecycle: Must-tuples intersect on join. addAggregate after query() does not validate the already-open result.

- False negative: A possible platform constructor namespace reassignment, prototype or relevant instance-method mutation, or dynamic-scope uncertainty suppresses matching diagnostics throughout the file.

Lifecycle: Must-tuples intersect on join. addAggregate after query() does not validate the already-open result.


Overlaps: `servicenow/require-query-before-next`.

### Evidence

- [The Australia GlideAggregate API documents addAggregate before query and getAggregate on the returned aggregate result.](https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideAggregateScopedAPI.html) — manual, 2026-08-22; `rule-evidence-64dc5caa`.
- [The Australia global GlideAggregate API documents the corresponding aggregate lifecycle methods.](https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideAggregateAPI.html) — manual, 2026-08-22; `rule-evidence-bdbab258`.
- [Type-only COUNT does not satisfy a field-specific getAggregate.](../tests/integration/profiles/invalid/aggregate-type-only-field.br.js) — integration-test, 2026-08-20; `rule-evidence-653ed72c`.
- [Constructor namespace, prototype, instance-method, and dynamic-scope mutations are covered by shared platform-authority fixtures.](../tests/rules/platform-method-authority.test.ts) — fixture, 2026-08-24; `rule-evidence-84bbded5`.

[Catalog source](../src/catalog/validate-glideaggregate-calls.ts).

## no-now-id-as-reference

`Now.ID[...]` is a metadata identity, not a reference. Alias meaning is read at the use site from lexical binding identity. Use the factory object in-app or `Now.ref()` for external records.

**Placements:** recommended (error), fluent (error). **Last verified:** 2026-08-20

### Applicability

fluent; surfaces: Fluent `.now.ts` metadata only.; confidence: inferred; modes: n/a; scopes: global, scoped, unknown; releases: SDK-versioned; SDK: 3.0.0 || 3.0.1 || 3.0.2 || 3.0.3 || 4.0.0 || 4.0.1 || 4.0.2 || 4.1.0 || 4.1.1 || 4.2.0 || 4.3.0 || 4.4.0 || 4.4.1 || 4.5.0 || 4.6.0 || 4.6.1 || 4.7.0 || 4.7.1 || 4.7.2 || 4.8.0 || 4.8.1 || 4.9.0 || 4.9.1 || 4.9.2 || 4.10.0 || 4.10.1 || 4.11.0.


#### Incorrect: Now.ID in another property

```ts
import { CatalogItem, VariableSet } from "@servicenow/sdk/core";

const userInformation = VariableSet({
  $id: Now.ID["user-information"],
  title: "User information",
});

CatalogItem({
  $id: Now.ID["software-request"],
  variableSets: [{ variableSet: Now.ID["user-information"], order: 100 }],
});
```

#### Correct: factory object reference

```ts
import { CatalogItem, VariableSet } from "@servicenow/sdk/core";

const userInformation = VariableSet({
  $id: Now.ID["user-information"],
  title: "User information",
});

CatalogItem({
  $id: Now.ID["software-request"],
  flow: Now.ref("sys_hub_flow", "existing-flow-id"),
  variableSets: [{ variableSet: userInformation, order: 100 }],
});
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: Local objects named Now are not the SDK namespace.

- Scope: Local objects named Now are not the SDK namespace.


Overlaps: `servicenow/require-fluent-id`.

### Evidence

- [Now.ID is a metadata identity, not an in-app record reference.](https://www.servicenow.com/docs/r/application-development/servicenow-sdk/fluent-constructs.html) — manual, 2026-08-20; `rule-evidence-8855e302`.
- [Recommended hosts report Now.ID used as a reference field.](../tests/integration/profiles/invalid/now-id-ref.now.ts) — integration-test, 2026-08-20; `rule-evidence-b2c1d41a`.

[Catalog source](../src/catalog/no-now-id-as-reference.ts).

## no-glideajax-getanswer

`getAnswer()` belongs to synchronous GlideAjax. Use `getXMLAnswer(callback)` instead.

**Placements:** recommended (error), client (error). **Last verified:** 2026-08-24

### Applicability

classic; surfaces: Applies to client, ui-action when those surfaces are known. UI Action applicability also depends on explicit client/server surfaces and the rule's execution-context gate. Unknown surfaces stay silent.; confidence: inferred; modes: n/a; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.


#### Incorrect: getAnswer after getXML

```js
var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_name", "getManager");
ajax.getXML(handleResponse);
var answer = ajax.getAnswer();
```

#### Correct: getXMLAnswer callback

```js
var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_name", "getManager");
ajax.getXMLAnswer(function (answer) {
  g_form.setValue("u_manager", answer);
});
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. false-negative: A possible GlideAjax constructor, prototype, or getAnswer mutation suppresses matching calls throughout the file.

- False negative: A possible GlideAjax constructor, prototype, or getAnswer mutation suppresses matching calls throughout the file.


Overlaps: `servicenow/no-sync-glideajax`.

### Evidence

- [getAnswer belongs to the synchronous getXMLWait pattern.](https://www.servicenow.com/docs/r/api-reference/c_GlideAjaxAPI.html) — manual, 2026-08-20; `rule-evidence-29a12bef`.
- [Recommended hosts report getAnswer on proven GlideAjax objects.](../tests/integration/profiles/invalid/glideajax-getanswer.client.js) — integration-test, 2026-08-20; `rule-evidence-2082b02e`.
- [Constructor, prototype, instance-method, and dynamic-scope mutations remain silent.](../tests/rules/no-glideajax-getanswer.test.ts) — fixture, 2026-08-24; `rule-evidence-1218bf8a`.

[Catalog source](../src/catalog/no-glideajax-getanswer.ts).

## no-duplicate-fluent-id

Two Fluent definitions that share the same static `Now.ID` key as `$id` collide. Cross-file uniqueness is out of scope.

**Placements:** recommended (error), fluent (error). **Last verified:** 2026-08-20

### Applicability

fluent; surfaces: Fluent `.now.ts` metadata only.; confidence: inferred; modes: n/a; scopes: global, scoped, unknown; releases: SDK-versioned; SDK: 3.0.0 || 3.0.1 || 3.0.2 || 3.0.3 || 4.0.0 || 4.0.1 || 4.0.2 || 4.1.0 || 4.1.1 || 4.2.0 || 4.3.0 || 4.4.0 || 4.4.1 || 4.5.0 || 4.6.0 || 4.6.1 || 4.7.0 || 4.7.1 || 4.7.2 || 4.8.0 || 4.8.1 || 4.9.0 || 4.9.1 || 4.9.2 || 4.10.0 || 4.10.1 || 4.11.0.


#### Incorrect: duplicate top-level ids

```ts
import { BusinessRule } from "@servicenow/sdk/core";

BusinessRule({
  $id: Now.ID["update-assignment"],
  name: "Update assignment",
  table: "incident",
  when: "before",
});

BusinessRule({
  $id: Now.ID["update-assignment"],
  name: "Notify assignment",
  table: "incident",
  when: "after",
});
```

#### Correct: unique ids

```ts
import { BusinessRule } from "@servicenow/sdk/core";

BusinessRule({
  $id: Now.ID["update-assignment"],
  name: "Update assignment",
  table: "incident",
  when: "before",
});

BusinessRule({
  $id: Now.ID["notify-assignment"],
  name: "Notify assignment",
  table: "incident",
  when: "after",
});
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing.

- None recorded.


Overlaps: `servicenow/require-fluent-id`.

### Evidence

- [Now.ID keys must be unique in a file so keys.ts can track records.](https://www.servicenow.com/docs/r/application-development/servicenow-sdk/fluent-constructs.html) — manual, 2026-08-20; `rule-evidence-4fc018df`.
- [Recommended hosts report duplicate Now.ID keys.](../tests/integration/profiles/invalid/duplicate-id.now.ts) — integration-test, 2026-08-20; `rule-evidence-885beb38`.

[Catalog source](../src/catalog/no-duplicate-fluent-id.ts).

## no-glideelement-in-collection

Direct GlideRecord field access and path-proven local aliases are GlideElements tied to the cursor. Do not `push` / `unshift` them inside a `.next()` or `._next()` loop.

**Placements:** recommended (error), business-rule (error). **Last verified:** 2026-08-24

### Applicability

classic; surfaces: Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Action applicability also depends on explicit client/server surfaces and the rule's execution-context gate. Unknown surfaces stay silent.; confidence: inferred; modes: n/a; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.


#### Incorrect: push field

```js
var numbers = [];
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  numbers.push(incident.number);
}
```

#### Incorrect: push field alias

```js
var numbers = [];
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  var number = incident.number;
  numbers.push(number);
}
```

#### Correct: getValue

```js
var numbers = [];
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  numbers.push(incident.getValue("number"));
}
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: Separately declared helpers and deferred callbacks stay silent because their invocation timing and value flow are not proven by the cursor traversal. false-negative: A possible platform constructor namespace reassignment, prototype or relevant instance-method mutation, or dynamic-scope uncertainty suppresses matching diagnostics throughout the file.

- False negative: A possible platform constructor namespace reassignment, prototype or relevant instance-method mutation, or dynamic-scope uncertainty suppresses matching diagnostics throughout the file.
- Scope: Separately declared helpers and deferred callbacks stay silent because their invocation timing and value flow are not proven by the cursor traversal.


### Evidence

- [A GlideElement follows a cursor advanced by next() or _next(); collections must store extracted values.](https://www.servicenow.com/docs/r/zurich/api-reference/server-api-reference/c_GlideRecordScopedAPI.html) — manual, 2026-08-22; `rule-evidence-8f2af49a`.
- [Recommended hosts report pushing a cursor field into an array.](../tests/integration/profiles/invalid/glideelement-push.br.js) — integration-test, 2026-08-20; `rule-evidence-f581ef18`.
- [Path-sensitive fixtures cover local aliases, reassignment, shadowing, all-path joins, and IIFE parameters.](../tests/rules/platform-binding-identity.test.ts) — fixture, 2026-08-22; `rule-evidence-7e51205d`.
- [Constructor namespace, prototype, instance-method, and dynamic-scope mutations are covered by shared platform-authority fixtures.](../tests/rules/platform-method-authority.test.ts) — fixture, 2026-08-24; `rule-evidence-b5231bb8`.
- [The Australia-scoped GlideRecord API was reviewed for the methods and lifecycle facts used by this rule.](https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html) — manual, 2026-08-22; `rule-evidence-ba597f84`.
- [The Australia-global GlideRecord API was reviewed for the methods and lifecycle facts used by this rule.](https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordAPI.html) — manual, 2026-08-22; `rule-evidence-d3948e5f`.

[Catalog source](../src/catalog/no-glideelement-in-collection.ts).

## no-gliderecord-query-modifier-after-query

Filters and result-shaping calls after a documented query executor do not change the open cursor. Report when a consumer uses that cursor before another execution.

**Placements:** recommended (error), business-rule (error). **Last verified:** 2026-08-24

### Applicability

classic; surfaces: Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Action applicability also depends on explicit client/server surfaces and the rule's execution-context gate. Unknown surfaces stay silent.; confidence: inferred; modes: n/a; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.


#### Incorrect: addQuery after query

```js
var incident = new GlideRecord("incident");
incident.query();
incident.addQuery("active", true);
while (incident.next()) {
  gs.info(incident.number);
}
```

#### Correct: filter then query

```js
var incident = new GlideRecord("incident");
incident.addQuery("active", true);
incident.query();
while (incident.next()) {
  gs.info(incident.number);
}
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. false-negative: A possible platform constructor namespace reassignment, prototype or relevant instance-method mutation, or dynamic-scope uncertainty suppresses matching diagnostics throughout the file. lifecycle: Modifiers after a definite executor are findings only when a consumer uses the still-open cursor. A possible-only executor clears positive lifecycle facts.

- False negative: A possible platform constructor namespace reassignment, prototype or relevant instance-method mutation, or dynamic-scope uncertainty suppresses matching diagnostics throughout the file.

Lifecycle: Modifiers after a definite executor are findings only when a consumer uses the still-open cursor. A possible-only executor clears positive lifecycle facts.


Overlaps: `servicenow/require-query-before-next`.

### Evidence

- [Query modifiers after a documented query executor do not change the open cursor.](https://www.servicenow.com/docs/r/zurich/api-reference/server-api-reference/c_GlideRecordAPI.html) — manual, 2026-08-22; `rule-evidence-6fd6aef0`.
- [Recommended hosts report addQuery after query before next.](../tests/integration/profiles/invalid/late-modifier.br.js) — integration-test, 2026-08-20; `rule-evidence-7a7e2bef`.
- [Constructor namespace, prototype, instance-method, and dynamic-scope mutations are covered by shared platform-authority fixtures.](../tests/rules/platform-method-authority.test.ts) — fixture, 2026-08-24; `rule-evidence-5e57a999`.
- [The Australia-scoped GlideRecord API was reviewed for the methods and lifecycle facts used by this rule.](https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html) — manual, 2026-08-22; `rule-evidence-b3775e07`.
- [The Australia-global GlideRecord API was reviewed for the methods and lifecycle facts used by this rule.](https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordAPI.html) — manual, 2026-08-22; `rule-evidence-b3c456ac`.

[Catalog source](../src/catalog/no-gliderecord-query-modifier-after-query.ts).

## require-business-rule-wrapper

Full-script Business Rules must wrap logic in the standard IIFE so top-level variables do not leak. The rule is silent unless `businessRuleSourceFormat` is `full-script`.

**Placements:** recommended (error), business-rule (error). **Last verified:** 2026-08-20

### Applicability

classic; surfaces: Applies to business-rule when those surfaces are known. Unknown surfaces stay silent.; confidence: inferred; modes: n/a; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.


#### Incorrect: unwrapped

```js
var targetGroup = gs.getProperty("x_acme.target_group");
if (current.assignment_group.nil()) {
  current.assignment_group = targetGroup;
}
```

#### Correct: IIFE wrapper

```js
(function executeRule(current, previous) {
  var targetGroup = gs.getProperty("x_acme.target_group");
  if (current.assignment_group.nil()) {
    current.assignment_group = targetGroup;
  }
})(current, previous);
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: Body-only Business Rule source does not contain the platform wrapper.

- Scope: Body-only Business Rule source does not contain the platform wrapper.


### Evidence

- [Full-script Business Rules use the executeRule(current, previous) IIFE so top-level bindings do not leak.](https://www.servicenow.com/docs/r/application-development/business-rules-classic/c_BusinessRules.html) — manual, 2026-08-20; `rule-evidence-bc701657`.
- [The wrapper rule reports only when businessRuleSourceFormat is full-script.](../tests/integration/profiles/invalid/unwrapped.br.js) — integration-test, 2026-08-20; `rule-evidence-29cd4710`.

[Catalog source](../src/catalog/require-business-rule-wrapper.ts).

## no-display-value-date-comparison

Do not relationally compare `GlideDateTime.getDisplayValue()` strings. Use `getNumericValue()` or a date-aware API.

**Placements:** strict (warn). **Last verified:** 2026-08-24

### Applicability

classic; surfaces: Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Action applicability also depends on explicit client/server surfaces and the rule's execution-context gate. Unknown surfaces stay silent.; confidence: inferred; modes: n/a; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.


#### Incorrect: display string compare

```js
var start = new GlideDateTime(current.start_date);
var end = new GlideDateTime(current.end_date);
if (start.getDisplayValue() > end.getDisplayValue()) {
  gs.addErrorMessage("Start must be before end");
}
```

#### Correct: numeric compare

```js
var start = new GlideDateTime(current.start_date);
var end = new GlideDateTime(current.end_date);
if (start.getNumericValue() > end.getNumericValue()) {
  gs.addErrorMessage("Start must be before end");
}
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. false-negative: Display values copied into locals are not tracked before comparison. false-negative: A possible platform constructor namespace reassignment, prototype or relevant instance-method mutation, or dynamic-scope uncertainty suppresses matching diagnostics throughout the file.

- False negative: Display values copied into locals are not tracked before comparison.
- False negative: A possible platform constructor namespace reassignment, prototype or relevant instance-method mutation, or dynamic-scope uncertainty suppresses matching diagnostics throughout the file.


Overlaps: `servicenow/no-gs-now`.

### Evidence

- [GlideDateTime.getDisplayValue() follows the session format and is not a chronological sort key.](https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideDateTimeAPI.html) — manual, 2026-08-20; `rule-evidence-16c3e6e5`.
- [Catalog examples cover display-value comparison versus getNumericValue.](../src/catalog/no-display-value-date-comparison.ts) — fixture, 2026-08-20; `rule-evidence-e58fb67c`.
- [Constructor namespace, prototype, instance-method, and dynamic-scope mutations are covered by shared platform-authority fixtures.](../tests/rules/platform-method-authority.test.ts) — fixture, 2026-08-24; `rule-evidence-825ff6f9`.

[Catalog source](../src/catalog/no-display-value-date-comparison.ts).

## no-unfiltered-gliderecord-bulk-operation

`updateMultiple()` / `deleteMultiple()` without a proven restricting filter can touch every row. `query`, `orderBy`, `setLimit`, and `chooseWindow` are not filters. Empty `addQuery()` / `addEncodedQuery("")` do not count.

**Placements:** recommended (warn). **Last verified:** 2026-08-24

### Applicability

classic; surfaces: Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Action applicability also depends on explicit client/server surfaces and the rule's execution-context gate. Unknown surfaces stay silent.; confidence: inferred; modes: n/a; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.


#### Incorrect: deleteMultiple with no filter

```js
var staging = new GlideRecord("x_acme_staging");
staging.deleteMultiple();
```

#### Correct: filtered updateMultiple

```js
var task = new GlideRecord("task");
task.addQuery("active", false);
task.setValue("u_migrated", true);
task.updateMultiple();
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. false-negative: A possible platform constructor namespace reassignment, prototype or relevant instance-method mutation, or dynamic-scope uncertainty suppresses matching diagnostics throughout the file. lifecycle: query, orderBy, setLimit, and chooseWindow are not restricting filters.

- False negative: A possible platform constructor namespace reassignment, prototype or relevant instance-method mutation, or dynamic-scope uncertainty suppresses matching diagnostics throughout the file.

Lifecycle: query, orderBy, setLimit, and chooseWindow are not restricting filters.


Overlaps: `servicenow/no-delete-multiple-with-windowing`.

### Evidence

- [updateMultiple and deleteMultiple apply to every row that matches the query filters.](https://www.servicenow.com/docs/r/zurich/api-reference/server-api-reference/c_GlideRecordScopedAPI.html) — manual, 2026-08-20; `rule-evidence-586ee5cf`.
- [Empty or missing addQuery arguments do not count as filters.](../tests/integration/profiles/invalid/empty-addquery-bulk.br.js) — integration-test, 2026-08-20; `rule-evidence-5ae56c50`.
- [Constructor namespace, prototype, instance-method, and dynamic-scope mutations are covered by shared platform-authority fixtures.](../tests/rules/platform-method-authority.test.ts) — fixture, 2026-08-24; `rule-evidence-39d3b952`.
- [The Australia-scoped GlideRecord API was reviewed for the methods and lifecycle facts used by this rule.](https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html) — manual, 2026-08-22; `rule-evidence-085282c6`.
- [The Australia-global GlideRecord API was reviewed for the methods and lifecycle facts used by this rule.](https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordAPI.html) — manual, 2026-08-22; `rule-evidence-1cf6b2c5`.

[Catalog source](../src/catalog/no-unfiltered-gliderecord-bulk-operation.ts).

## no-gliderecord-query-in-acl

Review proven GlideRecord, GlideRecordSecure, and GlideAggregate query executions on an ACL's immediate evaluation path. ServiceNow advises limiting GlideRecord queries in access control scripts because they can affect performance. This advisory rule is opt-in through strict, acl, or security profiles and does not claim that every query is incorrect.

**Placements:** strict (warn), acl (warn), security (warn). **Last verified:** 2026-08-24

### Applicability

classic; surfaces: Applies to acl when those surfaces are known. Unknown surfaces stay silent.; confidence: filename; modes: n/a; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.


#### Incorrect: query during ACL evaluation

```js
var membership = new GlideRecord("sys_user_grmember");
membership.addQuery("user", gs.getUserID());
membership.addQuery("group", current.assignment_group);
membership.query();
answer = membership.hasNext();
```

#### Correct: role and loaded-record fields

```js
answer = gs.hasRole("x_acme.agent") && current.active && current.assigned_to == gs.getUserID();
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: Uncalled helpers and deferred callbacks stay silent because their execution during this ACL evaluation is not proven. scope-boundary: A query after the first await stays silent because that continuation does not run during the helper's immediate invocation. false-negative: A GlideRecord passed to an unresolved helper stays silent after escape because the helper may replace or otherwise invalidate its method identity. scope-boundary: Global-only query executors stay silent when application scope is unknown. false-negative: A visible GlideRecord prototype or relevant instance-method mutation suppresses matching ACL diagnostics throughout the file. lifecycle: Only query executions before the first asynchronous suspension on the immediate ACL evaluation path are reviewed. Directly invoked local helpers inherit call-time object identity; uncalled functions, generators, deferred callbacks, post-await continuations, escaped objects, unsupported scope-specific methods, and uncertain platform-method authority stay silent.

- False negative: A GlideRecord passed to an unresolved helper stays silent after escape because the helper may replace or otherwise invalidate its method identity.
- False negative: A visible GlideRecord prototype or relevant instance-method mutation suppresses matching ACL diagnostics throughout the file.
- Scope: Uncalled helpers and deferred callbacks stay silent because their execution during this ACL evaluation is not proven.
- Scope: A query after the first await stays silent because that continuation does not run during the helper's immediate invocation.
- Scope: Global-only query executors stay silent when application scope is unknown.

Lifecycle: Only query executions before the first asynchronous suspension on the immediate ACL evaluation path are reviewed. Directly invoked local helpers inherit call-time object identity; uncalled functions, generators, deferred callbacks, post-await continuations, escaped objects, unsupported scope-specific methods, and uncertain platform-method authority stay silent.


Overlaps: `servicenow/no-gliderecord-query-in-loop`.

### Evidence

- [ServiceNow's Zurich secure-data guidance advises limiting GlideRecord queries in access control scripts because they can affect performance.](https://www.servicenow.com/docs/r/zurich/application-development/building-applications/secure-data.html) — manual, 2026-08-24; `rule-evidence-e759c4c5`.
- [ServiceNow's Australia secure-data guidance retains the same advice to limit GlideRecord queries in access control scripts.](https://www.servicenow.com/docs/r/application-development/secure-data.html) — manual, 2026-08-24; `rule-evidence-2946db41`.
- [The Australia GlideAggregate reference documents it as a GlideRecord extension that executes database aggregation queries.](https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideAggregateScopedAPI.html) — manual, 2026-08-24; `rule-evidence-36d2276b`.
- [The Australia ACL guidance documents current as the record available to a custom ACL script.](https://www.servicenow.com/docs/r/platform-security/access-control/t_CreateAnACLRule.html) — manual, 2026-08-24; `rule-evidence-a6a6d86f`.
- [Path-sensitive fixtures cover query executors, current, aliases, joins, reassignment, shadowing, direct and async helper calls, escape, deferred code, scope-specific APIs, and platform-method mutation.](../tests/rules/no-gliderecord-query-in-acl.test.ts) — fixture, 2026-08-24; `rule-evidence-7c851911`.
- [Real Oxlint and ESLint ACL profiles report a proven query while recommended remains unchanged.](../tests/integration/profiles/invalid/acl-query.acl.js) — integration-test, 2026-08-24; `rule-evidence-c64a1231`.
- [Constructor namespace, prototype, instance-method, and dynamic-scope mutations are covered by shared platform-authority fixtures.](../tests/rules/platform-method-authority.test.ts) — fixture, 2026-08-24; `rule-evidence-73185b82`.
- [The Australia-scoped GlideRecord API was reviewed for the methods and lifecycle facts used by this rule.](https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html) — manual, 2026-08-22; `rule-evidence-cb5299b6`.
- [The Australia-global GlideRecord API was reviewed for the methods and lifecycle facts used by this rule.](https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordAPI.html) — manual, 2026-08-22; `rule-evidence-bfdb4bf5`.
- [The Australia-global GlideAggregate API was reviewed for the methods and lifecycle facts used by this rule.](https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideAggregateAPI.html) — manual, 2026-08-22; `rule-evidence-ca184ced`.

[Catalog source](../src/catalog/no-gliderecord-query-in-acl.ts).

## no-gliderecord-query-in-loop

A query inside a proven record cursor loop is an N+1 pattern. Direct IIFEs and stable one-call-site local helpers inherit cursor depth. GlideRecord uses release-keyed executors and `.next()` / `._next()`; GlideAggregate uses its directly documented `query()` / `.next()` lifecycle. Unrelated iterators stay silent.

**Placements:** strict (warn). **Last verified:** 2026-08-24

### Applicability

classic; surfaces: Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Action applicability also depends on explicit client/server surfaces and the rule's execution-context gate. Unknown surfaces stay silent.; confidence: inferred; modes: n/a; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.


#### Incorrect: nested get

```js
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  var caller = new GlideRecord("sys_user");
  caller.get(incident.getValue("caller_id"));
  gs.info(caller.getDisplayValue());
}
```

#### Incorrect: query in a stable helper

```js
function loadCaller(id) {
  var caller = new GlideRecord("sys_user");
  caller.get(id);
}
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) loadCaller(incident.getValue("caller_id"));
```

#### Correct: display value

```js
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  gs.info(incident.getDisplayValue("caller_id"));
}
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. false-negative: Mutable helpers and helpers with multiple direct call sites stay silent because shared provenance is not call-context-sensitive. false-negative: Indirect `.call()`, `.apply()`, `.bind()`, constructor, and deferred callback invocations do not inherit cursor depth. false-negative: A possible platform constructor namespace reassignment, prototype or relevant instance-method mutation, or dynamic-scope uncertainty suppresses matching diagnostics throughout the file. lifecycle: A proven GlideRecord next() / _next() or GlideAggregate next() receiver establishes cursor depth. Direct IIFEs and direct calls to an unmodified local function with one statically visible call site inherit that depth. GlideRecord executors must be definite for the configured scope. GlideAggregate analysis follows its directly documented query() / next() lifecycle; inherited or undocumented executors and cursor aliases stay silent.

- False negative: Mutable helpers and helpers with multiple direct call sites stay silent because shared provenance is not call-context-sensitive.
- False negative: Indirect `.call()`, `.apply()`, `.bind()`, constructor, and deferred callback invocations do not inherit cursor depth.
- False negative: A possible platform constructor namespace reassignment, prototype or relevant instance-method mutation, or dynamic-scope uncertainty suppresses matching diagnostics throughout the file.

Lifecycle: A proven GlideRecord next() / _next() or GlideAggregate next() receiver establishes cursor depth. Direct IIFEs and direct calls to an unmodified local function with one statically visible call site inherit that depth. GlideRecord executors must be definite for the configured scope. GlideAggregate analysis follows its directly documented query() / next() lifecycle; inherited or undocumented executors and cursor aliases stay silent.


Overlaps: `servicenow/require-query-before-next`.

### Evidence

- [A documented GlideRecord query executor inside a next() or _next() loop is an N+1 pattern.](https://www.servicenow.com/docs/r/zurich/api-reference/server-api-reference/c_GlideRecordScopedAPI.html) — manual, 2026-08-22; `rule-evidence-7780d508`.
- [GlideAggregate documents query() and next() for aggregate cursor iteration.](https://www.servicenow.com/docs/r/zurich/api-reference/server-api-reference/c_GlideAggregateScopedAPI.html) — manual, 2026-08-22; `rule-evidence-14a281ed`.
- [Strict hosts report a nested query inside a proven cursor loop.](../tests/integration/profiles/invalid/nested-cursor-query.br.js) — integration-test, 2026-08-20; `rule-evidence-7856011f`.
- [Custom iterators with next() do not establish cursor depth.](../tests/integration/profiles/valid/custom-iterator-loop.br.js) — integration-test, 2026-08-20; `rule-evidence-8f290b53`.
- [Stable one-call-site local helpers inherit cursor depth; mutable, multiply called, generator, shadowed, and indirect helpers stay silent.](../tests/rules/phase3.test.ts) — fixture, 2026-08-22; `rule-evidence-81ea46a1`.
- [Constructor namespace, prototype, instance-method, and dynamic-scope mutations are covered by shared platform-authority fixtures.](../tests/rules/platform-method-authority.test.ts) — fixture, 2026-08-24; `rule-evidence-e0b6a0ca`.
- [The Australia-scoped GlideRecord API was reviewed for the methods and lifecycle facts used by this rule.](https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html) — manual, 2026-08-22; `rule-evidence-0aa93fce`.
- [The Australia-global GlideRecord API was reviewed for the methods and lifecycle facts used by this rule.](https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordAPI.html) — manual, 2026-08-22; `rule-evidence-2bc8eb5d`.
- [The Australia-scoped GlideAggregate API was reviewed for the methods and lifecycle facts used by this rule.](https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideAggregateScopedAPI.html) — manual, 2026-08-22; `rule-evidence-6b04aafc`.
- [The Australia-global GlideAggregate API was reviewed for the methods and lifecycle facts used by this rule.](https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideAggregateAPI.html) — manual, 2026-08-22; `rule-evidence-b2643a55`.

[Catalog source](../src/catalog/no-gliderecord-query-in-loop.ts).

## prefer-setnocount-with-choosewindow

The reviewed Zurich and Australia-scoped GlideRecord references document that `query()` after `chooseWindow()` runs `COUNT(*)` unless `setNoCount()` or `setLimit()` skips it. The rule is silent when `getRowCount()` is used, when `chooseWindow` forces a count, or when the binding escapes.

**Placements:** strict (warn). **Last verified:** 2026-08-24

### Applicability

classic; surfaces: Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Action applicability also depends on explicit client/server surfaces and the rule's execution-context gate. Unknown surfaces stay silent.; confidence: inferred; modes: n/a; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.


#### Incorrect: window without setNoCount

```js
var rec = new GlideRecord("incident");
rec.chooseWindow(0, 20);
rec.query();
while (rec.next()) {
  gs.info(rec.getValue("number"));
}
```

#### Correct: setNoCount

```js
var rec = new GlideRecord("incident");
rec.chooseWindow(0, 20);
rec.setNoCount();
rec.query();
while (rec.next()) {
  gs.info(rec.getValue("number"));
}
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. false-negative: A possible platform constructor namespace reassignment, prototype or relevant instance-method mutation, or dynamic-scope uncertainty suppresses matching diagnostics throughout the file. lifecycle: Window and setNoCount state are scoped to one query epoch and one object identity.

- False negative: A possible platform constructor namespace reassignment, prototype or relevant instance-method mutation, or dynamic-scope uncertainty suppresses matching diagnostics throughout the file.

Lifecycle: Window and setNoCount state are scoped to one query epoch and one object identity.


Overlaps: `servicenow/require-query-before-next`.

### Evidence

- [query() after chooseWindow() runs COUNT(*) unless setNoCount() or setLimit() skips it.](https://www.servicenow.com/docs/r/zurich/api-reference/server-api-reference/c_GlideRecordScopedAPI.html) — manual, 2026-08-20; `rule-evidence-f19d5c40`.
- [Australia retains the documented chooseWindow query count and setNoCount/setLimit behavior.](https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html) — manual, 2026-08-22; `rule-evidence-7101c6aa`.
- [A later query epoch is not justified by an earlier getRowCount().](../tests/integration/profiles/invalid/setnocount-second-query.br.js) — integration-test, 2026-08-20; `rule-evidence-2764954f`.
- [Constructor namespace, prototype, instance-method, and dynamic-scope mutations are covered by shared platform-authority fixtures.](../tests/rules/platform-method-authority.test.ts) — fixture, 2026-08-24; `rule-evidence-42cf68fe`.
- [The Australia-global GlideRecord API was reviewed for the methods and lifecycle facts used by this rule.](https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordAPI.html) — manual, 2026-08-22; `rule-evidence-ea766c39`.

[Catalog source](../src/catalog/prefer-setnocount-with-choosewindow.ts).

## no-system-query-bypass

Opt-in security review for documented ACL-bypass query APIs. Unknown computed GlideRecord access also reports for review.

**Placements:** security (warn). **Last verified:** 2026-08-24

### Applicability

classic; surfaces: Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Action applicability also depends on explicit client/server surfaces and the rule's execution-context gate. Unknown surfaces stay silent.; confidence: inferred; modes: n/a; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.


#### Incorrect: addSystemQuery

```js
var user = new GlideRecord("sys_user");
user.addSystemQuery("active", true);
user.query();
```

#### Correct: addQuery

```js
var user = new GlideRecord("sys_user");
user.addQuery("active", true);
user.query();
```

### Boundaries

Unproven, invalid, or ambiguous GlideRecord bindings stay silent. Proven escaped GlideRecord identities remain reviewable because this opt-in security rule favors surfacing potential ACL bypasses.

- None recorded.


### Evidence

- [addSystemQuery and related methods bypass query ACLs and need review.](https://www.servicenow.com/docs/r/zurich/api-reference/server-api-reference/c_GlideRecordScopedAPI.html) — manual, 2026-08-20; `rule-evidence-9eac51a9`.
- [The security profile reports documented ACL-bypass methods.](../tests/integration/profiles/invalid/system-query.br.js) — integration-test, 2026-08-20; `rule-evidence-0640c6fe`.
- [Oxlint and ESLint report folded, dynamic, extracted, and escaped GlideRecord bypass access.](../tests/integration/context-contracts.test.ts) — integration-test, 2026-08-21; `rule-evidence-3826e118`.
- [Constructor namespace, prototype, instance-method, and dynamic-scope mutations are covered by shared platform-authority fixtures.](../tests/rules/platform-method-authority.test.ts) — fixture, 2026-08-24; `rule-evidence-4b609d4f`.
- [The Australia-scoped GlideRecord API was reviewed for the methods and lifecycle facts used by this rule.](https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html) — manual, 2026-08-22; `rule-evidence-f5af72f5`.
- [The Australia-global GlideRecord API was reviewed for the methods and lifecycle facts used by this rule.](https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordAPI.html) — manual, 2026-08-22; `rule-evidence-a899b39e`.

[Catalog source](../src/catalog/no-system-query-bypass.ts).

## no-sync-glideajax

`getXMLWait()` blocks the browser and does not work in Service Portal. Use `getXML()` / `getXMLAnswer()`.

**Placements:** recommended (error), client (error). **Last verified:** 2026-08-24

### Applicability

classic; surfaces: Applies to client, ui-action when those surfaces are known. UI Action applicability also depends on explicit client/server surfaces and the rule's execution-context gate. Unknown surfaces stay silent.; confidence: inferred; modes: n/a; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.


#### Incorrect: getXMLWait

```js
var ga = new GlideAjax("x_acme.UserUtils");
ga.addParam("sysparm_name", "getUser");
var xml = ga.getXMLWait();
var answer = xml.documentElement.getAttribute("answer");
```

#### Correct: getXMLAnswer

```js
var ga = new GlideAjax("x_acme.UserUtils");
ga.addParam("sysparm_name", "getUser");
ga.getXMLAnswer(function (answer) {
  g_form.setValue("caller_id", answer);
});
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. false-negative: A possible GlideAjax constructor, prototype, or getXMLWait mutation suppresses matching calls throughout the file.

- False negative: A possible GlideAjax constructor, prototype, or getXMLWait mutation suppresses matching calls throughout the file.


Overlaps: `servicenow/no-glideajax-getanswer`.

### Evidence

- [getXMLWait is a synchronous browser request.](https://www.servicenow.com/docs/r/api-reference/c_GlideAjaxAPI.html) — manual, 2026-08-20; `rule-evidence-c6177bcc`.
- [Catalog examples cover getXMLWait versus getXMLAnswer.](../src/catalog/no-sync-glideajax.ts) — fixture, 2026-08-20; `rule-evidence-004c489e`.
- [Constructor, prototype, instance-method, and dynamic-scope mutations remain silent.](../tests/rules/glide-and-engine.test.ts) — fixture, 2026-08-24; `rule-evidence-28d7c249`.

[Catalog source](../src/catalog/no-sync-glideajax.ts).

## no-async-iterators

`for await…of` and async generators are disallowed in every instance JavaScript mode, including ES2021.

**Placements:** recommended (error), classic-es5 (error), es2021 (error). **Last verified:** 2026-08-22

### Applicability

classic; surfaces: Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Action applicability also depends on explicit client/server surfaces and the rule's execution-context gate. An explicit javascriptMode also enables documented engine checks in otherwise unclassified files.; confidence: inferred; modes: compatibility, es5, es2021, unknown; scopes: global, scoped, unknown; releases: zurich, australia; SDK: n/a.


#### Incorrect: for await

```js
async function drain(items) {
  for await (var item of items) {
    gs.info(item);
  }
}
```

#### Correct: for of

```js
function drain(items) {
  for (var i = 0; i < items.length; i++) {
    gs.info(items[i]);
  }
}
```

### Boundaries

Unknown, escaped, or ambiguous bindings stay silent instead of guessing.

- None recorded.


Overlaps: `servicenow/no-async-await`.

### Evidence

- [for await...of and async generators are disallowed in every instance JavaScript mode.](https://www.servicenow.com/docs/r/zurich/api-reference/scripts/javascript-engine-feature-support.html) — manual, 2026-08-20; `rule-evidence-dd02dd4f`.
- [Oxlint with es2021 still flags async iteration.](../tests/integration/profiles/invalid/es2021-async-iter.server.js) — integration-test, 2026-08-20; `rule-evidence-3c42e622`.
- [The Australia JavaScript engine feature table was reviewed for this rule's modeled capability cells.](https://www.servicenow.com/docs/r/api-reference/scripts/javascript-engine-feature-support.html) — manual, 2026-08-22; `rule-evidence-d3a51c15`.

[Catalog source](../src/catalog/no-async-iterators.ts).
