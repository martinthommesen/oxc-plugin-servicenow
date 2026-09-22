import { entry, ES5 } from "./entry.js";
import { noAsyncAwait } from "../rules/no-async-await.js";
import * as metadata from "../catalog-metadata.js";

export const noAsyncAwaitEntry = entry("no-async-await", noAsyncAwait, {
  ...metadata.meta(
    metadata.engine(metadata.ES5_MODES),
    [
      metadata.evidenceRecord(
        metadata.SN_JS_FEATURES,
        "async/await is unsupported in Compatibility and ES5 Standards modes.",
        "manual",
        "2026-08-20",
      ),
      metadata.evidenceRecord(
        "tests/rules/no-async-await.test.ts",
        "async functions and await expressions report in ES5 mode.",
        "fixture",
        "2026-08-20",
      ),
    ],
    {
      overlaps: ["servicenow/no-promise", "servicenow/no-async-iterators"],
    },
  ),
  placements: [{ profile: "classic-es5", severity: "error" }],
  optionDescriptor: undefined,
  title: "No async/await",
  family: "engine",
  severity: "error",
  fixable: false,
  hasSuggestions: false,
  description: "async/await is not implemented in Compatibility or ES5 Standards mode.",
  bad: [
    {
      name: "async function",
      filename: "script-include.js",
      settings: ES5,
      code: `async function loadIncident(id) {\n  return await fetchIncident(id);\n}`,
    },
  ],
  good: [
    {
      name: "sync function",
      filename: "script-include.js",
      settings: ES5,
      code: `function loadIncident(id) {\n  var gr = new GlideRecord("incident");\n  return gr.get(id) ? gr : null;\n}`,
    },
  ],
});
