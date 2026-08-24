# servicenow/no-incorrect-array-from-thisarg

Zurich throws when Array.from receives an explicit primitive mapper thisArg and gives a non-strict mapper the wrong this when that argument is omitted. Australia corrects both ES2021 behaviors. The rule reports only stable native calls with a syntax-proven callable mapper.

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
- **Implementation:** [`src/rules/no-incorrect-array-from-thisarg.ts`](../../src/rules/no-incorrect-array-from-thisarg.ts)

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

### Incorrect: explicit null mapper thisArg in Zurich

```js
var values = Array.from(source, function (value) { return value; }, null);
```

### Incorrect: omitted mapper thisArg in Zurich

```js
var values = Array.from(source, function (value) { return this.normalize(value); });
```

## Correct

### Correct: null mapper thisArg in Australia

```js
var values = Array.from(source, function (value) { return value; }, null);
```

### Correct: explicit object mapper thisArg in Zurich

```js
var values = Array.from(source, function (value) {
  return this.normalize(value);
}, normalizer);
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. false-negative: Member expressions, parameters, mutable variables, and callable aliases crossing an execution boundary stay silent because the rule cannot prove the mapper's function semantics. scope-boundary: The omitted-third-argument diagnostic requires a syntax-proven non-strict ordinary mapper that reads its own this; strict functions, arrows, and mappers without such a read stay silent. false-negative: Spread arguments and calls with a definitely nullish source stay silent because argument positions or whether execution reaches mapper-this handling cannot be proven. false-negative: Primitive this arguments produced by calls, substitutions, or compound expressions stay silent; the rule proves only nullish values, primitive literals, and no-substitution templates through dominating const aliases. scope-boundary: A possible Array owner or Array.from replacement suppresses diagnostics throughout the file; direct aliases of Array.from also stay silent because native method identity is not proven. scope-boundary: Calls stay silent when settings.servicenow.release is omitted because Zurich and Australia have different native behavior.

## Known false positives

- None recorded.

## Known false negatives

- Member expressions, parameters, mutable variables, and callable aliases crossing an execution boundary stay silent because the rule cannot prove the mapper's function semantics.
- Spread arguments and calls with a definitely nullish source stay silent because argument positions or whether execution reaches mapper-this handling cannot be proven.
- Primitive this arguments produced by calls, substitutions, or compound expressions stay silent; the rule proves only nullish values, primitive literals, and no-substitution templates through dominating const aliases.

## Intentional scope boundaries

- The omitted-third-argument diagnostic requires a syntax-proven non-strict ordinary mapper that reads its own this; strict functions, arrows, and mappers without such a read stay silent.
- A possible Array owner or Array.from replacement suppresses diagnostics throughout the file; direct aliases of Array.from also stay silent because native method identity is not proven.
- Calls stay silent when settings.servicenow.release is omitted because Zurich and Australia have different native behavior.

## Overlaps

- None recorded.

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **The Australia engine update lists Rhino PR 1982, Correct this in Array.from, as an ECMAScript 2021 fix.**
  - Verification ID: `rule-evidence-8b67060f`
  - URL: https://www.servicenow.com/docs/r/api-reference/scripts/updates-javascript-engine.html
  - Verified by: manual
  - Verified at: 2026-08-24
- **Fixtures prove explicit-primitive throws and omitted-this mismatches while covering strictness, lexical arrows, callable aliases, source validity, spread ambiguity, native authority, release selection, and unsupported contexts.**
  - Verification ID: `rule-evidence-fb9ff90a`
  - URL: tests/rules/no-incorrect-array-from-thisarg.test.ts
  - Verified by: fixture
  - Verified at: 2026-08-24
- **Real Oxlint and ESLint contracts verify explicit-nullish and omitted-this behavior in Zurich, Australia, and omitted-release configurations.**
  - Verification ID: `rule-evidence-b119dc04`
  - URL: tests/integration/release-contracts.test.ts
  - Verified by: integration-test
  - Verified at: 2026-08-24

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
