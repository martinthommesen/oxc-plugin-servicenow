# servicenow/prefer-setnocount-with-choosewindow

Zurich scoped GlideRecord documents that `query()` after `chooseWindow()` runs `COUNT(*)` unless `setNoCount()` or `setLimit()` skips it. The rule is silent when `getRowCount()` is used, when `chooseWindow` forces a count, or when the binding escapes. Evidence: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html

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
- **Implementation:** [`src/rules/prefer-setnocount-with-choosewindow.ts`](../../src/rules/prefer-setnocount-with-choosewindow.ts)

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

### Incorrect: window without setNoCount

```js
var rec = new GlideRecord("incident");
rec.chooseWindow(0, 20);
rec.query();
while (rec.next()) {
  gs.info(rec.getValue("number"));
}
```

## Correct

### Correct: setNoCount

```js
var rec = new GlideRecord("incident");
rec.chooseWindow(0, 20);
rec.setNoCount();
rec.query();
while (rec.next()) {
  gs.info(rec.getValue("number"));
}
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. lifecycle: Window and setNoCount state are scoped to one query epoch and one object identity.

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
- Lifecycle assumptions: Window and setNoCount state are scoped to one query epoch and one object identity.

## Evidence

- **query() after chooseWindow() runs COUNT(*) unless setNoCount() or setLimit() skips it.**
  - Verification ID: `rule-evidence-d217ef14`
  - URL: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html
  - Verified by: manual
  - Verified at: 2026-08-20
- **A later query epoch is not justified by an earlier getRowCount().**
  - Verification ID: `rule-evidence-334bc3e5`
  - URL: tests/integration/profiles/invalid/setnocount-second-query.br.js
  - Verified by: integration-test
  - Verified at: 2026-08-20

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
