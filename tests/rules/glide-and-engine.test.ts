import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertInvalid, assertValid, ES5, lint } from "../helpers/rule-tester.js";

describe("no-gs-now", () => {
  it("flags gs.now()", () => {
    assertInvalid(`var when = gs.now();`, "no-gs-now", { messageId: "server" });
  });

  it("flags gs.nowDateTime()", () => {
    assertInvalid(`var when = gs.nowDateTime();`, "no-gs-now", { messageId: "nowDateTime" });
  });

  it("uses the client message in client files", () => {
    assertInvalid(
      `var when = gs.now();`,
      "no-gs-now",
      { messageId: "client" },
      {
        filename: "form.client.js",
      },
    );
  });

  it("allows GlideDateTime", () => {
    assertValid(`var when = new GlideDateTime();`, "no-gs-now");
  });

  it("does not expose a fix or suggestion", () => {
    const messages = lint("current.u_opened = gs.now();", "no-gs-now");
    assert.ok(messages.every((message) => message.fixedSource === undefined));
    assert.ok(
      messages.every((message) => !message.suggestions || message.suggestions.length === 0),
    );
  });

  it("does not flag a shadowed gs binding", () => {
    assertValid("var gs = { now: function () { return 'x'; } }; var when = gs.now();", "no-gs-now");
  });
});

describe("validate-gliderecord-calls", () => {
  it("flags next() without query()", () => {
    assertInvalid(
      `var gr = new GlideRecord("incident");\ngr.addActiveQuery();\ngr.next();`,
      "validate-gliderecord-calls",
      { messageId: "missingQuery", count: 2 },
    );
  });

  it("flags next() without query() on GlideRecordSecure", () => {
    assertInvalid(
      'var gr = new GlideRecordSecure("incident"); gr.next();',
      "validate-gliderecord-calls",
      { messageId: "missingQuery", count: 2 },
    );
  });

  it("flags unused insert() return", () => {
    assertInvalid(
      `var gr = new GlideRecord("incident");\ngr.initialize();\ngr.insert();`,
      "validate-gliderecord-calls",
      { messageId: "unusedReturn" },
    );
  });

  it("allows checked next() after query()", () => {
    assertValid(
      `var gr = new GlideRecord("incident");\ngr.query();\nwhile (gr.next()) { gs.info(gr.number); }`,
      "validate-gliderecord-calls",
    );
  });
});

describe("no-br-current-update", () => {
  it("flags current.update()", () => {
    assertInvalid(
      `current.state = 2;\ncurrent.update();`,
      "no-br-current-update",
      { messageId: "update" },
      { filename: "incident.br.js" },
    );
  });

  it("does not treat src/server as a Business Rule", () => {
    assertValid("current.update();", "no-br-current-update", {
      filename: "src/server/incident.js",
    });
  });

  it("allows current.update() in unclassified files", () => {
    assertValid("current.update();", "no-br-current-update", { filename: "utils.js" });
  });

  it("allows current.update() in a Script Include", () => {
    assertValid("current.update();", "no-br-current-update", { filename: "helper.si.js" });
  });

  it("flags current.update() when scriptType forces a Business Rule", () => {
    assertInvalid(
      "current.update();",
      "no-br-current-update",
      { messageId: "update" },
      { filename: "misc.js", settings: { scriptType: "business-rule" } },
    );
  });

  it("allows field assignment", () => {
    assertValid(`current.state = 2;`, "no-br-current-update");
  });

  it("allows current.update() in a UI Action", () => {
    assertValid(`current.state = 2;\ncurrent.update();`, "no-br-current-update", {
      filename: "close-incident.ui-action.js",
    });
  });
});

