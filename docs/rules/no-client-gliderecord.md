# servicenow/no-client-gliderecord

Client-side GlideRecord is slow, often blocked, and a security smell. Use GlideAjax, Scripted REST, or `g_form.getReference()`.

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
- **Implementation:** [`src/rules/no-client-gliderecord.ts`](../../src/rules/no-client-gliderecord.ts)

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| _(none)_ | | | This rule has no options. |

## Incorrect

### Incorrect: client script

```js
function onChange() {
  var gr = new GlideRecord("sys_user");
  gr.addQuery("user_name", g_user.userName);
  gr.query();
}
```

## Correct

### Correct: GlideAjax

```js
function onChange() {
  var ga = new GlideAjax("x_acme.UserUtils");
  ga.addParam("sysparm_name", "getUser");
  ga.getXMLAnswer(function (answer) {
    g_form.setValue("caller_id", answer);
  });
}
```

## Limitations

When provenance, surface, or JavaScript mode is unknown, the rule stays silent instead of guessing.

## Evidence

- None recorded. Add an authoritative ServiceNow or Oxc link before expanding this rule.

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
