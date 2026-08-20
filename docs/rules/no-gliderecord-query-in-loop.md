# servicenow/no-gliderecord-query-in-loop

A `query()`, `get()`, or `getAsync()` inside a proven GlideRecord / GlideAggregate `.next()` loop is an N+1 pattern. Unrelated iterators with `.next()` do not establish cursor depth.

- **Family:** classic
- **Preset:** strict
- **Placements:** strict (warn)
- **Default severity:** warn
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to server, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. Unknown surfaces stay silent.
- **JavaScript mode:** Not instance-executed, or independent of JavaScript mode unless a rule documents a mode gate.
- **Last verified:** 2026-08-20
- **Implementation:** [`src/rules/no-gliderecord-query-in-loop.ts`](../../src/rules/no-gliderecord-query-in-loop.ts)

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

### Incorrect: nested get

```js
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  var caller = new GlideRecord("sys_user");
  caller.get(incident.getValue("caller_id"));
  gs.info(caller.getDisplayValue());
}
```

## Correct

### Correct: display value

```js
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  gs.info(incident.getDisplayValue("caller_id"));
}
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. False negative: Unknown or escaped loop receivers stay silent. Lifecycle: Only a proven unescaped GlideRecord or GlideAggregate next() receiver establishes cursor depth.

## Known false positives

- None recorded.

## Known false negatives

- Unknown or escaped loop receivers stay silent.

## Overlaps

- `servicenow/require-query-before-next`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: Only a proven unescaped GlideRecord or GlideAggregate next() receiver establishes cursor depth.

## Evidence

- **query or get inside a next() loop is an N+1 pattern on the GlideRecord cursor.**
  - URL: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html
  - Verified by: declaration-snapshot
  - Verified at: 2026-08-20
- **Strict hosts report a nested query inside a proven cursor loop.**
  - URL: tests/integration/profiles/invalid/nested-cursor-query.br.js
  - Verified by: integration-test
  - Verified at: 2026-08-20
- **Custom iterators with next() do not establish cursor depth.**
  - URL: tests/integration/profiles/valid/custom-iterator-loop.br.js
  - Verified by: integration-test
  - Verified at: 2026-08-20

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
