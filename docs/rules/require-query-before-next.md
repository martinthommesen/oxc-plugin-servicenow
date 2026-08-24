# servicenow/require-query-before-next

Require a documented, scope-supported GlideRecord query executor before `.next()` or `._next()`. A cursor advance reports when a reachable path lacks even a possible executor for the configured scope; unproven receivers stay silent.

- **Family:** classic
- **Preset:** recommended
- **Placements:** recommended (error), business-rule (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to server, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. Unknown surfaces stay silent.
- **JavaScript mode:** Not instance-executed, or independent of JavaScript mode unless a rule documents a mode gate.
- **Last verified:** 2026-08-22
- **Implementation:** [`src/rules/require-query-before-next.ts`](../../src/rules/require-query-before-next.ts)

## Applicability

| Dimension | Value |
| --- | --- |
| Authoring | classic |
| Surfaces | Applies to server, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. Unknown surfaces stay silent. |
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

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: A query through a proven alias opens the same record cursor. lifecycle: Executors are selected by release and scope. A possible scope-specific executor suppresses a missing-query finding without becoming a definite fact for positive rules. chooseWindow does not execute a query.

## Known false positives

- None recorded.

## Known false negatives

- None recorded.

## Intentional scope boundaries

- A query through a proven alias opens the same record cursor.

## Overlaps

- `servicenow/validate-gliderecord-calls`
- `servicenow/validate-glideaggregate-calls`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: Executors are selected by release and scope. A possible scope-specific executor suppresses a missing-query finding without becoming a definite fact for positive rules. chooseWindow does not execute a query.

## Evidence

- **query(), _query(), and get() execute a query before next() or _next() advances the cursor.**
  - Verification ID: `rule-evidence-434533fa`
  - URL: https://www.servicenow.com/docs/r/zurich/api-reference/server-api-reference/c_GlideRecordScopedAPI.html
  - Verified by: manual
  - Verified at: 2026-08-22
- **queryNoDomain() is documented on the global API and executes a query while ignoring domains.**
  - Verification ID: `rule-evidence-22e6da64`
  - URL: https://www.servicenow.com/docs/r/zurich/api-reference/server-api-reference/c_GlideRecordAPI.html
  - Verified by: manual
  - Verified at: 2026-08-22
- **Oxlint and ESLint enforce _query(), _next(), and scope-sensitive queryNoDomain() lifecycle contracts.**
  - Verification ID: `rule-evidence-fbeb4c62`
  - URL: tests/integration/binding-host-contracts.test.ts
  - Verified by: integration-test
  - Verified at: 2026-08-22
- **Aliases, sibling reassignment, and completion-aware paths are unit-tested.**
  - Verification ID: `rule-evidence-2620ec5c`
  - URL: tests/rules/stateful-lifecycle.test.ts
  - Verified by: fixture
  - Verified at: 2026-08-20
- **The Australia scoped GlideRecord API was reviewed for the methods and lifecycle facts used by this rule.**
  - Verification ID: `rule-evidence-239899a9`
  - URL: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html
  - Verified by: manual
  - Verified at: 2026-08-22
- **The Australia global GlideRecord API was reviewed for the methods and lifecycle facts used by this rule.**
  - Verification ID: `rule-evidence-a9aa90ba`
  - URL: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordAPI.html
  - Verified by: manual
  - Verified at: 2026-08-22

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
