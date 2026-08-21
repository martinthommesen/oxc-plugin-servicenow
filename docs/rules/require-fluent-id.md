# servicenow/require-fluent-id

Fluent entities must declare `$id` when the selected SDK manifest marks the imported factory as requiring an id. Prefer canonical `Now.ID['descriptive-key']`.

- **Family:** fluent
- **Preset:** recommended
- **Default severity:** error
- **Fixable:** no
- **Suggestions:** no

## Incorrect

### ❌ missing $id

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

### ✅ Now.ID

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

## See also

- [ServiceNow Fluent overview](https://servicenow.github.io/sdk/guides/fluent-overview)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
