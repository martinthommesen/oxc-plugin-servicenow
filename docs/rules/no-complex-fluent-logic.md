# servicenow/no-complex-fluent-logic

Optional architectural policy. `.now.ts` files should declare metadata. Loops, classes, try/catch, and multi-statement functions belong in `src/server/`. Not enabled in recommended or strict.

- **Family:** fluent
- **Preset:** policy
- **Placements:** policy (warn)
- **Default severity:** warn
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** fluent
- **Surfaces:** Fluent `.now.ts` metadata only
- **JavaScript mode:** Not instance-executed
- **Last verified:** 2026-08-19
- **Implementation:** [`src/rules/no-complex-fluent-logic.ts`](../../src/rules/no-complex-fluent-logic.ts)
- **Fluent manifest:** sdk-docs-2026-03

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

When provenance, surface, or JavaScript mode is unknown, the rule stays silent instead of guessing.

## Evidence

- None recorded. Add an authoritative ServiceNow or Oxc link before expanding this rule.

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
