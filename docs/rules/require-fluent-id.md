# servicenow/require-fluent-id

Fluent entities must declare `$id`. Prefer `Now.ID['descriptive-key']` so `keys.ts` stays readable.

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
- **Implementation:** [`src/rules/require-fluent-id.ts`](../../src/rules/require-fluent-id.ts)
- **Fluent manifest:** sdk-docs-2026-03

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

When provenance, surface, or JavaScript mode is unknown, the rule stays silent instead of guessing.

## Evidence

- None recorded. Add an authoritative ServiceNow or Oxc link before expanding this rule.

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
