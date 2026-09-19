import { entry } from "./entry.js";
import { noGsNow } from "../rules/no-gs-now.js";
import * as metadata from "../catalog-metadata.js";

export const noGsNowEntry = entry("no-gs-now", noGsNow, {
  ...metadata.meta(
    metadata.classic(metadata.CLASSIC_SURFACES),
    [
      metadata.evidenceRecord(
        metadata.SN_GDT,
        "gs.now() and gs.nowDateTime() return display strings, not GlideDateTime objects.",
        "manual",
        "2026-08-20",
      ),
      metadata.evidenceRecord(
        "tests/integration/fixtures/bad-business-rule.br.js",
        "Host fixtures report gs.now on Business Rule files.",
        "integration-test",
        "2026-08-20",
      ),
      metadata.evidenceRecord(
        "tests/integration/context-contracts.test.ts",
        "Oxlint and ESLint stay silent when visible writes make the gs global or target method identity unknown.",
        "integration-test",
        "2026-08-24",
      ),
    ],
    {
      overlaps: ["servicenow/no-display-value-date-comparison"],
    },
  ),
  placements: [
    { profile: "recommended", severity: "error" },
    { profile: "client", severity: "error" },
  ] as const,
  optionDescriptor: undefined,
  limitationCases: [
    {
      caseId: "no-gs-now-local-object",
      kind: "scope-boundary",
      description: "Local objects named gs are not the platform global.",
      name: "local gs object",
      filename: "local-gs.server.js",
      code: `var gs = { now: function () { return "local"; } };
gs.now();`,
    },
    {
      caseId: "no-gs-now-file-wide-mutation",
      kind: "false-negative",
      description:
        "A possible gs or target-method mutation suppresses every matching call in the file, including calls that appear before the mutation.",
      name: "later gs method mutation",
      filename: "mutated-gs.server.js",
      code: `gs.now();
gs.now = localNow;`,
    },
  ],
  title: "No gs.now()",
  family: "classic",
  severity: "error",
  fixable: false,
  hasSuggestions: false,
  description:
    "`gs.now()` and `gs.nowDateTime()` return timezone-sensitive display strings. `gs.now()` is also gone from client scripts since London. Prefer `new GlideDateTime()`.",
  bad: [
    { name: "gs.now", filename: "incident.br.js", code: `current.u_opened = gs.now();` },
    {
      name: "gs.nowDateTime",
      filename: "incident.br.js",
      code: `current.u_opened = gs.nowDateTime();`,
    },
  ],
  good: [
    {
      name: "GlideDateTime",
      filename: "incident.br.js",
      code: `current.u_opened = new GlideDateTime();`,
    },
  ],
});
