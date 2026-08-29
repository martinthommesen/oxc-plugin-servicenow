# servicenow/no-bigint

BigInt literals and `BigInt()` are unsupported in Compatibility or ES5 Standards mode. Direct calls and stable same-execution aliases report; bare aliases must be captured under an availability guard, while visibly polyfilled, guarded, unknown-mode, and local `BigInt` calls stay silent.

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
- **Implementation:** [`src/rules/no-bigint.ts`](../../src/rules/no-bigint.ts)

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

### Incorrect: literal

```js
var n = 9007199254740993n;
```

## Correct

### Correct: number

```js
var n = 9007199254740991;
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: A possible callable BigInt replacement suppresses call diagnostics throughout the file, regardless of source order; BigInt literal diagnostics are unaffected. scope-boundary: A call protected by a structurally dominating BigInt availability guard stays silent for code shared with another runtime. false-negative: A BigInt alias used from another function body stays silent because source order cannot prove that its initializer ran before the function was called.

## Known false positives

- None recorded.

## Known false negatives

- A BigInt alias used from another function body stays silent because source order cannot prove that its initializer ran before the function was called.

## Intentional scope boundaries

- A possible callable BigInt replacement suppresses call diagnostics throughout the file, regardless of source order; BigInt literal diagnostics are unaffected.
- A call protected by a structurally dominating BigInt availability guard stays silent for code shared with another runtime.

## Overlaps

- `servicenow/no-unsupported-syntax`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **BigInt is unsupported in Compatibility and ES5 Standards modes.**
  - Verification ID: `rule-evidence-d1b19fa7`
  - URL: https://www.servicenow.com/docs/r/zurich/api-reference/scripts/javascript-engine-feature-support.html
  - Verified by: manual
  - Verified at: 2026-08-20
- **BigInt literals, stable call aliases, guarded capture, modeled invalidation, visible polyfills, shadowing, and dynamic scope are covered.**
  - Verification ID: `rule-evidence-396a0363`
  - URL: tests/rules/no-bigint.test.ts
  - Verified by: fixture
  - Verified at: 2026-08-24
- **Real Oxlint and ESLint classic-es5 profiles report a stable BigInt alias and accept an explicit callable polyfill.**
  - Verification ID: `rule-evidence-e66056ed`
  - URL: tests/integration/profiles.test.ts
  - Verified by: integration-test
  - Verified at: 2026-08-24
- **The Australia JavaScript engine feature table was reviewed for this rule's modeled capability cells.**
  - Verification ID: `rule-evidence-2aae7d4a`
  - URL: https://www.servicenow.com/docs/r/api-reference/scripts/javascript-engine-feature-support.html
  - Verified by: manual
  - Verified at: 2026-08-22

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
