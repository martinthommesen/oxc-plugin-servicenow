# servicenow/no-display-value-date-comparison

Do not relationally compare `GlideDateTime.getDisplayValue()` strings. Use `getNumericValue()` or a date-aware API.

- **Family:** classic
- **Preset:** strict
- **Default severity:** warn
- **Fixable:** no
- **Suggestions:** no

## Incorrect

### ❌ display string compare

```js
var start = new GlideDateTime(current.start_date);
var end = new GlideDateTime(current.end_date);
if (start.getDisplayValue() > end.getDisplayValue()) {
  gs.addErrorMessage("Start must be before end");
}
```

## Correct

### ✅ numeric compare

```js
var start = new GlideDateTime(current.start_date);
var end = new GlideDateTime(current.end_date);
if (start.getNumericValue() > end.getNumericValue()) {
  gs.addErrorMessage("Start must be before end");
}
```

## See also

- [ServiceNow Fluent overview](https://servicenow.github.io/sdk/guides/fluent-overview)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
