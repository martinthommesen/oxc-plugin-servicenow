# servicenow/require-business-rule-wrapper

Full-script Business Rules must wrap logic in the standard IIFE so top-level variables do not leak. The rule is silent unless `businessRuleSourceFormat` is `full-script`.

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
- **Implementation:** [`src/rules/require-business-rule-wrapper.ts`](../../src/rules/require-business-rule-wrapper.ts)

## Applicability

| Dimension | Value |
| --- | --- |
| Authoring | classic |
| Surfaces | Applies to business-rule when those surfaces are known. Unknown surfaces stay silent. |
| Minimum surface confidence | explicit-only |
| JavaScript modes | n/a |
| Application scopes | global, scoped, unknown |
| ServiceNow releases | zurich, australia |
| Fluent SDK range | n/a |

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| _(none)_ | | | This rule has no options. |

## Incorrect

### Incorrect: unwrapped

```js
var targetGroup = gs.getProperty("x_acme.target_group");
if (current.assignment_group.nil()) {
  current.assignment_group = targetGroup;
}
```

## Correct

### Correct: IIFE wrapper

```js
(function executeRule(current, previous) {
  var targetGroup = gs.getProperty("x_acme.target_group");
  if (current.assignment_group.nil()) {
    current.assignment_group = targetGroup;
  }
})(current, previous);
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: Body-only Business Rule source does not contain the platform wrapper.

## Known false positives

- None recorded.

## Known false negatives

- None recorded.

## Intentional scope boundaries

- Body-only Business Rule source does not contain the platform wrapper.

## Overlaps

- None recorded.

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **Full-script Business Rules use the executeRule(current, previous) IIFE so top-level bindings do not leak.**
  - Verification ID: `rule-evidence-bc701657`
  - URL: https://www.servicenow.com/docs/r/application-development/business-rules-classic/c_BusinessRules.html
  - Verified by: manual
  - Verified at: 2026-08-20
- **The wrapper rule reports only when businessRuleSourceFormat is full-script.**
  - Verification ID: `rule-evidence-29cd4710`
  - URL: tests/integration/profiles/invalid/unwrapped.br.js
  - Verified by: integration-test
  - Verified at: 2026-08-20

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
