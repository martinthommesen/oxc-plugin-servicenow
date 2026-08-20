# servicenow/no-gs-now

`gs.now()` and `gs.nowDateTime()` return timezone-sensitive display strings. `gs.now()` is also gone from client scripts since London. Prefer `new GlideDateTime()`.

- **Family:** classic
- **Preset:** recommended
- **Placements:** recommended (error), client (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to client, server, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. Unknown surfaces stay silent.
- **JavaScript mode:** Not instance-executed, or independent of JavaScript mode unless a rule documents a mode gate.
- **Last verified:** 2026-08-20
- **Implementation:** [`src/rules/no-gs-now.ts`](../../src/rules/no-gs-now.ts)

## Applicability

| Dimension | Value |
| --- | --- |
| Authoring | classic |
| Surfaces | Applies to client, server, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. Unknown surfaces stay silent. |
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

### Incorrect: gs.now

```js
current.u_opened = gs.now();
```

### Incorrect: gs.nowDateTime

```js
current.u_opened = gs.nowDateTime();
```

## Correct

### Correct: GlideDateTime

```js
current.u_opened = new GlideDateTime();
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. False positive: Local objects with a now method that is not the platform gs binding. False negative: gs aliases that escape before the call.

## Known false positives

- Local objects with a now method that is not the platform gs binding.

## Known false negatives

- gs aliases that escape before the call.

## Overlaps

- `servicenow/no-display-value-date-comparison`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **gs.now() and gs.nowDateTime() return display strings, not GlideDateTime objects.**
  - URL: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideDateTimeAPI.html
  - Verified by: declaration-snapshot
  - Verified at: 2026-08-20
- **Host fixtures report gs.now on Business Rule files.**
  - URL: tests/integration/fixtures/bad-business-rule.br.js
  - Verified by: integration-test
  - Verified at: 2026-08-20

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
