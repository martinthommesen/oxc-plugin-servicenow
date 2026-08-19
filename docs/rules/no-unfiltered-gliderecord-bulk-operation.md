# servicenow/no-unfiltered-gliderecord-bulk-operation

`updateMultiple()` / `deleteMultiple()` without a proven filter can touch every row. `query`, `orderBy`, and `setLimit` are not filters.

- **Family:** classic
- **Preset:** recommended
- **Default severity:** warn
- **Fixable:** no
- **Suggestions:** no

## Incorrect

### ❌ deleteMultiple with no filter

```js
var staging = new GlideRecord("x_acme_staging");
staging.deleteMultiple();
```

## Correct

### ✅ filtered updateMultiple

```js
var task = new GlideRecord("task");
task.addQuery("active", false);
task.setValue("u_migrated", true);
task.updateMultiple();
```

## See also

- [ServiceNow Fluent overview](https://servicenow.github.io/sdk/guides/fluent-overview)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
