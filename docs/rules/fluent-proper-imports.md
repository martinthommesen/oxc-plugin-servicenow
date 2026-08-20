# servicenow/fluent-proper-imports

Fluent entity and column APIs must be imported from the module recorded in the selected SDK manifest. Aliases and namespace imports resolve by lexical binding identity.

- **Family:** fluent
- **Preset:** recommended
- **Placements:** recommended (error), fluent (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** fluent
- **Surfaces:** Fluent `.now.ts` metadata only
- **JavaScript mode:** Not instance-executed. Factory rules use the selected `fluentSdkVersion` manifest.
- **Last verified:** 2026-08-20
- **Implementation:** [`src/rules/fluent-proper-imports.ts`](../../src/rules/fluent-proper-imports.ts)
- **Fluent manifest:** sdk-docs-2026-03
- **Fluent SDK versions:** 3.0.0, 4.1.0 (unspecified selects 4.1.0)

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| _(none)_ | | | This rule has no options. |

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
