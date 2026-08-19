# servicenow/no-sync-glideajax

`getXMLWait()` blocks the browser and does not work in Service Portal. Use `getXML()` / `getXMLAnswer()`.

- **Family:** classic
- **Preset:** recommended
- **Default severity:** error
- **Fixable:** no
- **Suggestions:** no

## Incorrect

### ❌ getXMLWait

```js
var ga = new GlideAjax("x_acme.UserUtils");
ga.addParam("sysparm_name", "getUser");
var xml = ga.getXMLWait();
var answer = xml.documentElement.getAttribute("answer");
```

## Correct

### ✅ getXMLAnswer

```js
var ga = new GlideAjax("x_acme.UserUtils");
ga.addParam("sysparm_name", "getUser");
ga.getXMLAnswer(function (answer) {
  g_form.setValue("caller_id", answer);
});
```

## See also

- [ServiceNow Fluent overview](https://servicenow.github.io/sdk/guides/fluent-overview)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
