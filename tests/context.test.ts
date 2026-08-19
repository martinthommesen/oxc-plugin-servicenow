import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parse } from "./helpers/rule-tester.js";
import { applyRules } from "../src/runtime/apply-rules.js";
import { validateServiceNowSettings, ServiceNowSettingsError } from "../src/settings/index.js";
import { classifyFile } from "../src/utils/filenames.js";
import { assertInvalid, assertValid, ES5, ES2021 } from "./helpers/rule-tester.js";

describe("settings validation", () => {
  it("accepts empty settings", () => {
    const result = validateServiceNowSettings(undefined);
    assert.equal(result.settings.javascriptMode, undefined);
    assert.equal(result.settings.scope, "unknown");
  });

  it("rejects unknown keys", () => {
    assert.throws(
      () => validateServiceNowSettings({ ecamLatest: true }),
      ServiceNowSettingsError,
    );
  });

  it("rejects an invalid javascriptMode", () => {
    assert.throws(
      () => validateServiceNowSettings({ javascriptMode: "es6" }),
      /javascriptMode/,
    );
  });

  it("maps ecmaLatest true to a deprecation", () => {
    const result = validateServiceNowSettings({ ecmaLatest: true });
    assert.equal(result.settings.ecmaLatest, true);
    assert.ok(result.deprecations.some((item) => item.path.includes("ecmaLatest")));
  });

  it("rejects ecmaLatest true with javascriptMode es5", () => {
    assert.throws(
      () => validateServiceNowSettings({ ecmaLatest: true, javascriptMode: "es5" }),
      /conflicts/,
    );
  });

    it("rejects a malformed sys_id", () => {
    assert.throws(
      () => validateServiceNowSettings({ allowedSysIds: ["NOT-A-SYS-ID"] }),
      /allowedSysIds/,
    );
  });

  it("rejects duplicate surfaces", () => {
    assert.throws(
      () => validateServiceNowSettings({ surfaces: ["client", "client"] }),
      /surfaces/,
    );
  });

  it("rejects a conflicting scriptType and surfaces pair", () => {
    assert.throws(
      () => validateServiceNowSettings({ scriptType: "client", surfaces: ["business-rule"] }),
      /scriptType/,
    );
  });
});

describe("classifyFile compatibility", () => {
  it("still classifies UI Actions before client heuristics", () => {
    assert.equal(
      classifyFile("src/ui-actions/close.ui-action.js", "g_form.setValue('x', 1);", {}),
      "ui-action",
    );
  });
});

describe("context-aware engine rules", () => {
  it("ES2021 accepts Promise and optional chaining", () => {
    assertValid("var p = Promise.resolve(1); var x = p?.then;", "no-promise", { settings: ES2021 });
    assertValid("var x = current?.caller_id ?? 'n';", "no-unsupported-syntax", { settings: ES2021 });
  });

  it("ES2021 still flags async iteration", () => {
    assertInvalid(
      "async function drain(items) { for await (const item of items) { gs.info(item); } }",
      "no-async-iterators",
      { messageId: "forAwait" },
      { settings: ES2021 },
    );
  });

    it("unknown mode does not assume ES5", () => {
    assertValid("var p = new Promise(function () {});", "no-promise");
    assertValid("var x = current?.name;", "no-unsupported-syntax");
  });

  it("Compatibility mode uses the ES5 engine bans", () => {
    assertInvalid(
      "var p = new Promise(function () {});",
      "no-promise",
      { messageId: "construct" },
      { settings: { javascriptMode: "compatibility" } },
    );
  });
});

describe("require-query-before-next", () => {
  it("flags next without query", () => {
    assertInvalid(
      `var gr = new GlideRecord("incident");\ngr.addActiveQuery();\ngr.next();`,
      "require-query-before-next",
      { messageId: "missingQuery" },
    );
  });

  it("does not treat chooseWindow as opening the cursor", () => {
    assertInvalid(
      `var gr = new GlideRecord("incident");\ngr.chooseWindow(0, 10);\ngr.next();`,
      "require-query-before-next",
      { messageId: "missingQuery" },
    );
  });

  it("allows next after query", () => {
    assertValid(
      `var gr = new GlideRecord("incident");\ngr.query();\nwhile (gr.next()) { gs.info(gr.number); }`,
      "require-query-before-next",
    );
  });

  it("follows a simple alias", () => {
    assertInvalid(
      `var gr = new GlideRecord("incident");\nvar rec = gr;\nrec.next();`,
      "require-query-before-next",
      { messageId: "missingQuery" },
    );
  });

  it("does not flag a shadowed local GlideRecord", () => {
    assertValid(
      `function GlideRecord() {}\nvar gr = new GlideRecord("incident");\ngr.next();`,
      "require-query-before-next",
    );
  });

  it("suppresses when a helper receives the record", () => {
    assertValid(
      `var gr = new GlideRecord("incident");\ndoQuery(gr);\ngr.next();`,
      "require-query-before-next",
    );
  });

  it("suppresses when only one branch queries", () => {
    assertValid(
      `var gr = new GlideRecord("incident");\nif (flag) { gr.query(); }\ngr.next();`,
      "require-query-before-next",
    );
  });

  it("does not leak state across functions", () => {
    assertInvalid(
      `function a() { var gr = new GlideRecord("incident"); gr.query(); }\nfunction b() { var gr = new GlideRecord("incident"); gr.next(); }`,
      "require-query-before-next",
      { messageId: "missingQuery" },
    );
  });

  it("understands computed query and next", () => {
    assertValid(
      `var gr = new GlideRecord("incident");\ngr["query"]();\ngr["next"]();`,
      "require-query-before-next",
    );
  });
});

describe("UI Action surfaces", () => {
  it("does not run client GlideRecord on a UI Action filename alone", () => {
    assertValid(`var gr = new GlideRecord("incident");`, "no-client-gliderecord", {
      filename: "close.ui-action.js",
    });
  });

  it("runs client GlideRecord when the UI Action is explicitly client", () => {
    assertInvalid(
      `var gr = new GlideRecord("incident");`,
      "no-client-gliderecord",
      { messageId: "glideRecord" },
      { filename: "close.ui-action.js", settings: { surfaces: ["ui-action", "client"] } },
    );
  });

  it("does not run client GlideRecord on an explicitly server UI Action", () => {
    assertValid(`var gr = new GlideRecord("incident");`, "no-client-gliderecord", {
      filename: "close.ui-action.js",
      settings: { surfaces: ["ui-action", "server"] },
    });
  });

  it("runs client GlideRecord on a mixed UI Action that includes client", () => {
    assertInvalid(
      `var gr = new GlideRecord("incident");`,
      "no-client-gliderecord",
      { messageId: "glideRecord" },
      { filename: "close.ui-action.js", settings: { surfaces: ["ui-action", "client", "server"] } },
    );
  });
});

describe("applyRules still loads the plugin", () => {
  it("runs a rule against parsed source", () => {
    const parsed = parse("var x = 1;", "test.js");
    const messages = applyRules("var x = 1;", parsed, { ruleNames: ["no-hardcoded-sysid"] });
    assert.equal(messages.length, 0);
  });
});
