# servicenow/no-duplicate-fluent-id

Two Fluent definitions that share the same static `Now.ID` key as `$id` collide. Cross-file uniqueness is out of scope.

- **Family:** fluent
- **Preset:** recommended
- **Placements:** recommended (error), fluent (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** fluent
- **Surfaces:** Fluent `.now.ts` metadata only
- **JavaScript mode:** Not instance-executed
- **Last verified:** 2026-08-19
- **Implementation:** [`src/rules/no-duplicate-fluent-id.ts`](../../src/rules/no-duplicate-fluent-id.ts)
- **Fluent manifest:** sdk-docs-2026-03

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

When provenance, surface, or JavaScript mode is unknown, the rule stays silent instead of guessing.

## Evidence

- None recorded. Add an authoritative ServiceNow or Oxc link before expanding this rule.

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
