# servicenow/no-weak-references

WeakMap / WeakSet / WeakRef / FinalizationRegistry are unsupported classically.

- **Family:** engine
- **Preset:** strict
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
