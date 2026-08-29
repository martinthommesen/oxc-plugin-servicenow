# servicenow/no-proxy

`Proxy` is unsupported in Compatibility and ES5 Standards mode. Direct calls plus stable same-execution constructor and `revocable` owner aliases report; bare aliases must be captured under an owner guard, while fully guarded or visibly polyfilled calls stay silent.

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
- **Implementation:** [`src/rules/no-proxy.ts`](../../src/rules/no-proxy.ts)

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

### Incorrect: new Proxy

```js
var p = new Proxy(target, handler);
```

## Correct

### Correct: plain object

```js
var p = { prop: value };
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: A possible callable replacement for Proxy or Proxy.revocable suppresses matching diagnostics throughout the file, regardless of source order. scope-boundary: A constructor call protected by a structurally dominating owner guard stays silent; revocable calls require both the Proxy owner and method to be guarded. false-negative: A Proxy alias used from another function body stays silent because source order cannot prove that its initializer ran before the function was called. false-negative: Direct aliases of Proxy.revocable stay silent; the shared resolver proves stable aliases of the Proxy owner instead.

## Known false positives

- None recorded.

## Known false negatives

- A Proxy alias used from another function body stays silent because source order cannot prove that its initializer ran before the function was called.
- Direct aliases of Proxy.revocable stay silent; the shared resolver proves stable aliases of the Proxy owner instead.

## Intentional scope boundaries

- A possible callable replacement for Proxy or Proxy.revocable suppresses matching diagnostics throughout the file, regardless of source order.
- A constructor call protected by a structurally dominating owner guard stays silent; revocable calls require both the Proxy owner and method to be guarded.

## Overlaps

- `servicenow/no-unsupported-syntax`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **Proxy is unsupported in Compatibility and ES5 Standards modes.**
  - Verification ID: `rule-evidence-b5644e0d`
  - URL: https://www.servicenow.com/docs/r/zurich/api-reference/scripts/javascript-engine-feature-support.html
  - Verified by: manual
  - Verified at: 2026-08-20
- **Fixtures cover stable Proxy constructor and revocable-owner aliases, guarded alias capture, owner-and-method availability checks, modeled built-in invalidation, visible polyfills, mutation, and dynamic scope.**
  - Verification ID: `rule-evidence-00127b01`
  - URL: tests/rules/no-proxy.test.ts
  - Verified by: fixture
  - Verified at: 2026-08-24
- **Real Oxlint and ESLint classic-es5 profiles report a stable Proxy alias and accept an explicit callable polyfill.**
  - Verification ID: `rule-evidence-952b4455`
  - URL: tests/integration/profiles.test.ts
  - Verified by: integration-test
  - Verified at: 2026-08-24
- **The Australia JavaScript engine feature table was reviewed for this rule's modeled capability cells.**
  - Verification ID: `rule-evidence-cb39620b`
  - URL: https://www.servicenow.com/docs/r/api-reference/scripts/javascript-engine-feature-support.html
  - Verified by: manual
  - Verified at: 2026-08-22

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
