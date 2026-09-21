import { entry } from "./entry.js";
import { preferNowInclude } from "../rules/prefer-now-include.js";
import * as metadata from "../catalog-metadata.js";
import { preferNowIncludeOptions } from "../options/index.js";

export const preferNowIncludeEntry = entry("prefer-now-include", preferNowInclude, {
  ...metadata.meta(
    metadata.fluent(),
    [
      metadata.evidenceRecord(
        metadata.SN_FLUENT_CONSTRUCTS,
        "Now.include() loads script and markup files so Fluent metadata stays declarative.",
        "manual",
        "2026-08-20",
      ),
      metadata.evidenceRecord(
        "src/catalog/prefer-now-include.ts",
        "Catalog examples cover large inline script versus Now.include.",
        "fixture",
        "2026-08-20",
      ),
    ],
    {
      overlaps: ["servicenow/no-complex-fluent-logic"],
    },
  ),
  placements: [{ profile: "strict", severity: "warn" }],
  optionDescriptor: preferNowIncludeOptions,
  title: "Prefer Now.include()",
  family: "fluent",
  severity: "warn",
  fixable: false,
  hasSuggestions: false,
  description:
    "Large inline `script` / HTML / CSS payloads belong in their own file and should be loaded with `Now.include()`.",
  bad: [
    {
      name: "inline novel",
      filename: "log-state.now.ts",
      code: `import { BusinessRule } from "@servicenow/sdk/core";\n\nBusinessRule({\n  $id: Now.ID["log-state"],\n  table: "incident",\n  name: "Log state",\n  when: "after",\n  action: ["update"],\n  script: \`\n    (function executeRule(current, previous) {\n      var gr = new GlideRecord("sys_journal_field");\n      gr.initialize();\n      gr.element_id = current.sys_id;\n      gr.value = "state changed";\n      gr.insert();\n      gs.info(current.number);\n      gs.info(previous.state);\n      gs.info(current.state);\n    })(current, previous);\n  \`,\n});`,
    },
  ],
  good: [
    {
      name: "Now.include",
      filename: "log-state.now.ts",
      code: `import { BusinessRule } from "@servicenow/sdk/core";\n\nBusinessRule({\n  $id: Now.ID["log-state"],\n  table: "incident",\n  name: "Log state",\n  when: "after",\n  action: ["update"],\n  script: Now.include("../server/log-state.server.js"),\n});`,
    },
  ],
});
