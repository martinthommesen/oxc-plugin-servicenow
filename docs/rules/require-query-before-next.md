# servicenow/require-query-before-next

Require a proven GlideRecord binding to call `.query()` or `.get()` before `.next()`. `chooseWindow()` does not execute a query. Ambiguous branches are silent.

- **Family:** classic
- **Preset:** recommended
- **Default severity:** error
- **Fixable:** no
- **Suggestions:** no

## Incorrect

### ❌ next without query

```js
var gr = new GlideRecord("incident");
gr.addActiveQuery();
gr.next();
```

## Correct

### ✅ query + checked next

```js
var gr = new GlideRecord("incident");
gr.addActiveQuery();
gr.query();
while (gr.next()) {
  gs.info(gr.number);
}
```

## See also

- [ServiceNow Fluent overview](https://servicenow.github.io/sdk/guides/fluent-overview)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
