import {
  entry,
  platformMethodAuthorityEvidence,
  platformMethodMutationLimitation,
} from "./entry.js";
import { noGliderecordQueryModifierAfterQuery } from "../rules/no-gliderecord-query-modifier-after-query.js";
import * as metadata from "../catalog-metadata.js";

export const noGliderecordQueryModifierAfterQueryEntry = entry(
  "no-gliderecord-query-modifier-after-query",
  noGliderecordQueryModifierAfterQuery,
  {
    ...metadata.meta(
      metadata.classic(metadata.SERVER_SURFACES),
      [
        metadata.evidenceRecord(
          metadata.SN_GR_GLOBAL,
          "Query modifiers after a documented query executor do not change the open cursor.",
          "manual",
          "2026-08-22",
        ),
        metadata.evidenceRecord(
          "tests/integration/profiles/invalid/late-modifier.br.js",
          "Recommended hosts report addQuery after query before next.",
          "integration-test",
          "2026-08-20",
        ),
        platformMethodAuthorityEvidence(),
      ],
      {
        overlaps: ["servicenow/require-query-before-next"],
        lifecycleAssumptions:
          "Modifiers after a definite executor are findings only when a consumer uses the still-open cursor. A possible-only executor clears positive lifecycle facts.",
      },
    ),
    placements: [
      { profile: "recommended", severity: "error" },
      { profile: "business-rule", severity: "error" },
    ],
    optionDescriptor: undefined,
    limitationCases: [
      platformMethodMutationLimitation(
        "query-modifier-file-wide-mutation",
        `var record = new GlideRecord("incident");
record.query();
record.addQuery("active", true);
record.next();
record.next = localNext;`,
      ),
    ],
    title: "No query modifier after query",
    family: "classic",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "Filters and result-shaping calls after a documented query executor do not change the open cursor. Report when a consumer uses that cursor before another execution.",
    bad: [
      {
        name: "addQuery after query",
        filename: "incident.br.js",
        code: `var incident = new GlideRecord("incident");\nincident.query();\nincident.addQuery("active", true);\nwhile (incident.next()) {\n  gs.info(incident.number);\n}`,
      },
    ],
    good: [
      {
        name: "filter then query",
        filename: "incident.br.js",
        code: `var incident = new GlideRecord("incident");\nincident.addQuery("active", true);\nincident.query();\nwhile (incident.next()) {\n  gs.info(incident.number);\n}`,
      },
    ],
  },
);
