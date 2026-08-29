# servicenow/fluent-directives

Validate documented ServiceNow Fluent SDK directive names and placement. SDK directives are not Oxlint or ESLint disable comments.

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

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: ServiceNow Fluent directives are SDK controls; they are not Oxlint or ESLint disable comments and do not suppress this plugin's diagnostics.

## Known false positives

- None recorded.

## Known false negatives

- None recorded.

## Intentional scope boundaries

- ServiceNow Fluent directives are SDK controls; they are not Oxlint or ESLint disable comments and do not suppress this plugin's diagnostics.

## Overlaps

- None recorded.

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **The documented Fluent directives are line- or file-scoped comments consumed by the SDK toolchain.**
  - Verification ID: `rule-evidence-4440bc5b`
  - URL: https://www.servicenow.com/docs/r/api-reference/servicenow-fluent.html
  - Verified by: manual
  - Verified at: 2026-08-20
- **A trailing @fluent-ignore without a following statement reports.**
  - Verification ID: `rule-evidence-f7dd387a`
  - URL: tests/integration/profiles/invalid/dangling-fluent-ignore.now.ts
  - Verified by: integration-test
  - Verified at: 2026-08-20

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
