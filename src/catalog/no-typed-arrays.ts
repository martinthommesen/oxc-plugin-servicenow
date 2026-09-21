import { entry, ES5 } from "./entry.js";
import { noTypedArrays } from "../rules/no-typed-arrays.js";
import * as metadata from "../catalog-metadata.js";

export const noTypedArraysEntry = entry("no-typed-arrays", noTypedArrays, {
  ...metadata.meta(
    metadata.engine(metadata.ALL_INSTANCE_MODES),
    [
      metadata.evidenceRecord(
        metadata.SN_JS_FEATURES,
        "The Zurich table marks general typed-array/DataView constructors Disallowed in ES5 Standards, while BigInt64 arrays and DataView BigInt getters are Not Supported.",
        "manual",
        "2026-08-22",
      ),
      metadata.evidenceRecord(
        metadata.SN_JS_FEATURES_AUSTRALIA,
        "The Australia table marks BigInt64 array constructors Supported in ES2021 and Not Supported in ES5; DataView BigInt getters remain Not Supported.",
        "manual",
        "2026-08-22",
      ),
      metadata.evidenceRecord(
        metadata.SN_JS_ENGINE_UPDATES_AUSTRALIA,
        "The Australia engine update lists Rhino PR 1966 as adding TypedArray.from and TypedArray.of in ES2021 mode.",
        "manual",
        "2026-08-24",
      ),
      metadata.evidenceRecord(
        metadata.SN_JS_MODES,
        "ServiceNow documents Compatibility as a third mode; the plugin explicitly applies ES5 feature cells to it as package policy.",
        "manual",
        "2026-08-22",
      ),
      metadata.evidenceRecord(
        "tests/rules/glide-and-engine.test.ts",
        "Fixtures cover constructor-independent Zurich factory diagnostics, method guards, release omission, constructors, aliases, DataView BigInt getters, mutation, and namespace escape.",
        "fixture",
        "2026-08-24",
      ),
      metadata.evidenceRecord(
        "tests/integration/release-contracts.test.ts",
        "Real Oxlint and ESLint contracts verify general TypedArray factories in Zurich, Australia, and omitted-release ES2021 configurations.",
        "integration-test",
        "2026-08-24",
      ),
    ],
    {
      overlaps: ["servicenow/no-unsupported-syntax"],
    },
  ),
  placements: [
    { profile: "classic-es5", severity: "error" },
    { profile: "es2021", severity: "error" },
  ],
  optionDescriptor: undefined,
  limitationCases: [
    {
      caseId: "typed-array-dataview-setters-unreviewed",
      kind: "scope-boundary",
      description:
        "DataView BigInt setters stay silent because the reviewed ServiceNow tables establish only the getter methods.",
      name: "DataView BigInt setter",
      filename: "script-include.js",
      settings: { javascriptMode: "es2021", release: "australia" },
      code: `var view = new DataView(buffer);\nview.setBigInt64(0, value);`,
    },
    {
      caseId: "typed-array-visible-dataview-replacement",
      kind: "scope-boundary",
      description:
        "Any possible direct constructor, prototype, or instance-method write in the file conservatively suppresses affected diagnostics, regardless of source order.",
      name: "visible DataView method replacement",
      filename: "polyfill.script-include.js",
      settings: { javascriptMode: "es2021", release: "australia" },
      code: `var view = new DataView(buffer);
view.getBigInt64 = custom;
view.getBigInt64(0);`,
    },
    {
      caseId: "typed-array-escaped-namespace",
      kind: "scope-boundary",
      description:
        "Passing a typed-array constructor or DataView.prototype to unknown code suppresses affected method diagnostics because that code can install replacements.",
      name: "escaped DataView prototype",
      filename: "polyfill.script-include.js",
      settings: { javascriptMode: "es2021", release: "australia" },
      code: `installPolyfills(DataView.prototype);
new DataView(buffer).getBigInt64(0);`,
    },
    {
      caseId: "typed-array-mutator-authority",
      kind: "false-negative",
      description:
        "Calls through a reassigned property-mutation helper are treated as unknown; the rule does not assume the custom helper failed to install a DataView method.",
      name: "reassigned DataView mutation helper",
      filename: "custom-runtime.server.js",
      settings: { javascriptMode: "es2021", release: "australia" },
      code: `Object.defineProperty = undefined;
Object.defineProperty(DataView.prototype, "getBigInt64", { value: custom });
new DataView(buffer).getBigInt64(0);`,
    },
  ],
  title: "No TypedArray / DataView",
  family: "engine",
  severity: "error",
  fixable: false,
  hasSuggestions: false,
  description:
    "General TypedArray constructors and DataView construction are Disallowed by the ES5 cell, while BigInt64Array and BigUint64Array are Not Supported there. Zurich ES2021 supports general constructors but not static TypedArray.from/of factories; Australia adds those factories and Supports BigInt arrays. DataView BigInt getters remain Not Supported. Compatibility follows ES5 by package policy.",
  bad: [
    {
      name: "Int8Array",
      filename: "script-include.js",
      settings: ES5,
      code: `var bytes = new Int8Array(16);`,
    },
    {
      name: "DataView BigInt getter",
      filename: "script-include.js",
      settings: { javascriptMode: "es2021", release: "australia" },
      code: `var view = new DataView(buffer);\nvar value = view.getBigInt64(0);`,
    },
    {
      name: "Int8Array static factory in Zurich",
      filename: "script-include.js",
      settings: { javascriptMode: "es2021", release: "zurich" },
      code: `var values = Int8Array.from(source);`,
    },
    {
      name: "BigInt64Array static factory in Zurich",
      filename: "script-include.js",
      settings: { javascriptMode: "es2021", release: "zurich" },
      code: `var values = BigInt64Array.from(source);`,
    },
  ],
  good: [
    { name: "plain array", filename: "script-include.js", code: `var bytes = [0, 1, 2];` },
    {
      name: "Int8Array static factory in Australia",
      filename: "script-include.js",
      settings: { javascriptMode: "es2021", release: "australia" },
      code: `var values = Int8Array.from(source);`,
    },
  ],
});
