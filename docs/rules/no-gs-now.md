# servicenow/no-gs-now

`gs.now()` was removed from client scripts in London and is timezone-unsafe on the server. Prefer `new GlideDateTime()`.

- **Family:** classic
- **Preset:** recommended
- **Default severity:** error
- **Fixable:** yes
- **Suggestions:** yes

## Incorrect

### ❌ gs.now

```js
current.u_opened = gs.now();
```

## Correct

### ✅ GlideDateTime

```js
current.u_opened = new GlideDateTime();
```

## See also

- [ServiceNow Fluent overview](https://servicenow.github.io/sdk/guides/fluent-overview)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
