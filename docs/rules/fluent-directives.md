# servicenow/fluent-directives

Validate `@fluent-ignore`, `@fluent-disable-sync`, and `@fluent-disable-sync-for-file`, catch typos, and reject `@ts-ignore` as a Fluent suppress.

- **Family:** fluent
- **Preset:** recommended
- **Placements:** recommended (warn), fluent (warn)
- **Default severity:** warn
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** fluent
- **Surfaces:** Fluent `.now.ts` metadata only
- **JavaScript mode:** Not instance-executed
- **Last verified:** 2026-08-19
- **Implementation:** [`src/rules/fluent-directives.ts`](../../src/rules/fluent-directives.ts)
- **Fluent manifest:** sdk-docs-2026-03

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

When provenance, surface, or JavaScript mode is unknown, the rule stays silent instead of guessing.

## Evidence

- None recorded. Add an authoritative ServiceNow or Oxc link before expanding this rule.

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
