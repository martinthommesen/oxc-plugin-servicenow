# servicenow/no-proxy

`Proxy` is unsupported on the classic engine.

- **Family:** engine
- **Preset:** recommended
- **Default severity:** error
- **Fixable:** no
- **Suggestions:** no

## Incorrect

### ❌ new Proxy

```js
var p = new Proxy(target, handler);
```

## Correct

### ✅ plain object

```js
var p = { prop: value };
```

## See also

- [ServiceNow Fluent overview](https://servicenow.github.io/sdk/guides/fluent-overview)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
