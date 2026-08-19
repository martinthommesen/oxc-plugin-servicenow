# servicenow/no-packages-calls

The Rhino `Packages.*` Java bridge is unavailable in scoped apps and on the modern engine.

- **Family:** classic
- **Preset:** recommended
- **Default severity:** error
- **Fixable:** no
- **Suggestions:** no

## Incorrect

### ❌ Packages call

```js
var result = Packages.com.glide.sys.GlideSystem.now();
```

## Correct

### ✅ Glide API

```js
var result = new GlideDateTime();
```

## See also

- [ServiceNow Fluent overview](https://servicenow.github.io/sdk/guides/fluent-overview)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
