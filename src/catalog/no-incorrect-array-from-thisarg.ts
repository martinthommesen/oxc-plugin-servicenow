import { entry } from "./entry.js";
import { noIncorrectArrayFromThisarg } from "../rules/no-incorrect-array-from-thisarg.js";
import * as metadata from "../catalog-metadata.js";

export const noIncorrectArrayFromThisargEntry = entry(
  "no-incorrect-array-from-thisarg",
  noIncorrectArrayFromThisarg,
  {
    ...metadata.meta(
      metadata.engine(["es2021"]),
      [
        metadata.evidenceRecord(
          metadata.SN_JS_ENGINE_UPDATES_AUSTRALIA,
          "The Australia engine update lists Rhino PR 1982, Correct this in Array.from, as an ECMAScript 2021 fix.",
          "manual",
          "2026-08-24",
        ),
        metadata.evidenceRecord(
          "tests/rules/no-incorrect-array-from-thisarg.test.ts",
          "Fixtures prove explicit-primitive throws and omitted-this mismatches while covering strictness, lexical arrows, callable aliases, source validity, spread ambiguity, native authority, release selection, and unsupported contexts.",
          "fixture",
          "2026-08-24",
        ),
        metadata.evidenceRecord(
          "tests/integration/release-contracts.test.ts",
          "Real Oxlint and ESLint contracts verify explicit-nullish and omitted-this behavior in Zurich, Australia, and omitted-release configurations.",
          "integration-test",
          "2026-08-24",
        ),
      ],
      { overlaps: [] },
    ),
    placements: [{ profile: "es2021", severity: "error" }] as const,
    optionDescriptor: undefined,
    limitationCases: [
      {
        caseId: "incorrect-array-from-unknown-mapper",
        kind: "false-negative",
        description:
          "Member expressions, parameters, mutable variables, and callable aliases crossing an execution boundary stay silent because the rule cannot prove the mapper's function semantics.",
        name: "unknown mapper identity",
        filename: "arrays.server.js",
        settings: { javascriptMode: "es2021", release: "zurich" },
        code: `Array.from(source, helpers.mapValue, null);`,
      },
      {
        caseId: "incorrect-array-from-omitted-this-boundary",
        kind: "scope-boundary",
        description:
          "The omitted-third-argument diagnostic requires a syntax-proven non-strict ordinary mapper that reads its own this; strict functions, arrows, and mappers without such a read stay silent.",
        name: "strict mapper",
        filename: "arrays.server.js",
        settings: { javascriptMode: "es2021", release: "zurich" },
        code: `Array.from(source, function (value) {
  "use strict";
  return this === undefined ? value : null;
});`,
      },
      {
        caseId: "incorrect-array-from-nested-arrow-alias",
        kind: "false-negative",
        description:
          "A nested arrow contributes mapper-this usage only when syntax proves that it is directly invoked, returned, thrown, or yielded. Arrows whose later invocation or escape requires alias analysis stay silent.",
        name: "locally bound lexical arrow",
        filename: "arrays.server.js",
        settings: { javascriptMode: "es2021", release: "zurich" },
        code: `Array.from(source, function (value) {
  const normalize = () => this.normalize(value);
  return normalize();
});`,
      },
      {
        caseId: "incorrect-array-from-empty-source",
        kind: "scope-boundary",
        description:
          "The omitted-this diagnostic stays silent for a definitely empty source because the mapper cannot run. An empty const array remains proven only across non-mutating reads and direct const aliases.",
        name: "definitely empty mapper source",
        filename: "arrays.server.js",
        settings: { javascriptMode: "es2021", release: "zurich" },
        code: `const source = [];
Array.from(source, function (value) {
  return this.normalize(value);
});`,
      },
      {
        caseId: "incorrect-array-from-ambiguous-arguments",
        kind: "false-negative",
        description:
          "Spread arguments and calls with a definitely nullish source stay silent because argument positions or whether execution reaches mapper-this handling cannot be proven.",
        name: "spread arguments",
        filename: "arrays.server.js",
        settings: { javascriptMode: "es2021", release: "zurich" },
        code: `Array.from(...argumentsList);`,
      },
      {
        caseId: "incorrect-array-from-dynamic-primitive",
        kind: "false-negative",
        description:
          "Primitive this arguments produced by calls, substitutions, or non-nullish compound expressions stay silent; the rule proves nullish expressions (including void), primitive literals, and no-substitution templates through dominating const aliases.",
        name: "dynamically produced primitive thisArg",
        filename: "arrays.server.js",
        settings: { javascriptMode: "es2021", release: "zurich" },
        code: `Array.from(source, function (value) { return value; }, Symbol("scope"));`,
      },
      {
        caseId: "incorrect-array-from-visible-replacement",
        kind: "scope-boundary",
        description:
          "A possible Array owner or Array.from replacement suppresses diagnostics throughout the file; direct aliases of Array.from also stay silent because native method identity is not proven.",
        name: "visible Array.from replacement",
        filename: "polyfill.server.js",
        settings: { javascriptMode: "es2021", release: "zurich" },
        code: `Array.from = localFrom;
Array.from(source, mapper, null);`,
      },
      {
        caseId: "incorrect-array-from-omitted-release",
        kind: "scope-boundary",
        description:
          "Calls stay silent when settings.servicenow.release is omitted because Zurich and Australia have different native behavior.",
        name: "omitted release",
        filename: "portable.server.js",
        settings: { javascriptMode: "es2021" },
        code: `Array.from(source, function (value) { return value; }, null);`,
      },
    ],
    title: "No incorrect Array.from mapper thisArg",
    family: "engine",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "Zurich throws when Array.from receives an explicit primitive mapper thisArg—even for an empty source, because conversion precedes iteration—and gives a non-strict mapper the wrong this when that argument is omitted. Australia corrects both ES2021 behaviors. The rule reports only stable native calls with a syntax-proven callable mapper.",
    bad: [
      {
        name: "explicit null mapper thisArg in Zurich",
        filename: "script-include.js",
        settings: { javascriptMode: "es2021", release: "zurich" },
        code: `var values = Array.from(source, function (value) { return value; }, null);`,
      },
      {
        name: "omitted mapper thisArg in Zurich",
        filename: "script-include.js",
        settings: { javascriptMode: "es2021", release: "zurich" },
        code: `var values = Array.from(source, function (value) { return this.normalize(value); });`,
      },
    ],
    good: [
      {
        name: "null mapper thisArg in Australia",
        filename: "script-include.js",
        settings: { javascriptMode: "es2021", release: "australia" },
        code: `var values = Array.from(source, function (value) { return value; }, null);`,
      },
      {
        name: "explicit object mapper thisArg in Zurich",
        filename: "script-include.js",
        settings: { javascriptMode: "es2021", release: "zurich" },
        code: `var values = Array.from(source, function (value) {
  return this.normalize(value);
}, normalizer);`,
      },
    ],
  },
);
