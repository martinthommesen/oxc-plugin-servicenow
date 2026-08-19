# servicenow/require-glideajax-sysparm-name

GlideAjax requires `addParam("sysparm_name", method)` before `getXML` / `getXMLAnswer` / `getXMLWait`. Extra static keys must start with `sysparm_`. Evidence: https://www.servicenow.com/docs/r/api-reference/scripts/p_AJAX.html

- **Family:** classic
- **Preset:** recommended
- **Placements:** recommended (error), client (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Classic instance scripts. Client-only rules skip server-only files. Fluent files are skipped.
- **JavaScript mode:** Independent of JavaScript mode unless the rule documents a mode gate.
- **Last verified:** 2026-08-19
- **Implementation:** [`src/rules/require-glideajax-sysparm-name.ts`](../../src/rules/require-glideajax-sysparm-name.ts)

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| _(none)_ | | | This rule has no options. |

## Incorrect

### Incorrect: missing sysparm_name

```js
var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_user_id", g_form.getValue("caller_id"));
ajax.getXMLAnswer(handleAnswer);
```

## Correct

### Correct: named method

```js
var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_name", "getManager");
ajax.addParam("sysparm_user_id", g_form.getValue("caller_id"));
ajax.getXMLAnswer(handleAnswer);
```

## Limitations

When provenance, surface, or JavaScript mode is unknown, the rule stays silent instead of guessing.

## Evidence

- https://www.servicenow.com/docs/r/api-reference/scripts/p_AJAX.html

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
