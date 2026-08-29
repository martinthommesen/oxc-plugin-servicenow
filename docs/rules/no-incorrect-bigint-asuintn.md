# servicenow/no-incorrect-bigint-asuintn

Zurich can return a negative input unchanged from BigInt.asUintN() when the requested width exceeds the input's signed byte representation; Australia corrects the ES2021 behavior. The rule reports only direct literal pairs that prove the two results differ.

- **Family:** engine
- **Preset:** es2021
- **Placements:** es2021 (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Actions require an explicit server surface; mixed client/server UI Actions stay silent because execution regions are not classified. An explicit javascriptMode also enables documented engine checks in otherwise unclassified files.
- **JavaScript mode:** Runs when javascriptMode is es2021. Unknown mode stays silent.
- **Last verified:** 2026-08-24
- **Implementation:** [`src/rules/no-incorrect-bigint-asuintn.ts`](../../src/rules/no-incorrect-bigint-asuintn.ts)

## Applicability

| Dimension | Value |
| --- | --- |
| Authoring | classic |
| Surfaces | Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Actions require an explicit server surface; mixed client/server UI Actions stay silent because execution regions are not classified. An explicit javascriptMode also enables documented engine checks in otherwise unclassified files. |
| Minimum surface confidence | filename-inferred |
| JavaScript modes | es2021 |
| Application scopes | global, scoped, unknown |
| ServiceNow releases | zurich, australia |
| Fluent SDK range | n/a |

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| _(none)_ | | | This rule has no options. |

## Incorrect

### Incorrect: negative 64-bit unsigned narrowing in Zurich

```js
var unsigned = BigInt.asUintN(64, -1n);
```

## Correct

### Correct: negative 64-bit unsigned narrowing in Australia

```js
var unsigned = BigInt.asUintN(64, -1n);
```

### Correct: Zurich narrowing below the legacy early-return boundary

```js
var unsigned = BigInt.asUintN(7, -1n);
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. false-negative: Dynamic operands and const aliases stay silent; the rule requires both arguments directly in the call so a diagnostic proves the exact legacy result. scope-boundary: A possible BigInt owner or asUintN replacement suppresses diagnostics throughout the file because the call may no longer reach Rhino's native implementation. false-negative: Bit counts above 4096 and normalized BigInt literal text longer than 256 characters stay silent to bound per-file analysis cost. scope-boundary: BigInt.asIntN calls stay silent because the reviewed regression proves a negative unsigned-result mismatch; the rule does not extrapolate that defect to signed narrowing. scope-boundary: Calls stay silent when settings.servicenow.release is omitted because Zurich and Australia have different native behavior.

## Known false positives

- None recorded.

## Known false negatives

- Dynamic operands and const aliases stay silent; the rule requires both arguments directly in the call so a diagnostic proves the exact legacy result.
- Bit counts above 4096 and normalized BigInt literal text longer than 256 characters stay silent to bound per-file analysis cost.

## Intentional scope boundaries

- A possible BigInt owner or asUintN replacement suppresses diagnostics throughout the file because the call may no longer reach Rhino's native implementation.
- BigInt.asIntN calls stay silent because the reviewed regression proves a negative unsigned-result mismatch; the rule does not extrapolate that defect to signed narrowing.
- Calls stay silent when settings.servicenow.release is omitted because Zurich and Australia have different native behavior.

## Overlaps

- `servicenow/no-bigint`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **The Australia engine update lists Rhino PR 1979 as the ECMAScript 2021 fix for BigInt.asUintN and BigInt.asIntN.**
  - Verification ID: `rule-evidence-0d06eb0f`
  - URL: https://www.servicenow.com/docs/r/api-reference/scripts/updates-javascript-engine.html
  - Verified by: manual
  - Verified at: 2026-08-24
- **Fixtures prove the legacy byte-width boundary, safe near misses, owner authority, aliases, mutation, release selection, and unsupported contexts.**
  - Verification ID: `rule-evidence-d67ac3dd`
  - URL: tests/rules/no-incorrect-bigint-asuintn.test.ts
  - Verified by: fixture
  - Verified at: 2026-08-24
- **Real Oxlint and ESLint contracts verify the same literal call in Zurich, Australia, and omitted-release configurations.**
  - Verification ID: `rule-evidence-4f70996d`
  - URL: tests/integration/release-contracts.test.ts
  - Verified by: integration-test
  - Verified at: 2026-08-24

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
