# servicenow/no-unsupported-syntax

Optional chaining, nullish coalescing, logical assignment, private instance members, and RegExp lookbehind are unsupported in Compatibility and ES5 Standards mode.

- **Family:** engine
- **Preset:** classic-es5
- **Default severity:** error
- **Fixable:** no
- **Suggestions:** no

## Incorrect

### ❌ optional chaining and ??

```js
var name = current.caller_id?.name ?? "unknown";
```

## Correct

### ✅ explicit check

```js
var name = current.caller_id ? current.caller_id.name : "unknown";
```

## See also

- [ServiceNow Fluent overview](https://servicenow.github.io/sdk/guides/fluent-overview)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
