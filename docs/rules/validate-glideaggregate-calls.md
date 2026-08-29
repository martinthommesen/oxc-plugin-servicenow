# servicenow/validate-glideaggregate-calls

A proven GlideAggregate must call `query()` before `next()` or `getAggregate()`. Static `getAggregate(type, field?)` must match an exact `addAggregate` tuple that was registered before that `query()`.

- **Family:** classic
- **Preset:** recommended
- **Placements:** recommended (error), business-rule (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Actions require an explicit server surface; mixed client/server UI Actions stay silent because execution regions are not classified. Unknown surfaces stay silent.
- **JavaScript mode:** Not instance-executed, or independent of JavaScript mode unless a rule documents a mode gate.
- **Last verified:** 2026-08-24
- **Implementation:** [`src/rules/validate-glideaggregate-calls.ts`](../../src/rules/validate-glideaggregate-calls.ts)

## Applicability

| Dimension | Value |
| --- | --- |
| Authoring | classic |
| Surfaces | Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Actions require an explicit server surface; mixed client/server UI Actions stay silent because execution regions are not classified. Unknown surfaces stay silent. |
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

### Incorrect: next before query

```js
var count = new GlideAggregate("incident");
count.addAggregate("COUNT");
if (count.next()) {
  gs.info(count.getAggregate("COUNT"));
}
```

## Correct

### Correct: query then next

```js
var count = new GlideAggregate("incident");
count.addAggregate("COUNT");
count.query();
if (count.next()) {
  gs.info(count.getAggregate("COUNT"));
}
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. false-negative: A possible platform constructor namespace reassignment, prototype or relevant instance-method mutation, or dynamic-scope uncertainty suppresses matching diagnostics throughout the file. lifecycle: Must-tuples intersect on join. addAggregate after query() does not validate the already-open result.

## Known false positives

- None recorded.

## Known false negatives

- A possible platform constructor namespace reassignment, prototype or relevant instance-method mutation, or dynamic-scope uncertainty suppresses matching diagnostics throughout the file.

## Intentional scope boundaries

- None recorded.

## Overlaps

- `servicenow/require-query-before-next`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: Must-tuples intersect on join. addAggregate after query() does not validate the already-open result.

## Evidence

- **The Australia GlideAggregate API documents addAggregate before query and getAggregate on the returned aggregate result.**
  - Verification ID: `rule-evidence-64dc5caa`
  - URL: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideAggregateScopedAPI.html
  - Verified by: manual
  - Verified at: 2026-08-22
- **The Australia global GlideAggregate API documents the corresponding aggregate lifecycle methods.**
  - Verification ID: `rule-evidence-bdbab258`
  - URL: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideAggregateAPI.html
  - Verified by: manual
  - Verified at: 2026-08-22
- **Type-only COUNT does not satisfy a field-specific getAggregate.**
  - Verification ID: `rule-evidence-653ed72c`
  - URL: tests/integration/profiles/invalid/aggregate-type-only-field.br.js
  - Verified by: integration-test
  - Verified at: 2026-08-20
- **Constructor namespace, prototype, instance-method, and dynamic-scope mutations are covered by shared platform-authority fixtures.**
  - Verification ID: `rule-evidence-84bbded5`
  - URL: tests/rules/platform-method-authority.test.ts
  - Verified by: fixture
  - Verified at: 2026-08-24

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
