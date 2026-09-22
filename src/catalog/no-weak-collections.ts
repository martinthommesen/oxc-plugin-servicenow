import { entry, ES5 } from "./entry.js";
import { noWeakCollections } from "../rules/no-weak-collections.js";
import * as metadata from "../catalog-metadata.js";

export const noWeakCollectionsEntry = entry("no-weak-collections", noWeakCollections, {
  ...metadata.meta(
    metadata.engine(metadata.ES5_MODES),
    [
      metadata.evidenceRecord(
        metadata.SN_JS_FEATURES,
        "WeakMap and WeakSet are unsupported in Compatibility and ES5 Standards modes.",
        "manual",
        "2026-08-20",
      ),
      metadata.evidenceRecord(
        "tests/rules/unsupported-constructors.test.ts",
        "Fixtures cover WeakMap aliases, guarded alias capture, availability invalidation, and shared constructor-provenance behavior.",
        "fixture",
        "2026-08-24",
      ),
    ],
    {
      overlaps: ["servicenow/no-map-set", "servicenow/no-weak-references"],
    },
  ),
  placements: [{ profile: "classic-es5", severity: "error" }] as const,
  optionDescriptor: undefined,
  limitationCases: [
    {
      caseId: "weak-collection-visible-polyfill",
      kind: "scope-boundary",
      description:
        "A possible callable replacement for WeakMap or WeakSet suppresses matching diagnostics throughout the file, regardless of source order.",
      name: "visible WeakMap polyfill",
      filename: "polyfill.server.js",
      settings: ES5,
      code: `WeakMap = LocalWeakMap;
var cache = new WeakMap();`,
    },
    {
      caseId: "weak-collection-availability-guard",
      kind: "scope-boundary",
      description:
        "A call protected by a structurally dominating availability guard stays silent for code shared with other runtimes.",
      name: "availability guard",
      filename: "portable.server.js",
      settings: ES5,
      code: `if (typeof WeakMap === "function") {
  new WeakMap();
}`,
    },
  ],
  title: "No WeakMap / WeakSet",
  family: "engine",
  severity: "error",
  fixable: false,
  hasSuggestions: false,
  description:
    "WeakMap and WeakSet are disallowed in Compatibility and ES5 Standards mode. ES2021 supports them. Direct calls and stable same-execution aliases report; bare aliases captured before a later guard still report, while visibly polyfilled calls stay silent.",
  bad: [
    {
      name: "WeakMap",
      filename: "script-include.js",
      settings: ES5,
      code: `var cache = new WeakMap();`,
    },
  ],
  good: [
    {
      name: "object keyed by a stable primitive ID",
      filename: "script-include.js",
      settings: ES5,
      code: `var cacheBySysId = {};
cacheBySysId[sysId] = value;`,
    },
  ],
});
