import { entry, ES5 } from "./entry.js";
import { noBigint } from "../rules/no-bigint.js";
import * as metadata from "../catalog-metadata.js";

export const noBigintEntry = entry("no-bigint", noBigint, {
  ...metadata.meta(
    metadata.engine(metadata.ES5_MODES),
    [
      metadata.evidenceRecord(
        metadata.SN_JS_FEATURES,
        "BigInt is unsupported in Compatibility and ES5 Standards modes.",
        "manual",
        "2026-08-20",
      ),
      metadata.evidenceRecord(
        "tests/rules/no-bigint.test.ts",
        "BigInt literals, stable call aliases, guarded capture, modeled invalidation, visible polyfills, shadowing, and dynamic scope are covered.",
        "fixture",
        "2026-08-24",
      ),
      metadata.evidenceRecord(
        "tests/integration/profiles.test.ts",
        "Real Oxlint and ESLint classic-es5 profiles report a stable BigInt alias and accept an explicit callable polyfill.",
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
      caseId: "no-bigint-visible-polyfill",
      kind: "scope-boundary",
      description:
        "A possible callable BigInt replacement suppresses call diagnostics throughout the file, regardless of source order; BigInt literal diagnostics are unaffected.",
      name: "visible BigInt polyfill",
      filename: "polyfill.server.js",
      settings: ES5,
      code: `BigInt = LocalBigInt;
var value = BigInt(10);`,
    },
    {
      caseId: "no-bigint-availability-guard",
      kind: "scope-boundary",
      description:
        "A call protected by a structurally dominating BigInt availability guard stays silent for code shared with another runtime.",
      name: "availability guard",
      filename: "portable.server.js",
      settings: ES5,
      code: `if (typeof BigInt === "function") {
  BigInt(10);
}`,
    },
    {
      caseId: "no-bigint-cross-execution-alias",
      kind: "false-negative",
      description:
        "A BigInt alias used from another function body stays silent because source order cannot prove that its initializer ran before the function was called.",
      name: "cross-execution alias",
      filename: "deferred.server.js",
      settings: ES5,
      code: `const ToBigInt = BigInt;
function convert() { return ToBigInt(10); }
convert();`,
    },
  ],
  title: "No BigInt",
  family: "engine",
  severity: "error",
  fixable: false,
  hasSuggestions: false,
  description:
    "BigInt literals and `BigInt()` are unsupported in Compatibility or ES5 Standards mode. Direct calls and stable same-execution aliases report; bare aliases must be captured under an availability guard, while visibly polyfilled, guarded, unknown-mode, and local `BigInt` calls stay silent.",
  bad: [
    {
      name: "literal",
      filename: "script-include.js",
      settings: ES5,
      code: `var n = 9007199254740993n;`,
    },
  ],
  good: [
    {
      name: "number",
      filename: "script-include.js",
      settings: ES5,
      code: `var n = 9007199254740991;`,
    },
  ],
});
