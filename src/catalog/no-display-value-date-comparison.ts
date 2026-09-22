import {
  entry,
  platformMethodAuthorityEvidence,
  platformMethodMutationLimitation,
} from "./entry.js";
import { noDisplayValueDateComparison } from "../rules/no-display-value-date-comparison.js";
import * as metadata from "../catalog-metadata.js";

export const noDisplayValueDateComparisonEntry = entry(
  "no-display-value-date-comparison",
  noDisplayValueDateComparison,
  {
    ...metadata.meta(
      metadata.classic(metadata.SERVER_SURFACES),
      [
        metadata.evidenceRecord(
          metadata.SN_GDT,
          "GlideDateTime.getDisplayValue() follows the session format and is not a chronological sort key.",
          "manual",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "src/catalog.ts",
          "Catalog examples cover display-value comparison versus getNumericValue.",
          "fixture",
          "2026-08-20",
        ),
        platformMethodAuthorityEvidence(),
      ],
      {
        overlaps: ["servicenow/no-gs-now"],
      },
    ),
    placements: [{ profile: "strict", severity: "warn" }] as const,
    optionDescriptor: undefined,
    limitationCases: [
      {
        caseId: "display-date-local-copy",
        kind: "false-negative",
        description: "Display values copied into locals are not tracked before comparison.",
        name: "copied display value",
        filename: "copied-display.server.js",
        code: `var date = new GlideDateTime();
var display = date.getDisplayValue();
if (display < "2026-01-01") gs.info(display);`,
      },
      platformMethodMutationLimitation(
        "display-date-file-wide-mutation",
        `var date = new GlideDateTime();
if (date.getDisplayValue() < "2026-01-01") gs.info(date);
date.getDisplayValue = localDisplay;`,
      ),
    ],
    title: "No display-value date comparison",
    family: "classic",
    severity: "warn",
    fixable: false,
    hasSuggestions: false,
    description:
      "Do not relationally compare `GlideDateTime.getDisplayValue()` strings. Use `getNumericValue()` or a date-aware API.",
    bad: [
      {
        name: "display string compare",
        filename: "incident.br.js",
        code: `var start = new GlideDateTime(current.start_date);\nvar end = new GlideDateTime(current.end_date);\nif (start.getDisplayValue() > end.getDisplayValue()) {\n  gs.addErrorMessage("Start must be before end");\n}`,
      },
    ],
    good: [
      {
        name: "numeric compare",
        filename: "incident.br.js",
        code: `var start = new GlideDateTime(current.start_date);\nvar end = new GlideDateTime(current.end_date);\nif (start.getNumericValue() > end.getNumericValue()) {\n  gs.addErrorMessage("Start must be before end");\n}`,
      },
    ],
  },
);
