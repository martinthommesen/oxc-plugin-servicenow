# servicenow/no-unsupported-syntax

The ES5 table marks optional chaining, nullish coalescing, logical assignment, private members, and RegExp lookbehind Not Supported. Private instance members remain Not Supported in ES2021; Compatibility follows ES5 by package policy.

- **Family:** engine
- **Preset:** classic-es5
- **Placements:** classic-es5 (error), es2021 (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to server, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Actions require an explicit server surface; mixed client/server UI Actions stay silent because execution regions are not classified. An explicit javascriptMode also enables documented engine checks in otherwise unclassified files.
- **JavaScript mode:** Runs when javascriptMode is compatibility, es5, es2021, unknown. Universal restrictions can run with unknown mode when the file is a known instance script.
- **Last verified:** 2026-08-22
- **Implementation:** [`src/rules/no-unsupported-syntax.ts`](../../src/rules/no-unsupported-syntax.ts)

## Applicability

| Dimension | Value |
| --- | --- |
| Authoring | classic |
| Surfaces | Applies to server, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Actions require an explicit server surface; mixed client/server UI Actions stay silent because execution regions are not classified. An explicit javascriptMode also enables documented engine checks in otherwise unclassified files. |
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

## Correct

### Correct: explicit check

```js
var name = current.caller_id ? current.caller_id.name : "unknown";
```

### Correct: private static member in Australia ES2021

```js
class State { static #value = 1; }
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing.

## Known false positives

- None recorded.

## Known false negatives

- None recorded.

## Intentional scope boundaries

- None recorded.

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

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
