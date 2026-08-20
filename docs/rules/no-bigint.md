# servicenow/no-bigint

BigInt literals and `BigInt()` are unsupported in Compatibility or ES5 Standards mode.

- **Family:** engine
- **Preset:** classic-es5
- **Placements:** classic-es5 (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to client, server, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. Unknown surfaces stay silent.
- **JavaScript mode:** Runs when javascriptMode is compatibility, es5. Unknown mode stays silent.
- **Last verified:** 2026-08-20
- **Implementation:** [`src/rules/no-bigint.ts`](../../src/rules/no-bigint.ts)

## Applicability

| Dimension | Value |
| --- | --- |
| Authoring | classic |
| Surfaces | Applies to client, server, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. Unknown surfaces stay silent. |
| Minimum surface confidence | filename-inferred |
| JavaScript modes | compatibility, es5 |
| Application scopes | global, scoped, unknown |
| ServiceNow releases | xanadu, yokohama, zurich |
| Fluent SDK range | n/a |

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

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. False positive: Local bindings named BigInt. False negative: Runtime evaluation of the BigInt constructor through an unknown member.

## Known false positives

- Local bindings named BigInt.

## Known false negatives

- Runtime evaluation of the BigInt constructor through an unknown member.

## Overlaps

- `servicenow/no-unsupported-syntax`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **BigInt is unsupported in Compatibility and ES5 Standards modes.**
  - URL: https://www.servicenow.com/docs/r/zurich/api-reference/scripts/javascript-engine-feature-support.html
  - Verified by: declaration-snapshot
  - Verified at: 2026-08-20
- **BigInt literals and the platform BigInt identifier report.**
  - URL: tests/rules/no-bigint.test.ts
  - Verified by: fixture
  - Verified at: 2026-08-20

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
