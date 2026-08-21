# servicenow/require-callback-for-getreference

`g_form.getReference(field)` without a callback is a synchronous server request. Pass a callback. Evidence: https://www.servicenow.com/docs/r/api-reference/c_GlideFormAPI.html

- **Family:** classic
- **Preset:** recommended
- **Default severity:** error
- **Fixable:** no
- **Suggestions:** no

## Incorrect

### ❌ sync getReference

```js
function onChange() {
  var caller = g_form.getReference("caller_id");
  g_form.setValue("u_manager", caller.manager);
}
```

## Correct

### ✅ async getReference

```js
function onChange() {
  g_form.getReference("caller_id", function (caller) {
    g_form.setValue("u_manager", caller.manager);
  });
}
```

## See also

- [ServiceNow Fluent overview](https://servicenow.github.io/sdk/guides/fluent-overview)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
