# servicenow/validate-gliderecord-calls

Deprecated alias. Prefer `require-query-before-next`. Still reports missing query-before-next and unused insert/update/get/next returns. `chooseWindow()` does not open a cursor.

- **Family:** classic
- **Preset:** off
- **Placements:** off
- **Default severity:** warn
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Classic instance scripts. Client-only rules skip server-only files. Fluent files are skipped.
- **JavaScript mode:** Independent of JavaScript mode unless the rule documents a mode gate.
- **Last verified:** 2026-08-19
- **Implementation:** [`src/rules/validate-gliderecord-calls.ts`](../../src/rules/validate-gliderecord-calls.ts)

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| _(none)_ | | | This rule has no options. |

## Incorrect

### Incorrect: next without query

```js
var gr = new GlideRecord("incident");
gr.addActiveQuery();
gr.next();
gr.insert();
```

## Correct

### Correct: query + checked next

```js
var gr = new GlideRecord("incident");
gr.addActiveQuery();
gr.query();
while (gr.next()) {
  gs.info(gr.number);
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
