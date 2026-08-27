# servicenow/no-map-set

ServiceNow supports Map and Set in ES2021 but not in Compatibility or ES5 Standards mode in either Zurich or Australia. Direct calls and stable same-execution aliases report, while visibly polyfilled or availability-guarded calls stay silent.

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
- **Implementation:** [`src/rules/no-map-set.ts`](../../src/rules/no-map-set.ts)

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

### Incorrect: Map

```js
var cache = new Map();
```

### Incorrect: Set

```js
var seen = new Set();
```

## Correct

### Correct: object keyed by a stable primitive ID

```js
var seenBySysId = {};
seenBySysId[record.getUniqueValue()] = true;
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: A possible callable replacement for Map or Set suppresses matching diagnostics throughout the file, regardless of source order. scope-boundary: A call protected by a structurally dominating availability guard stays silent for code shared with other runtimes. false-negative: A constructor alias used from another function body stays silent because source order cannot prove that its initializer ran before the function was called.

## Known false positives

- None recorded.

## Known false negatives

- A constructor alias used from another function body stays silent because source order cannot prove that its initializer ran before the function was called.

## Intentional scope boundaries

- A possible callable replacement for Map or Set suppresses matching diagnostics throughout the file, regardless of source order.
- A call protected by a structurally dominating availability guard stays silent for code shared with other runtimes.

## Overlaps

- `servicenow/no-weak-collections`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **The Zurich table marks Map and Set basic functionality Supported in ES2021 and Not Supported in ES5 Standards.**
  - Verification ID: `rule-evidence-324cc720`
  - URL: https://www.servicenow.com/docs/r/zurich/api-reference/scripts/javascript-engine-feature-support.html
  - Verified by: manual
  - Verified at: 2026-08-24
- **The Australia table marks Map and Set basic functionality Supported in ES2021 and Not Supported in ES5 Standards.**
  - Verification ID: `rule-evidence-df01246f`
  - URL: https://www.servicenow.com/docs/r/api-reference/scripts/javascript-engine-feature-support.html
  - Verified by: manual
  - Verified at: 2026-08-24
- **Fixtures cover both constructors, both classic modes and releases, aliases, guards, polyfills, shadowing, dynamic scope, and unsupported contexts.**
  - Verification ID: `rule-evidence-b001f905`
  - URL: tests/rules/no-map-set.test.ts
  - Verified by: fixture
  - Verified at: 2026-08-24
- **Real Oxlint and ESLint contracts verify Map and Set behavior across Zurich, Australia, omitted-release ES5, and ES2021 settings.**
  - Verification ID: `rule-evidence-03388c55`
  - URL: tests/integration/release-contracts.test.ts
  - Verified by: integration-test
  - Verified at: 2026-08-24

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
