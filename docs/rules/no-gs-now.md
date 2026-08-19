# servicenow/no-gs-now

`gs.now()` and `gs.nowDateTime()` return timezone-sensitive display strings. `gs.now()` is also gone from client scripts since London. Prefer `new GlideDateTime()`.

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
- **Implementation:** [`src/rules/no-gs-now.ts`](../../src/rules/no-gs-now.ts)

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| _(none)_ | | | This rule has no options. |

## Incorrect

### Incorrect: gs.now

```js
current.u_opened = gs.now();
```

### Incorrect: gs.nowDateTime

```js
current.u_opened = gs.nowDateTime();
```

## Correct

### Correct: GlideDateTime

```js
current.u_opened = new GlideDateTime();
```

## Limitations

When provenance, surface, or JavaScript mode is unknown, the rule stays silent instead of guessing.

## Evidence

- None recorded. Add an authoritative ServiceNow or Oxc link before expanding this rule.

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
