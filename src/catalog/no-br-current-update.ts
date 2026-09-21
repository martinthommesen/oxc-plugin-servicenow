import { entry } from "./entry.js";
import { noBrCurrentUpdate } from "../rules/no-br-current-update.js";
import * as metadata from "../catalog-metadata.js";

export const noBrCurrentUpdateEntry = entry("no-br-current-update", noBrCurrentUpdate, {
  ...metadata.meta(
    metadata.classic(["business-rule"]),
    [
      metadata.evidenceRecord(
        metadata.SN_BR,
        "Business Rules should not call current.update() because the engine already writes the row.",
        "manual",
        "2026-08-20",
      ),
      metadata.evidenceRecord(
        "tests/integration/fixtures/bad-business-rule.br.js",
        "Host fixtures report current.update on Business Rule files.",
        "integration-test",
        "2026-08-20",
      ),
      metadata.evidenceRecord(
        "tests/integration/context-contracts.test.ts",
        "Oxlint and ESLint stay silent when visible current binding replacement makes identity uncertain while canonical wrapper calls still report.",
        "integration-test",
        "2026-08-24",
      ),
      metadata.evidenceRecord(
        "tests/rules/layer3-consumers.test.ts",
        "Canonical wrapper fixtures distinguish the required synchronous current argument from pre-call escape, receiver replacement, and GlideRecord prototype mutation.",
        "fixture",
        "2026-08-24",
      ),
    ],
    {
      overlaps: [],
    },
  ),
  placements: [
    { profile: "recommended", severity: "error" },
    { profile: "business-rule", severity: "error" },
  ] as const,
  optionDescriptor: undefined,
  limitationCases: [
    {
      caseId: "no-br-current-update-method-mutation",
      kind: "false-negative",
      description:
        "A possible current.update or GlideRecord.prototype.update mutation suppresses matching calls throughout the file.",
      name: "visible update replacement",
      filename: "mutated-method.br.js",
      code: `current.update = localUpdate;
current.update();`,
    },
  ],
  title: "No current.update() in Business Rules",
  family: "classic",
  severity: "error",
  fixable: false,
  hasSuggestions: false,
  description:
    "`current.update()` retriggers other Business Rules and can recurse. Set fields on `current` and let the platform save. Reports only when the file is a Business Rule. Shadowed `current` bindings are ignored.",
  bad: [
    {
      name: "current.update",
      filename: "incident.br.js",
      code: `current.state = 2;\ncurrent.update();`,
    },
  ],
  good: [
    {
      name: "assign and return",
      filename: "incident.br.js",
      code: `current.state = 2;\ncurrent.work_notes = "Moved to In Progress";`,
    },
  ],
});
