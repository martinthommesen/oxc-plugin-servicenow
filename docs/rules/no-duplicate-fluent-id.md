# servicenow/no-duplicate-fluent-id

Two Fluent definitions that share the same static `Now.ID` key as `$id` collide. Cross-file uniqueness is out of scope.

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
- **Implementation:** [`src/rules/no-duplicate-fluent-id.ts`](../../src/rules/no-duplicate-fluent-id.ts)
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

### Incorrect: duplicate top-level ids

```ts
import { BusinessRule } from "@servicenow/sdk/core";

BusinessRule({
  $id: Now.ID["update-assignment"],
  name: "Update assignment",
  table: "incident",
  when: "before",
});

BusinessRule({
  $id: Now.ID["update-assignment"],
  name: "Notify assignment",
  table: "incident",
  when: "after",
});
```

## Correct

### Correct: unique ids

```ts
import { BusinessRule } from "@servicenow/sdk/core";

BusinessRule({
  $id: Now.ID["update-assignment"],
  name: "Update assignment",
  table: "incident",
  when: "before",
});

BusinessRule({
  $id: Now.ID["notify-assignment"],
  name: "Notify assignment",
  table: "incident",
  when: "after",
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

- **Now.ID keys must be unique in a file so keys.ts can track records.**
  - Verification ID: `rule-evidence-4fc018df`
  - URL: https://www.servicenow.com/docs/r/application-development/servicenow-sdk/fluent-constructs.html
  - Verified by: manual
  - Verified at: 2026-08-20
- **Recommended hosts report duplicate Now.ID keys.**
  - Verification ID: `rule-evidence-885beb38`
  - URL: tests/integration/profiles/invalid/duplicate-id.now.ts
  - Verified by: integration-test
  - Verified at: 2026-08-20

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
