import { entry } from "./entry.js";
import { noIncorrectBigintAsuintn } from "../rules/no-incorrect-bigint-asuintn.js";
import * as metadata from "../catalog-metadata.js";

export const noIncorrectBigintAsuintnEntry = entry(
  "no-incorrect-bigint-asuintn",
  noIncorrectBigintAsuintn,
  {
    ...metadata.meta(
      metadata.engine(["es2021"]),
      [
        metadata.evidenceRecord(
          metadata.SN_JS_ENGINE_UPDATES_AUSTRALIA,
          "The Australia engine update lists Rhino PR 1979 as the ECMAScript 2021 fix for BigInt.asUintN and BigInt.asIntN.",
          "manual",
          "2026-08-24",
        ),
        metadata.evidenceRecord(
          "tests/rules/no-incorrect-bigint-asuintn.test.ts",
          "Fixtures prove the legacy byte-width boundary, safe near misses, owner authority, aliases, mutation, release selection, and unsupported contexts.",
          "fixture",
          "2026-08-24",
        ),
        metadata.evidenceRecord(
          "tests/integration/release-contracts.test.ts",
          "Real Oxlint and ESLint contracts verify the same literal call in Zurich, Australia, and omitted-release configurations.",
          "integration-test",
          "2026-08-24",
        ),
      ],
      { overlaps: ["servicenow/no-bigint"] },
    ),
    placements: [{ profile: "es2021", severity: "error" }] as const,
    optionDescriptor: undefined,
    limitationCases: [
      {
        caseId: "incorrect-bigint-asuintn-dynamic-operands",
        kind: "false-negative",
        description:
          "Dynamic operands and const aliases stay silent; the rule requires both arguments directly in the call so a diagnostic proves the exact legacy result.",
        name: "aliased narrowing operands",
        filename: "dynamic-bigint.server.js",
        settings: { javascriptMode: "es2021", release: "zurich" },
        code: `const bits = 64;
const value = -1n;
BigInt.asUintN(bits, value);`,
      },
      {
        caseId: "incorrect-bigint-asuintn-visible-replacement",
        kind: "scope-boundary",
        description:
          "A possible BigInt owner or asUintN replacement suppresses diagnostics throughout the file because the call may no longer reach Rhino's native implementation.",
        name: "visible asUintN replacement",
        filename: "polyfill.server.js",
        settings: { javascriptMode: "es2021", release: "zurich" },
        code: `BigInt.asUintN = localAsUintN;
BigInt.asUintN(64, -1n);`,
      },
      {
        caseId: "incorrect-bigint-asuintn-analysis-bounds",
        kind: "false-negative",
        description:
          "Bit counts above 4096 and normalized BigInt literal text longer than 256 characters stay silent to bound per-file analysis cost.",
        name: "unusually large narrowing width",
        filename: "large-bigint.server.js",
        settings: { javascriptMode: "es2021", release: "zurich" },
        code: `BigInt.asUintN(4097, -1n);`,
      },
      {
        caseId: "incorrect-bigint-asuintn-asintn-boundary",
        kind: "scope-boundary",
        description:
          "BigInt.asIntN calls stay silent because the reviewed regression proves a negative unsigned-result mismatch; the rule does not extrapolate that defect to signed narrowing.",
        name: "signed narrowing",
        filename: "signed-bigint.server.js",
        settings: { javascriptMode: "es2021", release: "zurich" },
        code: `BigInt.asIntN(64, -1n);`,
      },
      {
        caseId: "incorrect-bigint-asuintn-omitted-release",
        kind: "scope-boundary",
        description:
          "Calls stay silent when settings.servicenow.release is omitted because Zurich and Australia have different native behavior.",
        name: "omitted release",
        filename: "portable.server.js",
        settings: { javascriptMode: "es2021" },
        code: `BigInt.asUintN(64, -1n);`,
      },
    ],
    title: "No incorrect BigInt.asUintN results",
    family: "engine",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "Zurich can return a negative input unchanged from BigInt.asUintN() when the requested width exceeds the input's signed byte representation; Australia corrects the ES2021 behavior. The rule reports only direct literal pairs that prove the two results differ.",
    bad: [
      {
        name: "negative 64-bit unsigned narrowing in Zurich",
        filename: "script-include.js",
        settings: { javascriptMode: "es2021", release: "zurich" },
        code: `var unsigned = BigInt.asUintN(64, -1n);`,
      },
    ],
    good: [
      {
        name: "negative 64-bit unsigned narrowing in Australia",
        filename: "script-include.js",
        settings: { javascriptMode: "es2021", release: "australia" },
        code: `var unsigned = BigInt.asUintN(64, -1n);`,
      },
      {
        name: "Zurich narrowing below the legacy early-return boundary",
        filename: "script-include.js",
        settings: { javascriptMode: "es2021", release: "zurich" },
        code: `var unsigned = BigInt.asUintN(7, -1n);`,
      },
    ],
  },
);
