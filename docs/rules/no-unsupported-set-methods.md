# servicenow/no-unsupported-set-methods

Set.prototype.intersection(), union(), difference(), symmetricDifference(), isSubsetOf(), isSupersetOf(), and isDisjointFrom() are available in Australia ES2021 but not Zurich ES2021. Only direct calls on a proven, authoritative Set receiver are reported; classic Map/Set availability is outside this method-level rule.

- **Family:** engine
- **Preset:** es2021
- **Placements:** es2021 (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Actions require an explicit server surface; mixed client/server UI Actions stay silent because execution regions are not classified. An explicit javascriptMode also enables documented engine checks in otherwise unclassified files.
- **JavaScript mode:** Runs when javascriptMode is es2021. Unknown mode stays silent.
- **Last verified:** 2026-08-24
- **Implementation:** [`src/rules/no-unsupported-set-methods.ts`](../../src/rules/no-unsupported-set-methods.ts)

## Applicability

| Dimension | Value |
| --- | --- |
| Authoring | classic |
| Surfaces | Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Actions require an explicit server surface; mixed client/server UI Actions stay silent because execution regions are not classified. An explicit javascriptMode also enables documented engine checks in otherwise unclassified files. |
| Minimum surface confidence | filename-inferred |
| JavaScript modes | es2021 |
| Application scopes | global, scoped, unknown |
| ServiceNow releases | zurich, australia |
| Fluent SDK range | n/a |

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| _(none)_ | | | This rule has no options. |

## Incorrect

### Incorrect: Set union in Zurich ES2021

```js
const merged = new Set(left).union(right);
```

## Correct

### Correct: Set union in Australia ES2021

```js
const merged = new Set(left).union(right);
```

### Correct: unrelated set-like object

```js
const merged = customCollection.union(other);
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. false-negative: Calls through extracted method values or call/apply/bind helpers stay silent; the rule reports direct calls on a proven Set receiver. scope-boundary: A possible Set constructor, prototype, or matching instance-method replacement suppresses the diagnostic throughout the file, regardless of source order. false-negative: A Set passed to unknown code stays silent because that code could install an instance method before the modeled call. false-negative: Instances of user-defined Set subclasses stay silent because the shared provenance model does not infer built-in identity through class inheritance. scope-boundary: Set composition calls stay silent when settings.servicenow.release is omitted because Zurich and Australia disagree.

## Known false positives

- None recorded.

## Known false negatives

- Calls through extracted method values or call/apply/bind helpers stay silent; the rule reports direct calls on a proven Set receiver.
- A Set passed to unknown code stays silent because that code could install an instance method before the modeled call.
- Instances of user-defined Set subclasses stay silent because the shared provenance model does not infer built-in identity through class inheritance.

## Intentional scope boundaries

- A possible Set constructor, prototype, or matching instance-method replacement suppresses the diagnostic throughout the file, regardless of source order.
- Set composition calls stay silent when settings.servicenow.release is omitted because Zurich and Australia disagree.

## Overlaps

- None recorded.

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **The Australia JavaScript engine update adds the new Set methods from Rhino PR 2029 in ECMAScript 2021 mode.**
  - Verification ID: `rule-evidence-14f80217`
  - URL: https://www.servicenow.com/docs/r/api-reference/scripts/updates-javascript-engine.html
  - Verified by: manual
  - Verified at: 2026-08-24
- **The linked Rhino implementation identifies intersection, union, difference, symmetricDifference, isSubsetOf, isSupersetOf, and isDisjointFrom as the added Set methods.**
  - Verification ID: `rule-evidence-1a837e87`
  - URL: https://github.com/mozilla/rhino/pull/2029
  - Verified by: manual
  - Verified at: 2026-08-24
- **Fixtures cover all seven methods, release selection, object identity, aliases, joins, directly invoked and escaping closures, shadowing, mutation, availability guards, and unsupported contexts.**
  - Verification ID: `rule-evidence-fe4bc740`
  - URL: tests/rules/no-unsupported-set-methods.test.ts
  - Verified by: fixture
  - Verified at: 2026-08-24
- **Real Oxlint and ESLint contracts verify Zurich, Australia, and omitted-release behavior for a proven Set receiver.**
  - Verification ID: `rule-evidence-8b1b5177`
  - URL: tests/integration/release-contracts.test.ts
  - Verified by: integration-test
  - Verified at: 2026-08-24

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
