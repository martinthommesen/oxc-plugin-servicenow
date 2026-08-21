# servicenow/no-async-await

async/await is not implemented in Compatibility or ES5 Standards mode.

- **Family:** engine
- **Preset:** classic-es5
- **Default severity:** error
- **Fixable:** no
- **Suggestions:** no

## Incorrect

### ❌ async function

```js
async function loadIncident(id) {
  return await fetchIncident(id);
}
```

## Correct

### ✅ sync function

```js
function loadIncident(id) {
  var gr = new GlideRecord("incident");
  return gr.get(id) ? gr : null;
}
```

## See also

- [ServiceNow Fluent overview](https://servicenow.github.io/sdk/guides/fluent-overview)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
