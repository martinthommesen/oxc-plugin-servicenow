# servicenow/no-glideajax-getanswer

`getAnswer()` belongs to synchronous GlideAjax. Use `getXMLAnswer(callback)` instead. Evidence: https://www.servicenow.com/docs/r/api-reference/c_GlideAjaxAPI.html

- **Family:** classic
- **Preset:** recommended
- **Placements:** recommended (error), client (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Classic instance scripts. Client-only rules skip server-only files. Fluent files are skipped.
- **JavaScript mode:** Independent of JavaScript mode unless the rule documents a mode gate.
- **Implementation:** [`src/rules/no-glideajax-getanswer.ts`](../../src/rules/no-glideajax-getanswer.ts)

## Incorrect

### Incorrect: getAnswer after getXML

```js
var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_name", "getManager");
ajax.getXML(handleResponse);
var answer = ajax.getAnswer();
```

## Correct

### Correct: getXMLAnswer callback

```js
var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_name", "getManager");
ajax.getXMLAnswer(function (answer) {
  g_form.setValue("u_manager", answer);
});
```

## Limitations

When provenance, surface, or JavaScript mode is unknown, the rule stays silent instead of guessing.

## Evidence

- https://www.servicenow.com/docs/r/api-reference/c_GlideAjaxAPI.html

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