describe("no-hardcoded-table-names", () => {
  it("flags string table names", () => {
    assertInvalid(`var gr = new GlideRecord("x_acme_widget");`, "no-hardcoded-table-names", {
      messageId: "literal",
    });
  });

  it("flags string table names on GlideRecordSecure", () => {
    assertInvalid('var gr = new GlideRecordSecure("incident");', "no-hardcoded-table-names", {
      messageId: "literal",
    });
  });

  it("allows identifiers", () => {
    assertValid(`var gr = new GlideRecord(TABLE.WIDGET);`, "no-hardcoded-table-names");
  });

  it("allows builtins when configured", () => {
    assertValid(`var gr = new GlideRecord("incident");`, "no-hardcoded-table-names", {
      options: { "no-hardcoded-table-names": [{ allowBuiltins: true }] },
    });
  });
});

describe("engine extras", () => {
  it("no-at-method flags .at() in ES5", () => {
    assertInvalid(
      `var last = [1, 2].at(-1);`,
      "no-at-method",
      { messageId: "at" },
      { settings: ES5 },
    );
    assertInvalid(
      `var first = "text".at(0);`,
      "no-at-method",
      { messageId: "at" },
      { settings: ES5 },
    );
    assertInvalid(
      `const items = [1, 2]; var last = items.at(-1);`,
      "no-at-method",
      { messageId: "at" },
      { settings: ES5 },
    );
  });

  it("no-at-method does not expose a suggestion", () => {
    const messages = lint("var last = [1, 2].at(1);", "no-at-method", { settings: ES5 });
    assert.ok(messages.some((message) => message.messageId === "at"));
    assert.ok(
      messages.every((message) => !message.suggestions || message.suggestions.length === 0),
    );
  });

  it("no-at-method ignores user-defined and unknown receivers", () => {
    assertValid(
      `var cache = { at: function (key) { return key; } }; cache.at("x");`,
      "no-at-method",
      { settings: ES5 },
    );
    assertValid(`function read(value) { return value.at(0); }`, "no-at-method", { settings: ES5 });
    assertValid(`let items = [1, 2]; items.at(0);`, "no-at-method", { settings: ES5 });
    assertValid(`[1, 2].at(0);`, "no-at-method", { settings: { javascriptMode: "es2021" } });
  });

  it("no-packages-calls flags Packages", () => {
    assertInvalid(
      `var n = Packages.java.lang.System.nanoTime();`,
      "no-packages-calls",
      {
        messageId: "packages",
      },
      { filename: "src/server/test.js" },
    );
  });

  it("no-packages-calls reports a Packages chain once", () => {
    assertInvalid(
      'var s = new Packages.java.lang.String("x");',
      "no-packages-calls",
      { count: 1 },
      { filename: "src/server/test.js" },
    );
  });

  it("no-packages-calls flags dynamic computed access", () => {
    assertInvalid(
      "var value = Packages[name][member];",
      "no-packages-calls",
      { count: 1 },
      { filename: "src/server/test.js" },
    );
  });

  it("no-packages-calls allows Packages as an object key", () => {
    assertValid("var o = { Packages: 1 };", "no-packages-calls");
  });

  it("no-packages-calls allows a Packages member on another object", () => {
    assertValid("var x = lib.Packages;", "no-packages-calls");
  });

  it("no-packages-calls allows a local Packages binding", () => {
    assertValid("var Packages = 2; var y = Packages;", "no-packages-calls");
  });

  it("no-packages-calls ignores an unclassified file", () => {
    assertValid("var value = Packages.example;", "no-packages-calls", { filename: "plain.js" });
  });

  it("does not assume an ordinary unknown-context JavaScript file is ServiceNow", () => {
    assertValid(`var n = Packages.java.lang.System.nanoTime();`, "no-packages-calls", {
      filename: "index.js",
    });
  });

  it("treats the documented _next cursor equivalent as requiring a query", () => {
    for (const scope of ["global", "scoped"] as const) {
      assertInvalid(
        `var gr = new GlideRecord("incident"); gr._next();`,
        "validate-gliderecord-calls",
        { messageId: "missingQuery" },
        { filename: "src/server/test.js", settings: { scope } },
      );
    }
  });

  it("no-weak-references flags WeakRef in any instance mode", () => {
    assertInvalid(`var ref = new WeakRef(obj);`, "no-weak-references", { messageId: "weak" });
  });

  it("no-weak-collections flags WeakMap in ES5", () => {
    assertInvalid(
      `var cache = new WeakMap();`,
      "no-weak-collections",
      { messageId: "weak" },
      {
        settings: ES5,
      },
    );
  });

  it("no-async-iterators flags for await", () => {
    assertInvalid(
      `async function drain(items) { for await (const item of items) { gs.info(item); } }`,
      "no-async-iterators",
      { messageId: "forAwait" },
    );
  });

  it("no-typed-arrays flags Int8Array", () => {
    assertInvalid(
      `var bytes = new Int8Array(16);`,
      "no-typed-arrays",
      { messageId: "ctor" },
      {
        settings: ES5,
      },
    );
  });

  it("no-typed-arrays flags DataView", () => {
    assertInvalid(
      `var view = new DataView(buffer);`,
      "no-typed-arrays",
      { messageId: "ctor" },
      {
        settings: ES5,
      },
    );
  });

  it("no-proxy flags new Proxy", () => {
    assertInvalid(
      `var p = new Proxy(target, handler);`,
      "no-proxy",
      { messageId: "construct" },
      {
        settings: ES5,
      },
    );
  });

  it("no-proxy flags Proxy.revocable", () => {
    assertInvalid(
      `var p = Proxy.revocable(target, handler);`,
      "no-proxy",
      {
        messageId: "revocable",
      },
      { settings: ES5 },
    );
  });
});

