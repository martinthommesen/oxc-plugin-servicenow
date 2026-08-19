# servicenow/no-now-id-as-reference

`Now.ID[...]` is a metadata identity, not a reference. Use the factory object in-app or `Now.ref()` for external records. Evidence: https://www.servicenow.com/docs/r/application-development/servicenow-sdk/fluent-constructs.html

- **Family:** fluent
- **Preset:** recommended
- **Default severity:** error
- **Fixable:** no
- **Suggestions:** no
- **Fluent manifest:** sdk-docs-2026-03

## Incorrect

### ❌ Now.ID in another property

```ts
import { CatalogItem, VariableSet } from "@servicenow/sdk/core";

const userInformation = VariableSet({
  $id: Now.ID["user-information"],
  title: "User information",
});

CatalogItem({
  $id: Now.ID["software-request"],
  variableSets: [{ variableSet: Now.ID["user-information"], order: 100 }],
});
```

## Correct

### ✅ factory object reference

```ts
import { CatalogItem, VariableSet } from "@servicenow/sdk/core";

const userInformation = VariableSet({
  $id: Now.ID["user-information"],
  title: "User information",
});

CatalogItem({
  $id: Now.ID["software-request"],
  flow: Now.ref("sys_hub_flow", "existing-flow-id"),
  variableSets: [{ variableSet: userInformation, order: 100 }],
});
```

## See also

- [ServiceNow Fluent overview](https://servicenow.github.io/sdk/guides/fluent-overview)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
