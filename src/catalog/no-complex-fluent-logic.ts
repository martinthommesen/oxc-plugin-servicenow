import { entry } from "./entry.js";
import { noComplexFluentLogic } from "../rules/no-complex-fluent-logic.js";
import * as metadata from "../catalog-metadata.js";

export const noComplexFluentLogicEntry = entry("no-complex-fluent-logic", noComplexFluentLogic, {
  ...metadata.meta(
    metadata.fluent(),
    [
      metadata.evidenceRecord(
        metadata.SN_FLUENT,
        "Fluent .now.ts files declare metadata; runtime loops belong in src/server.",
        "manual",
        "2026-08-20",
      ),
      metadata.evidenceRecord(
        "tests/rules/fluent.test.ts",
        "Fixtures cover loops, async functions, function expressions, and arrow-function complexity thresholds.",
        "fixture",
        "2026-08-22",
      ),
    ],
    {
      overlaps: ["servicenow/prefer-now-include"],
    },
  ),
  placements: [{ profile: "policy", severity: "warn" }] as const,
  optionDescriptor: undefined,
  limitationCases: [],
  title: "No complex Fluent logic",
  family: "fluent",
  severity: "warn",
  fixable: false,
  hasSuggestions: false,
  description:
    "Optional architectural policy. `.now.ts` files should declare metadata. Loops, classes, try/catch, and multi-statement functions belong in `src/server/`. Not enabled in recommended or strict.",
  bad: [
    {
      name: "runtime loop",
      filename: "seed.now.ts",
      code: `import { Record } from "@servicenow/sdk/core";\n\nfor (var i = 0; i < 10; i++) {\n  Record({\n    $id: Now.ID["seed-" + i],\n    table: "incident",\n    data: { short_description: "n" },\n  });\n}`,
    },
  ],
  good: [
    {
      name: "declarative records",
      filename: "seed.now.ts",
      code: `import { Record } from "@servicenow/sdk/core";\n\nRecord({\n  $id: Now.ID["seed-incident"],\n  table: "incident",\n  data: { short_description: "Seed" },\n});`,
    },
  ],
});
