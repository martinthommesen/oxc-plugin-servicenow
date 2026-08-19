# servicenow/no-sync-glideajax

`getXMLWait()` blocks the browser and does not work in Service Portal. Use `getXML()` / `getXMLAnswer()`.

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
- **Implementation:** [`src/rules/no-sync-glideajax.ts`](../../src/rules/no-sync-glideajax.ts)

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| _(none)_ | | | This rule has no options. |

## Incorrect

### Incorrect: getXMLWait

```js
var ga = new GlideAjax("x_acme.UserUtils");
ga.addParam("sysparm_name", "getUser");
var xml = ga.getXMLWait();
var answer = xml.documentElement.getAttribute("answer");
```

## Correct

### Correct: getXMLAnswer

```js
var ga = new GlideAjax("x_acme.UserUtils");
ga.addParam("sysparm_name", "getUser");
ga.getXMLAnswer(function (answer) {
  g_form.setValue("caller_id", answer);
});
```

## Limitations

When provenance, surface, or JavaScript mode is unknown, the rule stays silent instead of guessing.

## Evidence

- None recorded. Add an authoritative ServiceNow or Oxc link before expanding this rule.

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
