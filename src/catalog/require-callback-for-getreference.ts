import { entry } from "./entry.js";
import { requireCallbackForGetreference } from "../rules/require-callback-for-getreference.js";
import * as metadata from "../catalog-metadata.js";

export const requireCallbackForGetreferenceEntry = entry(
  "require-callback-for-getreference",
  requireCallbackForGetreference,
  {
    ...metadata.meta(metadata.classic(metadata.CLIENT_SURFACES), [
      metadata.evidenceRecord(
        metadata.SN_FORM,
        "g_form.getReference without a callback is a synchronous server request.",
        "manual",
        "2026-08-20",
      ),
      metadata.evidenceRecord(
        "tests/integration/profiles/invalid/sync-getreference.client.js",
        "Recommended hosts report the one-argument form.",
        "integration-test",
        "2026-08-20",
      ),
      metadata.evidenceRecord(
        "tests/rules/require-callback-for-getreference.test.ts",
        "Immutable callback aliases and visible method mutations are covered adversarially.",
        "fixture",
        "2026-08-24",
      ),
    ]),
    placements: [
      { profile: "recommended", severity: "error" },
      { profile: "client", severity: "error" },
    ],
    optionDescriptor: undefined,
    limitationCases: [
      {
        caseId: "require-callback-local-g-form",
        kind: "scope-boundary",
        description: "Local objects named g_form are not the platform global.",
        name: "local g_form object",
        filename: "local-gform.client.js",
        code: `var g_form = { getReference: function () {} };
g_form.getReference("caller_id");`,
      },
      {
        caseId: "require-callback-file-wide-mutation",
        kind: "false-negative",
        description:
          "A possible g_form, GlideForm prototype, or getReference mutation suppresses matching calls throughout the file because deferred runtime order cannot be inferred from source order.",
        name: "later getReference mutation",
        filename: "mutated-gform.client.js",
        code: `g_form.getReference("caller_id");
g_form.getReference = localReference;`,
      },
    ],
    title: "Require callback for getReference",
    family: "classic",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "`g_form.getReference(field)` without a callback is a synchronous server request. Pass a callback.",
    bad: [
      {
        name: "sync getReference",
        filename: "incident.client.js",
        code: `function onChange() {\n  var caller = g_form.getReference("caller_id");\n  g_form.setValue("u_manager", caller.manager);\n}`,
      },
    ],
    good: [
      {
        name: "async getReference",
        filename: "incident.client.js",
        code: `function onChange() {\n  g_form.getReference("caller_id", function (caller) {\n    g_form.setValue("u_manager", caller.manager);\n  });\n}`,
      },
    ],
  },
);
