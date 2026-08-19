# servicenow/prefer-glideaggregate

`GlideRecord.getRowCount()` (and iterate-to-count loops) load every matching row. `GlideAggregate` counts in the database.

- **Family:** classic
- **Preset:** recommended
- **Default severity:** warn
- **Fixable:** no
- **Suggestions:** yes

## Incorrect

### ❌ getRowCount

```js
var gr = new GlideRecord("incident");
gr.addActiveQuery();
gr.query();
var count = gr.getRowCount();
```

## Correct

### ✅ GlideAggregate COUNT

```js
var ga = new GlideAggregate("incident");
ga.addActiveQuery();
ga.addAggregate("COUNT");
ga.query();
var count = ga.next() ? parseInt(ga.getAggregate("COUNT"), 10) : 0;
```

## See also

- [ServiceNow Fluent overview](https://servicenow.github.io/sdk/guides/fluent-overview)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
