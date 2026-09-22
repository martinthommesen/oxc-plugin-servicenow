import { entry } from "./entry.js";
import { fluentProperImports } from "../rules/fluent-proper-imports.js";
import * as metadata from "../catalog-metadata.js";

export const fluentProperImportsEntry = entry("fluent-proper-imports", fluentProperImports, {
  ...metadata.meta(
    metadata.fluent(),
    [
      metadata.evidenceRecord(
        metadata.SN_FLUENT,
        "Fluent factories are imported from the documented @servicenow/sdk modules.",
        "manual",
        "2026-08-20",
      ),
      metadata.evidenceRecord(
        "tests/integration/fixtures/bad-fluent.now.ts",
        "Host fixtures report factories imported from the wrong module.",
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
      caseId: "fluent-proper-imports-local-factory",
      kind: "scope-boundary",
      description: "Local functions that share a Fluent factory name are not SDK factories.",
      name: "local factory function",
      filename: "local-factory.now.ts",
      code: `function BusinessRule(value) { return value; }
BusinessRule({ table: "incident" });`,
    },
  ],
  title: "Fluent imports from @servicenow/sdk/core",
  family: "fluent",
  severity: "error",
  fixable: false,
  hasSuggestions: false,
  description:
    "Fluent entity and column APIs must be imported from the module recorded in the selected SDK manifest. Aliases and namespace imports resolve by lexical binding identity.",
  bad: [
    {
      name: "wrong module",
      filename: "incident.now.ts",
      code: `import { BusinessRule } from "@servicenow/sdk";\n\nBusinessRule({\n  $id: Now.ID["log-change"],\n  table: "incident",\n  name: "Log change",\n  when: "after",\n  action: ["update"],\n});`,
    },
  ],
  good: [
    {
      name: "core import",
      filename: "incident.now.ts",
      code: `import { BusinessRule } from "@servicenow/sdk/core";\n\nBusinessRule({\n  $id: Now.ID["log-change"],\n  table: "incident",\n  name: "Log change",\n  when: "after",\n  action: ["update"],\n});`,
    },
  ],
});
