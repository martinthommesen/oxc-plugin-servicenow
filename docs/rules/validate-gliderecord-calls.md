# servicenow/validate-gliderecord-calls

Deprecated alias. Prefer `require-query-before-next`. Still reports missing query-before-next and unused insert/update/get/next returns. `chooseWindow()` does not open a cursor.

- **Family:** classic
- **Preset:** off
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
