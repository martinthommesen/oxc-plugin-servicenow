import { entry } from "./entry.js";
import { noUnsupportedStaticMethods } from "../rules/no-unsupported-static-methods.js";
import * as metadata from "../catalog-metadata.js";

export const noUnsupportedStaticMethodsEntry = entry(
  "no-unsupported-static-methods",
  noUnsupportedStaticMethods,
  {
    ...metadata.meta(
      metadata.engine(["compatibility", "es5", "es2021"]),
      [
        metadata.evidenceRecord(
          metadata.SN_JS_ENGINE_UPDATES_AUSTRALIA,
          "The Australia engine update adds Error.isError, Promise.try, and Promise.withResolvers in ECMAScript 2021 mode.",
          "manual",
          "2026-08-24",
        ),
        metadata.evidenceRecord(
          metadata.SN_JS_MODES,
          "ServiceNow documents Compatibility as a third mode; the plugin applies the ES5 Error.isError capability cell to it as package policy.",
          "manual",
          "2026-08-24",
        ),
        metadata.evidenceRecord(
          "tests/rules/no-unsupported-static-methods.test.ts",
          "Fixtures cover release deltas, owner aliases, shadowing, reassignment, dynamic scope, callable polyfills, non-callable replacements, availability guards, and guard invalidation.",
          "fixture",
          "2026-08-24",
        ),
        metadata.evidenceRecord(
          "tests/integration/release-contracts.test.ts",
          "Real Oxlint and ESLint contracts verify Zurich, Australia, omitted-release, and ES5 behavior for the modeled static methods.",
          "integration-test",
          "2026-08-24",
        ),
      ],
      {
        overlaps: ["servicenow/no-promise"],
      },
    ),
    placements: [
      { profile: "classic-es5", severity: "error" },
      { profile: "es2021", severity: "error" },
    ] as const,
    optionDescriptor: undefined,
    limitationCases: [
      {
        caseId: "unsupported-static-method-direct-alias",
        kind: "false-negative",
        description:
          "Direct aliases of individual static methods stay silent; the shared resolver proves stable aliases of the owning Error or Promise object instead.",
        name: "static method alias",
        filename: "method-alias.server.js",
        settings: { javascriptMode: "es2021", release: "zurich" },
        code: `const isError = Error.isError;
isError(value);`,
      },
      {
        caseId: "unsupported-static-method-visible-polyfill",
        kind: "scope-boundary",
        description:
          "A possible callable replacement for a modeled method suppresses matching diagnostics throughout the file, regardless of source order.",
        name: "visible static-method polyfill",
        filename: "polyfill.server.js",
        settings: { javascriptMode: "es2021", release: "zurich" },
        code: `Error.isError = localIsError;
Error.isError(value);`,
      },
      {
        caseId: "unsupported-static-method-cross-execution-alias",
        kind: "false-negative",
        description:
          "An owner alias used from another function body stays silent because source order cannot prove that its initializer ran before the function was called.",
        name: "cross-execution owner alias",
        filename: "deferred.server.js",
        settings: { javascriptMode: "es2021", release: "zurich" },
        code: `const PlatformError = Error;
function check(value) { return PlatformError.isError(value); }
check(value);`,
      },
      {
        caseId: "unsupported-static-method-omitted-release",
        kind: "scope-boundary",
        description:
          "Release-dependent ES2021 calls stay silent when settings.servicenow.release is omitted because Zurich and Australia disagree.",
        name: "omitted release",
        filename: "portable.server.js",
        settings: { javascriptMode: "es2021" },
        code: `Error.isError(value);`,
      },
    ],
    title: "No unsupported static engine methods",
    family: "engine",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "Error.isError(), Promise.try(), and Promise.withResolvers() are available in Australia ES2021 but not Zurich ES2021. Error.isError() is also unavailable in Compatibility and ES5 modes; Promise calls there remain owned by no-promise to avoid duplicate diagnostics. Omitted releases and unknown modes stay silent.",
    bad: [
      {
        name: "Error.isError in Zurich ES2021",
        filename: "script-include.js",
        settings: { javascriptMode: "es2021", release: "zurich" },
        code: `var isPlatformError = Error.isError(value);`,
      },
    ],
    good: [
      {
        name: "Error.isError in Australia ES2021",
        filename: "script-include.js",
        settings: { javascriptMode: "es2021", release: "australia" },
        code: `var isPlatformError = Error.isError(value);`,
      },
    ],
  },
);
