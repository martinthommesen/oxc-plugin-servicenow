# servicenow/no-gliderecord-query-modifier-after-query

Filters and result-shaping calls after `query()` do not change the open cursor. Report when `next()` consumes that cursor first.

- **Family:** classic
- **Preset:** recommended
- **Default severity:** error
- **Fixable:** no
- **Suggestions:** no

## Incorrect

### ❌ addQuery after query

```js
var incident = new GlideRecord("incident");
incident.query();
incident.addQuery("active", true);
while (incident.next()) {
  gs.info(incident.number);
}
```

## Correct

### ✅ filter then query

```js
var incident = new GlideRecord("incident");
incident.addQuery("active", true);
incident.query();
while (incident.next()) {
  gs.info(incident.number);
}
```

## See also

- [ServiceNow Fluent overview](https://servicenow.github.io/sdk/guides/fluent-overview)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
