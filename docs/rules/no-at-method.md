# servicenow/no-at-method

`.at()` is not implemented in Compatibility or ES5 Standards mode.

- **Family:** engine
- **Preset:** classic-es5
- **Placements:** classic-es5 (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Classic instance scripts. Fluent files are skipped.
- **JavaScript mode:** Runs when `javascriptMode` is `compatibility` or `es5`. Unknown mode stays silent.
- **Last verified:** 2026-08-19
- **Implementation:** [`src/rules/no-at-method.ts`](../../src/rules/no-at-method.ts)

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| _(none)_ | | | This rule has no options. |

## Incorrect

### Incorrect: at

```js
var last = list.at(-1);
```

## Correct

### Correct: index

```js
var last = list[list.length - 1];
```

## Limitations

When provenance, surface, or JavaScript mode is unknown, the rule stays silent instead of guessing.

## Evidence

- None recorded. Add an authoritative ServiceNow or Oxc link before expanding this rule.

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
