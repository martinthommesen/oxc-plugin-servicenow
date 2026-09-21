import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Context } from "@oxlint/plugins";
import { resolveScriptContext } from "../src/context/resolve.js";
import { validateServiceNowSettings, ServiceNowSettingsError } from "../src/settings/index.js";
import { SUPPORTED_SERVICENOW_RELEASES } from "../src/settings/releases.js";
import { assertInvalid, assertSkipped, assertValid, ES2021, lint } from "./helpers/rule-tester.js";

/**
 * A minimal host context for `resolveScriptContext`. `sourceCode` is passed
 * through unchanged so a case can model a host that supplies no comment
 * tokens at all by omitting `getAllComments`.
 */
function fakeContext(
  filename: string,
  settings?: Record<string, unknown>,
  sourceCode: { text: string; getAllComments?: () => Array<{ value: string }> } = {
    text: "",
    getAllComments: () => [],
  },
): Context {
  return {
    filename,
    settings: settings ? { servicenow: settings } : {},
    sourceCode,
    options: [],
  } as unknown as Context;
}

describe("settings validation", () => {
  it("accepts empty settings", () => {
    const result = validateServiceNowSettings(undefined);
    assert.equal(result.settings.javascriptMode, undefined);
    assert.equal(result.settings.scope, "unknown");
  });

  it("rejects unknown keys", () => {
    assert.throws(() => validateServiceNowSettings({ ecamLatest: true }), ServiceNowSettingsError);
  });

  it("rejects an invalid javascriptMode", () => {
    assert.throws(() => validateServiceNowSettings({ javascriptMode: "es6" }), /javascriptMode/);
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
    assert.throws(() => validateServiceNowSettings({ surfaces: ["client", "client"] }), /surfaces/);
  });

  it("accepts ACL as an explicit server-side surface", () => {
    assert.deepEqual(validateServiceNowSettings({ surfaces: ["acl"] }).settings.surfaces, ["acl"]);
  });

  it("rejects empty surfaces", () => {
    assert.throws(
      () => validateServiceNowSettings({ surfaces: [] }),
      (error: unknown) =>
        error instanceof ServiceNowSettingsError && error.message.includes(".surfaces"),
    );
  });

  it("rejects legacy scriptType combined with extra surfaces", () => {
    for (const settings of [
      { scriptType: "server", surfaces: ["server", "client"] },
      { scriptType: "business-rule", surfaces: ["business-rule", "client"] },
      { scriptType: "ui-action", surfaces: ["ui-action", "client"] },
    ]) {
      assert.throws(
        () => validateServiceNowSettings(settings),
        (error: unknown) =>
          error instanceof ServiceNowSettingsError && error.message.includes(".scriptType"),
      );
    }
  });

  it("accepts explicit mixed UI Action surfaces without scriptType", () => {
    for (const surfaces of [
      ["ui-action", "client"],
      ["ui-action", "server"],
      ["ui-action", "client", "server"],
    ] as const) {
      assert.deepEqual(
        validateServiceNowSettings({ authoring: "classic", surfaces }).settings.surfaces,
        surfaces,
      );
    }
  });

  it("rejects a conflicting scriptType and surfaces pair", () => {
    assert.throws(
      () => validateServiceNowSettings({ scriptType: "client", surfaces: ["business-rule"] }),
      /scriptType/,
    );
  });

  it("rejects Fluent authoring with instance surfaces", () => {
    assert.throws(
      () => validateServiceNowSettings({ authoring: "fluent", surfaces: ["client"] }),
      /surfaces/,
    );
  });

  it("rejects scriptType fluent with instance surfaces", () => {
    assert.throws(
      () => validateServiceNowSettings({ scriptType: "fluent", surfaces: ["server"] }),
      /scriptType/,
    );
  });

  it("rejects scriptType client with authoring fluent", () => {
    assert.throws(
      () => validateServiceNowSettings({ scriptType: "client", authoring: "fluent" }),
      /scriptType/,
    );
  });

  it("defaults Business Rule timing to unknown", () => {
    const result = validateServiceNowSettings({});
    assert.equal(result.settings.businessRuleWhen, "unknown");
    assert.equal(result.settings.businessRuleSourceFormat, "unknown");
  });

  it("accepts an explicit Business Rule timing", () => {
    const result = validateServiceNowSettings({ businessRuleWhen: "async" });
    assert.equal(result.settings.businessRuleWhen, "async");
  });

  it("rejects an invalid Business Rule timing", () => {
    assert.throws(
      () => validateServiceNowSettings({ businessRuleWhen: "sometime" }),
      /businessRuleWhen/,
    );
  });
  it("deep-freezes nested settings and does not share mutable arrays", () => {
    const first = validateServiceNowSettings({
      allowedSysIds: ["97c04b3b1b12100043ab85e5bd0713e2"],
      allowedTables: ["incident"],
      surfaces: ["server"],
    });
    const second = validateServiceNowSettings({ surfaces: ["client"] });
    assert.throws(
      () => (first.settings.allowedSysIds as string[]).push("00000000000000000000000000000000"),
      TypeError,
    );
    assert.throws(
      () =>
        ((first.settings as unknown as { surfaces: string[] }).surfaces as string[]).push("client"),
      TypeError,
    );
    assert.deepEqual(second.settings.allowedSysIds, []);
    assert.deepEqual(second.settings.surfaces, ["client"]);
  });
});

