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

Unknown, escaped, or ambiguous bindings stay silent instead of guessing.

## Known false positives

- None recorded.

## Known false negatives

- None recorded.

## Intentional scope boundaries

- None recorded.

## Overlaps

- `servicenow/require-fluent-id`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **Fluent file stems and Now.ID keys should stay stable kebab-case or snake_case identifiers.**
  - Verification ID: `rule-evidence-e4fe4448`
  - URL: https://www.servicenow.com/docs/r/api-reference/servicenow-fluent.html
  - Verified by: manual
  - Verified at: 2026-08-20
- **Catalog examples cover PascalCase files and kebab-case corrections.**
  - Verification ID: `rule-evidence-fdbf0751`
  - URL: src/catalog.ts
  - Verified by: fixture
  - Verified at: 2026-08-20

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
