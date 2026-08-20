# servicenow/no-now-id-as-reference

`Now.ID[...]` is a metadata identity, not a reference. Alias meaning is read at the use site from lexical binding identity. Use the factory object in-app or `Now.ref()` for external records. Evidence: https://www.servicenow.com/docs/r/application-development/servicenow-sdk/fluent-constructs.html

- **Family:** fluent
- **Preset:** recommended
- **Placements:** recommended (error), fluent (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** fluent
- **Surfaces:** Fluent `.now.ts` metadata only.
- **JavaScript mode:** Not instance-executed, or independent of JavaScript mode unless a rule documents a mode gate.
- **Last verified:** 2026-08-20
- **Implementation:** [`src/rules/no-now-id-as-reference.ts`](../../src/rules/no-now-id-as-reference.ts)
- **Fluent manifest:** sdk-docs-2026-03
- **Fluent SDK versions:** 3.0.0, 4.1.0 (unspecified selects 4.1.0)

## Applicability

| Dimension | Value |
| --- | --- |
| Authoring | fluent |
| Surfaces | Fluent `.now.ts` metadata only. |
| Minimum surface confidence | filename-inferred |
| JavaScript modes | n/a |
| Application scopes | global, scoped, unknown |
| ServiceNow releases | zurich |
| Fluent SDK range | 3.0.0 \|\| 4.1.0 |

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| _(none)_ | | | This rule has no options. |

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

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. False positive: Local objects named Now that are not the platform global. False negative: Ids copied through unknown helpers.

## Known false positives

- Local objects named Now that are not the platform global.

## Known false negatives

- Ids copied through unknown helpers.

## Overlaps

- `servicenow/require-fluent-id`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **Now.ID is a metadata identity, not an in-app record reference.**
  - URL: https://www.servicenow.com/docs/r/application-development/servicenow-sdk/fluent-constructs.html
  - Verified by: declaration-snapshot
  - Verified at: 2026-08-20
- **Recommended hosts report Now.ID used as a reference field.**
  - URL: tests/integration/profiles/invalid/now-id-ref.now.ts
  - Verified by: integration-test
  - Verified at: 2026-08-20

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
