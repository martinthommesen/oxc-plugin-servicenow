# servicenow/no-gliderecord-query-modifier-after-query

Filters and result-shaping calls after `query()` do not change the open cursor. Report when `next()` consumes that cursor first.

- **Family:** classic
- **Preset:** recommended
- **Placements:** recommended (error), business-rule (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Classic instance scripts. Client-only rules skip server-only files. Fluent files are skipped.
- **JavaScript mode:** Independent of JavaScript mode unless the rule documents a mode gate.
- **Last verified:** 2026-08-19
- **Implementation:** [`src/rules/no-gliderecord-query-modifier-after-query.ts`](../../src/rules/no-gliderecord-query-modifier-after-query.ts)

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| _(none)_ | | | This rule has no options. |

## Incorrect

### Incorrect: addQuery after query

```js
var incident = new GlideRecord("incident");
incident.query();
incident.addQuery("active", true);
while (incident.next()) {
  gs.info(incident.number);
}
```

## Correct

### Correct: filter then query

```js
var incident = new GlideRecord("incident");
incident.addQuery("active", true);
incident.query();
while (incident.next()) {
  gs.info(incident.number);
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
