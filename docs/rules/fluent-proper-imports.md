# servicenow/fluent-proper-imports

Fluent entity and column APIs must be imported from the module recorded in the selected SDK manifest. Aliases and namespace imports resolve by lexical binding identity.

- **Family:** fluent
- **Preset:** recommended
- **Placements:** recommended (error), fluent (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** fluent
- **Surfaces:** Fluent `.now.ts` metadata only.
- **JavaScript mode:** Not instance-executed, or independent of JavaScript mode unless a rule documents a mode gate.
- **Last verified:** 2026-08-20
- **Implementation:** [`src/rules/fluent-proper-imports.ts`](../../src/rules/fluent-proper-imports.ts)
- **Fluent manifest:** sdk-docs-2026-03
- **Fluent SDK versions:** 3.0.0, 3.0.1, 3.0.2, 3.0.3, 4.0.0, 4.0.1, 4.0.2, 4.1.0, 4.1.1, 4.2.0, 4.3.0, 4.4.0, 4.4.1, 4.5.0, 4.6.0, 4.6.1, 4.7.0, 4.7.1, 4.7.2, 4.8.0, 4.8.1, 4.9.0, 4.9.1, 4.9.2, 4.10.0, 4.10.1, 4.11.0 (unspecified selects 4.11.0)

## Applicability

| Dimension | Value |
| --- | --- |
| Authoring | fluent |
| Surfaces | Fluent `.now.ts` metadata only. |
| Minimum surface confidence | filename-inferred |
| JavaScript modes | n/a |
| Application scopes | global, scoped, unknown |
| ServiceNow releases | n/a (Fluent SDK-versioned) |
| Fluent SDK range | 3.0.0 \|\| 3.0.1 \|\| 3.0.2 \|\| 3.0.3 \|\| 4.0.0 \|\| 4.0.1 \|\| 4.0.2 \|\| 4.1.0 \|\| 4.1.1 \|\| 4.2.0 \|\| 4.3.0 \|\| 4.4.0 \|\| 4.4.1 \|\| 4.5.0 \|\| 4.6.0 \|\| 4.6.1 \|\| 4.7.0 \|\| 4.7.1 \|\| 4.7.2 \|\| 4.8.0 \|\| 4.8.1 \|\| 4.9.0 \|\| 4.9.1 \|\| 4.9.2 \|\| 4.10.0 \|\| 4.10.1 \|\| 4.11.0 |

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| _(none)_ | | | This rule has no options. |

## Incorrect

### Incorrect: wrong module

```ts
import { BusinessRule } from "@servicenow/sdk";

BusinessRule({
  $id: Now.ID["log-change"],
  table: "incident",
  name: "Log change",
  when: "after",
  action: ["update"],
});
```

## Correct

### Correct: core import

```ts
import { BusinessRule } from "@servicenow/sdk/core";

BusinessRule({
  $id: Now.ID["log-change"],
  table: "incident",
  name: "Log change",
  when: "after",
  action: ["update"],
});
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: Local functions that share a Fluent factory name are not SDK factories.

## Known false positives

- None recorded.

## Known false negatives

- None recorded.

## Intentional scope boundaries

- Local functions that share a Fluent factory name are not SDK factories.

## Overlaps

- `servicenow/require-fluent-id`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **Fluent factories are imported from the documented @servicenow/sdk modules.**
  - Verification ID: `rule-evidence-38e89461`
  - URL: https://www.servicenow.com/docs/r/api-reference/servicenow-fluent.html
  - Verified by: manual
  - Verified at: 2026-08-20
- **Host fixtures report factories imported from the wrong module.**
  - Verification ID: `rule-evidence-b9e2415f`
  - URL: tests/integration/fixtures/bad-fluent.now.ts
  - Verified by: integration-test
  - Verified at: 2026-08-20

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
