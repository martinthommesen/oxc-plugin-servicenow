# servicenow/prefer-glideaggregate

`GlideRecord.getRowCount()` (and iterate-to-count loops) load every matching row. `GlideAggregate` counts in the database.

- **Family:** classic
- **Preset:** strict
- **Placements:** strict (warn)
- **Default severity:** warn
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to server, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Actions require an explicit server surface; mixed client/server UI Actions stay silent because execution regions are not classified. Unknown surfaces stay silent.
- **JavaScript mode:** Not instance-executed, or independent of JavaScript mode unless a rule documents a mode gate.
- **Last verified:** 2026-08-22
- **Implementation:** [`src/rules/prefer-glideaggregate.ts`](../../src/rules/prefer-glideaggregate.ts)

## Applicability

| Dimension | Value |
| --- | --- |
| Authoring | classic |
| Surfaces | Applies to server, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Actions require an explicit server surface; mixed client/server UI Actions stay silent because execution regions are not classified. Unknown surfaces stay silent. |
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

### Incorrect: getRowCount

```js
var gr = new GlideRecord("incident");
gr.addActiveQuery();
gr.query();
var count = gr.getRowCount();
```

## Correct

### Correct: GlideAggregate COUNT

```js
var ga = new GlideAggregate("incident");
ga.addActiveQuery();
ga.addAggregate("COUNT");
ga.query();
var count = ga.next() ? parseInt(ga.getAggregate("COUNT"), 10) : 0;
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

- `servicenow/validate-glideaggregate-calls`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **The Australia GlideAggregate API documents database-side COUNT and other aggregate queries.**
  - Verification ID: `rule-evidence-3b04a8f8`
  - URL: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideAggregateScopedAPI.html
  - Verified by: manual
  - Verified at: 2026-08-22
- **The Australia global GlideAggregate API provides the same database aggregation surface.**
  - Verification ID: `rule-evidence-44699dce`
  - URL: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideAggregateAPI.html
  - Verified by: manual
  - Verified at: 2026-08-22
- **The Australia GlideRecord API recommends GlideAggregate when only a record count is needed because it does not retrieve matching records.**
  - Verification ID: `rule-evidence-ac7542f1`
  - URL: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html
  - Verified by: manual
  - Verified at: 2026-08-22
- **Iterate-to-count loops using next() or _next() report; if (gr.next()) stays silent.**
  - Verification ID: `rule-evidence-8e25a98b`
  - URL: tests/rules/prefer-glideaggregate.test.ts
  - Verified by: fixture
  - Verified at: 2026-08-20

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
