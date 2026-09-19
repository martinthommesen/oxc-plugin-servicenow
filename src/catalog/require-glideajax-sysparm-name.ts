import { entry } from "./entry.js";
import { requireGlideajaxSysparmName } from "../rules/require-glideajax-sysparm-name.js";
import * as metadata from "../catalog-metadata.js";

export const requireGlideajaxSysparmNameEntry = entry(
  "require-glideajax-sysparm-name",
  requireGlideajaxSysparmName,
  {
    ...metadata.meta(
      metadata.classic(metadata.CLIENT_SURFACES),
      [
        metadata.evidenceRecord(
          metadata.SN_AJAX,
          "GlideAjax requires a non-empty sysparm_name before getXML, getXMLAnswer, or getXMLWait.",
          "manual",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/integration/profiles/invalid/glideajax-empty-sysparm.client.js",
          "Empty or missing sysparm_name values report on the client host fixtures.",
          "integration-test",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/rules/require-glideajax-sysparm-name.test.ts",
          "Constructor, prototype, instance-method, and dynamic-scope mutations remain silent.",
          "fixture",
          "2026-08-24",
        ),
      ],
      {
        overlaps: ["servicenow/no-glideajax-getanswer", "servicenow/no-sync-glideajax"],
        lifecycleAssumptions:
          "A later request on the same object requires a new usable sysparm_name.",
      },
    ),
    placements: [
      { profile: "recommended", severity: "error" },
      { profile: "client", severity: "error" },
    ] as const,
    optionDescriptor: undefined,
    limitationCases: [
      {
        caseId: "require-glideajax-file-wide-mutation",
        kind: "false-negative",
        description:
          "A possible GlideAjax constructor, prototype, addParam, or request-method mutation suppresses affected lifecycle findings throughout the file.",
        name: "later request-method mutation",
        filename: "mutated-glideajax.client.js",
        code: `var ajax = new GlideAjax("Lookup");
ajax.getXMLAnswer(handleAnswer);
ajax.getXMLAnswer = localRequest;`,
      },
    ],
    title: "Require GlideAjax sysparm_name",
    family: "classic",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      'GlideAjax requires a non-empty `addParam("sysparm_name", method)` before `getXML` / `getXMLAnswer` / `getXMLWait`. Extra static keys must start with `sysparm_`. Evidence: https://www.servicenow.com/docs/r/api-reference/scripts/p_AJAX.html',
    bad: [
      {
        name: "missing sysparm_name",
        filename: "incident.client.js",
        code: `var ajax = new GlideAjax("x_acme.UserLookup");\najax.addParam("sysparm_user_id", g_form.getValue("caller_id"));\najax.getXMLAnswer(handleAnswer);`,
      },
    ],
    good: [
      {
        name: "named method",
        filename: "incident.client.js",
        code: `var ajax = new GlideAjax("x_acme.UserLookup");\najax.addParam("sysparm_name", "getManager");\najax.addParam("sysparm_user_id", g_form.getValue("caller_id"));\najax.getXMLAnswer(handleAnswer);`,
      },
    ],
  },
);
