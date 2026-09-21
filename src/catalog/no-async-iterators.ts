import { entry } from "./entry.js";
import { noAsyncIterators } from "../rules/no-async-iterators.js";
import * as metadata from "../catalog-metadata.js";

export const noAsyncIteratorsEntry = entry("no-async-iterators", noAsyncIterators, {
  ...metadata.meta(
    metadata.engine(metadata.ALL_INSTANCE_MODES),
    [
      metadata.evidenceRecord(
        metadata.SN_JS_FEATURES,
        "for await...of and async generators are disallowed in every instance JavaScript mode.",
        "manual",
        "2026-08-20",
      ),
      metadata.evidenceRecord(
        "tests/integration/profiles/invalid/es2021-async-iter.server.js",
        "Oxlint with es2021 still flags async iteration.",
        "integration-test",
        "2026-08-20",
      ),
    ],
    {
      overlaps: ["servicenow/no-async-await"],
    },
  ),
  placements: [
    { profile: "recommended", severity: "error" },
    { profile: "classic-es5", severity: "error" },
    { profile: "es2021", severity: "error" },
  ],
  optionDescriptor: undefined,
  title: "No async iterators",
  family: "engine",
  severity: "error",
  fixable: false,
  hasSuggestions: false,
  description:
    "`for await…of` and async generators are disallowed in every instance JavaScript mode, including ES2021.",
  bad: [
    {
      name: "for await",
      filename: "script-include.js",
      code: `async function drain(items) {\n  for await (var item of items) {\n    gs.info(item);\n  }\n}`,
    },
  ],
  good: [
    {
      name: "for of",
      filename: "script-include.js",
      code: `function drain(items) {\n  for (var i = 0; i < items.length; i++) {\n    gs.info(items[i]);\n  }\n}`,
    },
  ],
});
