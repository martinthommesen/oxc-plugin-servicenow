# servicenow/no-typed-arrays

TypedArray and DataView constructors are unsupported in Compatibility and ES5 Standards mode. ES2021 still rejects BigInt64Array / BigUint64Array.

- **Family:** engine
- **Preset:** classic-es5
- **Default severity:** error
- **Fixable:** no
- **Suggestions:** no

## Incorrect

### ❌ Int8Array

```js
var bytes = new Int8Array(16);
```

## Correct

### ✅ plain array

```js
var bytes = [0, 1, 2];
```

## See also

- [ServiceNow Fluent overview](https://servicenow.github.io/sdk/guides/fluent-overview)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
