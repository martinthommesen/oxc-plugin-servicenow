# servicenow/no-weak-collections

WeakMap and WeakSet are disallowed in Compatibility and ES5 Standards mode. ES2021 supports them.

- **Family:** engine
- **Preset:** classic-es5
- **Placements:** classic-es5 (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to client, server, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. Unknown surfaces stay silent.
- **JavaScript mode:** Runs when javascriptMode is compatibility, es5. Unknown mode stays silent.
- **Last verified:** 2026-08-20
- **Implementation:** [`src/rules/no-weak-collections.ts`](../../src/rules/no-weak-collections.ts)

## Applicability

| Dimension | Value |
| --- | --- |
| Authoring | classic |
| Surfaces | Applies to client, server, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. Unknown surfaces stay silent. |
| Minimum surface confidence | filename-inferred |
| JavaScript modes | compatibility, es5 |
| Application scopes | global, scoped, unknown |
| ServiceNow releases | xanadu, yokohama, zurich |
| Fluent SDK range | n/a |

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| _(none)_ | | | This rule has no options. |

## Incorrect

### Incorrect: WeakMap

```js
var cache = new WeakMap();
```

## Correct

### Correct: Map

```js
var cache = new Map();
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. False positive: Local bindings that reuse those names. False negative: Dynamic construction through unknown identifiers.

## Known false positives

- Local bindings that reuse those names.

## Known false negatives

- Dynamic construction through unknown identifiers.

## Overlaps

- `servicenow/no-weak-references`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **WeakMap and WeakSet are unsupported in Compatibility and ES5 Standards modes.**
  - URL: https://www.servicenow.com/docs/r/zurich/api-reference/scripts/javascript-engine-feature-support.html
  - Verified by: declaration-snapshot
  - Verified at: 2026-08-20
- **Catalog examples cover WeakMap construction in ES5 mode.**
  - URL: src/catalog.ts
  - Verified by: fixture
  - Verified at: 2026-08-20

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
