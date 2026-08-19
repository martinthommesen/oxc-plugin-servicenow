# servicenow/no-bigint

BigInt literals and `BigInt()` are unsupported in Compatibility or ES5 Standards mode.

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
- **Implementation:** [`src/rules/no-bigint.ts`](../../src/rules/no-bigint.ts)

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| _(none)_ | | | This rule has no options. |

## Incorrect

### Incorrect: literal

```js
var n = 9007199254740993n;
```

## Correct

### Correct: number

```js
var n = 9007199254740991;
```

## Limitations

When provenance, surface, or JavaScript mode is unknown, the rule stays silent instead of guessing.

## Evidence

- None recorded. Add an authoritative ServiceNow or Oxc link before expanding this rule.

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
