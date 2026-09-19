import {
  entry,
  platformMethodAuthorityEvidence,
  platformMethodMutationLimitation,
} from "./entry.js";
import { noUnfilteredGliderecordBulkOperation } from "../rules/no-unfiltered-gliderecord-bulk-operation.js";
import * as metadata from "../catalog-metadata.js";

export const noUnfilteredGliderecordBulkOperationEntry = entry(
  "no-unfiltered-gliderecord-bulk-operation",
  noUnfilteredGliderecordBulkOperation,
  {
    ...metadata.meta(
      metadata.classic(metadata.SERVER_SURFACES),
      [
        metadata.evidenceRecord(
          metadata.SN_GR,
          "updateMultiple and deleteMultiple apply to every row that matches the query filters.",
          "manual",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/integration/profiles/invalid/empty-addquery-bulk.br.js",
          "Empty or missing addQuery arguments do not count as filters.",
          "integration-test",
          "2026-08-20",
        ),
        platformMethodAuthorityEvidence(),
      ],
      {
        overlaps: ["servicenow/no-delete-multiple-with-windowing"],
        lifecycleAssumptions:
          "query, orderBy, setLimit, and chooseWindow are not restricting filters.",
      },
    ),
    placements: [{ profile: "recommended", severity: "warn" }] as const,
    optionDescriptor: undefined,
    limitationCases: [
      platformMethodMutationLimitation(
        "unfiltered-bulk-file-wide-mutation",
        `var record = new GlideRecord("incident");
record.deleteMultiple();
record.deleteMultiple = localDelete;`,
      ),
    ],
    title: "No unfiltered GlideRecord bulk operation",
    family: "classic",
    severity: "warn",
    fixable: false,
    hasSuggestions: false,
    description:
      '`updateMultiple()` / `deleteMultiple()` without a proven restricting filter can touch every row. `query`, `orderBy`, `setLimit`, and `chooseWindow` are not filters. Empty `addQuery()` / `addEncodedQuery("")` do not count.',
    bad: [
      {
        name: "deleteMultiple with no filter",
        filename: "incident.br.js",
        code: `var staging = new GlideRecord("x_acme_staging");\nstaging.deleteMultiple();`,
      },
    ],
    good: [
      {
        name: "filtered updateMultiple",
        filename: "incident.br.js",
        code: `var task = new GlideRecord("task");\ntask.addQuery("active", false);\ntask.setValue("u_migrated", true);\ntask.updateMultiple();`,
      },
    ],
  },
);
