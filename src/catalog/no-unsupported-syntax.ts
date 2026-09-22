import { entry, ES5 } from "./entry.js";
import { noUnsupportedSyntax } from "../rules/no-unsupported-syntax.js";
import * as metadata from "../catalog-metadata.js";

export const noUnsupportedSyntaxEntry = entry("no-unsupported-syntax", noUnsupportedSyntax, {
  ...metadata.meta(
    metadata.engine(metadata.ALL_INSTANCE_MODES),
    [
      metadata.evidenceRecord(
        metadata.SN_JS_FEATURES,
        "The feature table marks ordinary shorthand object methods Not Supported and async/generator object methods Disallowed in ES5 Standards mode; Compatibility follows those cells by package policy.",
        "manual",
        "2026-08-24",
      ),
      metadata.evidenceRecord(
        metadata.SN_JS_FEATURES_AUSTRALIA,
        "The Australia table marks private instance fields, methods, and accessors Not Supported in ES2021.",
        "manual",
        "2026-08-22",
      ),
      metadata.evidenceRecord(
        metadata.SN_JS_MODES,
        "ServiceNow documents Compatibility as a third mode; the plugin explicitly applies ES5 feature cells to it as package policy.",
        "manual",
        "2026-08-22",
      ),
      metadata.evidenceRecord(
        "tests/integration/profiles/invalid/es5-promise.server.js",
        "classic-es5 Oxlint flags unsupported syntax on the ES2021 fixture.",
        "integration-test",
        "2026-08-20",
      ),
      metadata.evidenceRecord(
        "tests/rules/no-unsupported-syntax.test.ts",
        "Fixtures cover shorthand object methods plus direct, namespace-qualified, and stable same-execution RegExp aliases, shadows, mutation, dynamic scope, and constructor-versus-literal authority boundaries.",
        "fixture",
        "2026-08-24",
      ),
      metadata.evidenceRecord(
        "tests/integration/profiles.test.ts",
        "Real Oxlint and ESLint classic-es5 profiles resolve stable RegExp aliases and accept explicit constructor replacements.",
        "integration-test",
        "2026-08-24",
      ),
    ],
    {
      overlaps: ["servicenow/no-async-await", "servicenow/no-bigint"],
    },
  ),
  placements: [
    { profile: "classic-es5", severity: "error" },
    { profile: "es2021", severity: "error" },
  ] as const,
  optionDescriptor: undefined,
  limitationCases: [
    {
      caseId: "unsupported-syntax-regexp-authority-loss",
      kind: "scope-boundary",
      description:
        "Any visible RegExp replacement suppresses constructor-string diagnostics throughout the file because the replacement may implement different pattern syntax. RegExp literal diagnostics remain active.",
      name: "visible RegExp replacement",
      filename: "polyfill.server.js",
      settings: ES5,
      code: `RegExp = LocalRegExp;
RegExp("(?<=a)b");`,
    },
    {
      caseId: "unsupported-syntax-regexp-cross-execution-alias",
      kind: "false-negative",
      description:
        "A RegExp alias used from another function body stays silent because source order cannot prove that its initializer ran before the function was called.",
      name: "cross-execution RegExp alias",
      filename: "deferred.server.js",
      settings: ES5,
      code: `const Regex = RegExp;
function compile() { return Regex("(?<=a)b"); }
compile();`,
    },
  ],
  title: "No unsupported ES-latest syntax",
  family: "engine",
  severity: "error",
  fixable: false,
  hasSuggestions: false,
  description:
    "The ES5 table marks ordinary object shorthand methods Not Supported and async/generator methods Disallowed. It also marks optional chaining, nullish coalescing, logical assignment, private members, and RegExp lookbehind Not Supported. Constructor-string lookbehind detection follows direct and stable same-execution built-in RegExp identity. Private instance members remain Not Supported in ES2021; Compatibility follows ES5 by package policy.",
  bad: [
    {
      name: "optional chaining and ??",
      filename: "script-include.js",
      settings: ES5,
      code: `var name = current.caller_id?.name ?? "unknown";`,
    },
    {
      name: "private instance member in Australia ES2021",
      filename: "script-include.js",
      settings: { javascriptMode: "es2021", release: "australia" },
      code: `class State { #value = 1; }`,
    },
    {
      name: "RegExp alias with lookbehind",
      filename: "script-include.js",
      settings: ES5,
      code: `const Regex = RegExp;
var matcher = Regex("(?<=a)b");`,
    },
    {
      name: "object shorthand method in ES5",
      filename: "script-include.js",
      settings: ES5,
      code: `var definitions = { create() {} };`,
    },
  ],
  good: [
    {
      name: "explicit check",
      filename: "script-include.js",
      code: `var name = current.caller_id ? current.caller_id.name : "unknown";`,
    },
    {
      name: "private static member in Australia ES2021",
      filename: "script-include.js",
      settings: { javascriptMode: "es2021", release: "australia" },
      code: `class State { static #value = 1; }`,
    },
    {
      name: "explicit RegExp replacement",
      filename: "script-include.js",
      settings: ES5,
      code: `RegExp = LocalRegExp;
var matcher = RegExp("(?<=a)b");`,
    },
  ],
});
