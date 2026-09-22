import {
  entry,
  platformMethodAuthorityEvidence,
  platformMethodMutationLimitation,
} from "./entry.js";
import { preferGlideaggregate } from "../rules/prefer-glideaggregate.js";
import * as metadata from "../catalog-metadata.js";

export const preferGlideaggregateEntry = entry("prefer-glideaggregate", preferGlideaggregate, {
  ...metadata.meta(
    metadata.classic(metadata.SERVER_SURFACES),
    [
      metadata.evidenceRecord(
        metadata.SN_GA_AUSTRALIA,
        "The Australia GlideAggregate API documents database-side COUNT and other aggregate queries.",
        "manual",
        "2026-08-22",
      ),
      metadata.evidenceRecord(
        metadata.SN_GA_GLOBAL_AUSTRALIA,
        "The Australia global GlideAggregate API provides the same database aggregation surface.",
        "manual",
        "2026-08-22",
      ),
      metadata.evidenceRecord(
        metadata.SN_GR_AUSTRALIA,
        "The Australia GlideRecord API recommends GlideAggregate when only a record count is needed because it does not retrieve matching records.",
        "manual",
        "2026-08-22",
      ),
      metadata.evidenceRecord(
        "tests/rules/prefer-glideaggregate.test.ts",
        "Iterate-to-count loops using next() or _next() report; if (gr.next()) stays silent.",
        "fixture",
        "2026-08-20",
      ),
      platformMethodAuthorityEvidence(),
    ],
    {
      overlaps: ["servicenow/validate-glideaggregate-calls"],
    },
  ),
  placements: [{ profile: "strict", severity: "warn" }],
  optionDescriptor: undefined,
  limitationCases: [
    platformMethodMutationLimitation(
      "prefer-glideaggregate-file-wide-mutation",
      `var gr = new GlideRecord("incident");
gr.getRowCount();
gr.getRowCount = localCount;`,
    ),
  ],
  title: "Prefer GlideAggregate",
  family: "classic",
  severity: "warn",
  fixable: false,
  hasSuggestions: false,
  description:
    "`GlideRecord.getRowCount()` (and iterate-to-count loops) load every matching row. `GlideAggregate` counts in the database.",
  bad: [
    {
      name: "getRowCount",
      filename: "incident.br.js",
      code: `var gr = new GlideRecord("incident");\ngr.addActiveQuery();\ngr.query();\nvar count = gr.getRowCount();`,
    },
  ],
  good: [
    {
      name: "GlideAggregate COUNT",
      filename: "incident.br.js",
      code: `var ga = new GlideAggregate("incident");\nga.addActiveQuery();\nga.addAggregate("COUNT");\nga.query();\nvar count = ga.next() ? parseInt(ga.getAggregate("COUNT"), 10) : 0;`,
    },
  ],
});
