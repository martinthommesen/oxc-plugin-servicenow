# servicenow/no-async-iterators

`for await…of` and async generators are disallowed in every instance JavaScript mode, including ES2021.

- **Family:** engine
- **Preset:** recommended
- **Placements:** recommended (error), classic-es5 (error), es2021 (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Classic instance scripts. Fluent files are skipped.
- **JavaScript mode:** Runs for documented all-mode bans, or when `javascriptMode` is known and the feature is unsupported.
- **Implementation:** [`src/rules/no-async-iterators.ts`](../../src/rules/no-async-iterators.ts)

## Incorrect

### Incorrect: for await

```js
async function drain(items) {
  for await (var item of items) {
    gs.info(item);
  }
}
```

## Correct

### Correct: for of

```js
function drain(items) {
  for (var i = 0; i < items.length; i++) {
    gs.info(items[i]);
  }
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
