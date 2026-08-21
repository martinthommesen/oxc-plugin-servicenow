# servicenow/require-fluent-id

Fluent entities must declare `$id` when the selected SDK manifest marks the imported factory as requiring an id. Prefer canonical `Now.ID['descriptive-key']`.

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
- **Implementation:** [`src/rules/require-fluent-id.ts`](../../src/rules/require-fluent-id.ts)
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
| ServiceNow releases | zurich |
| Fluent SDK range | 3.0.0 \|\| 4.1.0 \|\| 4.8.0 \|\| 4.10.0 \|\| 4.10.1 \|\| 4.11.0 |

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `preferNowId` | boolean | `true` | Warn when `$id` is a raw string or sys_id instead of `Now.ID`. |

## Incorrect

### Incorrect: missing $id

```ts
import { BusinessRule } from "@servicenow/sdk/core";

BusinessRule({
  table: "incident",
  name: "Log state",
  when: "after",
  action: ["update"],
});
```

## Correct

### Correct: Now.ID

```ts
import { BusinessRule } from "@servicenow/sdk/core";

BusinessRule({
  $id: Now.ID["log-state"],
  table: "incident",
  name: "Log state",
  when: "after",
            action: ["update"],
});
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing.

## Known false positives

- None recorded.

## Known false negatives

- None recorded.

## Intentional scope boundaries

- None recorded.

## Overlaps

- `servicenow/no-duplicate-fluent-id`
- `servicenow/no-now-id-as-reference`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **Factories whose manifest marks $id as required must declare Now.ID or an equivalent id.**
  - Verification ID: `rule-evidence-e4dc20db`
  - URL: https://www.servicenow.com/docs/r/application-development/servicenow-sdk/fluent-constructs.html
  - Verified by: manual
  - Verified at: 2026-08-20
- **Aliased factory imports still require $id under recommended.**
  - Verification ID: `rule-evidence-0618f375`
  - URL: tests/integration/profiles/invalid/fluent-alias-missing-id.now.ts
  - Verified by: integration-test
  - Verified at: 2026-08-20

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
