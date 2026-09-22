import {
  entry,
  platformMethodAuthorityEvidence,
  platformMethodMutationLimitation,
} from "./entry.js";
import { preferSetnocountWithChoosewindow } from "../rules/prefer-setnocount-with-choosewindow.js";
import * as metadata from "../catalog-metadata.js";

export const preferSetnocountWithChoosewindowEntry = entry(
  "prefer-setnocount-with-choosewindow",
  preferSetnocountWithChoosewindow,
  {
    ...metadata.meta(
      metadata.classic(metadata.SERVER_SURFACES),
      [
        metadata.evidenceRecord(
          metadata.SN_GR,
          "query() after chooseWindow() runs COUNT(*) unless setNoCount() or setLimit() skips it.",
          "manual",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          metadata.SN_GR_AUSTRALIA,
          "Australia retains the documented chooseWindow query count and setNoCount/setLimit behavior.",
          "manual",
          "2026-08-22",
        ),
        metadata.evidenceRecord(
          "tests/integration/profiles/invalid/setnocount-second-query.br.js",
          "A later query epoch is not justified by an earlier getRowCount().",
          "integration-test",
          "2026-08-20",
        ),
        platformMethodAuthorityEvidence(),
      ],
      {
        overlaps: ["servicenow/require-query-before-next"],
        lifecycleAssumptions:
          "Window and setNoCount state are scoped to one query epoch and one object identity.",
      },
    ),
    placements: [{ profile: "strict", severity: "warn" }],
    optionDescriptor: undefined,
    limitationCases: [
      platformMethodMutationLimitation(
        "setnocount-file-wide-mutation",
        `var record = new GlideRecord("incident");
record.chooseWindow(0, 20);
record.query();
record.query = localQuery;`,
      ),
    ],
    title: "Prefer setNoCount with chooseWindow",
    family: "classic",
    severity: "warn",
    fixable: false,
    hasSuggestions: false,
    description:
      "The reviewed Zurich and Australia-scoped GlideRecord references document that `query()` after `chooseWindow()` runs `COUNT(*)` unless `setNoCount()` or `setLimit()` skips it. The rule is silent when `getRowCount()` is used, when `chooseWindow` forces a count, or when the binding escapes.",
    bad: [
      {
        name: "window without setNoCount",
        filename: "page.br.js",
        code: `var rec = new GlideRecord("incident");\nrec.chooseWindow(0, 20);\nrec.query();\nwhile (rec.next()) {\n  gs.info(rec.getValue("number"));\n}`,
      },
    ],
    good: [
      {
        name: "setNoCount",
        filename: "page.br.js",
        code: `var rec = new GlideRecord("incident");\nrec.chooseWindow(0, 20);\nrec.setNoCount();\nrec.query();\nwhile (rec.next()) {\n  gs.info(rec.getValue("number"));\n}`,
      },
    ],
  },
);
