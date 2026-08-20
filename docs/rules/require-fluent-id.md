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
- **Fluent SDK versions:** 3.0.0, 4.1.0 (unspecified selects 4.1.0)

## Applicability

| Dimension | Value |
| --- | --- |
| Authoring | fluent |
| Surfaces | Fluent `.now.ts` metadata only. |
| Minimum surface confidence | filename-inferred |
| JavaScript modes | n/a |
| Application scopes | global, scoped, unknown |
| ServiceNow releases | zurich |
| Fluent SDK range | 3.0.0 || 4.1.0 |

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

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. False positive: APIs whose selected SDK manifest marks $id as optional. False negative: Ids assigned after the factory call.

## Known false positives

- APIs whose selected SDK manifest marks $id as optional.

## Known false negatives

- Ids assigned after the factory call.

## Overlaps

- `servicenow/no-duplicate-fluent-id`
- `servicenow/no-now-id-as-reference`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **Factories whose manifest marks $id as required must declare Now.ID or an equivalent id.**
  - URL: https://www.servicenow.com/docs/r/application-development/servicenow-sdk/fluent-constructs.html
  - Verified by: declaration-snapshot
  - Verified at: 2026-08-20
- **Aliased factory imports still require $id under recommended.**
  - URL: tests/integration/profiles/invalid/fluent-alias-missing-id.now.ts
  - Verified by: integration-test
  - Verified at: 2026-08-20

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
