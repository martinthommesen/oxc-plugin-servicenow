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
- **JavaScript mode:** Not instance-executed. Factory rules use the selected `fluentSdkVersion` manifest.
- **Last verified:** 2026-08-19
- **Implementation:** [`src/rules/fluent-naming-convention.ts`](../../src/rules/fluent-naming-convention.ts)
- **Fluent manifest:** sdk-docs-2026-03
- **Fluent SDK versions:** 3.0.0, 4.1.0 (unspecified selects 4.1.0)

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `idStyle` | "kebab-case" | "snake_case" | "either" | `"kebab-case"` | Required style for `Now.ID` keys. |
| `fileStyle` | "kebab-case" | "snake_case" | "either" | `"kebab-case"` | Required style for `.now.ts` filenames. |

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
