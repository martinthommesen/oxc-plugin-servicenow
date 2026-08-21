# servicenow/prefer-glideaggregate

`GlideRecord.getRowCount()` (and iterate-to-count loops) load every matching row. `GlideAggregate` counts in the database.

- **Family:** classic
- **Preset:** strict
- **Placements:** strict (warn)
- **Default severity:** warn
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to server, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. Unknown surfaces stay silent.
- **JavaScript mode:** Not instance-executed, or independent of JavaScript mode unless a rule documents a mode gate.
- **Last verified:** 2026-08-20
- **Implementation:** [`src/rules/prefer-glideaggregate.ts`](../../src/rules/prefer-glideaggregate.ts)

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

- **GlideAggregate is the documented API for count and group queries.**
  - Verification ID: `rule-evidence-df414ab9`
  - URL: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html
  - Verified by: manual
  - Verified at: 2026-08-20
- **Iterate-to-count loops report; if (gr.next()) stays silent.**
  - Verification ID: `rule-evidence-66fb1576`
  - URL: tests/rules/prefer-glideaggregate.test.ts
  - Verified by: fixture
  - Verified at: 2026-08-20

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
