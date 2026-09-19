import { entry, ES5 } from "./entry.js";
import { noMapSet } from "../rules/no-map-set.js";
import * as metadata from "../catalog-metadata.js";

export const noMapSetEntry = entry("no-map-set", noMapSet, {
  ...metadata.meta(
    metadata.engine(metadata.ES5_MODES),
    [
      metadata.evidenceRecord(
        metadata.SN_JS_FEATURES,
        "The Zurich table marks Map and Set basic functionality Supported in ES2021 and Not Supported in ES5 Standards.",
        "manual",
        "2026-08-24",
      ),
      metadata.evidenceRecord(
        metadata.SN_JS_FEATURES_AUSTRALIA,
        "The Australia table marks Map and Set basic functionality Supported in ES2021 and Not Supported in ES5 Standards.",
        "manual",
        "2026-08-24",
      ),
      metadata.evidenceRecord(
        "tests/rules/no-map-set.test.ts",
        "Fixtures cover both constructors, Compatibility and ES5 modes, both releases, aliases, guards, polyfills, shadowing, dynamic scope, and unsupported contexts.",
        "fixture",
        "2026-08-24",
      ),
      metadata.evidenceRecord(
        "tests/integration/release-contracts.test.ts",
        "Real Oxlint and ESLint contracts verify Map and Set behavior across Zurich, Australia, omitted-release ES5, and ES2021 settings.",
        "integration-test",
        "2026-08-24",
      ),
    ],
    {
      overlaps: ["servicenow/no-weak-collections"],
    },
  ),
  placements: [{ profile: "classic-es5", severity: "error" }] as const,
  optionDescriptor: undefined,
  limitationCases: [
    {
      caseId: "map-set-visible-polyfill",
      kind: "scope-boundary",
      description:
        "A possible callable replacement for Map or Set suppresses matching diagnostics throughout the file, regardless of source order.",
      name: "visible Map polyfill",
      filename: "polyfill.server.js",
      settings: ES5,
      code: `Map = LocalMap;
var cache = new Map();`,
    },
    {
      caseId: "map-set-availability-guard",
      kind: "scope-boundary",
      description:
        "A call protected by a structurally dominating availability guard stays silent for code shared with other runtimes.",
      name: "availability guard",
      filename: "portable.server.js",
      settings: ES5,
      code: `if (typeof Set === "function") {
  new Set();
}`,
    },
    {
      caseId: "map-set-cross-execution-alias",
      kind: "false-negative",
      description:
        "A constructor alias used from another function body stays silent because source order cannot prove that its initializer ran before the function was called.",
      name: "cross-execution alias",
      filename: "deferred.server.js",
      settings: ES5,
      code: `const NativeMap = Map;
function create() { return new NativeMap(); }
create();`,
    },
  ],
  title: "No Map / Set",
  family: "engine",
  severity: "error",
  fixable: false,
  hasSuggestions: false,
  description:
    "ServiceNow supports Map and Set in ES2021 but not in Compatibility or ES5 Standards mode in either Zurich or Australia. Direct calls and stable same-execution aliases report, while visibly polyfilled or availability-guarded calls stay silent.",
  bad: [
    {
      name: "Map",
      filename: "script-include.js",
      settings: ES5,
      code: `var cache = new Map();`,
    },
    {
      name: "Set",
      filename: "script-include.js",
      settings: ES5,
      code: `var seen = new Set();`,
    },
  ],
  good: [
    {
      name: "object keyed by a stable primitive ID",
      filename: "script-include.js",
      settings: ES5,
      code: `var seenBySysId = {};
seenBySysId[record.getUniqueValue()] = true;`,
    },
  ],
});
