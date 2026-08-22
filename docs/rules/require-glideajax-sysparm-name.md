# servicenow/require-glideajax-sysparm-name

GlideAjax requires a non-empty `addParam("sysparm_name", method)` before `getXML` / `getXMLAnswer` / `getXMLWait`. Extra static keys must start with `sysparm_`. Evidence: https://www.servicenow.com/docs/r/api-reference/scripts/p_AJAX.html

- **Family:** classic
- **Preset:** recommended
- **Default severity:** error
- **Fixable:** no
- **Suggestions:** no

## Incorrect

### ❌ missing sysparm_name

```js
var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_user_id", g_form.getValue("caller_id"));
ajax.getXMLAnswer(handleAnswer);
```

## Correct

### ✅ named method

```js
var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_name", "getManager");
ajax.addParam("sysparm_user_id", g_form.getValue("caller_id"));
ajax.getXMLAnswer(handleAnswer);
```

## See also

- [ServiceNow Fluent overview](https://servicenow.github.io/sdk/guides/fluent-overview)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
