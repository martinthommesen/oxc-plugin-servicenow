import { entry } from "./entry.js";
import { noSyncGlideajax } from "../rules/no-sync-glideajax.js";
import * as metadata from "../catalog-metadata.js";

export const noSyncGlideajaxEntry = entry("no-sync-glideajax", noSyncGlideajax, {
  ...metadata.meta(
    metadata.classic(metadata.CLIENT_SURFACES),
    [
      metadata.evidenceRecord(
        metadata.SN_GLIDEAJAX,
        "getXMLWait is a synchronous browser request.",
        "manual",
        "2026-08-20",
      ),
      metadata.evidenceRecord(
        "src/catalog/no-sync-glideajax.ts",
        "Catalog examples cover getXMLWait versus getXMLAnswer.",
        "fixture",
        "2026-08-20",
      ),
      metadata.evidenceRecord(
        "tests/rules/glide-and-engine.test.ts",
        "Constructor, prototype, instance-method, and dynamic-scope mutations remain silent.",
        "fixture",
        "2026-08-24",
      ),
    ],
    {
      overlaps: ["servicenow/no-glideajax-getanswer"],
    },
  ),
  placements: [
    { profile: "recommended", severity: "error" },
    { profile: "client", severity: "error" },
  ],
  optionDescriptor: undefined,
  limitationCases: [
    {
      caseId: "no-sync-glideajax-file-wide-mutation",
      kind: "false-negative",
      description:
        "A possible GlideAjax constructor, prototype, or getXMLWait mutation suppresses matching calls throughout the file.",
      name: "later getXMLWait mutation",
      filename: "mutated-glideajax.client.js",
      code: `var ajax = new GlideAjax("Lookup");
ajax.getXMLWait();
ajax.getXMLWait = localWait;`,
    },
  ],
  title: "No synchronous GlideAjax",
  family: "classic",
  severity: "error",
  fixable: false,
  hasSuggestions: false,
  description:
    "`getXMLWait()` blocks the browser and does not work in Service Portal. Use `getXML()` / `getXMLAnswer()`.",
  bad: [
    {
      name: "getXMLWait",
      filename: "incident.client.js",
      code: `var ga = new GlideAjax("x_acme.UserUtils");\nga.addParam("sysparm_name", "getUser");\nvar xml = ga.getXMLWait();\nvar answer = xml.documentElement.getAttribute("answer");`,
    },
  ],
  good: [
    {
      name: "getXMLAnswer",
      filename: "incident.client.js",
      code: `var ga = new GlideAjax("x_acme.UserUtils");\nga.addParam("sysparm_name", "getUser");\nga.getXMLAnswer(function (answer) {\n  g_form.setValue("caller_id", answer);\n});`,
    },
  ],
});
