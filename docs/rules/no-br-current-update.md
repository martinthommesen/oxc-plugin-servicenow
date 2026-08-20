# servicenow/no-br-current-update

`current.update()` retriggers other Business Rules and can recurse. Set fields on `current` and let the platform save. Reports only when the file is a Business Rule. Shadowed `current` bindings are ignored.

- **Family:** classic
- **Preset:** recommended
- **Placements:** recommended (error), business-rule (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to business-rule when those surfaces are known. Unknown surfaces stay silent.
- **JavaScript mode:** Not instance-executed, or independent of JavaScript mode unless a rule documents a mode gate.
- **Last verified:** 2026-08-20
- **Implementation:** [`src/rules/no-br-current-update.ts`](../../src/rules/no-br-current-update.ts)

## Applicability

| Dimension | Value |
| --- | --- |
| Authoring | classic |
| Surfaces | Applies to business-rule when those surfaces are known. Unknown surfaces stay silent. |
| Minimum surface confidence | filename-inferred |
| JavaScript modes | n/a |
| Application scopes | global, scoped, unknown |
| ServiceNow releases | zurich |
| Fluent SDK range | n/a |

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| _(none)_ | | | This rule has no options. |

## Incorrect

### Incorrect: current.update

```js
current.state = 2;
current.update();
```

## Correct

### Correct: assign and return

```js
current.state = 2;
current.work_notes = "Moved to In Progress";
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. False positive: Server Script Includes that are not Business Rules. False negative: current aliases that escape before update.

## Known false positives

- Server Script Includes that are not Business Rules.

## Known false negatives

- current aliases that escape before update.

## Overlaps

- None recorded.

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **Business Rules should not call current.update() because the engine already writes the row.**
  - URL: https://www.servicenow.com/docs/r/application-development/business-rules-classic/c_BusinessRules.html
  - Verified by: declaration-snapshot
  - Verified at: 2026-08-20
- **Host fixtures report current.update on Business Rule files.**
  - URL: tests/integration/fixtures/bad-business-rule.br.js
  - Verified by: integration-test
  - Verified at: 2026-08-20

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
