import { entry } from "./entry.js";
import { noWeakReferences } from "../rules/no-weak-references.js";
import * as metadata from "../catalog-metadata.js";

export const noWeakReferencesEntry = entry("no-weak-references", noWeakReferences, {
  ...metadata.meta(
    metadata.engine(metadata.ALL_INSTANCE_MODES),
    [
      metadata.evidenceRecord(
        metadata.SN_JS_FEATURES,
        "WeakRef and FinalizationRegistry are unsupported in instance JavaScript modes.",
        "manual",
        "2026-08-20",
      ),
      metadata.evidenceRecord(
        "tests/rules/unsupported-constructors.test.ts",
        "Fixtures cover stable aliases, guarded alias capture, built-in guard invalidation, callable polyfills, non-callable replacements, lexical shadows, and dynamic scope.",
        "fixture",
        "2026-08-24",
      ),
    ],
    {
      overlaps: ["servicenow/no-weak-collections"],
    },
  ),
  placements: [
    { profile: "recommended", severity: "error" },
    { profile: "classic-es5", severity: "error" },
    { profile: "es2021", severity: "error" },
  ],
  optionDescriptor: undefined,
  limitationCases: [
    {
      caseId: "weak-reference-visible-polyfill",
      kind: "scope-boundary",
      description:
        "A possible callable replacement for WeakRef or FinalizationRegistry suppresses matching diagnostics throughout the file, regardless of source order.",
      name: "visible WeakRef polyfill",
      filename: "polyfill.server.js",
      settings: { javascriptMode: "es2021", release: "australia" },
      code: `WeakRef = LocalWeakRef;
var reference = new WeakRef(value);`,
    },
    {
      caseId: "weak-reference-availability-guard",
      kind: "scope-boundary",
      description:
        "A call protected by a structurally dominating availability guard stays silent for code shared with other runtimes.",
      name: "availability guard",
      filename: "portable.server.js",
      settings: { javascriptMode: "es2021", release: "australia" },
      code: `if (typeof WeakRef === "function") {
  new WeakRef(value);
}`,
    },
    {
      caseId: "weak-reference-cross-execution-alias",
      kind: "false-negative",
      description:
        "A constructor alias used from another function body stays silent because source order cannot prove that its initializer ran before the function was called.",
      name: "cross-execution alias",
      filename: "deferred.server.js",
      settings: { javascriptMode: "es2021", release: "australia" },
      code: `const Ref = WeakRef;
function create(value) { return new Ref(value); }
create(value);`,
    },
  ],
  title: "No WeakRef / FinalizationRegistry",
  family: "engine",
  severity: "error",
  fixable: false,
  hasSuggestions: false,
  description:
    "WeakRef and FinalizationRegistry are disallowed in every instance JavaScript mode, including ES2021. Direct calls and stable same-execution aliases report; a bare alias must be captured inside its availability guard, while visibly polyfilled calls stay silent.",
  bad: [{ name: "WeakRef", filename: "script-include.js", code: `var ref = new WeakRef(obj);` }],
  good: [
    {
      name: "Map in ES2021",
      filename: "script-include.js",
      settings: { javascriptMode: "es2021" },
      code: `var cache = new Map();`,
    },
  ],
});
