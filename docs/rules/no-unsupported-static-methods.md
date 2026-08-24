# servicenow/no-unsupported-static-methods

Error.isError(), Promise.try(), and Promise.withResolvers() are available in Australia ES2021 but not Zurich ES2021. Error.isError() is also unavailable in classic modes; Promise calls there remain owned by no-promise to avoid duplicate diagnostics. Omitted releases and unknown modes stay silent.

- **Family:** engine
- **Preset:** es2021
- **Placements:** classic-es5 (error), es2021 (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Actions require an explicit server surface; mixed client/server UI Actions stay silent because execution regions are not classified. An explicit javascriptMode also enables documented engine checks in otherwise unclassified files.
- **JavaScript mode:** Runs when javascriptMode is compatibility, es5, es2021. Unknown mode stays silent.
- **Last verified:** 2026-08-24
- **Implementation:** [`src/rules/no-unsupported-static-methods.ts`](../../src/rules/no-unsupported-static-methods.ts)

## Applicability

| Dimension | Value |
| --- | --- |
| Authoring | classic |
| Surfaces | Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Actions require an explicit server surface; mixed client/server UI Actions stay silent because execution regions are not classified. An explicit javascriptMode also enables documented engine checks in otherwise unclassified files. |
| Minimum surface confidence | filename-inferred |
| JavaScript modes | compatibility, es5, es2021 |
| Application scopes | global, scoped, unknown |
| ServiceNow releases | zurich, australia |
| Fluent SDK range | n/a |

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| _(none)_ | | | This rule has no options. |

## Incorrect

### Incorrect: Error.isError in Zurich ES2021

```js
var isPlatformError = Error.isError(value);
```

## Correct

### Correct: Error.isError in Australia ES2021

```js
var isPlatformError = Error.isError(value);
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. false-negative: Direct aliases of individual static methods stay silent; the shared resolver proves stable aliases of the owning Error or Promise object instead. scope-boundary: A possible callable replacement for a modeled method suppresses matching diagnostics throughout the file, regardless of source order. false-negative: An owner alias used from another function body stays silent because source order cannot prove that its initializer ran before the function was called. scope-boundary: Release-dependent ES2021 calls stay silent when settings.servicenow.release is omitted because Zurich and Australia disagree.

## Known false positives

- None recorded.

## Known false negatives

- Direct aliases of individual static methods stay silent; the shared resolver proves stable aliases of the owning Error or Promise object instead.
- An owner alias used from another function body stays silent because source order cannot prove that its initializer ran before the function was called.

## Intentional scope boundaries

- A possible callable replacement for a modeled method suppresses matching diagnostics throughout the file, regardless of source order.
- Release-dependent ES2021 calls stay silent when settings.servicenow.release is omitted because Zurich and Australia disagree.

## Overlaps

- `servicenow/no-promise`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **The Australia engine update adds Error.isError, Promise.try, and Promise.withResolvers in ECMAScript 2021 mode.**
  - Verification ID: `rule-evidence-e5b10f35`
  - URL: https://www.servicenow.com/docs/r/api-reference/scripts/updates-javascript-engine.html
  - Verified by: manual
  - Verified at: 2026-08-24
- **ServiceNow documents Compatibility as a third mode; the plugin applies the ES5 Error.isError capability cell to it as package policy.**
  - Verification ID: `rule-evidence-368a42a4`
  - URL: https://www.servicenow.com/docs/r/api-reference/scripts/c_JS_modes.html
  - Verified by: manual
  - Verified at: 2026-08-24
- **Fixtures cover release deltas, owner aliases, shadowing, reassignment, dynamic scope, callable polyfills, non-callable replacements, availability guards, and guard invalidation.**
  - Verification ID: `rule-evidence-55217204`
  - URL: tests/rules/no-unsupported-static-methods.test.ts
  - Verified by: fixture
  - Verified at: 2026-08-24
- **Real Oxlint and ESLint contracts verify Zurich, Australia, omitted-release, and ES5 behavior for the modeled static methods.**
  - Verification ID: `rule-evidence-e814fe7b`
  - URL: tests/integration/release-contracts.test.ts
  - Verified by: integration-test
  - Verified at: 2026-08-24

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
