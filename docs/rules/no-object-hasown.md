# servicenow/no-object-hasown

`Object.hasOwn()` is Not Supported in Zurich ES2021 and Australia ES5; Australia ES2021 Supports it. Compatibility follows the ES5 cell by package policy.

- **Family:** engine
- **Preset:** classic-es5
- **Placements:** classic-es5 (error), es2021 (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Actions require an explicit server surface; mixed client/server UI Actions stay silent because execution regions are not classified. An explicit javascriptMode also enables documented engine checks in otherwise unclassified files.
- **JavaScript mode:** Runs when javascriptMode is compatibility, es5, es2021, unknown. Universal restrictions can run with unknown mode when the file is a known instance script.
- **Last verified:** 2026-08-22
- **Implementation:** [`src/rules/no-object-hasown.ts`](../../src/rules/no-object-hasown.ts)

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

### Incorrect: Object.hasOwn in Zurich ES2021

```js
var ownsNumber = Object.hasOwn(record, "number");
```

## Correct

### Correct: portable hasOwnProperty call

```js
var ownsNumber = Object.prototype.hasOwnProperty.call(record, "number");
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: Dynamic property names stay silent because they do not prove a hasOwn call. scope-boundary: Any possible direct write to Object or Object.hasOwn in the file conservatively suppresses diagnostics for that file, regardless of source order. scope-boundary: Passing Object to an unknown call or constructor suppresses diagnostics because that code can install replacement methods on the namespace object. scope-boundary: Calls protected by a proven Object.hasOwn availability guard or optional call stay silent for release-portable code. false-negative: Calls through a reassigned Object mutation helper are treated as unknown; the rule does not try to prove that a custom helper installed the feature.

## Known false positives

- None recorded.

## Known false negatives

- Calls through a reassigned Object mutation helper are treated as unknown; the rule does not try to prove that a custom helper installed the feature.

## Intentional scope boundaries

- Dynamic property names stay silent because they do not prove a hasOwn call.
- Any possible direct write to Object or Object.hasOwn in the file conservatively suppresses diagnostics for that file, regardless of source order.
- Passing Object to an unknown call or constructor suppresses diagnostics because that code can install replacement methods on the namespace object.
- Calls protected by a proven Object.hasOwn availability guard or optional call stay silent for release-portable code.

## Overlaps

- None recorded.

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **The Zurich table marks Object.hasOwn Not Supported in ES2021 and ES5 Standards.**
  - Verification ID: `rule-evidence-137f2a8f`
  - URL: https://www.servicenow.com/docs/r/zurich/api-reference/scripts/javascript-engine-feature-support.html
  - Verified by: manual
  - Verified at: 2026-08-22
- **The Australia table marks Object.hasOwn Supported in ES2021 and Not Supported in ES5 Standards.**
  - Verification ID: `rule-evidence-1e3d2b83`
  - URL: https://www.servicenow.com/docs/r/api-reference/scripts/javascript-engine-feature-support.html
  - Verified by: manual
  - Verified at: 2026-08-22
- **ServiceNow documents Compatibility as a third mode; the plugin explicitly applies ES5 feature cells to it as package policy.**
  - Verification ID: `rule-evidence-ac761b0e`
  - URL: https://www.servicenow.com/docs/r/api-reference/scripts/c_JS_modes.html
  - Verified by: manual
  - Verified at: 2026-08-22
- **Fixtures cover release deltas, immutable aliases, reassignment, computed access, shadowing, mutation, and namespace escape.**
  - Verification ID: `rule-evidence-95bc0eeb`
  - URL: tests/rules/glide-and-engine.test.ts
  - Verified by: fixture
  - Verified at: 2026-08-22

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
