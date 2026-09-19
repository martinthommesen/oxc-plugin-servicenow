import {
  entry,
  platformMethodAuthorityEvidence,
  platformMethodMutationLimitation,
} from "./entry.js";
import { noSystemQueryBypass } from "../rules/no-system-query-bypass.js";
import * as metadata from "../catalog-metadata.js";

export const noSystemQueryBypassEntry = entry("no-system-query-bypass", noSystemQueryBypass, {
  ...metadata.meta(
    metadata.classic(metadata.SERVER_SURFACES),
    [
      metadata.evidenceRecord(
        metadata.SN_GR,
        "addSystemQuery and related methods bypass query ACLs and need review.",
        "manual",
        "2026-08-20",
      ),
      metadata.evidenceRecord(
        "tests/integration/profiles/invalid/system-query.br.js",
        "The security profile reports documented ACL-bypass methods.",
        "integration-test",
        "2026-08-20",
      ),
      metadata.evidenceRecord(
        "tests/integration/context-contracts.test.ts",
        "Oxlint and ESLint report folded, dynamic, extracted, and escaped GlideRecord bypass access.",
        "integration-test",
        "2026-08-21",
      ),
      platformMethodAuthorityEvidence(),
    ],
    {
      overlaps: [],
      limitationPreamble:
        "Unproven, invalid, or ambiguous GlideRecord bindings stay silent. Proven escaped GlideRecord identities remain reviewable because this opt-in security rule favors surfacing potential ACL bypasses.",
    },
  ),
  placements: [{ profile: "security", severity: "warn" }] as const,
  optionDescriptor: undefined,
  limitationCases: [
    platformMethodMutationLimitation(
      "system-query-file-wide-mutation",
      `var record = new GlideRecord("incident");
record.addSystemQuery("active", true);
record.addSystemQuery = localQuery;`,
    ),
  ],
  title: "Review system query ACL bypass",
  family: "classic",
  severity: "warn",
  fixable: false,
  hasSuggestions: false,
  description:
    "Opt-in security review for documented ACL-bypass query APIs. Unknown computed GlideRecord access also reports for review.",
  bad: [
    {
      name: "addSystemQuery",
      filename: "incident.br.js",
      code: `var user = new GlideRecord("sys_user");\nuser.addSystemQuery("active", true);\nuser.query();`,
    },
  ],
  good: [
    {
      name: "addQuery",
      filename: "incident.br.js",
      code: `var user = new GlideRecord("sys_user");\nuser.addQuery("active", true);\nuser.query();`,
    },
  ],
});
