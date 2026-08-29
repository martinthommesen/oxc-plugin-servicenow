# servicenow/no-promise

Compatibility and ES5 Standards modes do not implement Promises. Direct calls plus stable same-execution constructor and static-method owner aliases report; bare aliases must be captured under an owner guard, while fully guarded, visibly polyfilled, unknown-mode, and local `Promise` uses stay silent.

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
- **Implementation:** [`src/rules/no-promise.ts`](../../src/rules/no-promise.ts)

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

### Incorrect: constructor

```js
var p = new Promise(function (resolve) { resolve(1); });
```

## Correct

### Correct: synchronous Glide

```js
var gr = new GlideRecord("incident");
if (gr.get(sysId)) {
  gs.info(gr.number);
}
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: Local bindings named Promise are not platform Promises. scope-boundary: A possible callable replacement for Promise or a used static method suppresses matching diagnostics throughout the file, regardless of source order. scope-boundary: A constructor call protected by a structurally dominating owner guard stays silent; static calls require both the Promise owner and selected method to be guarded. false-negative: A Promise alias used from another function body stays silent because source order cannot prove that its initializer ran before the function was called. false-negative: Direct aliases of individual Promise static methods stay silent; the shared resolver proves stable aliases of the Promise owner instead.

## Known false positives

- None recorded.

## Known false negatives

- A Promise alias used from another function body stays silent because source order cannot prove that its initializer ran before the function was called.
- Direct aliases of individual Promise static methods stay silent; the shared resolver proves stable aliases of the Promise owner instead.

## Intentional scope boundaries

- Local bindings named Promise are not platform Promises.
- A possible callable replacement for Promise or a used static method suppresses matching diagnostics throughout the file, regardless of source order.
- A constructor call protected by a structurally dominating owner guard stays silent; static calls require both the Promise owner and selected method to be guarded.

## Overlaps

- `servicenow/no-async-await`
- `eslint no-restricted-globals`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **Promises are unsupported in Compatibility and ES5 Standards modes.**
  - Verification ID: `rule-evidence-d22e5ebe`
  - URL: https://www.servicenow.com/docs/r/zurich/api-reference/scripts/javascript-engine-feature-support.html
  - Verified by: manual
  - Verified at: 2026-08-20
- **Fixtures cover stable Promise constructor and static-method owner aliases, guarded alias capture, owner-and-method availability checks, modeled built-in invalidation, visible polyfills, mutation, and dynamic scope.**
  - Verification ID: `rule-evidence-45fae05c`
  - URL: tests/rules/no-promise.test.ts
  - Verified by: fixture
  - Verified at: 2026-08-24
- **Real Oxlint and ESLint classic-es5 profiles report a stable Promise alias and accept an explicit callable polyfill.**
  - Verification ID: `rule-evidence-ae60ea43`
  - URL: tests/integration/profiles.test.ts
  - Verified by: integration-test
  - Verified at: 2026-08-24
- **The Australia JavaScript engine feature table was reviewed for this rule's modeled capability cells.**
  - Verification ID: `rule-evidence-14208b4e`
  - URL: https://www.servicenow.com/docs/r/api-reference/scripts/javascript-engine-feature-support.html
  - Verified by: manual
  - Verified at: 2026-08-22

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
