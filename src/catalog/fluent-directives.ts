import { entry } from "./entry.js";
import { fluentDirectives } from "../rules/fluent-directives.js";
import * as metadata from "../catalog-metadata.js";

export const fluentDirectivesEntry = entry("fluent-directives", fluentDirectives, {
  ...metadata.meta(
    metadata.fluent(),
    [
      metadata.evidenceRecord(
        metadata.SN_FLUENT,
        "The documented Fluent directives are line- or file-scoped comments consumed by the SDK toolchain.",
        "manual",
        "2026-08-20",
      ),
      metadata.evidenceRecord(
        "tests/integration/profiles/invalid/dangling-fluent-ignore.now.ts",
        "A trailing @fluent-ignore without a following statement reports.",
        "integration-test",
        "2026-08-20",
      ),
    ],
    {
      overlaps: [],
    },
  ),
  placements: [
    { profile: "recommended", severity: "warn" },
    { profile: "fluent", severity: "warn" },
  ] as const,
  optionDescriptor: undefined,
  limitationCases: [
    {
      caseId: "fluent-directives-no-lint-suppression",
      kind: "scope-boundary",
      description:
        "ServiceNow Fluent directives are SDK controls; they are not Oxlint or ESLint disable comments and do not suppress this plugin's diagnostics.",
      name: "lint suppression boundary",
      filename: "incident.now.ts",
      code: `import { Record } from "@servicenow/sdk/core";

// @fluent-ignore
Record({ table: "incident", data: {} });`,
    },
  ],
  title: "Fluent directives",
  family: "fluent",
  severity: "warn",
  fixable: false,
  hasSuggestions: false,
  description:
    "Validate documented ServiceNow Fluent SDK directive names and placement. SDK directives are not Oxlint or ESLint disable comments.",
  bad: [
    {
      name: "typo + ts-ignore",
      filename: "incident.now.ts",
      code: `// @ts-ignore\n// @fluent-ignre\nexport const demo = 1;`,
    },
  ],
  good: [
    {
      name: "documented directive",
      filename: "incident.now.ts",
      code: `// @fluent-disable-sync\nimport { Record } from "@servicenow/sdk/core";\n\nRecord({\n  $id: Now.ID["seed-incident"],\n  table: "incident",\n  data: { short_description: "Seed" },\n});`,
    },
  ],
});
