import { entry } from "./entry.js";
import { noUnsupportedDateFraction } from "../rules/no-unsupported-date-fraction.js";
import * as metadata from "../catalog-metadata.js";

export const noUnsupportedDateFractionEntry = entry(
  "no-unsupported-date-fraction",
  noUnsupportedDateFraction,
  {
    ...metadata.meta(
      metadata.engine(metadata.ALL_INSTANCE_MODES),
      [
        metadata.evidenceRecord(
          metadata.SN_JS_ENGINE_UPDATES_AUSTRALIA,
          "The Australia JavaScript engine update lists Rhino PR 1896, Enhance date string parsing with optional millisecond digits, as a feature applicable to all JavaScript modes.",
          "manual",
          "2026-08-24",
        ),
        metadata.evidenceRecord(
          "tests/rules/no-unsupported-date-fraction.test.ts",
          "Fixtures cover one, two, and more than three fraction digits; calendar, time, and offset validity; all modes; release omission; static aliases; native Date authority; shadowing; and unsupported contexts.",
          "fixture",
          "2026-08-24",
        ),
        metadata.evidenceRecord(
          "tests/integration/release-contracts.test.ts",
          "Real Oxlint and ESLint contracts verify Zurich, Australia, and omitted-release behavior for native Date construction and Date.parse.",
          "integration-test",
          "2026-08-24",
        ),
      ],
      { overlaps: [] },
    ),
    placements: [
      { profile: "classic-es5", severity: "error" },
      { profile: "es2021", severity: "error" },
    ] as const,
    optionDescriptor: undefined,
    limitationCases: [
      {
        caseId: "unsupported-date-fraction-dynamic-input",
        kind: "false-negative",
        description:
          "Dynamic date strings stay silent; the rule requires a static string or a dominating same-execution const alias.",
        name: "dynamic timestamp",
        filename: "dates.server.js",
        settings: { javascriptMode: "es5", release: "zurich" },
        code: `var parsed = new Date(inputTimestamp);`,
      },
      {
        caseId: "unsupported-date-fraction-narrow-iso-shape",
        kind: "false-negative",
        description:
          "Extended years, timezone offsets without a colon, and other legacy Date string forms stay silent; the rule validates a narrow complete ISO timestamp before diagnosing.",
        name: "extended-year timestamp",
        filename: "dates.server.js",
        settings: { javascriptMode: "es2021", release: "zurich" },
        code: `const parsed = new Date("+002025-05-07T09:05:20.78Z");`,
      },
      {
        caseId: "unsupported-date-fraction-indirect-invocation",
        kind: "false-negative",
        description:
          "Extracted Date.parse methods, call/apply/bind helpers, Reflect.construct, subclasses, and constructor or string aliases crossing an execution boundary stay silent; the rule models direct native parsing operations and stable same-execution owner aliases.",
        name: "extracted Date.parse call",
        filename: "dates.server.js",
        settings: { javascriptMode: "es2021", release: "zurich" },
        code: `const parse = Date.parse;
const parsed = parse("2025-05-07T09:05:20.78Z");`,
      },
      {
        caseId: "unsupported-date-fraction-visible-replacement",
        kind: "scope-boundary",
        description:
          "A possible Date binding replacement suppresses constructor diagnostics; a Date namespace escape or Date.parse replacement suppresses static-method diagnostics because those operations can select different parsing semantics.",
        name: "visible Date replacement",
        filename: "custom-runtime.server.js",
        settings: { javascriptMode: "es2021", release: "zurich" },
        code: `Date = LocalDate;
new Date("2025-05-07T09:05:20.78Z");`,
      },
      {
        caseId: "unsupported-date-fraction-omitted-release",
        kind: "scope-boundary",
        description:
          "Variable-length fractional seconds stay silent when settings.servicenow.release is omitted because Zurich and Australia disagree.",
        name: "omitted release",
        filename: "portable.server.js",
        settings: { javascriptMode: "es2021" },
        code: `var parsed = new Date("2025-05-07T09:05:20.78Z");`,
      },
    ],
    title: "No unsupported Date fractional seconds",
    family: "engine",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "Australia adds variable-length ISO fractional-second parsing to all JavaScript modes, while Zurich accepts fractional seconds only when exactly three digits are present. This rule reports statically proven native Date constructor or Date.parse calls whose otherwise valid timestamp uses a different length.",
    bad: [
      {
        name: "two fractional digits in Zurich",
        filename: "script-include.js",
        settings: { javascriptMode: "es5", release: "zurich" },
        code: `var parsed = new Date("2025-05-07T09:05:20.78Z");`,
      },
    ],
    good: [
      {
        name: "two fractional digits in Australia",
        filename: "script-include.js",
        settings: { javascriptMode: "es5", release: "australia" },
        code: `var parsed = new Date("2025-05-07T09:05:20.78Z");`,
      },
      {
        name: "portable three-digit fraction",
        filename: "script-include.js",
        settings: { javascriptMode: "es5", release: "zurich" },
        code: `var parsed = new Date("2025-05-07T09:05:20.780Z");`,
      },
    ],
  },
);
