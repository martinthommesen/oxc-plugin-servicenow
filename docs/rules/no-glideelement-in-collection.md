# servicenow/no-glideelement-in-collection

Direct GlideRecord field access is a GlideElement tied to the cursor. Do not `push` / `unshift` it inside a `.next()` loop. Evidence: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html

- **Family:** classic
- **Preset:** recommended
- **Default severity:** error
- **Fixable:** no
- **Suggestions:** no

## Incorrect

### ❌ push field

```js
var numbers = [];
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  numbers.push(incident.number);
}
```

## Correct

### ✅ getValue

```js
var numbers = [];
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  numbers.push(incident.getValue("number"));
}
```

## See also

- [ServiceNow Fluent overview](https://servicenow.github.io/sdk/guides/fluent-overview)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
