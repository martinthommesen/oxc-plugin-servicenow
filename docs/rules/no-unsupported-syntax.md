# servicenow/no-unsupported-syntax

Optional chaining, nullish coalescing, logical assignment, private class members, and RegExp lookbehind are unsupported classically.

- **Family:** engine
- **Preset:** recommended
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
