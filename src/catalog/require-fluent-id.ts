import { entry } from "./entry.js";
import { requireFluentId } from "../rules/require-fluent-id.js";
import * as metadata from "../catalog-metadata.js";
import { requireFluentIdOptions } from "../options/index.js";

export const requireFluentIdEntry = entry("require-fluent-id", requireFluentId, {
  ...metadata.meta(
    metadata.fluent(),
    [
      metadata.evidenceRecord(
        metadata.SN_FLUENT_CONSTRUCTS,
        "Factories whose manifest marks $id as required must declare Now.ID or an equivalent id.",
        "manual",
        "2026-08-20",
      ),
      metadata.evidenceRecord(
        "tests/integration/profiles/invalid/fluent-alias-missing-id.now.ts",
        "Aliased factory imports still require $id under recommended.",
        "integration-test",
        "2026-08-20",
      ),
    ],
    {
      overlaps: ["servicenow/no-duplicate-fluent-id", "servicenow/no-now-id-as-reference"],
    },
  ),
  placements: [
    { profile: "recommended", severity: "error" },
    { profile: "fluent", severity: "error" },
  ],
  optionDescriptor: requireFluentIdOptions,
  title: "Require Fluent $id",
  family: "fluent",
  severity: "error",
  fixable: false,
  hasSuggestions: false,
  description:
    "Fluent entities must declare `$id` when the selected SDK manifest marks the imported factory as requiring an id. Prefer canonical `Now.ID['descriptive-key']`.",
  bad: [
    {
      name: "missing $id",
      filename: "log-state.now.ts",
      code: `import { BusinessRule } from "@servicenow/sdk/core";\n\nBusinessRule({\n  table: "incident",\n  name: "Log state",\n  when: "after",\n  action: ["update"],\n});`,
    },
  ],
  good: [
    {
      name: "Now.ID",
      filename: "log-state.now.ts",
      code: `import { BusinessRule } from "@servicenow/sdk/core";\n\nBusinessRule({\n  $id: Now.ID["log-state"],\n  table: "incident",\n  name: "Log state",\n  when: "after",\n  action: ["update"],\n});`,
    },
  ],
});
