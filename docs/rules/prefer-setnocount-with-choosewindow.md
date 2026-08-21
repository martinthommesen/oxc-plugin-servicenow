# servicenow/prefer-setnocount-with-choosewindow

Zurich scoped GlideRecord documents that `query()` after `chooseWindow()` runs `COUNT(*)` unless `setNoCount()` or `setLimit()` skips it. The rule is silent when `getRowCount()` is used, when `chooseWindow` forces a count, or when the binding escapes. Evidence: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html

- **Family:** classic
- **Preset:** strict
- **Default severity:** warn
- **Fixable:** no
- **Suggestions:** no

## Incorrect

### ❌ window without setNoCount

```js
var rec = new GlideRecord("incident");
rec.chooseWindow(0, 20);
rec.query();
while (rec.next()) {
  gs.info(rec.getValue("number"));
}
```

## Correct

### ✅ setNoCount

```js
var rec = new GlideRecord("incident");
rec.chooseWindow(0, 20);
rec.setNoCount();
rec.query();
while (rec.next()) {
  gs.info(rec.getValue("number"));
}
```

## See also

- [ServiceNow Fluent overview](https://servicenow.github.io/sdk/guides/fluent-overview)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
