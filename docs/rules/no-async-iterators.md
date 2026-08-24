# servicenow/no-async-iterators

`for await…of` and async generators are disallowed in every instance JavaScript mode, including ES2021.

- **Family:** engine
- **Preset:** recommended
- **Placements:** recommended (error), classic-es5 (error), es2021 (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Actions require an explicit server surface; mixed client/server UI Actions stay silent because execution regions are not classified. An explicit javascriptMode also enables documented engine checks in otherwise unclassified files.
- **JavaScript mode:** Runs when javascriptMode is compatibility, es5, es2021, unknown. Universal restrictions can run with unknown mode when the file is a known instance script.
- **Last verified:** 2026-08-22
- **Implementation:** [`src/rules/no-async-iterators.ts`](../../src/rules/no-async-iterators.ts)

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

### Incorrect: for await

```js
async function drain(items) {
  for await (var item of items) {
    gs.info(item);
  }
}
```

## Correct

### Correct: for of

```js
function drain(items) {
  for (var i = 0; i < items.length; i++) {
    gs.info(items[i]);
  }
}
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing.

## Known false positives

- None recorded.

## Known false negatives

- None recorded.

## Intentional scope boundaries

- None recorded.

## Overlaps

- `servicenow/no-async-await`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **for await...of and async generators are disallowed in every instance JavaScript mode.**
  - Verification ID: `rule-evidence-dd02dd4f`
  - URL: https://www.servicenow.com/docs/r/zurich/api-reference/scripts/javascript-engine-feature-support.html
  - Verified by: manual
  - Verified at: 2026-08-20
- **es2021 Oxlint still flags async iteration.**
  - Verification ID: `rule-evidence-743648b4`
  - URL: tests/integration/profiles/invalid/es2021-async-iter.server.js
  - Verified by: integration-test
  - Verified at: 2026-08-20
- **The Australia JavaScript engine feature table was reviewed for this rule's modeled capability cells.**
  - Verification ID: `rule-evidence-d3a51c15`
  - URL: https://www.servicenow.com/docs/r/api-reference/scripts/javascript-engine-feature-support.html
  - Verified by: manual
  - Verified at: 2026-08-22

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
