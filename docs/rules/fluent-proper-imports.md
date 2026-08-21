# servicenow/fluent-proper-imports

Fluent entity and column APIs must be imported from the module recorded in the selected SDK manifest. Aliases and namespace imports resolve by lexical binding identity.

- **Family:** fluent
- **Preset:** recommended
- **Default severity:** error
- **Fixable:** no
- **Suggestions:** no

## Incorrect

### ❌ wrong module

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

### ✅ core import

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

## See also

- [ServiceNow Fluent overview](https://servicenow.github.io/sdk/guides/fluent-overview)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
