# servicenow/no-weak-references

WeakRef and FinalizationRegistry are disallowed in every instance JavaScript mode, including ES2021.

- **Family:** engine
- **Preset:** recommended
- **Placements:** recommended (error), classic-es5 (error), es2021 (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Classic instance scripts. Fluent files are skipped.
- **JavaScript mode:** Runs for documented all-mode bans, or when `javascriptMode` is known and the feature is unsupported.
- **Last verified:** 2026-08-19
- **Implementation:** [`src/rules/no-weak-references.ts`](../../src/rules/no-weak-references.ts)

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| _(none)_ | | | This rule has no options. |

## Incorrect

### Incorrect: WeakRef

```js
var ref = new WeakRef(obj);
```

## Correct

### Correct: Map

```js
var cache = new Map();
```

## Limitations

When provenance, surface, or JavaScript mode is unknown, the rule stays silent instead of guessing.

## Evidence

- None recorded. Add an authoritative ServiceNow or Oxc link before expanding this rule.

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
