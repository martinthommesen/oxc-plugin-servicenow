import { entry } from "./entry.js";
import { noClientGliderecord } from "../rules/no-client-gliderecord.js";
import * as metadata from "../catalog-metadata.js";

export const noClientGliderecordEntry = entry("no-client-gliderecord", noClientGliderecord, {
  ...metadata.meta(
    metadata.classic(metadata.CLIENT_SURFACES, "n/a", ["scoped"]),
    [
      metadata.evidenceRecord(
        metadata.SN_CLIENT_GR,
        "The Australia client GlideRecord API is unsupported in scoped applications.",
        "manual",
        "2026-08-22",
      ),
      metadata.evidenceRecord(
        metadata.SN_CLIENT_BEST_PRACTICES,
        "ServiceNow no longer recommends client GlideRecord or getReference for performance because they retrieve all fields.",
        "manual",
        "2026-08-22",
      ),
      metadata.evidenceRecord(
        "tests/integration/profiles/invalid/client-gliderecord.client.js",
        "Recommended Oxlint and ESLint flag GlideRecord in client files.",
        "integration-test",
        "2026-08-20",
      ),
      metadata.evidenceRecord(
        "tests/integration/context-contracts.test.ts",
        "Oxlint and ESLint flag direct, global namespace, computed, stable aliased, and destructured constructors without leaking mutually exclusive alias assignments.",
        "integration-test",
        "2026-08-24",
      ),
      metadata.evidenceRecord(
        "tests/rules/no-client-gliderecord.test.ts",
        "Adversarial fixtures cover branch order, alias writes and dominance, shadowing, dynamic scope, namespace escape, and visible platform replacement.",
        "fixture",
        "2026-08-24",
      ),
    ],
    {
      overlaps: ["servicenow/require-query-before-next"],
    },
  ),
  placements: [
    { profile: "recommended", severity: "error" },
    { profile: "client", severity: "error" },
  ],
  optionDescriptor: undefined,
  limitationCases: [
    {
      caseId: "no-client-gliderecord-mixed-ui-action",
      kind: "scope-boundary",
      description:
        "Mixed client/server UI Actions stay silent because the rule cannot classify execution regions.",
      name: "mixed UI Action",
      filename: "mixed.ui-action.js",
      settings: { authoring: "classic", surfaces: ["ui-action", "client", "server"] },
      code: `var record = new GlideRecord("incident");`,
    },
    {
      caseId: "no-client-gliderecord-global-scope",
      kind: "scope-boundary",
      description:
        "Global and unknown application scope stay silent because ServiceNow documents the client API in global applications and only marks scoped applications unsupported.",
      name: "global client script",
      filename: "global.client.js",
      settings: { authoring: "classic", surfaces: ["client"], scope: "global" },
      code: `var record = new GlideRecord("incident");`,
    },
    {
      caseId: "no-client-gliderecord-mutable-alias",
      kind: "false-negative",
      description:
        "Aliases assigned outside their declaration stay silent even when every visible branch selects a platform constructor; proving that identity requires path-sensitive constructor-value analysis.",
      name: "mutable constructor alias",
      filename: "conditional.client.js",
      settings: { authoring: "classic", surfaces: ["client"], scope: "scoped" },
      code: `var GR;
if (condition) {
  GR = GlideRecord;
} else {
  GR = GlideRecordSecure;
}
new GR("incident");`,
    },
    {
      caseId: "no-client-gliderecord-cross-execution-alias",
      kind: "false-negative",
      description:
        "Aliases used from another function body stay silent because source order alone cannot prove that the initializer ran before the function was called.",
      name: "cross-execution constructor alias",
      filename: "deferred.client.js",
      settings: { authoring: "classic", surfaces: ["client"], scope: "scoped" },
      code: `var GR = GlideRecord;
function run() {
  new GR("incident");
}`,
    },
    {
      caseId: "no-client-gliderecord-file-wide-replacement",
      kind: "false-negative",
      description:
        "A possible platform-constructor or namespace replacement suppresses matching calls throughout the file, including calls that appear before the replacement; source order alone does not establish runtime order across function bodies.",
      name: "later constructor replacement",
      filename: "replaced.client.js",
      settings: { authoring: "classic", surfaces: ["client"], scope: "scoped" },
      code: `new GlideRecord("incident");
GlideRecord = LocalRecord;`,
    },
  ],
  title: "No client GlideRecord",
  family: "classic",
  severity: "error",
  fixable: false,
  hasSuggestions: false,
  description:
    "Proven platform GlideRecord calls are unsupported in scoped client applications. Query on the server with GlideAjax or Scripted REST.",
  bad: [
    {
      name: "client script",
      filename: "incident.client.js",
      settings: { scope: "scoped" },
      code: `function onChange() {\n  var gr = new GlideRecord("sys_user");\n  gr.addQuery("user_name", g_user.userName);\n  gr.query();\n}`,
    },
  ],
  good: [
    {
      name: "GlideAjax",
      filename: "incident.client.js",
      settings: { scope: "scoped" },
      code: `function onChange() {\n  var ga = new GlideAjax("x_acme.UserUtils");\n  ga.addParam("sysparm_name", "getUser");\n  ga.getXMLAnswer(function (answer) {\n    g_form.setValue("caller_id", answer);\n  });\n}`,
    },
  ],
});