describe("no-unsupported-syntax", () => {
  it("flags optional chaining", () => {
    assertInvalid(
      `var name = current.caller_id?.name;`,
      "no-unsupported-syntax",
      {
        messageId: "optional",
      },
      { settings: ES5 },
    );
  });

  it("flags nullish coalescing", () => {
    assertInvalid(
      `var name = value ?? "unknown";`,
      "no-unsupported-syntax",
      {
        messageId: "nullish",
      },
      { settings: ES5 },
    );
  });

  it("flags logical assignment", () => {
    assertInvalid(
      `cache ||= {};`,
      "no-unsupported-syntax",
      { messageId: "logicalAssign" },
      {
        settings: ES5,
      },
    );
  });

  it("flags private class members", () => {
    assertInvalid(
      `class C { #hidden = 1; }`,
      "no-unsupported-syntax",
      {
        messageId: "privateInstance",
      },
      { settings: ES5 },
    );
  });

  it("flags regexp lookbehind", () => {
    assertInvalid(
      `var r = /(?<=@)\\w+/;`,
      "no-unsupported-syntax",
      { messageId: "lookbehind" },
      {
        settings: ES5,
      },
    );
  });

  it("flags new RegExp lookbehind", () => {
    assertInvalid(
      `var r = new RegExp("(?<=a)b");`,
      "no-unsupported-syntax",
      {
        messageId: "lookbehind",
      },
      { settings: ES5 },
    );
  });

  it("allows named capture groups and lookahead", () => {
    assertValid(`var r = /(?<name>a)(?=b)/;`, "no-unsupported-syntax");
  });

  it("skips Fluent metadata files", () => {
    assertValid(`const name = current?.caller_id ?? "x";`, "no-unsupported-syntax", {
      filename: "table.now.ts",
    });
  });
});

describe("no-sync-glideajax", () => {
  it("flags getXMLWait", () => {
    assertInvalid(
      `var ga = new GlideAjax("x_acme.UserUtils");\nvar xml = ga.getXMLWait();`,
      "no-sync-glideajax",
      { messageId: "wait" },
      { filename: "incident.client.js" },
    );
  });

  it("allows getXMLAnswer", () => {
    assertValid(
      `var ga = new GlideAjax("x_acme.UserUtils");\nga.getXMLAnswer(function (answer) { g_form.setValue("x", answer); });`,
      "no-sync-glideajax",
      { filename: "incident.client.js" },
    );
  });
});
