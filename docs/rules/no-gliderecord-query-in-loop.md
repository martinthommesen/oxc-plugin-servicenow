# servicenow/no-gliderecord-query-in-loop

A `query()` or `get()` inside `while (outer.next())` is an N+1 pattern. Starts as a warning because some lookups cannot be batched.

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
