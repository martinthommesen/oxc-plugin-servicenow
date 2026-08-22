# servicenow/no-gliderecord-query-in-loop

A `query()`, `get()`, or `getAsync()` inside a proven GlideRecord / GlideAggregate `.next()` loop is an N+1 pattern. Unrelated iterators with `.next()` do not establish cursor depth.

- **Family:** classic
- **Preset:** strict
- **Default severity:** warn
- **Fixable:** no
- **Suggestions:** no

## Incorrect

### ❌ nested get

```js
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  var caller = new GlideRecord("sys_user");
  caller.get(incident.getValue("caller_id"));
  gs.info(caller.getDisplayValue());
}
```

## Correct

### ✅ display value

```js
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  gs.info(incident.getDisplayValue("caller_id"));
}
```

## See also

- [ServiceNow Fluent overview](https://servicenow.github.io/sdk/guides/fluent-overview)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
