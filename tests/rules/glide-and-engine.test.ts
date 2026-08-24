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

  it("stays silent when the gs method identity can change", () => {
    assertValid(`gs = localGs;\ngs.now();`, "no-gs-now");
    assertValid(`gs = null;\ngs.now();`, "no-gs-now");
    assertValid(`gs.now = localNow;\ngs.now();`, "no-gs-now");
    assertValid(`gs.now = undefined;\ngs.now();`, "no-gs-now");
    assertValid(`Object.defineProperty(gs, "now", { value: null });\ngs.now();`, "no-gs-now");
    assertValid(`prepare(gs);\ngs.now();`, "no-gs-now");
    assertValid(`var platform = gs;\nprepare(platform);\ngs.now();`, "no-gs-now");
    assertInvalid(`prepare(gs.now);\ngs.now();`, "no-gs-now", { messageId: "server" });
  });

  it("keeps gs authority across nullish Object.assign sources", () => {
    assertInvalid(
      `const absent = null;\nObject.assign(gs, absent, undefined);\ngs.now();`,
      "no-gs-now",
      { messageId: "server" },
      { settings: { javascriptMode: "es2021" } },
    );
  });

  it("keeps a stable gs object alias after the global binding changes", () => {
    assertInvalid(`var service = gs;\ngs = localGs;\nservice.now();`, "no-gs-now", {
      messageId: "server",
    });
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

  it("stays silent when the body-only current identity can change", () => {
    assertValid(`current = getOtherRecord();\ncurrent.update();`, "no-br-current-update", {
      filename: "incident.br.js",
    });
    assertValid(`current = null;\ncurrent.update();`, "no-br-current-update", {
      filename: "incident.br.js",
    });
    assertValid(`current.update = localUpdate;\ncurrent.update();`, "no-br-current-update", {
      filename: "incident.br.js",
    });
    assertValid(`current.update = undefined;\ncurrent.update();`, "no-br-current-update", {
      filename: "incident.br.js",
    });
    assertValid(
      `Object.defineProperty(current, "update", { value: null });\ncurrent.update();`,
      "no-br-current-update",
      { filename: "incident.br.js" },
    );
    assertValid(`prepare(current);\ncurrent.update();`, "no-br-current-update", {
      filename: "incident.br.js",
    });
    assertValid(
      `var record = current;\nprepare(record);\ncurrent.update();`,
      "no-br-current-update",
      { filename: "incident.br.js" },
    );
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
    assertValid(
      `const values = [1, 2]; values.items = customCollection; const { items } = values; items.at(0);`,
      "no-at-method",
      { settings: ES5 },
    );
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

  it("no-packages-calls stays silent on browser-only and mixed UI Action surfaces", () => {
    assertValid(`var value = Packages.example;`, "no-packages-calls", {
      filename: "form.client.js",
      settings: { surfaces: ["client"] },
    });
    assertValid(`var value = Packages.example;`, "no-packages-calls", {
      filename: "mixed.ui-action.js",
      settings: { surfaces: ["ui-action", "client", "server"] },
    });
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
        { count: 2, messageId: "missingQuery" },
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

  it("flags typed-array static factories when their constructor feature is unavailable", () => {
    for (const code of [
      `Int8Array.from(values);`,
      `Uint8Array.of(1, 2);`,
      `const fromBytes = Int8Array.from; fromBytes(values);`,
    ]) {
      assertInvalid(
        code,
        "no-typed-arrays",
        { messageId: "factory" },
        { settings: { javascriptMode: "es5", release: "australia" } },
      );
    }
    assertInvalid(
      `BigInt64Array.from(values);`,
      "no-typed-arrays",
      { messageId: "factory" },
      { settings: { javascriptMode: "es2021", release: "zurich" } },
    );
    assertValid(`BigInt64Array.from(values);`, "no-typed-arrays", {
      settings: { javascriptMode: "es2021", release: "australia" },
    });
    assertValid(
      `typeof BigInt64Array !== "undefined" && BigInt64Array.from(values);`,
      "no-typed-arrays",
      { settings: { javascriptMode: "es2021", release: "zurich" } },
    );
    assertValid(`Int8Array.from = polyfill; Int8Array.from(values);`, "no-typed-arrays", {
      settings: { javascriptMode: "es5", release: "australia" },
    });
    assertValid(
      `const { BigInt64Array: Words } = globalThis; Words.from = polyfill; Words.from(values);`,
      "no-typed-arrays",
      { settings: { javascriptMode: "es2021", release: "zurich" } },
    );
    assertValid(`const Int8Array = { from: custom }; Int8Array.from(values);`, "no-typed-arrays", {
      settings: { javascriptMode: "es5", release: "australia" },
    });
  });

  it("models the BigInt typed-array Australia delta conservatively", () => {
    const code = `var values = new BigInt64Array(4);`;
    assertInvalid(
      code,
      "no-typed-arrays",
      { messageId: "bigintCtor" },
      { settings: { javascriptMode: "es2021", release: "zurich" } },
    );
    assertValid(code, "no-typed-arrays", {
      settings: { javascriptMode: "es2021", release: "australia" },
    });
    assertValid(code, "no-typed-arrays", { settings: { javascriptMode: "es2021" } });
    assertInvalid(
      code,
      "no-typed-arrays",
      { messageId: "bigintCtor" },
      { settings: { javascriptMode: "es5" } },
    );
  });

  it("flags documented DataView BigInt getters through object aliases", () => {
    assertInvalid(
      `const view = new DataView(buffer); const alias = view; alias["getBigInt64"](0);`,
      "no-typed-arrays",
      { messageId: "bigintGetter" },
      { settings: { javascriptMode: "es2021", release: "australia" } },
    );
    assertInvalid(
      `new DataView(buffer).getBigUint64(0);`,
      "no-typed-arrays",
      { messageId: "bigintGetter" },
      { settings: { release: "australia" } },
    );
    assertInvalid(
      `const DV = DataView; const view = new DV(buffer); view.getBigInt64(0);`,
      "no-typed-arrays",
      { messageId: "bigintGetter" },
      { settings: { javascriptMode: "es2021", release: "australia" } },
    );
    assertInvalid(
      `const view = new globalThis.DataView(buffer); view.getBigInt64(0);`,
      "no-typed-arrays",
      { messageId: "bigintGetter" },
      { settings: { javascriptMode: "es2021", release: "australia" } },
    );
  });

  it("follows immutable aliases to typed-array constructors", () => {
    assertInvalid(
      `const Bytes = Int8Array; new Bytes(4);`,
      "no-typed-arrays",
      { messageId: "ctor" },
      { settings: { javascriptMode: "es5", release: "australia" } },
    );
    assertInvalid(
      `const Words = BigInt64Array; new Words(4);`,
      "no-typed-arrays",
      { messageId: "bigintCtor" },
      { settings: { javascriptMode: "es2021", release: "zurich" } },
    );
    assertInvalid(
      `const DV = DataView; new DV(buffer);`,
      "no-typed-arrays",
      { messageId: "ctor" },
      { settings: { javascriptMode: "es5", release: "australia" } },
    );
    assertInvalid(
      `const Bytes = globalThis.Int8Array; new Bytes(4);`,
      "no-typed-arrays",
      { messageId: "ctor" },
      { settings: { javascriptMode: "es5", release: "australia" } },
    );
    assertInvalid(
      `const Bytes = (0, Int8Array); new Bytes(4);`,
      "no-typed-arrays",
      { messageId: "ctor" },
      { settings: { javascriptMode: "es5", release: "australia" } },
    );
    assertInvalid(
      `new (0, Int8Array)(4);`,
      "no-typed-arrays",
      { messageId: "ctor" },
      { settings: { javascriptMode: "es5", release: "australia" } },
    );
    assertInvalid(
      `const { BigInt64Array: Words } = globalThis; new Words(4);`,
      "no-typed-arrays",
      { messageId: "bigintCtor" },
      { settings: { javascriptMode: "es2021", release: "zurich" } },
    );
    assertInvalid(
      `const { DataView: DV } = globalThis; new DV(buffer).getBigInt64(0);`,
      "no-typed-arrays",
      { messageId: "bigintGetter" },
      { settings: { javascriptMode: "es2021", release: "australia" } },
    );
  });

  it("keeps guarded typed-array features silent", () => {
    assertValid(`if (typeof Int8Array !== "undefined") new Int8Array(4);`, "no-typed-arrays", {
      settings: { javascriptMode: "es5", release: "australia" },
    });
    assertValid(`typeof Int8Array !== "undefined" && new Int8Array(4);`, "no-typed-arrays", {
      settings: { javascriptMode: "es5", release: "australia" },
    });
    assertValid(`typeof Int8Array !== "function" || new Int8Array(4);`, "no-typed-arrays", {
      settings: { javascriptMode: "es5", release: "australia" },
    });
    assertInvalid(
      `const Bytes = globalThis.Int8Array; if (typeof Bytes === "function") new Bytes(4);`,
      "no-typed-arrays",
      { messageId: "ctor" },
      { settings: { javascriptMode: "es5", release: "australia" } },
    );
    assertInvalid(
      `globalThis.Int8Array?.(4);`,
      "no-typed-arrays",
      { messageId: "ctor" },
      { settings: { javascriptMode: "es5", release: "australia" } },
    );
    assertValid(
      `typeof globalThis !== "undefined" && globalThis.Int8Array && new globalThis.Int8Array(4);`,
      "no-typed-arrays",
      { settings: { javascriptMode: "es5", release: "australia" } },
    );
    assertValid(
      `const Bytes = globalThis.Int8Array; if (typeof Bytes === "function") new Bytes(4);`,
      "no-typed-arrays",
      { settings: { javascriptMode: "es2021", release: "australia" } },
    );
    assertValid(
      `"BigInt64Array" in globalThis && new globalThis.BigInt64Array(4);`,
      "no-typed-arrays",
      { settings: { javascriptMode: "es2021", release: "zurich" } },
    );
    for (const code of [
      `Int8Array && new Int8Array(4);`,
      `if (Int8Array) new Int8Array(4);`,
      `Int8Array !== undefined && new Int8Array(4);`,
      `if (Int8Array != null) new Int8Array(4);`,
      `const Bytes = Int8Array; if (typeof Bytes !== "undefined") new Bytes(4);`,
      `const Bytes = Int8Array; if (typeof Int8Array !== "undefined") new Bytes(4);`,
      `if (typeof Int8Array === "function") { Int8Array = undefined; new Int8Array(4); }`,
    ]) {
      assertInvalid(
        code,
        "no-typed-arrays",
        { messageId: "ctor" },
        { settings: { javascriptMode: "es5", release: "australia" } },
      );
    }
    const settings = { javascriptMode: "es2021", release: "australia" } as const;
    for (const code of [
      `const view = new DataView(buffer); view.getBigInt64?.(0);`,
      `const view = new DataView(buffer); view.getBigInt64 && view.getBigInt64(0);`,
      `const view = new DataView(buffer); if (view.getBigInt64) view.getBigInt64(0);`,
      `const view = new DataView(buffer); if (!view.getBigInt64) return; view.getBigInt64(0);`,
      `const first = new DataView(a); const second = new DataView(b); if (first.getBigInt64) second.getBigInt64(0);`,
      `const view = new DataView(buffer); if (DataView.prototype.getBigInt64) view.getBigInt64(0);`,
      `const view = new DataView(buffer); !view.getBigInt64 || view.getBigInt64(0);`,
      `const view = new DataView(buffer); "getBigInt64" in DataView.prototype && view.getBigInt64(0);`,
    ]) {
      assertValid(code, "no-typed-arrays", { settings });
    }
    assertInvalid(
      `const view = new DataView(buffer); view?.getBigInt64(0);`,
      "no-typed-arrays",
      { messageId: "bigintGetter" },
      { settings },
    );
    assertInvalid(
      `const view = new DataView(buffer); if (view.getBigInt64) { view.getBigInt64 = undefined; view.getBigInt64(0); }`,
      "no-typed-arrays",
      { messageId: "bigintGetter" },
      { settings },
    );
  });

  it("recognizes direct DataView getter invocation helpers", () => {
    const settings = { javascriptMode: "es2021", release: "australia" } as const;
    for (const code of [
      `const view = new DataView(buffer); view.getBigInt64.call(view, 0);`,
      `const view = new DataView(buffer); view.getBigInt64.apply(view, [0]);`,
      `const view = new DataView(buffer); view.getBigInt64.bind(view)(0);`,
      `const view = new DataView(buffer); view.getBigInt64.call?.(view, 0);`,
      `const view = new DataView(buffer); Reflect.apply(view.getBigInt64, view, [0]);`,
      `const view = new DataView(buffer); DataView.prototype.getBigInt64.call(view, 0);`,
      `const view = new DataView(buffer); const get = DataView.prototype.getBigInt64; get.call(view, 0);`,
      `const view = new DataView(buffer); const { getBigInt64: get } = view; get.call(view, 0);`,
      `const view = new DataView(buffer); const { getBigInt64: get } = DataView.prototype; get.call(view, 0);`,
    ]) {
      assertInvalid(code, "no-typed-arrays", { messageId: "bigintGetter" }, { settings });
    }
  });

  it("keeps unproven DataView-like receivers and undocumented setters silent", () => {
    assertValid(`new DataView(buffer).setBigInt64(0, value);`, "no-typed-arrays", {
      settings: { javascriptMode: "es2021", release: "zurich" },
    });
    assertValid(`view.getBigInt64(0);`, "no-typed-arrays", {
      settings: { javascriptMode: "es2021", release: "zurich" },
    });
    assertValid(
      `function DataView() {} const view = new DataView(); view.getBigInt64(0);`,
      "no-typed-arrays",
      { settings: { javascriptMode: "es2021", release: "zurich" } },
    );
    assertValid(
      `let view = new DataView(buffer); view = customView; view.getBigInt64(0);`,
      "no-typed-arrays",
      { settings: { javascriptMode: "es2021", release: "zurich" } },
    );
    assertValid(
      `DataView = CustomView; const view = new DataView(buffer); view.getBigInt64(0);`,
      "no-typed-arrays",
      { settings: { javascriptMode: "es2021", release: "zurich" } },
    );
    assertValid(
      `const view = new DataView(buffer); view.getBigInt64 = custom; view.getBigInt64(0);`,
      "no-typed-arrays",
      { settings: { javascriptMode: "es2021", release: "zurich" } },
    );
    assertValid(
      `DataView.prototype.getBigInt64 = custom; new DataView(buffer).getBigInt64(0);`,
      "no-typed-arrays",
      { settings: { javascriptMode: "es2021", release: "zurich" } },
    );
    assertValid(`Int8Array = CustomArray; new Int8Array(1);`, "no-typed-arrays", {
      settings: { javascriptMode: "es5", release: "australia" },
    });
    assertValid(
      `globalThis.DataView.prototype.getBigInt64 = custom;
new DataView(buffer).getBigInt64(0);`,
      "no-typed-arrays",
      {
        filename: "incident.br.js",
        settings: { javascriptMode: "unknown", release: "australia" },
      },
    );
  });

  it("conservatively suppresses diagnostics after any possible relevant mutation", () => {
    const settings = { javascriptMode: "es2021", release: "australia" } as const;
    for (const code of [
      `function install() { DataView.prototype.getBigInt64 = custom; }
const view = new DataView(buffer); view.getBigInt64(0);`,
      `if (false) DataView.prototype.getBigInt64 = custom;
new DataView(buffer).getBigInt64(0);`,
      `const view = new DataView(buffer); view[method] = custom; view.getBigInt64(0);`,
      `DataView[key].getBigInt64 = custom; new DataView(buffer).getBigInt64(0);`,
      `const view = new DataView(buffer); Object.defineProperty(view, "getBigInt64", { value: custom }); view.getBigInt64(0);`,
      `const { defineProperty } = Object; const view = new DataView(buffer); defineProperty(view, "getBigInt64", { value: custom }); view.getBigInt64(0);`,
      `const view = new DataView(buffer); Object.defineProperty.apply(Object, [view, "getBigInt64", { value: custom }]); view.getBigInt64(0);`,
      `const view = new DataView(buffer); (0, Object.defineProperty)(view, "getBigInt64", { value: custom }); view.getBigInt64(0);`,
      `const view = new DataView(buffer); const define = Object.defineProperty.bind(Object); define(view, "getBigInt64", { value: custom }); view.getBigInt64(0);`,
      `const view = new DataView(buffer); Object.defineProperty(view, "getBigInt64", { value: undefined, value: custom }); view.getBigInt64(0);`,
      `const view = new DataView(buffer); Object.defineProperty(view, "getBigInt64", { value: undefined, ...{ value: custom } }); view.getBigInt64(0);`,
      `const view = new DataView(buffer); const args = [view, "getBigInt64", { value: custom }]; Object.defineProperty(...args); view.getBigInt64(0);`,
      `Object.defineProperty = undefined; Object.defineProperty(DataView.prototype, "getBigInt64", { value: custom }); new DataView(buffer).getBigInt64(0);`,
      `function never() { Object.defineProperty = undefined; }
Object.defineProperty(DataView.prototype, "getBigInt64", { value: custom }); new DataView(buffer).getBigInt64(0);`,
      `function install(view) { view.getBigInt64 = custom; }
const first = new DataView(a); const second = new DataView(b);
install(first); install(second); first.getBigInt64(0); second.getBigInt64(0);`,
      `function install(view) { let alias = view; alias.getBigInt64 = custom; }
const first = new DataView(a); const second = new DataView(b);
install(first); install(second); first.getBigInt64(0); second.getBigInt64(0);`,
      `function install(view) { var alias = view; alias.getBigInt64 = custom; }
const first = new DataView(a); const second = new DataView(b);
install(second); install(first); first.getBigInt64(0); second.getBigInt64(0);`,
      `install(DataView.prototype); new DataView(buffer).getBigInt64(0);`,
      `install({ target: DataView.prototype }); new DataView(buffer).getBigInt64(0);`,
      `const target = DataView.prototype; install(target); new DataView(buffer).getBigInt64(0);`,
    ]) {
      assertValid(code, "no-typed-arrays", { settings });
    }
    assertValid(`install(Int8Array); Int8Array.from(values);`, "no-typed-arrays", {
      settings: { javascriptMode: "es5", release: "australia" },
    });
    assertValid(`new Int8Array(1); Int8Array = CustomArray;`, "no-typed-arrays", {
      settings: { javascriptMode: "es5", release: "australia" },
    });
    assertInvalid(
      `globalThis.Int8Array = CustomArray; new Int8Array(1);`,
      "no-typed-arrays",
      { messageId: "ctor" },
      { settings: { javascriptMode: "es5", release: "australia" } },
    );
  });

  it("keeps DataView method replacement tied to object identity", () => {
    assertInvalid(
      `const first = new DataView(a); first.getBigInt64 = custom; first.getBigInt64(0);
const second = new DataView(b); second.getBigInt64(0);`,
      "no-typed-arrays",
      { messageId: "bigintGetter", count: 1 },
      { settings: { javascriptMode: "es2021", release: "australia" } },
    );
    assertInvalid(
      `const cache = {}; cache[key] = value;
const view = new DataView(buffer); view.getBigInt64(0);`,
      "no-typed-arrays",
      { messageId: "bigintGetter", count: 1 },
      { settings: { javascriptMode: "es2021", release: "australia" } },
    );
    for (const code of [
      `const view = new DataView(buffer); delete view.getBigInt64; view.getBigInt64(0);`,
      `const view = new DataView(buffer); view.getBigInt64 = undefined; view.getBigInt64(0);`,
      `Reflect.set(DataView.prototype, "getBigInt64", custom); new DataView(buffer).getBigInt64(0);`,
      `const view = new DataView(buffer); view.__proto__ = { getBigInt64: custom }; view.getBigInt64(0);`,
      `inspect(DataView.prototype.getBigInt64); new DataView(buffer).getBigInt64(0);`,
    ]) {
      assertInvalid(
        code,
        "no-typed-arrays",
        { messageId: "bigintGetter", count: 1 },
        { settings: { javascriptMode: "es2021", release: "australia" } },
      );
    }
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

describe("server engine surface gating", () => {
  it("does not apply the server engine matrix to browser-executed client scripts", () => {
    assertValid(`Object.hasOwn(record, "number");`, "no-object-hasown", {
      filename: "form.client.js",
      settings: {
        javascriptMode: "es2021",
        release: "zurich",
        surfaces: ["client"],
      },
    });
    assertValid(`new BigInt64Array(1);`, "no-typed-arrays", {
      filename: "form.client.js",
      settings: {
        javascriptMode: "es2021",
        release: "zurich",
        surfaces: ["client"],
      },
    });
    assertValid(`class Example { #value = 1; }`, "no-unsupported-syntax", {
      filename: "form.client.js",
      settings: {
        javascriptMode: "es2021",
        release: "australia",
        surfaces: ["client"],
      },
    });
  });
});
describe("no-object-hasown", () => {
  it("follows the Zurich and Australia release matrix", () => {
    const code = `var owns = Object.hasOwn(record, "number");`;
    assertInvalid(
      code,
      "no-object-hasown",
      { messageId: "unsupported" },
      { settings: { javascriptMode: "es2021", release: "zurich" } },
    );
    assertValid(code, "no-object-hasown", {
      settings: { javascriptMode: "es2021", release: "australia" },
    });
    assertValid(code, "no-object-hasown", { settings: { javascriptMode: "es2021" } });
    assertInvalid(
      code,
      "no-object-hasown",
      { messageId: "unsupported" },
      { settings: { javascriptMode: "es5" } },
    );
  });

  it("recognizes static computed access and proven aliases", () => {
    assertInvalid(
      `const BuiltinObject = Object; BuiltinObject["hasOwn"](record, "number");`,
      "no-object-hasown",
      { messageId: "unsupported" },
      { settings: { javascriptMode: "es5", release: "australia" } },
    );
    for (const code of [
      `const owns = Object.hasOwn; owns(record, "number");`,
      `const { hasOwn } = Object; hasOwn(record, "number");`,
      `const { hasOwn: owns } = Object; owns(record, "number");`,
      `Object.hasOwn.call(null, record, "number");`,
      `(0, Object.hasOwn)(record, "number");`,
      `Reflect.apply(Object.hasOwn, Object, [record, "number"]);`,
      `globalThis.Object.hasOwn(record, "number");`,
      `const { Object: BuiltinObject } = globalThis; BuiltinObject.hasOwn(record, "number");`,
      `const { hasOwn: owns } = globalThis.Object; owns(record, "number");`,
    ]) {
      assertInvalid(
        code,
        "no-object-hasown",
        { messageId: "unsupported" },
        { settings: { javascriptMode: "es5", release: "australia" } },
      );
    }
    assertValid(
      `const { hasOwn = fallback } = Object; hasOwn(record, "number");`,
      "no-object-hasown",
      { settings: { javascriptMode: "es5", release: "australia" } },
    );
    for (const code of [
      `const { hasOwn = undefined } = Object; hasOwn(record, "number");`,
      `const { hasOwn = null } = Object; hasOwn(record, "number");`,
    ]) {
      assertInvalid(
        code,
        "no-object-hasown",
        { messageId: "unsupported" },
        { settings: { javascriptMode: "es2021", release: "zurich" } },
      );
    }
    assertValid(
      `const { Object: BuiltinObject = CustomObject } = globalThis; BuiltinObject.hasOwn(record, "number");`,
      "no-object-hasown",
      { settings: { javascriptMode: "es2021", release: "zurich" } },
    );
  });

  it("keeps shadowed, reassigned, dynamic, and unrelated receivers silent", () => {
    const settings = { javascriptMode: "es5", release: "australia" } as const;
    assertValid(
      `const Object = { hasOwn: function () { return true; } }; Object.hasOwn(record, "x");`,
      "no-object-hasown",
      { settings },
    );
    assertValid(
      `let BuiltinObject = Object; BuiltinObject = helper; BuiltinObject.hasOwn(record, "x");`,
      "no-object-hasown",
      { settings },
    );
    assertValid(`Object[method](record, "x");`, "no-object-hasown", { settings });
    assertValid(`helper.hasOwn(record, "x");`, "no-object-hasown", { settings });
    assertValid(`const { local } = Object; local.hasOwn(record, "x");`, "no-object-hasown", {
      settings,
    });
    assertValid(`Object.hasOwn = polyfill; Object.hasOwn(record, "x");`, "no-object-hasown", {
      settings,
    });
    assertValid(`Object = custom; Object.hasOwn(record, "x");`, "no-object-hasown", {
      settings,
    });
    assertValid(
      `const BuiltinObject = Object; BuiltinObject.hasOwn = polyfill; BuiltinObject.hasOwn(record, "x");`,
      "no-object-hasown",
      { settings },
    );
    assertValid(
      `const { Object: BuiltinObject } = globalThis; BuiltinObject.hasOwn = polyfill; BuiltinObject.hasOwn(record, "x");`,
      "no-object-hasown",
      { settings: { javascriptMode: "es2021", release: "zurich" } },
    );
    assertValid(`Object.hasOwn(record, "x"); Object.hasOwn = polyfill;`, "no-object-hasown", {
      settings,
    });
    assertValid(
      `const { Object: First } = Second;
const { Object: Second } = First;
First.hasOwn(record, "x");`,
      "no-object-hasown",
      { settings },
    );
  });

  it("keeps release-portable availability guards silent", () => {
    const settings = { javascriptMode: "es2021", release: "zurich" } as const;
    for (const code of [
      `Object.hasOwn && Object.hasOwn(record, "x");`,
      `Object.hasOwn ? Object.hasOwn(record, "x") : fallback(record, "x");`,
      `Object.hasOwn?.(record, "x") ?? false;`,
      `Object.hasOwn?.call(null, record, "x");`,
      `if (Object.hasOwn) { Object.hasOwn(record, "x"); }`,
      `if (typeof Object.hasOwn === "function") Object.hasOwn(record, "x");`,
      `if (Object.hasOwn == null) fallback(); else Object.hasOwn(record, "x");`,
      `while (Object.hasOwn) { Object.hasOwn(record, "x"); break; }`,
      `function owns(record) { if (!Object.hasOwn) return false; return Object.hasOwn(record, "x"); }`,
      `function owns(record) { if (typeof Object.hasOwn !== "function") throw unavailable; return Object.hasOwn(record, "x"); }`,
      `function owns(record) { if (!Object.hasOwn) return fallback(); log(); return Object.hasOwn(record, "x"); }`,
      `if (Object.hasOwn) (() => Object.hasOwn(record, "x"))();`,
      `while (items.length) { if (!Object.hasOwn) break; Object.hasOwn(record, "x"); }`,
      `for (const item of items) { if (!Object.hasOwn) continue; Object.hasOwn(item, "x"); }`,
      `!Object.hasOwn || Object.hasOwn(record, "x");`,
      `typeof Object.hasOwn !== "function" || Object.hasOwn(record, "x");`,
      `Object.hasOwn !== void 0 && Object.hasOwn(record, "x");`,
      `"hasOwn" in Object && Object.hasOwn(record, "x");`,
    ]) {
      assertValid(code, "no-object-hasown", { settings });
    }
    assertInvalid(
      `Object.hasOwn || Object.hasOwn(record, "x");`,
      "no-object-hasown",
      { messageId: "unsupported" },
      { settings },
    );
    for (const code of [
      `if (Object.hasOwn !== null) Object.hasOwn(record, "x");`,
      `Object.hasOwn !== null && Object.hasOwn(record, "x");`,
      `if (Object.hasOwn === null) {} else Object.hasOwn(record, "x");`,
      `function owns(undefined) { if (Object.hasOwn !== undefined) return Object.hasOwn(record, "x"); }`,
      `Object.hasOwn.call?.(null, record, "x");`,
      `if (typeof Object.hasOwn === "function") { Object.hasOwn = undefined; Object.hasOwn(record, "x"); }`,
      `if (Object.hasOwn) { delete Object.hasOwn; Object.hasOwn(record, "x"); }`,
      `if (Object.hasOwn) { (function () { Object.hasOwn = undefined; })(); Object.hasOwn(record, "x"); }`,
      `for (; Object.hasOwn; Object.hasOwn(record, "x")) { Object.hasOwn = undefined; }`,
    ]) {
      assertInvalid(code, "no-object-hasown", { messageId: "unsupported" }, { settings });
    }
  });

  it("does not apply a definition-site guard across a function boundary", () => {
    assertInvalid(
      `if (Object.hasOwn) {
  function owns(record) { return Object.hasOwn(record, "x"); }
}`,
      "no-object-hasown",
      { messageId: "unsupported" },
      { settings: { javascriptMode: "es2021", release: "zurich" } },
    );
  });

  it("conservatively treats possible Object replacements as whole-file taint", () => {
    const settings = { javascriptMode: "es2021", release: "zurich" } as const;
    for (const code of [
      `function run() { Object.hasOwn(record, "x"); }
Object.hasOwn = polyfill; run();`,
      `run(); Object.hasOwn = polyfill;
function run() { Object.hasOwn(record, "x"); }`,
      `if (false) Object.hasOwn = polyfill; Object.hasOwn(record, "x");`,
      `Object[method] = polyfill; Object.hasOwn(record, "x");`,
      `Object.defineProperty(Object, "hasOwn", { value: polyfill }); Object.hasOwn(record, "x");`,
      `Object.assign(Object, { hasOwn: polyfill }); Object.hasOwn(record, "x");`,
      `const { defineProperty } = Object; defineProperty(Object, "hasOwn", { value: polyfill }); Object.hasOwn(record, "x");`,
      `Object.defineProperty.call(Object, Object, "hasOwn", { value: polyfill }); Object.hasOwn(record, "x");`,
      `Object.defineProperty.apply(Object, [Object, "hasOwn", { value: polyfill }]); Object.hasOwn(record, "x");`,
      `const define = Object.defineProperty.bind(Object); define(Object, "hasOwn", { value: polyfill }); Object.hasOwn(record, "x");`,
      `(0, Object.defineProperty)(Object, "hasOwn", { value: polyfill }); Object.hasOwn(record, "x");`,
      `const define = (0, Object.defineProperty); define(Object, "hasOwn", { value: polyfill }); Object.hasOwn(record, "x");`,
      `Object.defineProperty(Object, "hasOwn", { value: undefined, value: polyfill }); Object.hasOwn(record, "x");`,
      `Object.defineProperty(Object, "hasOwn", { value: undefined, ...{ value: polyfill } }); Object.hasOwn(record, "x");`,
      `const args = [Object, "hasOwn", { value: polyfill }]; Object.defineProperty(...args); Object.hasOwn(record, "x");`,
      `const define = Object.defineProperty; Object.defineProperty = undefined; define(Object, "hasOwn", { value: polyfill }); Object.hasOwn(record, "x");`,
      `Object.defineProperty = undefined; Object.defineProperty(Object, "hasOwn", { value: polyfill }); Object.hasOwn(record, "x");`,
      `Object.defineProperty = function () {}; Object.defineProperty(Object, "hasOwn", { value: polyfill }); Object.hasOwn(record, "x");`,
      `function never() { Object.defineProperty = undefined; }
Object.defineProperty(Object, "hasOwn", { value: polyfill }); Object.hasOwn(record, "x");`,
      `const nativeDefine = Object.defineProperty; Object.defineProperty = undefined; Object.defineProperty = nativeDefine;
Object.defineProperty(Object, "hasOwn", { value: polyfill }); Object.hasOwn(record, "x");`,
      `install(Object); Object.hasOwn(record, "x");`,
      `install({ target: Object }); Object.hasOwn(record, "x");`,
      `const targets = { primary: Object }; install(targets); Object.hasOwn(record, "x");`,
      `new Installer(Object); Object.hasOwn(record, "x");`,
    ]) {
      assertValid(code, "no-object-hasown", { settings });
    }
    for (const code of [
      `Reflect.set(Object, "hasOwn", polyfill); Object.hasOwn(record, "x");`,
      `Reflect.apply(Object.defineProperty, Object, [Object, "hasOwn", { value: polyfill }]); Object.hasOwn(record, "x");`,
      `Object.__proto__ = { hasOwn: polyfill }; Object.hasOwn(record, "x");`,
      `delete Object.hasOwn; Object.hasOwn(record, "x");`,
      `Object.hasOwn = undefined; Object.hasOwn(record, "x");`,
      `Object.hasOwn = null; Object.hasOwn(record, "x");`,
      `Object.defineProperty(Object, "hasOwn", { value: undefined }); Object.hasOwn(record, "x");`,
      `Object.defineProperty(Object, "hasOwn", {}); Object.hasOwn(record, "x");`,
      `Object.defineProperties(Object, { hasOwn: { value: undefined } }); Object.hasOwn(record, "x");`,
      `Object.assign(Object, { hasOwn: undefined }); Object.hasOwn(record, "x");`,
      `Object.setPrototypeOf(Object, { hasOwn: undefined }); Object.hasOwn(record, "x");`,
      `inspect(Object.hasOwn); Object.hasOwn(record, "x");`,
      `Object.freeze(Object); Object.hasOwn(record, "x");`,
    ]) {
      assertInvalid(code, "no-object-hasown", { messageId: "unsupported" }, { settings });
    }
    assertInvalid(
      `globalThis.Object.defineProperty(Object, "hasOwn", { value: function () {} }); Object.hasOwn(record, "x");`,
      "no-object-hasown",
      { messageId: "unsupported" },
      { settings: { javascriptMode: "es5", release: "australia" } },
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

  it("flags private instance members in both ES2021 releases and with omitted mode", () => {
    for (const release of ["zurich", "australia"] as const) {
      assertInvalid(
        `class C { #hidden() {} }`,
        "no-unsupported-syntax",
        { messageId: "privateInstance" },
        { settings: { javascriptMode: "es2021", release } },
      );
    }
    assertInvalid(
      `class C { get #hidden() { return 1; } }`,
      "no-unsupported-syntax",
      { messageId: "privateInstance" },
      { settings: { release: "australia" } },
    );
  });

  it("allows private static members in ES2021", () => {
    for (const release of ["zurich", "australia"] as const) {
      assertValid(`class C { static #hidden = 1; }`, "no-unsupported-syntax", {
        settings: { javascriptMode: "es2021", release },
      });
    }
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

  it("stays silent when getXMLWait no longer has platform identity", () => {
    for (const code of [
      `var ga = new GlideAjax("x_acme.UserUtils");
ga.getXMLWait();
ga.getXMLWait = localWait;`,
      `GlideAjax.prototype.getXMLWait = localWait;
var ga = new GlideAjax("x_acme.UserUtils");
ga.getXMLWait();`,
      `GlideAjax = LocalGlideAjax;
var ga = new GlideAjax("x_acme.UserUtils");
ga.getXMLWait();`,
      `eval("GlideAjax.prototype.getXMLWait = localWait");
var ga = new GlideAjax("x_acme.UserUtils");
ga.getXMLWait();`,
    ]) {
      assertValid(code, "no-sync-glideajax", { filename: "incident.client.js" });
    }
  });
});
