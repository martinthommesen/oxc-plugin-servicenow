# servicenow/no-complex-fluent-logic

Optional architectural policy. `.now.ts` files should declare metadata. Loops, classes, try/catch, and multi-statement functions belong in `src/server/`. Not enabled in recommended or strict.

- **Family:** fluent
- **Preset:** off
- **Default severity:** warn
- **Fixable:** no
- **Suggestions:** no
- **Fluent manifest:** sdk-docs-2026-03

## Incorrect

### ❌ runtime loop

```ts
import { Record } from "@servicenow/sdk/core";

for (var i = 0; i < 10; i++) {
  Record({
    $id: Now.ID["seed-" + i],
    table: "incident",
    data: { short_description: "n" },
  });
}
```

## Correct

### ✅ declarative records

```ts
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
