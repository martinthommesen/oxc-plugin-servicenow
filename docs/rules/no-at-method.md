# servicenow/no-at-method

`.at()` is not implemented in Compatibility or ES5 Standards mode.

- **Family:** engine
- **Preset:** classic-es5
- **Placements:** classic-es5 (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Actions require an explicit server surface; mixed client/server UI Actions stay silent because execution regions are not classified. An explicit javascriptMode also enables documented engine checks in otherwise unclassified files.
- **JavaScript mode:** Runs when javascriptMode is compatibility, es5. Unknown mode stays silent.
- **Last verified:** 2026-08-22
- **Implementation:** [`src/rules/no-at-method.ts`](../../src/rules/no-at-method.ts)

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

### Incorrect: at

```js
var last = [1, 2].at(-1);
```

## Correct

### Correct: index

```js
var last = list[list.length - 1];
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: Unknown receivers with a method named at stay silent.

## Known false positives

- None recorded.

## Known false negatives

- None recorded.

## Intentional scope boundaries

- Unknown receivers with a method named at stay silent.

## Overlaps

- `servicenow/no-unsupported-syntax`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **Array.prototype.at is unsupported in Compatibility and ES5 Standards modes.**
  - Verification ID: `rule-evidence-a60aceba`
  - URL: https://www.servicenow.com/docs/r/zurich/api-reference/scripts/javascript-engine-feature-support.html
  - Verified by: manual
  - Verified at: 2026-08-20
- **Catalog examples cover array.at versus bracket access.**
  - Verification ID: `rule-evidence-e0ec88d9`
  - URL: src/catalog.ts
  - Verified by: fixture
  - Verified at: 2026-08-20
- **The Australia JavaScript engine feature table was reviewed for this rule's modeled capability cells.**
  - Verification ID: `rule-evidence-6a554922`
  - URL: https://www.servicenow.com/docs/r/api-reference/scripts/javascript-engine-feature-support.html
  - Verified by: manual
  - Verified at: 2026-08-22

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
