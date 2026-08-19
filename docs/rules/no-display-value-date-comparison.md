# servicenow/no-display-value-date-comparison

Do not relationally compare `GlideDateTime.getDisplayValue()` strings. Use `getNumericValue()` or a date-aware API.

- **Family:** classic
- **Preset:** strict
- **Placements:** strict (warn)
- **Default severity:** warn
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Classic instance scripts. Client-only rules skip server-only files. Fluent files are skipped.
- **JavaScript mode:** Independent of JavaScript mode unless the rule documents a mode gate.
- **Implementation:** [`src/rules/no-display-value-date-comparison.ts`](../../src/rules/no-display-value-date-comparison.ts)

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

When provenance, surface, or JavaScript mode is unknown, the rule stays silent instead of guessing.

## Evidence

- None recorded. Add an authoritative ServiceNow or Oxc link before expanding this rule.

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
