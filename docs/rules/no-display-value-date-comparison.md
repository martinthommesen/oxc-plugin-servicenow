# servicenow/no-display-value-date-comparison

Do not relationally compare `GlideDateTime.getDisplayValue()` strings. Use `getNumericValue()` or a date-aware API.

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
- **Implementation:** [`src/rules/no-display-value-date-comparison.ts`](../../src/rules/no-display-value-date-comparison.ts)

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

### Incorrect: display string compare

```js
var start = new GlideDateTime(current.start_date);
var end = new GlideDateTime(current.end_date);
if (start.getDisplayValue() > end.getDisplayValue()) {
  gs.addErrorMessage("Start must be before end");
}
```

## Correct

### Correct: numeric compare

```js
var start = new GlideDateTime(current.start_date);
var end = new GlideDateTime(current.end_date);
if (start.getNumericValue() > end.getNumericValue()) {
  gs.addErrorMessage("Start must be before end");
}
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. False positive: Equality checks that only display the string. False negative: Display values copied into locals before comparison.

## Known false positives

- Equality checks that only display the string.

## Known false negatives

- Display values copied into locals before comparison.

## Overlaps

- `servicenow/no-gs-now`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **GlideDateTime.getDisplayValue() follows the session format and is not a chronological sort key.**
  - URL: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideDateTimeAPI.html
  - Verified by: declaration-snapshot
  - Verified at: 2026-08-20
- **Catalog examples cover display-value comparison versus getNumericValue.**
  - URL: src/catalog.ts
  - Verified by: fixture
  - Verified at: 2026-08-20

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
