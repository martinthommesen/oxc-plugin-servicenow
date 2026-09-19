import {
  entry,
  platformMethodAuthorityEvidence,
  platformMethodMutationLimitation,
} from "./entry.js";
import { noDeleteMultipleWithWindowing } from "../rules/no-delete-multiple-with-windowing.js";
import * as metadata from "../catalog-metadata.js";

export const noDeleteMultipleWithWindowingEntry = entry(
  "no-delete-multiple-with-windowing",
  noDeleteMultipleWithWindowing,
  {
    ...metadata.meta(
      metadata.classic(metadata.SERVER_SURFACES),
      [
        metadata.evidenceRecord(
          metadata.SN_GR,
          "setLimit and chooseWindow do not limit deleteMultiple(); the call deletes every matching row.",
          "manual",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/integration/profiles/invalid/windowed-delete.br.js",
          "Recommended hosts report windowed deleteMultiple.",
          "integration-test",
          "2026-08-20",
        ),
        platformMethodAuthorityEvidence(),
      ],
      {
        overlaps: ["servicenow/no-unfiltered-gliderecord-bulk-operation"],
        lifecycleAssumptions:
          "Window methods must resolve to the same GlideRecord object identity as deleteMultiple.",
      },
    ),
    placements: [
      { profile: "recommended", severity: "error" },
      { profile: "business-rule", severity: "error" },
    ] as const,
    optionDescriptor: undefined,
    limitationCases: [
      platformMethodMutationLimitation(
        "windowed-delete-file-wide-mutation",
        `var record = new GlideRecord("incident");
record.setLimit(10);
record.deleteMultiple();
record.deleteMultiple = localDelete;`,
      ),
    ],
    title: "No deleteMultiple with windowing",
    family: "classic",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "`setLimit()` and `chooseWindow()` do not limit `deleteMultiple()`. The call deletes every row that matches the query. Evidence: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html",
    bad: [
      {
        name: "setLimit then deleteMultiple",
        filename: "incident.br.js",
        code: `var stale = new GlideRecord("x_acme_staging");\nstale.addQuery("state", "expired");\nstale.setLimit(100);\nstale.deleteMultiple();`,
      },
    ],
    good: [
      {
        name: "intentional bulk delete",
        filename: "incident.br.js",
        code: `var stale = new GlideRecord("x_acme_staging");\nstale.addQuery("state", "expired");\nstale.deleteMultiple();`,
      },
    ],
  },
);
