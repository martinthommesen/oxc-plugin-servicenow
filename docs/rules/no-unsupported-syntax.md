# servicenow/no-unsupported-syntax

The ES5 table marks optional chaining, nullish coalescing, logical assignment, private members, and RegExp lookbehind Not Supported. Constructor-string lookbehind detection follows direct and stable same-execution built-in RegExp identity. Private instance members remain Not Supported in ES2021; Compatibility follows ES5 by package policy.

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
- **Implementation:** [`src/rules/no-unsupported-syntax.ts`](../../src/rules/no-unsupported-syntax.ts)

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

### Incorrect: optional chaining and ??

```js
var name = current.caller_id?.name ?? "unknown";
```

### Incorrect: private instance member in Australia ES2021

```js
class State { #value = 1; }
```

### Incorrect: RegExp alias with lookbehind

```js
const Regex = RegExp;
var matcher = Regex("(?<=a)b");
```

## Correct

### Correct: explicit check

```js
var name = current.caller_id ? current.caller_id.name : "unknown";
```

### Correct: private static member in Australia ES2021

```js
class State { static #value = 1; }
```

### Correct: explicit RegExp replacement

```js
RegExp = LocalRegExp;
var matcher = RegExp("(?<=a)b");
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: Any visible RegExp replacement suppresses constructor-string diagnostics throughout the file because the replacement may implement different pattern syntax. RegExp literal diagnostics remain active. false-negative: A RegExp alias used from another function body stays silent because source order cannot prove that its initializer ran before the function was called.

## Known false positives

- None recorded.

## Known false negatives

- A RegExp alias used from another function body stays silent because source order cannot prove that its initializer ran before the function was called.

## Intentional scope boundaries

- Any visible RegExp replacement suppresses constructor-string diagnostics throughout the file because the replacement may implement different pattern syntax. RegExp literal diagnostics remain active.

## Overlaps

- `servicenow/no-async-await`
- `servicenow/no-bigint`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **Several ES2015+ syntactic forms are unsupported in Compatibility and ES5 Standards modes.**
  - Verification ID: `rule-evidence-8c372832`
  - URL: https://www.servicenow.com/docs/r/zurich/api-reference/scripts/javascript-engine-feature-support.html
  - Verified by: manual
  - Verified at: 2026-08-20
- **The Australia table marks private instance fields, methods, and accessors Not Supported in ES2021.**
  - Verification ID: `rule-evidence-da85fc02`
  - URL: https://www.servicenow.com/docs/r/api-reference/scripts/javascript-engine-feature-support.html
  - Verified by: manual
  - Verified at: 2026-08-22
- **ServiceNow documents Compatibility as a third mode; the plugin explicitly applies ES5 feature cells to it as package policy.**
  - Verification ID: `rule-evidence-1d7367a9`
  - URL: https://www.servicenow.com/docs/r/api-reference/scripts/c_JS_modes.html
  - Verified by: manual
  - Verified at: 2026-08-22
- **classic-es5 Oxlint flags unsupported syntax on the ES2021 fixture.**
  - Verification ID: `rule-evidence-dbced4b7`
  - URL: tests/integration/profiles/invalid/es5-promise.server.js
  - Verified by: integration-test
  - Verified at: 2026-08-20
- **Fixtures cover direct, namespace-qualified, and stable same-execution RegExp aliases plus shadows, mutation, dynamic scope, and constructor-versus-literal authority boundaries.**
  - Verification ID: `rule-evidence-1aa625d5`
  - URL: tests/rules/no-unsupported-syntax.test.ts
  - Verified by: fixture
  - Verified at: 2026-08-24
- **Real Oxlint and ESLint classic-ES5 profiles resolve stable RegExp aliases and accept explicit constructor replacements.**
  - Verification ID: `rule-evidence-2677dcd9`
  - URL: tests/integration/profiles.test.ts
  - Verified by: integration-test
  - Verified at: 2026-08-24

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
