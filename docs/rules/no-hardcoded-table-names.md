# servicenow/no-hardcoded-table-names

String-literal table names in `GlideRecord` / `GlideAggregate` are hard to rename. Prefer named constants or Fluent table exports.

- **Family:** classic
- **Preset:** strict
- **Default severity:** warn
- **Fixable:** no
- **Suggestions:** no

## Incorrect

### ❌ literal table

```js
var gr = new GlideRecord("x_acme_widget");
```

## Correct

### ✅ named constant

```js
var TABLE = { WIDGET: "x_acme_widget" };
var gr = new GlideRecord(TABLE.WIDGET);
```

## See also

- [ServiceNow Fluent overview](https://servicenow.github.io/sdk/guides/fluent-overview)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
