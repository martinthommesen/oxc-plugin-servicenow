# servicenow/no-gliderecord-query-in-loop

A `query()` or `get()` inside `while (outer.next())` is an N+1 pattern. Starts as a warning because some lookups cannot be batched.

- **Family:** classic
- **Preset:** strict
- **Placements:** strict (warn)
- **Default severity:** warn
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Classic instance scripts. Client-only rules skip server-only files. Fluent files are skipped.
- **JavaScript mode:** Independent of JavaScript mode unless the rule documents a mode gate.
- **Implementation:** [`src/rules/no-gliderecord-query-in-loop.ts`](../../src/rules/no-gliderecord-query-in-loop.ts)

## Incorrect

### Incorrect: nested get

```js
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  var caller = new GlideRecord("sys_user");
  caller.get(incident.getValue("caller_id"));
  gs.info(caller.getDisplayValue());
}
```

## Correct

### Correct: display value

```js
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  gs.info(incident.getDisplayValue("caller_id"));
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
