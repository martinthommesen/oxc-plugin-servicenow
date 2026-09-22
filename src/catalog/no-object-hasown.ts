import { entry } from "./entry.js";
import { noObjectHasown } from "../rules/no-object-hasown.js";
import * as metadata from "../catalog-metadata.js";

export const noObjectHasownEntry = entry("no-object-hasown", noObjectHasown, {
  ...metadata.meta(metadata.engine(metadata.ALL_INSTANCE_MODES), [
    metadata.evidenceRecord(
      metadata.SN_JS_FEATURES,
      "The Zurich table marks Object.hasOwn Not Supported in ES2021 and ES5 Standards.",
      "manual",
      "2026-08-22",
    ),
    metadata.evidenceRecord(
      metadata.SN_JS_FEATURES_AUSTRALIA,
      "The Australia table marks Object.hasOwn Supported in ES2021 and Not Supported in ES5 Standards.",
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
      "tests/rules/glide-and-engine.test.ts",
      "Fixtures cover release deltas, immutable aliases, reassignment, computed access, shadowing, mutation, and namespace escape.",
      "fixture",
      "2026-08-22",
    ),
  ]),
  placements: [
    { profile: "classic-es5", severity: "error" },
    { profile: "es2021", severity: "error" },
  ],
  optionDescriptor: undefined,
  limitationCases: [
    {
      caseId: "object-hasown-dynamic-property",
      kind: "scope-boundary",
      description: "Dynamic property names stay silent because they do not prove a hasOwn call.",
      name: "dynamic property",
      filename: "dynamic-object.server.js",
      settings: { javascriptMode: "es5", release: "australia" },
      code: `Object[method](record, "number");`,
    },
    {
      caseId: "object-hasown-visible-replacement",
      kind: "scope-boundary",
      description:
        "Any possible direct write to Object or Object.hasOwn in the file conservatively suppresses diagnostics for that file, regardless of source order.",
      name: "visible Object.hasOwn replacement",
      filename: "polyfill.server.js",
      settings: { javascriptMode: "es5", release: "australia" },
      code: `Object.hasOwn = polyfill;
Object.hasOwn(record, "number");`,
    },
    {
      caseId: "object-hasown-escaped-namespace",
      kind: "scope-boundary",
      description:
        "Passing Object to an unknown call or constructor suppresses diagnostics because that code can install replacement methods on the namespace object.",
      name: "escaped Object namespace",
      filename: "polyfill.server.js",
      settings: { javascriptMode: "es2021", release: "zurich" },
      code: `installPolyfills(Object);
Object.hasOwn(record, "number");`,
    },
    {
      caseId: "object-hasown-availability-guard",
      kind: "scope-boundary",
      description:
        "Calls protected by a proven Object.hasOwn availability guard or optional call stay silent for release-portable code.",
      name: "availability guard",
      filename: "portable.server.js",
      settings: { javascriptMode: "es2021", release: "zurich" },
      code: `Object.hasOwn && Object.hasOwn(record, "number");`,
    },
    {
      caseId: "object-hasown-mutator-authority",
      kind: "false-negative",
      description:
        "Calls through a reassigned Object mutation helper are treated as unknown; the rule does not try to prove that a custom helper installed the feature.",
      name: "reassigned mutation helper",
      filename: "custom-runtime.server.js",
      settings: { javascriptMode: "es2021", release: "zurich" },
      code: `Object.defineProperty = undefined;
Object.defineProperty(Object, "hasOwn", { value: polyfill });
Object.hasOwn(record, "number");`,
    },
  ],
  title: "No unsupported Object.hasOwn",
  family: "engine",
  severity: "error",
  fixable: false,
  hasSuggestions: false,
  description:
    "`Object.hasOwn()` is Not Supported in Zurich ES2021 and Australia ES5; Australia ES2021 Supports it. Compatibility follows the ES5 cell by package policy.",
  bad: [
    {
      name: "Object.hasOwn in Zurich ES2021",
      filename: "script-include.js",
      settings: { javascriptMode: "es2021", release: "zurich" },
      code: `var ownsNumber = Object.hasOwn(record, "number");`,
    },
  ],
  good: [
    {
      name: "portable hasOwnProperty call",
      filename: "script-include.js",
      settings: { javascriptMode: "es5" },
      code: `var ownsNumber = Object.prototype.hasOwnProperty.call(record, "number");`,
    },
  ],
});
