# servicenow/validate-glideaggregate-calls

A proven GlideAggregate must call `query()` before `next()` or `getAggregate()`. Static `getAggregate(type, field?)` must match an exact `addAggregate` tuple that was registered before that `query()`.

- **Family:** classic
- **Preset:** recommended
- **Default severity:** error
- **Fixable:** no
- **Suggestions:** no

## Incorrect

### ❌ next before query

```js
var count = new GlideAggregate("incident");
count.addAggregate("COUNT");
if (count.next()) {
  gs.info(count.getAggregate("COUNT"));
}
```

## Correct

### ✅ query then next

```js
var count = new GlideAggregate("incident");
count.addAggregate("COUNT");
count.query();
if (count.next()) {
  gs.info(count.getAggregate("COUNT"));
}
```

## See also

- [ServiceNow Fluent overview](https://servicenow.github.io/sdk/guides/fluent-overview)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
