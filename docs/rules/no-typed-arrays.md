# servicenow/no-typed-arrays

General TypedArray constructors and DataView construction are Disallowed by the ES5 cell, while BigInt64Array and BigUint64Array are Not Supported there. Zurich ES2021 supports general constructors but not static TypedArray.from/of factories; Australia adds those factories and Supports BigInt arrays. DataView BigInt getters remain Not Supported. Compatibility follows ES5 by package policy.

- **Family:** engine
- **Preset:** classic-es5
- **Placements:** classic-es5 (error), es2021 (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Actions require an explicit server surface; mixed client/server UI Actions stay silent because execution regions are not classified. An explicit javascriptMode also enables documented engine checks in otherwise unclassified files.
- **JavaScript mode:** Runs when javascriptMode is compatibility, es5, es2021, unknown. Universal restrictions can run with unknown mode when the file is a known instance script.
- **Last verified:** 2026-08-24
- **Implementation:** [`src/rules/no-typed-arrays.ts`](../../src/rules/no-typed-arrays.ts)

## Applicability

| Dimension | Value |
| --- | --- |
| Authoring | classic |
| Surfaces | Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Actions require an explicit server surface; mixed client/server UI Actions stay silent because execution regions are not classified. An explicit javascriptMode also enables documented engine checks in otherwise unclassified files. |
| Minimum surface confidence | filename-inferred |
| JavaScript modes | compatibility, es5, es2021, unknown |
| Application scopes | global, scoped, unknown |
| ServiceNow releases | zurich, australia |
| Fluent SDK range | n/a |

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| _(none)_ | | | This rule has no options. |

## Incorrect

### Incorrect: Int8Array

```js
var bytes = new Int8Array(16);
```

### Incorrect: DataView BigInt getter

```js
var view = new DataView(buffer);
var value = view.getBigInt64(0);
```

### Incorrect: Int8Array static factory in Zurich

```js
var values = Int8Array.from(source);
```

### Incorrect: BigInt64Array static factory in Zurich

```js
var values = BigInt64Array.from(source);
```

## Correct

### Correct: plain array

```js
var bytes = [0, 1, 2];
```

### Correct: Int8Array static factory in Australia

```js
var values = Int8Array.from(source);
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: DataView BigInt setters stay silent because the reviewed ServiceNow tables establish only the getter methods. scope-boundary: Any possible direct constructor, prototype, or instance-method write in the file conservatively suppresses affected diagnostics, regardless of source order. scope-boundary: Passing a typed-array constructor or DataView.prototype to unknown code suppresses affected method diagnostics because that code can install replacements. false-negative: Calls through a reassigned property-mutation helper are treated as unknown; the rule does not assume the custom helper failed to install a DataView method.

## Known false positives

- None recorded.

## Known false negatives

- Calls through a reassigned property-mutation helper are treated as unknown; the rule does not assume the custom helper failed to install a DataView method.

## Intentional scope boundaries

- DataView BigInt setters stay silent because the reviewed ServiceNow tables establish only the getter methods.
- Any possible direct constructor, prototype, or instance-method write in the file conservatively suppresses affected diagnostics, regardless of source order.
- Passing a typed-array constructor or DataView.prototype to unknown code suppresses affected method diagnostics because that code can install replacements.

## Overlaps

- `servicenow/no-unsupported-syntax`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **The Zurich table marks general typed-array/DataView constructors Disallowed in ES5 Standards, while BigInt64 arrays and DataView BigInt getters are Not Supported.**
  - Verification ID: `rule-evidence-e13253e3`
  - URL: https://www.servicenow.com/docs/r/zurich/api-reference/scripts/javascript-engine-feature-support.html
  - Verified by: manual
  - Verified at: 2026-08-22
- **The Australia table marks BigInt64 array constructors Supported in ES2021 and Not Supported in ES5; DataView BigInt getters remain Not Supported.**
  - Verification ID: `rule-evidence-7da2cbb4`
  - URL: https://www.servicenow.com/docs/r/api-reference/scripts/javascript-engine-feature-support.html
  - Verified by: manual
  - Verified at: 2026-08-22
- **The Australia engine update lists Rhino PR 1966 as adding TypedArray.from and TypedArray.of in ES2021 mode.**
  - Verification ID: `rule-evidence-3d19a43b`
  - URL: https://www.servicenow.com/docs/r/api-reference/scripts/updates-javascript-engine.html
  - Verified by: manual
  - Verified at: 2026-08-24
- **ServiceNow documents Compatibility as a third mode; the plugin explicitly applies ES5 feature cells to it as package policy.**
  - Verification ID: `rule-evidence-0d677df1`
  - URL: https://www.servicenow.com/docs/r/api-reference/scripts/c_JS_modes.html
  - Verified by: manual
  - Verified at: 2026-08-22
- **Fixtures cover constructor-independent Zurich factory diagnostics, method guards, release omission, constructors, aliases, DataView BigInt getters, mutation, and namespace escape.**
  - Verification ID: `rule-evidence-7b500c7f`
  - URL: tests/rules/glide-and-engine.test.ts
  - Verified by: fixture
  - Verified at: 2026-08-24
- **Real Oxlint and ESLint contracts verify general TypedArray factories in Zurich, Australia, and omitted-release ES2021 configurations.**
  - Verification ID: `rule-evidence-b6da498a`
  - URL: tests/integration/release-contracts.test.ts
  - Verified by: integration-test
  - Verified at: 2026-08-24

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
