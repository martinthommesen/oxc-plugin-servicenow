# servicenow/fluent-directives

Validate `@fluent-ignore`, `@fluent-disable-sync`, and `@fluent-disable-sync-for-file` against the selected SDK manifest. Previous-line directives attach to the next statement. Catch typos and reject `@ts-ignore` as a Fluent suppress.

- **Family:** fluent
- **Preset:** recommended
- **Default severity:** warn
- **Fixable:** no
- **Suggestions:** no

## Incorrect

### ❌ typo + ts-ignore

```ts
// @ts-ignore
// @fluent-ignre
export const demo = 1;
```

## Correct

### ✅ documented directive

```ts
// @fluent-disable-sync
import { Record } from "@servicenow/sdk/core";

Record({
  $id: Now.ID["seed-incident"],
  table: "incident",
  data: { short_description: "Seed" },
});
```

## See also

- [ServiceNow Fluent overview](https://servicenow.github.io/sdk/guides/fluent-overview)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
