# servicenow/fluent-naming-convention

`.now.ts` files and `Now.ID` keys should be kebab-case. Exported `Table` bindings should match the table `name`.

- **Family:** fluent
- **Preset:** strict
- **Placements:** strict (warn)
- **Default severity:** warn
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** fluent
- **Surfaces:** Fluent `.now.ts` metadata only
- **JavaScript mode:** Not instance-executed
- **Implementation:** [`src/rules/fluent-naming-convention.ts`](../../src/rules/fluent-naming-convention.ts)
- **Fluent manifest:** sdk-docs-2026-03

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

When provenance, surface, or JavaScript mode is unknown, the rule stays silent instead of guessing.

## Evidence

- None recorded. Add an authoritative ServiceNow or Oxc link before expanding this rule.

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
