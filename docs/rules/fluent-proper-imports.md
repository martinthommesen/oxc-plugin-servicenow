# servicenow/fluent-proper-imports

Fluent entity and column APIs must be imported from `@servicenow/sdk/core`.

- **Family:** fluent
- **Preset:** recommended
- **Placements:** recommended (error), fluent (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** fluent
- **Surfaces:** Fluent `.now.ts` metadata only
- **JavaScript mode:** Not instance-executed
- **Implementation:** [`src/rules/fluent-proper-imports.ts`](../../src/rules/fluent-proper-imports.ts)
- **Fluent manifest:** sdk-docs-2026-03

## Incorrect

### Incorrect: wrong module

```ts
import { BusinessRule } from "@servicenow/sdk";

BusinessRule({
  $id: Now.ID["log-change"],
  table: "incident",
  name: "Log change",
  when: "after",
  action: ["update"],
});
```

## Correct

### Correct: core import

```ts
import { BusinessRule } from "@servicenow/sdk/core";

BusinessRule({
  $id: Now.ID["log-change"],
  table: "incident",
  name: "Log change",
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
