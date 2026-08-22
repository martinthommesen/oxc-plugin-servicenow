# servicenow/no-weak-collections

WeakMap and WeakSet are disallowed in Compatibility and ES5 Standards mode. ES2021 supports them.

- **Family:** engine
- **Preset:** classic-es5
- **Default severity:** error
- **Fixable:** no
- **Suggestions:** no

## Incorrect

### ❌ WeakMap

```js
var cache = new WeakMap();
```

## Correct

### ✅ Map

```js
var cache = new Map();
```

## See also

- [ServiceNow Fluent overview](https://servicenow.github.io/sdk/guides/fluent-overview)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
