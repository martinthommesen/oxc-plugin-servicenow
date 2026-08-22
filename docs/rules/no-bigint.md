# servicenow/no-bigint

BigInt literals and `BigInt()` are unsupported in Compatibility or ES5 Standards mode.

- **Family:** engine
- **Preset:** classic-es5
- **Default severity:** error
- **Fixable:** no
- **Suggestions:** no

## Incorrect

### ❌ literal

```js
var n = 9007199254740993n;
```

## Correct

### ✅ number

```js
var n = 9007199254740991;
```

## See also

- [ServiceNow Fluent overview](https://servicenow.github.io/sdk/guides/fluent-overview)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