describe("release and context resolution", () => {
  it("does not reject filename-derived Fluent authoring with classic surfaces", () => {
    const context = fakeContext("client.now.ts", { surfaces: ["client"] });
    const script = resolveScriptContext(context);
    assert.equal(script.authoring, "classic");
    assert.deepEqual([...script.surfaces], ["client"]);
    assert.equal(script.sources.authoring, "explicit");
    assert.equal(script.sources.surfaces, "explicit");
  });

  it("accepts every reviewed release and rejects unknown values", () => {
    for (const release of SUPPORTED_SERVICENOW_RELEASES) {
      assert.equal(validateServiceNowSettings({ release }).settings.release, release);
    }
    assert.equal(validateServiceNowSettings({}).settings.release, undefined);
    assert.throws(() => validateServiceNowSettings({ release: "zurichx" }), /release.*one of/);
  });

  it("keeps explicit legacy scriptType ahead of a .now.ts filename", () => {
    assertInvalid(
      `var gr = new GlideRecord("incident");`,
      "no-client-gliderecord",
      { messageId: "glideRecord" },
      { filename: "incident.now.ts", settings: { scriptType: "client", scope: "scoped" } },
    );
  });

  it("reports the weakest independent context confidence", () => {
    const context = fakeContext("incident.br.js", { javascriptMode: "es2021" });
    const script = resolveScriptContext(context);
    assert.equal(script.sources.surfaces, "filename");
    assert.equal(script.sources.javascriptMode, "explicit");
    assert.equal(script.sources.authoring, "unknown");
    assert.equal(script.sources.scope, "unknown");
    assert.equal(script.confidence, "unknown");
  });

  it("does not infer a pragma without parser comment tokens", () => {
    const context = fakeContext("incident.br.js", undefined, {
      text: "// @servicenow-es-latest",
    });
    const script = resolveScriptContext(context);
    assert.equal(script.javascriptMode, "unknown");
    assert.equal(script.sources.javascriptMode, "unknown");
  });

  it("ignores the retired @sn-es-latest pragma (FINDINGS.md FEAT-002)", () => {
    const context = fakeContext("incident.br.js", undefined, {
      text: "// @sn-es-latest\nPromise.resolve(1);",
      getAllComments: () => [{ value: " @sn-es-latest" }],
    });
    const script = resolveScriptContext(context);
    assert.equal(script.javascriptMode, "unknown");
    assert.equal(script.sources.javascriptMode, "unknown");
    assert.deepEqual([...script.deprecations], []);
  });
});

describe("filename surface evidence", () => {
  it("keeps a UI Action bare before client AST evidence is available", () => {
    const context = fakeContext("src/ui-actions/close.ui-action.js", undefined, {
      text: "g_form.setValue('x', 1);",
      getAllComments: () => [],
    });
    assert.deepEqual([...resolveScriptContext(context).surfaces], ["ui-action"]);
  });

  it("recognizes record-type directories", () => {
    const cases = [
      ["src/business-rules/update.js", "business-rule"],
      ["src/script-includes/helper.js", "script-include"],
      ["src/ui-actions/close.js", "ui-action"],
      ["src/fix-scripts/repair.js", "fix-script"],
      ["src/scheduled-scripts/nightly.js", "scheduled-script"],
      ["src/access-controls/read.js", "acl"],
    ] as const;
    for (const [filename, expected] of cases) {
      assert.deepEqual([...resolveScriptContext(fakeContext(filename)).surfaces], [expected]);
    }
  });

  it("keeps a specific record type inside a server directory", () => {
    for (const [filename, expected] of [
      ["src/server/incident.br.js", "business-rule"],
      ["src/server/helper.si.js", "script-include"],
      ["src/server/read.acl.js", "acl"],
    ] as const) {
      assert.deepEqual([...resolveScriptContext(fakeContext(filename)).surfaces], [expected]);
    }
  });

  // @lat: [[tests#Context evidence#Explicit server naming survives for UI Actions]]
  it("resolves a server UI Action to both surfaces (FINDINGS.md COR-017)", () => {
    for (const filename of [
      "approve.server.ui-action.js",
      "approve.server.ui_action.cjs",
      "src/server/approve.ui-action.mjs",
    ]) {
      const script = resolveScriptContext(fakeContext(filename));
      assert.deepEqual([...script.surfaces], ["ui-action", "server"], filename);
      assert.equal(script.sources.surfaces, "filename", filename);
    }
  });

  it("lets explicit surfaces override a server UI Action filename", () => {
    const context = fakeContext("approve.server.ui-action.js", {
      surfaces: ["ui-action", "client"],
    });
    const script = resolveScriptContext(context);
    assert.deepEqual([...script.surfaces], ["ui-action", "client"]);
    assert.equal(script.sources.surfaces, "explicit");
  });
});

