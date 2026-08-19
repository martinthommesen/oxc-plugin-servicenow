# servicenow/prefer-glideaggregate

`GlideRecord.getRowCount()` (and iterate-to-count loops) load every matching row. `GlideAggregate` counts in the database.

- **Family:** classic
- **Preset:** strict
- **Placements:** strict (warn)
- **Default severity:** warn
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Classic instance scripts. Client-only rules skip server-only files. Fluent files are skipped.
- **JavaScript mode:** Independent of JavaScript mode unless the rule documents a mode gate.
- **Last verified:** 2026-08-19
- **Implementation:** [`src/rules/prefer-glideaggregate.ts`](../../src/rules/prefer-glideaggregate.ts)

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| _(none)_ | | | This rule has no options. |

## Incorrect

### Incorrect: getRowCount

```js
var gr = new GlideRecord("incident");
gr.addActiveQuery();
gr.query();
var count = gr.getRowCount();
```

## Correct

### Correct: GlideAggregate COUNT

```js
var ga = new GlideAggregate("incident");
ga.addActiveQuery();
ga.addAggregate("COUNT");
ga.query();
var count = ga.next() ? parseInt(ga.getAggregate("COUNT"), 10) : 0;
```

## Limitations

When provenance, surface, or JavaScript mode is unknown, the rule stays silent instead of guessing.

## Evidence

- None recorded. Add an authoritative ServiceNow or Oxc link before expanding this rule.

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
