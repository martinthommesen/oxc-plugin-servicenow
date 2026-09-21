import { entry } from "./entry.js";
import { noDuplicateFluentId } from "../rules/no-duplicate-fluent-id.js";
import * as metadata from "../catalog-metadata.js";

export const noDuplicateFluentIdEntry = entry("no-duplicate-fluent-id", noDuplicateFluentId, {
  ...metadata.meta(
    metadata.fluent(),
    [
      metadata.evidenceRecord(
        metadata.SN_FLUENT_CONSTRUCTS,
        "Now.ID keys must be unique in a file so keys.ts can track records.",
        "manual",
        "2026-08-20",
      ),
      metadata.evidenceRecord(
        "tests/integration/profiles/invalid/duplicate-id.now.ts",
        "Recommended hosts report duplicate Now.ID keys.",
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
  ],
  optionDescriptor: undefined,
  title: "No duplicate Fluent $id",
  family: "fluent",
  severity: "error",
  fixable: false,
  hasSuggestions: false,
  description:
    "Two Fluent definitions that share the same static `Now.ID` key as `$id` collide. Cross-file uniqueness is out of scope.",
  bad: [
    {
      name: "duplicate top-level ids",
      filename: "rules.now.ts",
      code: `import { BusinessRule } from "@servicenow/sdk/core";\n\nBusinessRule({\n  $id: Now.ID["update-assignment"],\n  name: "Update assignment",\n  table: "incident",\n  when: "before",\n});\n\nBusinessRule({\n  $id: Now.ID["update-assignment"],\n  name: "Notify assignment",\n  table: "incident",\n  when: "after",\n});`,
    },
  ],
  good: [
    {
      name: "unique ids",
      filename: "rules.now.ts",
      code: `import { BusinessRule } from "@servicenow/sdk/core";\n\nBusinessRule({\n  $id: Now.ID["update-assignment"],\n  name: "Update assignment",\n  table: "incident",\n  when: "before",\n});\n\nBusinessRule({\n  $id: Now.ID["notify-assignment"],\n  name: "Notify assignment",\n  table: "incident",\n  when: "after",\n});`,
    },
  ],
});
