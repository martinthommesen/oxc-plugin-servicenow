# servicenow/no-unsupported-syntax

Optional chaining, nullish coalescing, logical assignment, private instance members, and RegExp lookbehind are unsupported in Compatibility and ES5 Standards mode.

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
- **Implementation:** [`src/rules/no-unsupported-syntax.ts`](../../src/rules/no-unsupported-syntax.ts)

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

### Incorrect: optional chaining and ??

```js
var name = current.caller_id?.name ?? "unknown";
```

## Correct

### Correct: explicit check

```js
var name = current.caller_id ? current.caller_id.name : "unknown";
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. False positive: Files whose javascriptMode is unknown or es2021. False negative: Syntax that oxc-parser does not represent as the documented node types.

## Known false positives

- Files whose javascriptMode is unknown or es2021.

## Known false negatives

- Syntax that oxc-parser does not represent as the documented node types.

## Overlaps

- `servicenow/no-async-await`
- `servicenow/no-bigint`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **Several ES2015+ syntactic forms are unsupported in Compatibility and ES5 Standards modes.**
  - URL: https://www.servicenow.com/docs/r/zurich/api-reference/scripts/javascript-engine-feature-support.html
  - Verified by: declaration-snapshot
  - Verified at: 2026-08-20
- **classic-es5 Oxlint flags unsupported syntax on the ES2021 fixture.**
  - URL: tests/integration/profiles/invalid/es5-promise.server.js
  - Verified by: integration-test
  - Verified at: 2026-08-20

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
