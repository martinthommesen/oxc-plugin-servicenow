# servicenow/no-typed-arrays

TypedArray and DataView constructors are unsupported in Compatibility and ES5 Standards mode. ES2021 still rejects BigInt64Array / BigUint64Array.

- **Family:** engine
- **Preset:** classic-es5
- **Placements:** classic-es5 (error), es2021 (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Classic instance scripts. Fluent files are skipped.
- **JavaScript mode:** Runs when `javascriptMode` is `compatibility` or `es5`. Unknown mode stays silent.
- **Implementation:** [`src/rules/no-typed-arrays.ts`](../../src/rules/no-typed-arrays.ts)

## Incorrect

### Incorrect: Int8Array

```js
var bytes = new Int8Array(16);
```

## Correct

### Correct: plain array

```js
var bytes = [0, 1, 2];
```

## Limitations

When provenance, surface, or JavaScript mode is unknown, the rule stays silent instead of guessing.

## Evidence

- None recorded. Add an authoritative ServiceNow or Oxc link before expanding this rule.

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
