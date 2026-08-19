# servicenow/no-br-current-update

`current.update()` retriggers other Business Rules and can recurse. Set fields on `current` and let the platform save. Reports only when the file is a Business Rule. Shadowed `current` bindings are ignored.

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
- **Implementation:** [`src/rules/no-br-current-update.ts`](../../src/rules/no-br-current-update.ts)

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| _(none)_ | | | This rule has no options. |

## Incorrect

### Incorrect: current.update

```js
current.state = 2;
current.update();
```

## Correct

### Correct: assign and return

```js
current.state = 2;
current.work_notes = "Moved to In Progress";
```

## Limitations

When provenance, surface, or JavaScript mode is unknown, the rule stays silent instead of guessing.

## Evidence

- None recorded. Add an authoritative ServiceNow or Oxc link before expanding this rule.

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
