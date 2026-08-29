# servicenow/validate-gliderecord-calls

Deprecated alias, scheduled for removal in 3.0. Prefer `require-query-before-next`. Still reports missing query-before-next and unused insert/update/get/next returns. `chooseWindow()` does not open a cursor.

- **Family:** classic
- **Preset:** off
- **Placements:** off
- **Default severity:** warn
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to server, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. Unknown surfaces stay silent.
- **JavaScript mode:** Not instance-executed, or independent of JavaScript mode unless a rule documents a mode gate.
- **Last verified:** 2026-08-20
- **Implementation:** [`src/rules/validate-gliderecord-calls.ts`](../../src/rules/validate-gliderecord-calls.ts)

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

### Incorrect: next without query

```js
var gr = new GlideRecord("incident");
gr.addActiveQuery();
gr.next();
gr.insert();
```

## Correct

### Correct: query + checked next

```js
var gr = new GlideRecord("incident");
gr.addActiveQuery();
gr.query();
while (gr.next()) {
  gs.info(gr.number);
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

- `servicenow/require-query-before-next`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **Deprecated compatibility rule. Prefer require-query-before-next for query lifecycle.**
  - Verification ID: `rule-evidence-a93b2686`
  - URL: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordAPI.html
  - Verified by: manual
  - Verified at: 2026-08-20
- **The rule remains exported and off by default.**
  - Verification ID: `rule-evidence-70cb3ad5`
  - URL: tests/catalog.test.ts
  - Verified by: fixture
  - Verified at: 2026-08-20

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
