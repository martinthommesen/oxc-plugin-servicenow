# servicenow/no-weak-references

WeakRef and FinalizationRegistry are disallowed in every instance JavaScript mode, including ES2021.

- **Family:** engine
- **Preset:** recommended
- **Default severity:** error
- **Fixable:** no
- **Suggestions:** no

## Incorrect

### ❌ WeakRef

```js
var ref = new WeakRef(obj);
```

## Correct

### ✅ Map

```js
var cache = new Map();
```

## See also

- [ServiceNow Fluent overview](https://servicenow.github.io/sdk/guides/fluent-overview)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
