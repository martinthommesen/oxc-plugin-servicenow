# servicenow/no-promise

The classic ServiceNow JavaScript engine does not implement Promises. Stay synchronous, or opt the file into ES latest.

- **Family:** engine
- **Preset:** recommended
- **Default severity:** error
- **Fixable:** no
- **Suggestions:** no

## Incorrect

### ❌ constructor and then

```js
var p = new Promise(function (resolve) { resolve(1); });
p.then(function (value) { gs.info(value); });
```

## Correct

### ✅ synchronous Glide

```js
var gr = new GlideRecord("incident");
if (gr.get(sysId)) {
  gs.info(gr.number);
}
```

## See also

- [ServiceNow Fluent overview](https://servicenow.github.io/sdk/guides/fluent-overview)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
