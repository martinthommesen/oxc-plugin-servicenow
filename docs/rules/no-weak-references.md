# servicenow/no-weak-references

WeakRef and FinalizationRegistry are disallowed in every instance JavaScript mode, including ES2021. Direct calls and stable same-execution aliases report; a bare alias must be captured inside its availability guard, while visibly polyfilled calls stay silent.

- **Family:** engine
- **Preset:** recommended
- **Placements:** recommended (error), classic-es5 (error), es2021 (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Actions require an explicit server surface; mixed client/server UI Actions stay silent because execution regions are not classified. An explicit javascriptMode also enables documented engine checks in otherwise unclassified files.
- **JavaScript mode:** Runs when javascriptMode is compatibility, es5, es2021, unknown. Universal restrictions can run with unknown mode when the file is a known instance script.
- **Last verified:** 2026-08-24
- **Implementation:** [`src/rules/no-weak-references.ts`](../../src/rules/no-weak-references.ts)

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

### Incorrect: WeakRef

```js
var ref = new WeakRef(obj);
```

## Correct

### Correct: Map

```js
var cache = new Map();
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: A possible callable replacement for WeakRef or FinalizationRegistry suppresses matching diagnostics throughout the file, regardless of source order. scope-boundary: A call protected by a structurally dominating availability guard stays silent for code shared with other runtimes. false-negative: A constructor alias used from another function body stays silent because source order cannot prove that its initializer ran before the function was called.

## Known false positives

- None recorded.

## Known false negatives

- A constructor alias used from another function body stays silent because source order cannot prove that its initializer ran before the function was called.

## Intentional scope boundaries

- A possible callable replacement for WeakRef or FinalizationRegistry suppresses matching diagnostics throughout the file, regardless of source order.
- A call protected by a structurally dominating availability guard stays silent for code shared with other runtimes.

## Overlaps

- `servicenow/no-weak-collections`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **WeakRef and FinalizationRegistry are unsupported in instance JavaScript modes.**
  - Verification ID: `rule-evidence-23eb8b49`
  - URL: https://www.servicenow.com/docs/r/zurich/api-reference/scripts/javascript-engine-feature-support.html
  - Verified by: manual
  - Verified at: 2026-08-20
- **Fixtures cover stable aliases, guarded alias capture, built-in guard invalidation, callable polyfills, non-callable replacements, lexical shadows, and dynamic scope.**
  - Verification ID: `rule-evidence-46d6a600`
  - URL: tests/rules/unsupported-constructors.test.ts
  - Verified by: fixture
  - Verified at: 2026-08-24
- **The Australia JavaScript engine feature table was reviewed for this rule's modeled capability cells.**
  - Verification ID: `rule-evidence-3c070a1e`
  - URL: https://www.servicenow.com/docs/r/api-reference/scripts/javascript-engine-feature-support.html
  - Verified by: manual
  - Verified at: 2026-08-22

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
