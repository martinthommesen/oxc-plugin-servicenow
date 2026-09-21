import { entry, ES5 } from "./entry.js";
import { noAtMethod } from "../rules/no-at-method.js";
import * as metadata from "../catalog-metadata.js";

export const noAtMethodEntry = entry("no-at-method", noAtMethod, {
  ...metadata.meta(
    metadata.engine(metadata.ES5_MODES),
    [
      metadata.evidenceRecord(
        metadata.SN_JS_FEATURES,
        "Array.prototype.at is unsupported in Compatibility and ES5 Standards modes.",
        "manual",
        "2026-08-20",
      ),
      metadata.evidenceRecord(
        metadata.SN_JS_FEATURES,
        "String.prototype.at is unsupported in Compatibility and ES5 Standards modes.",
        "manual",
        "2026-08-24",
      ),
      metadata.evidenceRecord(
        "tests/rules/no-at-method.test.ts",
        "Fixtures cover Array/String prototype authority, modeled built-in replacement, dynamic scope, dominating feature guards, optional invocation, and shadowed near misses.",
        "fixture",
        "2026-08-24",
      ),
      metadata.evidenceRecord(
        "tests/integration/profiles.test.ts",
        "Real Oxlint and ESLint classic-es5 profiles accept an explicit Array.prototype.at polyfill.",
        "integration-test",
        "2026-08-24",
      ),
    ],
    {
      overlaps: ["servicenow/no-unsupported-syntax"],
    },
  ),
  placements: [{ profile: "classic-es5", severity: "error" }],
  optionDescriptor: undefined,
  limitationCases: [
    {
      caseId: "no-at-method-unknown-receiver",
      kind: "scope-boundary",
      description: "Unknown receivers with a method named at stay silent.",
      name: "unknown receiver",
      filename: "unknown-at.server.js",
      settings: ES5,
      code: `customCollection.at(0);`,
    },
    {
      caseId: "no-at-method-visible-polyfill",
      kind: "scope-boundary",
      description:
        "A possible Array or String constructor, prototype, or at-method replacement suppresses matching diagnostics throughout the file, regardless of source order.",
      name: "visible Array.at polyfill",
      filename: "polyfill.server.js",
      settings: ES5,
      code: `Array.prototype.at = localAt;
var last = [1, 2].at(-1);`,
    },
  ],
  title: "No .at()",
  family: "engine",
  severity: "error",
  fixable: false,
  hasSuggestions: false,
  description:
    "`.at()` is not implemented in Compatibility or ES5 Standards mode. Proven array/string literal receivers report unless the matching built-in authority is visibly replaced or a structural prototype-availability guard protects the call.",
  bad: [
    {
      name: "at",
      filename: "script-include.js",
      settings: ES5,
      code: `var last = [1, 2].at(-1);`,
    },
  ],
  good: [
    {
      name: "index",
      filename: "script-include.js",
      settings: ES5,
      code: `var last = list[list.length - 1];`,
    },
    {
      name: "guarded polyfill use",
      filename: "portable.server.js",
      settings: ES5,
      code: `if (typeof Array.prototype.at === "function") {
  var last = [1, 2].at(-1);
}`,
    },
  ],
});
