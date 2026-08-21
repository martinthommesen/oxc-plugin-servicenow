# servicenow/no-duplicate-fluent-id

Two Fluent definitions that share the same static `Now.ID` key as `$id` collide. Cross-file uniqueness is out of scope.

- **Family:** fluent
- **Preset:** recommended
- **Default severity:** error
- **Fixable:** no
- **Suggestions:** no

## Incorrect

### ❌ duplicate top-level ids

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

### ✅ unique ids

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

## See also

- [ServiceNow Fluent overview](https://servicenow.github.io/sdk/guides/fluent-overview)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
