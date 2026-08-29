# servicenow/no-delete-multiple-with-windowing

`setLimit()` and `chooseWindow()` do not limit `deleteMultiple()`. The call deletes every row that matches the query. Evidence: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html

- **Family:** classic
- **Preset:** recommended
- **Placements:** recommended (error), business-rule (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to server, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. Unknown surfaces stay silent.
- **JavaScript mode:** Not instance-executed, or independent of JavaScript mode unless a rule documents a mode gate.
- **Last verified:** 2026-08-20
- **Implementation:** [`src/rules/no-delete-multiple-with-windowing.ts`](../../src/rules/no-delete-multiple-with-windowing.ts)

## Applicability

| Dimension | Value |
| --- | --- |
| Authoring | classic |
| Surfaces | Applies to server, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. Unknown surfaces stay silent. |
| Minimum surface confidence | filename-inferred |
| JavaScript modes | n/a |
| Application scopes | global, scoped, unknown |
| ServiceNow releases | zurich |
| Fluent SDK range | n/a |

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| _(none)_ | | | This rule has no options. |

## Incorrect

### Incorrect: setLimit then deleteMultiple

```js
var stale = new GlideRecord("x_acme_staging");
stale.addQuery("state", "expired");
stale.setLimit(100);
stale.deleteMultiple();
```

## Correct

### Correct: intentional bulk delete

```js
var stale = new GlideRecord("x_acme_staging");
stale.addQuery("state", "expired");
stale.deleteMultiple();
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. lifecycle: Window methods must resolve to the same GlideRecord object identity as deleteMultiple.

## Known false positives

- None recorded.

## Known false negatives

- None recorded.

## Intentional scope boundaries

- None recorded.

## Overlaps

- `servicenow/no-unfiltered-gliderecord-bulk-operation`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: Window methods must resolve to the same GlideRecord object identity as deleteMultiple.

## Evidence

- **setLimit and chooseWindow do not limit deleteMultiple(); the call deletes every matching row.**
  - Verification ID: `rule-evidence-5fe74792`
  - URL: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html
  - Verified by: manual
  - Verified at: 2026-08-20
- **Recommended hosts report windowed deleteMultiple.**
  - Verification ID: `rule-evidence-49ec0528`
  - URL: tests/integration/profiles/invalid/windowed-delete.br.js
  - Verified by: integration-test
  - Verified at: 2026-08-20

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
