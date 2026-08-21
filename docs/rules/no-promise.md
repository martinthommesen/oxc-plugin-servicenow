# servicenow/no-promise

Compatibility and ES5 Standards modes do not implement Promises. The rule is silent when JavaScript mode is unknown or ES2021. Local `Promise` bindings are ignored.

- **Family:** engine
- **Preset:** classic-es5
- **Default severity:** error
- **Fixable:** no
- **Suggestions:** no

## Incorrect

### ❌ constructor

```js
var p = new Promise(function (resolve) { resolve(1); });
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
