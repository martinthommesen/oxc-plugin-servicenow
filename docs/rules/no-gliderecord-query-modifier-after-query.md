# servicenow/no-gliderecord-query-modifier-after-query

Filters and result-shaping calls after a documented query executor do not change the open cursor. Report when a consumer uses that cursor before another execution.

- **Family:** classic
- **Preset:** recommended
- **Placements:** recommended (error), business-rule (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to server, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Actions require an explicit server surface; mixed client/server UI Actions stay silent because execution regions are not classified. Unknown surfaces stay silent.
- **JavaScript mode:** Not instance-executed, or independent of JavaScript mode unless a rule documents a mode gate.
- **Last verified:** 2026-08-22
- **Implementation:** [`src/rules/no-gliderecord-query-modifier-after-query.ts`](../../src/rules/no-gliderecord-query-modifier-after-query.ts)

## Applicability

| Dimension | Value |
| --- | --- |
| Authoring | classic |
| Surfaces | Applies to server, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Actions require an explicit server surface; mixed client/server UI Actions stay silent because execution regions are not classified. Unknown surfaces stay silent. |
| Minimum surface confidence | filename-inferred |
| JavaScript modes | n/a |
| Application scopes | global, scoped, unknown |
| ServiceNow releases | zurich, australia |
| Fluent SDK range | n/a |

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| _(none)_ | | | This rule has no options. |

## Incorrect

### Incorrect: addQuery after query

```js
var incident = new GlideRecord("incident");
incident.query();
incident.addQuery("active", true);
while (incident.next()) {
  gs.info(incident.number);
}
```

## Correct

### Correct: filter then query

```js
var incident = new GlideRecord("incident");
incident.addQuery("active", true);
incident.query();
while (incident.next()) {
  gs.info(incident.number);
}
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. lifecycle: Modifiers after a definite executor are findings only when a consumer uses the still-open cursor. A possible-only executor clears positive lifecycle facts.

## Known false positives

- None recorded.

## Known false negatives

- None recorded.

## Intentional scope boundaries

- None recorded.

## Overlaps

- `servicenow/require-query-before-next`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: Modifiers after a definite executor are findings only when a consumer uses the still-open cursor. A possible-only executor clears positive lifecycle facts.

## Evidence

- **Query modifiers after a documented query executor do not change the open cursor.**
  - Verification ID: `rule-evidence-6fd6aef0`
  - URL: https://www.servicenow.com/docs/r/zurich/api-reference/server-api-reference/c_GlideRecordAPI.html
  - Verified by: manual
  - Verified at: 2026-08-22
- **Recommended hosts report addQuery after query before next.**
  - Verification ID: `rule-evidence-7a7e2bef`
  - URL: tests/integration/profiles/invalid/late-modifier.br.js
  - Verified by: integration-test
  - Verified at: 2026-08-20
- **The Australia-scoped GlideRecord API was reviewed for the methods and lifecycle facts used by this rule.**
  - Verification ID: `rule-evidence-b3775e07`
  - URL: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html
  - Verified by: manual
  - Verified at: 2026-08-22
- **The Australia-global GlideRecord API was reviewed for the methods and lifecycle facts used by this rule.**
  - Verification ID: `rule-evidence-b3c456ac`
  - URL: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordAPI.html
  - Verified by: manual
  - Verified at: 2026-08-22

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
