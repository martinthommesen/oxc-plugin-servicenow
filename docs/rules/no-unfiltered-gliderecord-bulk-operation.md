# servicenow/no-unfiltered-gliderecord-bulk-operation

`updateMultiple()` / `deleteMultiple()` without a proven restricting filter can touch every row. `query`, `orderBy`, `setLimit`, and `chooseWindow` are not filters. Empty `addQuery()` / `addEncodedQuery("")` do not count.

- **Family:** classic
- **Preset:** recommended
- **Placements:** recommended (warn)
- **Default severity:** warn
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to server, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. Unknown surfaces stay silent.
- **JavaScript mode:** Not instance-executed, or independent of JavaScript mode unless a rule documents a mode gate.
- **Last verified:** 2026-08-22
- **Implementation:** [`src/rules/no-unfiltered-gliderecord-bulk-operation.ts`](../../src/rules/no-unfiltered-gliderecord-bulk-operation.ts)

## Applicability

| Dimension | Value |
| --- | --- |
| Authoring | classic |
| Surfaces | Applies to server, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. Unknown surfaces stay silent. |
| Minimum surface confidence | filename-inferred |
| JavaScript modes | n/a |
| Application scopes | global, scoped, unknown |
| ServiceNow releases | zurich, australia |
| Fluent SDK range | n/a |

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| _(none)_ | | | This rule has no options. |

## Incorrect

### Incorrect: deleteMultiple with no filter

```js
var staging = new GlideRecord("x_acme_staging");
staging.deleteMultiple();
```

## Correct

### Correct: filtered updateMultiple

```js
var task = new GlideRecord("task");
task.addQuery("active", false);
task.setValue("u_migrated", true);
task.updateMultiple();
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. lifecycle: query, orderBy, setLimit, and chooseWindow are not restricting filters.

## Known false positives

- None recorded.

## Known false negatives

- None recorded.

## Intentional scope boundaries

- None recorded.

## Overlaps

- `servicenow/no-delete-multiple-with-windowing`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: query, orderBy, setLimit, and chooseWindow are not restricting filters.

## Evidence

- **updateMultiple and deleteMultiple apply to every row that matches the query filters.**
  - Verification ID: `rule-evidence-586ee5cf`
  - URL: https://www.servicenow.com/docs/r/zurich/api-reference/server-api-reference/c_GlideRecordScopedAPI.html
  - Verified by: manual
  - Verified at: 2026-08-20
- **Empty or missing addQuery arguments do not count as filters.**
  - Verification ID: `rule-evidence-5ae56c50`
  - URL: tests/integration/profiles/invalid/empty-addquery-bulk.br.js
  - Verified by: integration-test
  - Verified at: 2026-08-20
- **The Australia scoped GlideRecord API was reviewed for the methods and lifecycle facts used by this rule.**
  - Verification ID: `rule-evidence-ef15d2fd`
  - URL: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html
  - Verified by: manual
  - Verified at: 2026-08-22
- **The Australia global GlideRecord API was reviewed for the methods and lifecycle facts used by this rule.**
  - Verification ID: `rule-evidence-5ccc072e`
  - URL: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordAPI.html
  - Verified by: manual
  - Verified at: 2026-08-22

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
