import { entry } from "./entry.js";
import { noHardcodedSysid } from "../rules/no-hardcoded-sysid.js";
import * as metadata from "../catalog-metadata.js";
import { noHardcodedSysidOptions } from "../options/index.js";

export const noHardcodedSysidEntry = entry("no-hardcoded-sysid", noHardcodedSysid, {
  ...metadata.meta(
    metadata.classic(metadata.CLASSIC_SURFACES),
    [
      metadata.evidenceRecord(
        metadata.SN_FLUENT_CONSTRUCTS,
        "Named Fluent Now.ID keys are the supported portable identity, not raw sys_id literals.",
        "manual",
        "2026-08-20",
      ),
      metadata.evidenceRecord(
        "tests/rules/no-hardcoded-sysid.test.ts",
        "Literal, uppercase, concatenated, and static-template sys_ids report; exact allow-lists and structurally owned algorithm-specific hash contexts suppress.",
        "fixture",
        "2026-08-24",
      ),
      metadata.evidenceRecord(
        "tests/integration/profiles/valid/hash-context.br.js",
        "Real Oxlint and ESLint valid-profile contracts preserve an outer MD5 owner across nested sibling expressions.",
        "integration-test",
        "2026-08-24",
      ),
    ],
    {
      overlaps: ["servicenow/no-now-id-as-reference", "core no-restricted-syntax"],
    },
  ),
  placements: [{ profile: "recommended", severity: "error" }],
  optionDescriptor: noHardcodedSysidOptions,
  limitationCases: [
    {
      caseId: "no-hardcoded-sysid-md5-owner",
      kind: "false-negative",
      description:
        "Default MD5-owner suppression can hide a real sys_id stored under an MD5-like name; set `ignoreHashNames: false` when that false-negative tradeoff is unacceptable.",
      name: "MD5-like owner",
      filename: "incident.br.js",
      code: `var expectedMd5 = "97c04b3b1b12100043ab85e5bd0713e2";`,
    },
  ],
  title: "No hardcoded sys_id",
  family: "classic",
  severity: "error",
  fixable: false,
  hasSuggestions: false,
  description:
    "Hardcoded 32-character sys_ids break when an app is installed on another instance. Store them in a system property, a named constant, or Fluent `Now.ID`.",
  bad: [
    {
      name: "literal sys_id",
      filename: "incident.br.js",
      code: `var assignmentGroup = "97c04b3b1b12100043ab85e5bd0713e2";\ncurrent.assignment_group = assignmentGroup;`,
    },
  ],
  good: [
    {
      name: "system property",
      filename: "incident.br.js",
      code: `var assignmentGroup = gs.getProperty("x_acme.default_assignment_group");\ncurrent.assignment_group = assignmentGroup;`,
    },
  ],
});