describe("context-aware engine rules", () => {
  it("ES2021 accepts Promise and optional chaining", () => {
    assertValid("var p = Promise.resolve(1); var x = p?.then;", "no-promise", { settings: ES2021 });
    assertValid("var x = current?.caller_id ?? 'n';", "no-unsupported-syntax", {
      settings: ES2021,
    });
  });

  it("ES2021 still flags async iteration", () => {
    assertInvalid(
      "async function drain(items) { for await (const item of items) { gs.info(item); } }",
      "no-async-iterators",
      { messageId: "forAwait" },
      { settings: ES2021 },
    );
  });

  it("uses an explicit mode for engine-wide bans on an unclassified file", () => {
    assertInvalid(
      "async function drain(items) { for await (const item of items) {} }",
      "no-async-iterators",
      { messageId: "forAwait" },
      { filename: "plain.js", settings: ES2021 },
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

  it("reports when only one branch queries", () => {
    assertInvalid(
      `var gr = new GlideRecord("incident");\nif (flag) { gr.query(); }\ngr.next();`,
      "require-query-before-next",
      { messageId: "missingQuery" },
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

  it("continues AST inference for a bare UI Action with client evidence", () => {
    assertInvalid(
      `g_form.setValue("state", "closed");
var gr = new GlideRecord("incident");`,
      "no-client-gliderecord",
      { messageId: "glideRecord" },
      { filename: "close.ui-action.js", settings: { scope: "scoped" } },
    );
  });

  it("does not assume a bare UI Action is server-side", () => {
    assertValid(
      `var gr = new GlideRecord("incident");
gr.next();`,
      "require-query-before-next",
      { filename: "close.ui-action.js" },
    );
  });

  it("recognizes the documented server suffix", () => {
    assertInvalid(
      `var gr = new GlideRecord("incident");
gr.next();`,
      "require-query-before-next",
      { messageId: "missingQuery" },
      { filename: "close.server.js" },
    );
  });

  it("rejects contradictory legacy UI Action settings", () => {
    assert.throws(
      () =>
        lint(`var gr = new GlideRecord("incident");`, "no-client-gliderecord", {
          filename: "close.ui-action.js",
          settings: { scriptType: "server", surfaces: ["ui-action", "client"] },
        }),
      /scriptType.*conflicts/,
    );
  });

  it("runs client GlideRecord when the UI Action is explicitly client", () => {
    assertInvalid(
      `var gr = new GlideRecord("incident");`,
      "no-client-gliderecord",
      { messageId: "glideRecord" },
      {
        filename: "close.ui-action.js",
        settings: { surfaces: ["ui-action", "client"], scope: "scoped" },
      },
    );
  });

  it("does not run client GlideRecord on an explicitly server UI Action", () => {
    assertValid(`var gr = new GlideRecord("incident");`, "no-client-gliderecord", {
      filename: "close.ui-action.js",
      settings: { surfaces: ["ui-action", "server"] },
    });
  });

  it("suppresses client GlideRecord on a mixed client/server UI Action", () => {
    assertValid(`var gr = new GlideRecord("incident");`, "no-client-gliderecord", {
      filename: "close.ui-action.js",
      settings: { surfaces: ["ui-action", "client", "server"] },
    });
  });

  it("keeps surface rules silent when only JavaScript mode is known", () => {
    const settings = { javascriptMode: "es5" as const };
    assertSkipped("gs.now();", "no-gs-now", { filename: "plain.js", settings });
    assertValid('var gr = new GlideRecord("incident"); gr.next();', "require-query-before-next", {
      filename: "plain.js",
      settings,
    });
    assertInvalid(
      "Promise.resolve(1);",
      "no-promise",
      { messageId: "staticMethod" },
      { filename: "plain.js", settings },
    );
  });
});
