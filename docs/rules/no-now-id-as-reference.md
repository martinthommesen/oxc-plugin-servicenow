# servicenow/no-now-id-as-reference

`Now.ID[...]` is a metadata identity, not a reference. Use the factory object in-app or `Now.ref()` for external records. Evidence: https://www.servicenow.com/docs/r/application-development/servicenow-sdk/fluent-constructs.html

- **Family:** fluent
- **Preset:** recommended
- **Placements:** recommended (error), fluent (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** fluent
- **Surfaces:** Fluent `.now.ts` metadata only
- **JavaScript mode:** Not instance-executed
- **Implementation:** [`src/rules/no-now-id-as-reference.ts`](../../src/rules/no-now-id-as-reference.ts)
- **Fluent manifest:** sdk-docs-2026-03

## Incorrect

### Incorrect: Now.ID in another property

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

### Correct: factory object reference

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

## Limitations

When provenance, surface, or JavaScript mode is unknown, the rule stays silent instead of guessing.

## Evidence

- https://www.servicenow.com/docs/r/application-development/servicenow-sdk/fluent-constructs.html

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
