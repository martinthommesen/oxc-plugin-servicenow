# servicenow/validate-gliderecord-calls

Require `.query()` / `.get()` before `.next()`, and require the return values of `insert`, `update`, `get`, and `next` to be checked.

- **Family:** classic
- **Preset:** recommended
- **Default severity:** warn
- **Fixable:** no
- **Suggestions:** no

## Incorrect

### ❌ next without query

```js
var gr = new GlideRecord("incident");
gr.addActiveQuery();
gr.next();
gr.insert();
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
