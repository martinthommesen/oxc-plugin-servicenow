import { entry } from "./entry.js";
import { noUnsupportedSetMethods } from "../rules/no-unsupported-set-methods.js";
import * as metadata from "../catalog-metadata.js";

export const noUnsupportedSetMethodsEntry = entry(
  "no-unsupported-set-methods",
  noUnsupportedSetMethods,
  {
    ...metadata.meta(
      metadata.engine(["es2021"]),
      [
        metadata.evidenceRecord(
          metadata.SN_JS_ENGINE_UPDATES_AUSTRALIA,
          "The Australia JavaScript engine update adds the new Set methods from Rhino PR 2029 in ECMAScript 2021 mode.",
          "manual",
          "2026-08-24",
        ),
        metadata.evidenceRecord(
          metadata.SN_JS_ENGINE_UPDATES_AUSTRALIA,
          "The official Australia update links Rhino PR 2029, whose implementation identifies intersection, union, difference, symmetricDifference, isSubsetOf, isSupersetOf, and isDisjointFrom as the added Set methods.",
          "manual",
          "2026-08-24",
        ),
        metadata.evidenceRecord(
          "tests/rules/no-unsupported-set-methods.test.ts",
          "Fixtures cover all seven methods, release selection, object identity, aliases, joins, directly invoked and escaping closures, shadowing, mutation, availability guards, and unsupported contexts.",
          "fixture",
          "2026-08-24",
        ),
        metadata.evidenceRecord(
          "tests/integration/release-contracts.test.ts",
          "Real Oxlint and ESLint contracts verify Zurich, Australia, and omitted-release behavior for a proven Set receiver.",
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
        caseId: "unsupported-set-method-extracted-call",
        kind: "false-negative",
        description:
          "Calls through extracted method values or call/apply/bind helpers stay silent; the rule reports direct calls on a proven Set receiver.",
        name: "extracted Set method",
        filename: "method-alias.server.js",
        settings: { javascriptMode: "es2021", release: "zurich" },
        code: `const values = new Set();
const union = values.union.bind(values);
union(other);`,
      },
      {
        caseId: "unsupported-set-method-visible-mutation",
        kind: "scope-boundary",
        description:
          "A possible Set constructor, prototype, or matching instance-method replacement suppresses the diagnostic throughout the file, regardless of source order.",
        name: "visible Set polyfill",
        filename: "polyfill.server.js",
        settings: { javascriptMode: "es2021", release: "zurich" },
        code: `Set.prototype.union = localUnion;
new Set().union(other);`,
      },
      {
        caseId: "unsupported-set-method-escaped-receiver",
        kind: "false-negative",
        description:
          "A Set passed to unknown code stays silent because that code could install an instance method before the modeled call.",
        name: "escaped Set receiver",
        filename: "escaped.server.js",
        settings: { javascriptMode: "es2021", release: "zurich" },
        code: `const values = new Set();
installPolyfills(values);
values.union(other);`,
      },
      {
        caseId: "unsupported-set-method-subclass",
        kind: "false-negative",
        description:
          "Instances of user-defined Set subclasses stay silent because the shared provenance model does not infer built-in identity through class inheritance.",
        name: "Set subclass",
        filename: "subclass.server.js",
        settings: { javascriptMode: "es2021", release: "zurich" },
        code: `class OrderedSet extends Set {}
new OrderedSet().union(other);`,
      },
      {
        caseId: "unsupported-set-method-omitted-release",
        kind: "scope-boundary",
        description:
          "Set composition calls stay silent when settings.servicenow.release is omitted because Zurich and Australia disagree.",
        name: "omitted release",
        filename: "portable.server.js",
        settings: { javascriptMode: "es2021" },
        code: `new Set().union(other);`,
      },
    ],
    title: "No unsupported Set methods",
    family: "engine",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "Set.prototype.intersection(), union(), difference(), symmetricDifference(), isSubsetOf(), isSupersetOf(), and isDisjointFrom() are available in Australia ES2021 but not Zurich ES2021. Only direct calls on a proven, authoritative Set receiver are reported; classic Map/Set availability is outside this method-level rule.",
    bad: [
      {
        name: "Set union in Zurich ES2021",
        filename: "script-include.js",
        settings: { javascriptMode: "es2021", release: "zurich" },
        code: `const merged = new Set(left).union(right);`,
      },
    ],
    good: [
      {
        name: "Set union in Australia ES2021",
        filename: "script-include.js",
        settings: { javascriptMode: "es2021", release: "australia" },
        code: `const merged = new Set(left).union(right);`,
      },
      {
        name: "unrelated set-like object",
        filename: "script-include.js",
        settings: { javascriptMode: "es2021", release: "zurich" },
        code: `const merged = customCollection.union(other);`,
      },
    ],
  },
);
