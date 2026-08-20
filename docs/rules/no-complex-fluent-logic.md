# servicenow/no-complex-fluent-logic

Optional architectural policy. `.now.ts` files should declare metadata. Loops, classes, try/catch, and multi-statement functions belong in `src/server/`. Not enabled in recommended or strict.

- **Family:** fluent
- **Preset:** policy
- **Placements:** policy (warn)
- **Default severity:** warn
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** fluent
- **Surfaces:** Fluent `.now.ts` metadata only.
- **JavaScript mode:** Not instance-executed, or independent of JavaScript mode unless a rule documents a mode gate.
- **Last verified:** 2026-08-20
- **Implementation:** [`src/rules/no-complex-fluent-logic.ts`](../../src/rules/no-complex-fluent-logic.ts)
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
| _(none)_ | | | This rule has no options. |

## Incorrect

### Incorrect: runtime loop

```ts
import { Record } from "@servicenow/sdk/core";

for (var i = 0; i < 10; i++) {
  Record({
    $id: Now.ID["seed-" + i],
    table: "incident",
    data: { short_description: "n" },
  });
}
```

## Correct

### Correct: declarative records

```ts
import { Record } from "@servicenow/sdk/core";

Record({
  $id: Now.ID["seed-incident"],
  table: "incident",
  data: { short_description: "Seed" },
});
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. False positive: Small helper functions that remain declarative. False negative: Logic hidden behind imported helpers.

## Known false positives

- Small helper functions that remain declarative.

## Known false negatives

- Logic hidden behind imported helpers.

## Overlaps

- `servicenow/prefer-now-include`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **Fluent .now.ts files declare metadata; runtime loops belong in src/server.**
  - URL: https://www.servicenow.com/docs/r/api-reference/servicenow-fluent.html
  - Verified by: declaration-snapshot
  - Verified at: 2026-08-20
- **Catalog examples cover a runtime loop versus declarative metadata.**
  - URL: src/catalog.ts
  - Verified by: fixture
  - Verified at: 2026-08-20

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
