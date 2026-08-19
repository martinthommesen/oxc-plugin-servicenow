# servicenow/no-gs-now

`gs.now()` and `gs.nowDateTime()` return timezone-sensitive display strings. `gs.now()` is also gone from client scripts since London. Prefer `new GlideDateTime()`.

- **Family:** classic
- **Preset:** recommended
- **Default severity:** error
- **Fixable:** no
- **Suggestions:** yes

## Incorrect

### ❌ gs.now

```js
current.u_opened = gs.now();
```

### ❌ gs.nowDateTime

```js
current.u_opened = gs.nowDateTime();
```

## Correct

### ✅ GlideDateTime

```js
current.u_opened = new GlideDateTime();
```

## See also

- [ServiceNow Fluent overview](https://servicenow.github.io/sdk/guides/fluent-overview)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
