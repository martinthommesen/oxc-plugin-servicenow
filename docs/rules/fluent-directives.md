# servicenow/fluent-directives

Validate `@fluent-ignore`, `@fluent-disable-sync`, and `@fluent-disable-sync-for-file` against the selected SDK manifest. Previous-line directives attach to the next statement. Catch typos and reject `@ts-ignore` as a Fluent suppress.

- **Family:** fluent
- **Preset:** recommended
- **Placements:** recommended (warn), fluent (warn)
- **Default severity:** warn
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** fluent
- **Surfaces:** Fluent `.now.ts` metadata only.
- **JavaScript mode:** Not instance-executed, or independent of JavaScript mode unless a rule documents a mode gate.
- **Last verified:** 2026-08-20
- **Implementation:** [`src/rules/fluent-directives.ts`](../../src/rules/fluent-directives.ts)
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
| Fluent SDK range | 3.0.0 \|\| 4.1.0 |

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| _(none)_ | | | This rule has no options. |

## Incorrect

### Incorrect: typo + ts-ignore

```ts
// @ts-ignore
// @fluent-ignre
export const demo = 1;
```

## Correct

### Correct: documented directive

```ts
// @fluent-disable-sync
import { Record } from "@servicenow/sdk/core";

Record({
  $id: Now.ID["seed-incident"],
  table: "incident",
  data: { short_description: "Seed" },
});
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. False negative: Directives inside block comments that are not previous-line attachments.

## Known false positives

- None recorded.

## Known false negatives

- Directives inside block comments that are not previous-line attachments.

## Overlaps

- None recorded.

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **Fluent ignore directives are line- and file-scoped comments recognized by the SDK toolchain.**
  - URL: https://www.servicenow.com/docs/r/api-reference/servicenow-fluent.html
  - Verified by: declaration-snapshot
  - Verified at: 2026-08-20
- **A trailing @fluent-ignore without a following statement reports.**
  - URL: tests/integration/profiles/invalid/dangling-fluent-ignore.now.ts
  - Verified by: integration-test
  - Verified at: 2026-08-20

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
