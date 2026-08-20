# servicenow/require-query-before-next

Require a proven GlideRecord binding to call `.query()` or `.get()` before `.next()`. `chooseWindow()` does not execute a query. Ambiguous branches are silent.

- **Family:** classic
- **Preset:** recommended
- **Placements:** recommended (error), business-rule (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to server, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. Unknown surfaces stay silent.
- **JavaScript mode:** Not instance-executed, or independent of JavaScript mode unless a rule documents a mode gate.
- **Last verified:** 2026-08-20
- **Implementation:** [`src/rules/require-query-before-next.ts`](../../src/rules/require-query-before-next.ts)

## Applicability

| Dimension | Value |
| --- | --- |
| Authoring | classic |
| Surfaces | Applies to server, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. Unknown surfaces stay silent. |
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

### Incorrect: next without query

```js
var gr = new GlideRecord("incident");
gr.addActiveQuery();
gr.next();
```

## Correct

### Correct: query + checked next

```js
var gr = new GlideRecord("incident");
gr.addActiveQuery();
gr.query();
while (gr.next()) {
  gs.info(gr.number);
}
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. False negative: Dynamic method names and escaped records stay silent. Lifecycle: chooseWindow does not execute a query. Aliases share object identity. Abrupt paths do not join into later statements.

## Known false positives

- None recorded.

## Known false negatives

- Dynamic method names and escaped records stay silent.

## Overlaps

- `servicenow/validate-gliderecord-calls`
- `servicenow/validate-glideaggregate-calls`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: chooseWindow does not execute a query. Aliases share object identity. Abrupt paths do not join into later statements.

## Evidence

- **next() reads the current cursor row after query() or get() executes the query.**
  - URL: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html
  - Verified by: declaration-snapshot
  - Verified at: 2026-08-20
- **Oxlint and ESLint report next() without a preceding query on every path.**
  - URL: tests/integration/profiles/invalid/missing-query.br.js
  - Verified by: integration-test
  - Verified at: 2026-08-20
- **Aliases, sibling reassignment, and completion-aware paths are unit-tested.**
  - URL: tests/rules/stateful-lifecycle.test.ts
  - Verified by: fixture
  - Verified at: 2026-08-20

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
