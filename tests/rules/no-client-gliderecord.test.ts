import { describe, it } from "node:test";
import { assertInvalid, assertValid } from "../helpers/rule-tester.js";

const RULE = "no-client-gliderecord" as const;

describe(RULE, () => {
  it("flags GlideRecord in a client filename", () => {
    assertInvalid(
      `var gr = new GlideRecord("sys_user");`,
      RULE,
      { messageId: "glideRecord" },
      {
        filename: "incident.client.js",
        settings: { scope: "scoped" },
      },
    );
  });

  it("flags GlideRecord when g_form is used", () => {
    assertInvalid(
      `g_form.setValue("x", "1");\nvar gr = new GlideRecord("sys_user");`,
      RULE,
      { messageId: "glideRecord" },
      { filename: "onChange.js", settings: { scope: "scoped" } },
    );
  });

  it("flags global namespace and computed constructors", () => {
    assertInvalid(
      `new global.GlideRecord("incident");
new global["GlideRecordSecure"]("task");`,
      RULE,
      { messageId: "glideRecord", count: 2 },
      { filename: "form.client.js", settings: { scope: "scoped" } },
    );
  });

  it("flags direct and destructured constructor aliases", () => {
    assertInvalid(
      `var GR = GlideRecord;
const { GlideRecordSecure: GRS } = global;
new GR("incident");
new GRS("task");`,
      RULE,
      { messageId: "glideRecord", count: 2 },
      { filename: "form.client.js", settings: { scope: "scoped" } },
    );
  });

  it("forgets a reassigned constructor alias", () => {
    assertValid(
      `var GR = GlideRecord;
GR = LocalRecord;
new GR("incident");`,
      RULE,
      { filename: "form.client.js" },
    );
  });

  it("stays silent for global or unknown application scope", () => {
    assertValid(`var gr = new GlideRecord("sys_user");`, RULE, {
      filename: "global.client.js",
      settings: { scope: "global" },
    });
    assertValid(`var gr = new GlideRecord("sys_user");`, RULE, {
      filename: "unknown.client.js",
    });
  });

  it("allows GlideRecord on the server", () => {
    assertValid(`var gr = new GlideRecord("incident");\ngr.query();`, RULE, {
      filename: "incident.br.js",
    });
  });

  it("allows GlideRecord in a display Business Rule that writes g_scratchpad", () => {
    assertValid(
      `var gr = new GlideRecord("incident");\ngr.query();\ng_scratchpad.count = 1;`,
      RULE,
      { filename: "display-stuff.br.js" },
    );
  });
});
