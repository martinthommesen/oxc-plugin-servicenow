import { entry } from "./entry.js";
import { fluentNamingConvention } from "../rules/fluent-naming-convention.js";
import * as metadata from "../catalog-metadata.js";
import { fluentNamingConventionOptions } from "../options/index.js";

export const fluentNamingConventionEntry = entry(
  "fluent-naming-convention",
  fluentNamingConvention,
  {
    ...metadata.meta(
      metadata.fluent(),
      [
        metadata.evidenceRecord(
          metadata.SN_FLUENT,
          "Fluent file stems and Now.ID keys should stay stable kebab-case or snake_case identifiers.",
          "manual",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "src/catalog.ts",
          "Catalog examples cover PascalCase files and kebab-case corrections.",
          "fixture",
          "2026-08-20",
        ),
      ],
      {
        overlaps: ["servicenow/require-fluent-id"],
      },
    ),
    placements: [{ profile: "strict", severity: "warn" }] as const,
    optionDescriptor: fluentNamingConventionOptions,
    limitationCases: [],
    title: "Fluent naming convention",
    family: "fluent",
    severity: "warn",
    fixable: false,
    hasSuggestions: false,
    description:
      "`.now.ts` files and `Now.ID` keys should be kebab-case. Exported `Table` bindings should match the table `name`.",
    bad: [
      {
        name: "PascalCase file + id",
        filename: "LogState.now.ts",
        code: `import { BusinessRule } from "@servicenow/sdk/core";\n\nBusinessRule({\n  $id: Now.ID["LogState"],\n  table: "incident",\n  name: "Log state",\n});`,
      },
    ],
    good: [
      {
        name: "kebab-case",
        filename: "log-state.now.ts",
        code: `import { BusinessRule } from "@servicenow/sdk/core";\n\nBusinessRule({\n  $id: Now.ID["log-state"],\n  table: "incident",\n  name: "Log state",\n});`,
      },
    ],
  },
);
