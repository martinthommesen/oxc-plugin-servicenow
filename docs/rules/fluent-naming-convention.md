# servicenow/fluent-naming-convention

`.now.ts` files and `Now.ID` keys should be kebab-case. Exported `Table` bindings should match the table `name`.

- **Family:** fluent
- **Preset:** strict
- **Placements:** strict (warn)
- **Default severity:** warn
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** fluent
- **Surfaces:** Fluent `.now.ts` metadata only.
- **JavaScript mode:** Not instance-executed, or independent of JavaScript mode unless a rule documents a mode gate.
- **Last verified:** 2026-08-20
- **Implementation:** [`src/rules/fluent-naming-convention.ts`](../../src/rules/fluent-naming-convention.ts)
- **Fluent manifest:** sdk-docs-2026-03
- **Fluent SDK versions:** 3.0.0, 4.1.0, 4.8.0, 4.10.0, 4.11.0 (unspecified selects 4.11.0)

## Applicability

| Dimension | Value |
| --- | --- |
| Authoring | fluent |
| Surfaces | Fluent `.now.ts` metadata only. |
| Minimum surface confidence | filename-inferred |
| JavaScript modes | n/a |
| Application scopes | global, scoped, unknown |
| ServiceNow releases | zurich |
| Fluent SDK range | 3.0.0 \|\| 4.1.0 \|\| 4.8.0 \|\| 4.10.0 \|\| 4.11.0 |

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `idStyle` | "kebab-case" \| "snake_case" \| "either" | `"kebab-case"` | Required style for `Now.ID` keys. |
| `fileStyle` | "kebab-case" \| "snake_case" \| "either" | `"kebab-case"` | Required style for `.now.ts` filenames. |

## Incorrect

### Incorrect: PascalCase file + id

```ts
import { BusinessRule } from "@servicenow/sdk/core";

BusinessRule({
  $id: Now.ID["LogState"],
  table: "incident",
  name: "Log state",
});
```

## Correct

### Correct: kebab-case

```ts
import { BusinessRule } from "@servicenow/sdk/core";

BusinessRule({
  $id: Now.ID["log-state"],
  table: "incident",
            name: "Log state",
});
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. False positive: Generated file names that include a required scope prefix. False negative: Ids constructed at runtime.

## Known false positives

- Generated file names that include a required scope prefix.

## Known false negatives

- Ids constructed at runtime.

## Overlaps

- `servicenow/require-fluent-id`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **Fluent file stems and Now.ID keys should stay stable kebab-case or snake_case identifiers.**
  - URL: https://www.servicenow.com/docs/r/api-reference/servicenow-fluent.html
  - Verified by: declaration-snapshot
  - Verified at: 2026-08-20
- **Catalog examples cover PascalCase files and kebab-case corrections.**
  - URL: src/catalog.ts
  - Verified by: fixture
  - Verified at: 2026-08-20

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
