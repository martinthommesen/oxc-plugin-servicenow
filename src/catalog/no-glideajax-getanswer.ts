import { entry } from "./entry.js";
import { noGlideajaxGetanswer } from "../rules/no-glideajax-getanswer.js";
import * as metadata from "../catalog-metadata.js";

export const noGlideajaxGetanswerEntry = entry("no-glideajax-getanswer", noGlideajaxGetanswer, {
  ...metadata.meta(
    metadata.classic(metadata.CLIENT_SURFACES),
    [
      metadata.evidenceRecord(
        metadata.SN_GLIDEAJAX,
        "getAnswer belongs to the synchronous getXMLWait pattern.",
        "manual",
        "2026-08-20",
      ),
      metadata.evidenceRecord(
        "tests/integration/profiles/invalid/glideajax-getanswer.client.js",
        "Recommended hosts report getAnswer on proven GlideAjax objects.",
        "integration-test",
        "2026-08-20",
      ),
      metadata.evidenceRecord(
        "tests/rules/no-glideajax-getanswer.test.ts",
        "Constructor, prototype, instance-method, and dynamic-scope mutations remain silent.",
        "fixture",
        "2026-08-24",
      ),
    ],
    {
      overlaps: ["servicenow/no-sync-glideajax"],
    },
  ),
  placements: [
    { profile: "recommended", severity: "error" },
    { profile: "client", severity: "error" },
  ] as const,
  optionDescriptor: undefined,
  limitationCases: [
    {
      caseId: "no-glideajax-getanswer-file-wide-mutation",
      kind: "false-negative",
      description:
        "A possible GlideAjax constructor, prototype, or getAnswer mutation suppresses matching calls throughout the file.",
      name: "later getAnswer mutation",
      filename: "mutated-glideajax.client.js",
      code: `var ajax = new GlideAjax("Lookup");
ajax.getAnswer();
ajax.getAnswer = localAnswer;`,
    },
  ],
  title: "No GlideAjax getAnswer",
  family: "classic",
  severity: "error",
  fixable: false,
  hasSuggestions: false,
  description:
    "`getAnswer()` belongs to synchronous GlideAjax. Use `getXMLAnswer(callback)` instead.",
  bad: [
    {
      name: "getAnswer after getXML",
      filename: "incident.client.js",
      code: `var ajax = new GlideAjax("x_acme.UserLookup");\najax.addParam("sysparm_name", "getManager");\najax.getXML(handleResponse);\nvar answer = ajax.getAnswer();`,
    },
  ],
  good: [
    {
      name: "getXMLAnswer callback",
      filename: "incident.client.js",
      code: `var ajax = new GlideAjax("x_acme.UserLookup");\najax.addParam("sysparm_name", "getManager");\najax.getXMLAnswer(function (answer) {\n  g_form.setValue("u_manager", answer);\n});`,
    },
  ],
});
