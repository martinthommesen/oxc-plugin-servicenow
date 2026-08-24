# servicenow/no-weak-collections

WeakMap and WeakSet are disallowed in Compatibility and ES5 Standards mode. ES2021 supports them. Direct calls and stable same-execution aliases report; guarded or visibly polyfilled calls stay silent.

- **Family:** engine
- **Preset:** classic-es5
- **Placements:** classic-es5 (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Actions require an explicit server surface; mixed client/server UI Actions stay silent because execution regions are not classified. An explicit javascriptMode also enables documented engine checks in otherwise unclassified files.
- **JavaScript mode:** Runs when javascriptMode is compatibility, es5. Unknown mode stays silent.
- **Last verified:** 2026-08-24
- **Implementation:** [`src/rules/no-weak-collections.ts`](../../src/rules/no-weak-collections.ts)

## Applicability

| Dimension | Value |
| --- | --- |
| Authoring | classic |
| Surfaces | Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Actions require an explicit server surface; mixed client/server UI Actions stay silent because execution regions are not classified. An explicit javascriptMode also enables documented engine checks in otherwise unclassified files. |
| Minimum surface confidence | filename-inferred |
| JavaScript modes | compatibility, es5 |
| Application scopes | global, scoped, unknown |
| ServiceNow releases | zurich, australia |
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

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: A possible callable replacement for WeakMap or WeakSet suppresses matching diagnostics throughout the file, regardless of source order. scope-boundary: A call protected by a structurally dominating availability guard stays silent for code shared with other runtimes.

## Known false positives

- None recorded.

## Known false negatives

- None recorded.

## Intentional scope boundaries

- A possible callable replacement for WeakMap or WeakSet suppresses matching diagnostics throughout the file, regardless of source order.
- A call protected by a structurally dominating availability guard stays silent for code shared with other runtimes.

## Overlaps

- `servicenow/no-weak-references`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **WeakMap and WeakSet are unsupported in Compatibility and ES5 Standards modes.**
  - Verification ID: `rule-evidence-387ab368`
  - URL: https://www.servicenow.com/docs/r/zurich/api-reference/scripts/javascript-engine-feature-support.html
  - Verified by: manual
  - Verified at: 2026-08-20
- **Fixtures cover WeakMap aliases, availability guards, and shared constructor-provenance behavior.**
  - Verification ID: `rule-evidence-fe332f1c`
  - URL: tests/rules/unsupported-constructors.test.ts
  - Verified by: fixture
  - Verified at: 2026-08-24
- **The Australia JavaScript engine feature table was reviewed for this rule's modeled capability cells.**
  - Verification ID: `rule-evidence-dcd2c521`
  - URL: https://www.servicenow.com/docs/r/api-reference/scripts/javascript-engine-feature-support.html
  - Verified by: manual
  - Verified at: 2026-08-22

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
