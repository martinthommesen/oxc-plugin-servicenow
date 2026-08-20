# servicenow/no-async-await

async/await is not implemented in Compatibility or ES5 Standards mode.

- **Family:** engine
- **Preset:** classic-es5
- **Placements:** classic-es5 (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to client, server, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. Unknown surfaces stay silent.
- **JavaScript mode:** Runs when javascriptMode is compatibility, es5. Unknown mode stays silent.
- **Last verified:** 2026-08-20
- **Implementation:** [`src/rules/no-async-await.ts`](../../src/rules/no-async-await.ts)

## Applicability

| Dimension | Value |
| --- | --- |
| Authoring | classic |
| Surfaces | Applies to client, server, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. Unknown surfaces stay silent. |
| Minimum surface confidence | filename-inferred |
| JavaScript modes | compatibility, es5 |
| Application scopes | global, scoped, unknown |
| ServiceNow releases | xanadu, yokohama, zurich |
| Fluent SDK range | n/a |

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| _(none)_ | | | This rule has no options. |

## Incorrect

### Incorrect: async function

```js
async function loadIncident(id) {
  return await fetchIncident(id);
}
```

## Correct

### Correct: sync function

```js
function loadIncident(id) {
  var gr = new GlideRecord("incident");
  return gr.get(id) ? gr : null;
}
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. False positive: Files whose javascriptMode is unknown or es2021. False negative: Transpiled async helpers that no longer use await syntax.

## Known false positives

- Files whose javascriptMode is unknown or es2021.

## Known false negatives

- Transpiled async helpers that no longer use await syntax.

## Overlaps

- `servicenow/no-promise`
- `servicenow/no-async-iterators`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **async/await is unsupported in Compatibility and ES5 Standards modes.**
  - URL: https://www.servicenow.com/docs/r/zurich/api-reference/scripts/javascript-engine-feature-support.html
  - Verified by: declaration-snapshot
  - Verified at: 2026-08-20
- **async functions and await expressions report in ES5 mode.**
  - URL: tests/rules/no-async-await.test.ts
  - Verified by: fixture
  - Verified at: 2026-08-20

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
