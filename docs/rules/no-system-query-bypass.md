# servicenow/no-system-query-bypass

Opt-in security review for documented ACL-bypass query APIs: `addSystemQuery`, `addSystemEncodedQuery`, `addSystemOrderBy`, `addSystemOrderByDesc`.

- **Family:** classic
- **Preset:** off
- **Default severity:** warn
- **Fixable:** no
- **Suggestions:** no

## Incorrect

### ❌ addSystemQuery

```js
var user = new GlideRecord("sys_user");
user.addSystemQuery("active", true);
user.query();
```

## Correct

### ✅ addQuery

```js
var user = new GlideRecord("sys_user");
user.addQuery("active", true);
user.query();
```

## See also

- [ServiceNow Fluent overview](https://servicenow.github.io/sdk/guides/fluent-overview)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
