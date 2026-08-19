# servicenow/fluent-directives

Validate `@fluent-ignore` and `@fluent-disable-sync`, catch typos, and reject `@ts-ignore` as a Fluent suppress.

- **Family:** fluent
- **Preset:** recommended
- **Default severity:** warn
- **Fixable:** no
- **Suggestions:** yes

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
