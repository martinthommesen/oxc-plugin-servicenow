# servicenow/no-delete-multiple-with-windowing

`setLimit()` and `chooseWindow()` do not limit `deleteMultiple()`. The call deletes every row that matches the query. Evidence: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html

- **Family:** classic
- **Preset:** recommended
- **Default severity:** error
- **Fixable:** no
- **Suggestions:** no

## Incorrect

### ❌ setLimit then deleteMultiple

```js
var stale = new GlideRecord("x_acme_staging");
stale.addQuery("state", "expired");
stale.setLimit(100);
stale.deleteMultiple();
```

## Correct

### ✅ intentional bulk delete

```js
var stale = new GlideRecord("x_acme_staging");
stale.addQuery("state", "expired");
stale.deleteMultiple();
```

## See also

- [ServiceNow Fluent overview](https://servicenow.github.io/sdk/guides/fluent-overview)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
