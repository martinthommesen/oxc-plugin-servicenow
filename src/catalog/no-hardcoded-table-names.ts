import { entry } from "./entry.js";
import { noHardcodedTableNames } from "../rules/no-hardcoded-table-names.js";
import * as metadata from "../catalog-metadata.js";
import { noHardcodedTableNamesOptions } from "../options/index.js";

export const noHardcodedTableNamesEntry = entry("no-hardcoded-table-names", noHardcodedTableNames, {
  ...metadata.meta(
    metadata.classic(metadata.SERVER_SURFACES),
    [
      metadata.evidenceRecord(
        metadata.SN_GR,
        "Table names passed to GlideRecord constructors are string identities that do not rename safely.",
        "manual",
        "2026-08-20",
      ),
      metadata.evidenceRecord(
        "tests/rules/glide-and-engine.test.ts",
        "Literal tables report; named constants and allow-lists stay silent.",
        "fixture",
        "2026-08-20",
      ),
    ],
    {
      overlaps: ["servicenow/fluent-naming-convention"],
    },
  ),
  placements: [{ profile: "policy", severity: "warn" }] as const,
  optionDescriptor: noHardcodedTableNamesOptions,
  limitationCases: [],
  title: "No hardcoded table names",
  family: "classic",
  severity: "warn",
  fixable: false,
  hasSuggestions: false,
  description:
    "Optional organizational policy. String-literal table names in `GlideRecord` / `GlideRecordSecure` / `GlideAggregate` are hard to rename. Prefer named constants or Fluent table exports.",
  bad: [
    {
      name: "literal table",
      filename: "incident.br.js",
      code: `var gr = new GlideRecord("x_acme_widget");`,
    },
  ],
  good: [
    {
      name: "named constant",
      filename: "incident.br.js",
      code: `var TABLE = { WIDGET: "x_acme_widget" };\nvar gr = new GlideRecord(TABLE.WIDGET);`,
    },
  ],
});
