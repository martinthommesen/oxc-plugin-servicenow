import { entry, ES5 } from "./entry.js";
import { noPromise } from "../rules/no-promise.js";
import * as metadata from "../catalog-metadata.js";

export const noPromiseEntry = entry("no-promise", noPromise, {
  ...metadata.meta(
    metadata.engine(metadata.ES5_MODES),
    [
      metadata.evidenceRecord(
        metadata.SN_JS_FEATURES,
        "Promises are unsupported in Compatibility and ES5 Standards modes.",
        "manual",
        "2026-08-20",
      ),
      metadata.evidenceRecord(
        "tests/rules/no-promise.test.ts",
        "Fixtures cover stable Promise constructor and static-method owner aliases, guarded alias capture, owner-and-method availability checks, modeled built-in invalidation, visible polyfills, mutation, and dynamic scope.",
        "fixture",
        "2026-08-24",
      ),
      metadata.evidenceRecord(
        "tests/integration/profiles.test.ts",
        "Real Oxlint and ESLint classic-es5 profiles report a stable Promise alias and accept an explicit callable polyfill.",
        "integration-test",
        "2026-08-24",
      ),
    ],
    {
      overlaps: ["servicenow/no-async-await", "eslint no-restricted-globals"],
    },
  ),
  placements: [{ profile: "classic-es5", severity: "error" }],
  optionDescriptor: undefined,
  limitationCases: [
    {
      caseId: "no-promise-local-binding",
      kind: "scope-boundary",
      description: "Local bindings named Promise are not platform Promises.",
      name: "local Promise binding",
      filename: "local-promise.server.js",
      settings: ES5,
      code: `function Promise() {}
Promise.resolve = function (value) { return value; };
Promise.resolve(1);`,
    },
    {
      caseId: "no-promise-visible-polyfill",
      kind: "scope-boundary",
      description:
        "A possible callable replacement for Promise or a used static method suppresses matching diagnostics throughout the file, regardless of source order.",
      name: "visible Promise polyfill",
      filename: "polyfill.server.js",
      settings: ES5,
      code: `Promise = LocalPromise;
var ready = Promise.resolve(1);`,
    },
    {
      caseId: "no-promise-availability-guard",
      kind: "scope-boundary",
      description:
        "A constructor call protected by a structurally dominating owner guard stays silent; static calls require both the Promise owner and selected method to be guarded.",
      name: "availability guard",
      filename: "portable.server.js",
      settings: ES5,
      code: `if (typeof Promise === "function") {
  new Promise(function () {});
}`,
    },
    {
      caseId: "no-promise-cross-execution-alias",
      kind: "false-negative",
      description:
        "A Promise alias used from another function body stays silent because source order cannot prove that its initializer ran before the function was called.",
      name: "cross-execution alias",
      filename: "deferred.server.js",
      settings: ES5,
      code: `const P = Promise;
function create() { return new P(function () {}); }
create();`,
    },
    {
      caseId: "no-promise-static-method-alias",
      kind: "false-negative",
      description:
        "Direct aliases of individual Promise static methods stay silent; the shared resolver proves stable aliases of the Promise owner instead.",
      name: "static method alias",
      filename: "method-alias.server.js",
      settings: ES5,
      code: `const resolve = Promise.resolve;
resolve(1);`,
    },
  ],
  title: "No Promise",
  family: "engine",
  severity: "error",
  fixable: false,
  hasSuggestions: false,
  description:
    "Compatibility and ES5 Standards modes do not implement Promises. Direct calls plus stable same-execution constructor and static-method owner aliases report; bare aliases must be captured under an owner guard, while fully guarded, visibly polyfilled, unknown-mode, and local `Promise` uses stay silent.",
  bad: [
    {
      name: "constructor",
      filename: "script-include.js",
      settings: ES5,
      code: `var p = new Promise(function (resolve) { resolve(1); });`,
    },
  ],
  good: [
    {
      name: "synchronous Glide",
      filename: "script-include.js",
      settings: ES5,
      code: `var gr = new GlideRecord("incident");\nif (gr.get(sysId)) {\n  gs.info(gr.number);\n}`,
    },
  ],
});
