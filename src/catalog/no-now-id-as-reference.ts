import { entry } from "./entry.js";
import { noNowIdAsReference } from "../rules/no-now-id-as-reference.js";
import * as metadata from "../catalog-metadata.js";

export const noNowIdAsReferenceEntry = entry("no-now-id-as-reference", noNowIdAsReference, {
  ...metadata.meta(
    metadata.fluent(),
    [
      metadata.evidenceRecord(
        metadata.SN_FLUENT_CONSTRUCTS,
        "Now.ID is a metadata identity, not an in-app record reference.",
        "manual",
        "2026-08-20",
      ),
      metadata.evidenceRecord(
        "tests/integration/profiles/invalid/now-id-ref.now.ts",
        "Recommended hosts report Now.ID used as a reference field.",
        "integration-test",
        "2026-08-20",
      ),
    ],
    {
      overlaps: ["servicenow/require-fluent-id"],
    },
  ),
  placements: [
    { profile: "recommended", severity: "error" },
    { profile: "fluent", severity: "error" },
  ] as const,
  optionDescriptor: undefined,
  limitationCases: [
    {
      caseId: "no-now-id-local-now",
      kind: "scope-boundary",
      description: "Local objects named Now are not the SDK namespace.",
      name: "local Now object",
      filename: "local-now.now.ts",
      code: `const Now = { ID: { task: "local" } };
const value = Now.ID.task;`,
    },
  ],
  title: "No Now.ID as a reference",
  family: "fluent",
  severity: "error",
  fixable: false,
  hasSuggestions: false,
  description:
    "`Now.ID[...]` is a metadata identity, not a reference. Alias meaning is read at the use site from lexical binding identity. Use the factory object in-app or `Now.ref()` for external records. Evidence: https://www.servicenow.com/docs/r/application-development/servicenow-sdk/fluent-constructs.html",
  bad: [
    {
      name: "Now.ID in another property",
      filename: "catalog.now.ts",
      code: `import { CatalogItem, VariableSet } from "@servicenow/sdk/core";\n\nconst userInformation = VariableSet({\n  $id: Now.ID["user-information"],\n  title: "User information",\n});\n\nCatalogItem({\n  $id: Now.ID["software-request"],\n  variableSets: [{ variableSet: Now.ID["user-information"], order: 100 }],\n});`,
    },
  ],
  good: [
    {
      name: "factory object reference",
      filename: "catalog.now.ts",
      code: `import { CatalogItem, VariableSet } from "@servicenow/sdk/core";\n\nconst userInformation = VariableSet({\n  $id: Now.ID["user-information"],\n  title: "User information",\n});\n\nCatalogItem({\n  $id: Now.ID["software-request"],\n  flow: Now.ref("sys_hub_flow", "existing-flow-id"),\n  variableSets: [{ variableSet: userInformation, order: 100 }],\n});`,
    },
  ],
});
