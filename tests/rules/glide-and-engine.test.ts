import { ruleTester } from "../helpers/rule-tester.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertInvalid,
  assertValid,
  AUSTRALIA_ES2021,
  AUSTRALIA_ES5,
  ES2021,
  ES5,
  lint,
  ZURICH_ES2021,
} from "../helpers/rule-tester.js";

describe("no-gs-now", () => {
  const { expectInvalid, expectValid, expectActive } = ruleTester(
    "no-gs-now",
    {},
    {
      messageId: "server",
    },
  );

  it("flags gs.now()", () => void expectInvalid(`var when = gs.now();`));

  it("flags gs.nowDateTime()", () =>
    void expectInvalid(`var when = gs.nowDateTime();`, { messageId: "nowDateTime" }));

  it("uses the client message in client files", () =>
    void expectInvalid(
      `var when = gs.now();`,
      { messageId: "client" },
      {
        filename: "form.client.js",
      },
    ));

  it("allows GlideDateTime", () => void expectValid(`var when = new GlideDateTime();`));

  it("does not flag a shadowed gs binding", () =>
    void expectValid("var gs = { now: function () { return 'x'; } }; var when = gs.now();"));

  it("stays silent when the gs method identity can change", () => {
    expectActive(`gs = localGs;\ngs.now();`);
    expectActive(`gs = null;\ngs.now();`);
    expectActive(`gs.now = localNow;\ngs.now();`);
    expectActive(`gs.now = undefined;\ngs.now();`);
    expectActive(`Object.defineProperty(gs, "now", { value: null });\ngs.now();`);
    expectActive(`prepare(gs);\ngs.now();`);
    expectActive(`var platform = gs;\nprepare(platform);\ngs.now();`);
    expectInvalid(`prepare(gs.now);\ngs.now();`);
  });

  it("keeps gs authority across nullish Object.assign sources", () => {
    for (const declaration of [
      "const absent = null;",
      "var absent = null;",
      "let absent = undefined;",
      "let absent = void 0;",
    ]) {
      expectInvalid(`${declaration}\nObject.assign(gs, absent, undefined);\ngs.now();`, undefined, {
        settings: ES2021,
      });
    }
  });

  it("keeps a stable gs object alias after the global binding changes", () =>
    void expectInvalid(`var service = gs;\ngs = localGs;\nservice.now();`));

  it("does not let a provably later top-level write suppress an earlier call", () => {
    expectInvalid(`gs.now();\ngs.now = localNow;`);
    expectInvalid(`function run() { gs.now(); gs.now = localNow; } run();`);
    expectValid(`gs.now();\nfunction later() { gs.now = localNow; }`);
  });

  it("bounds deeply destructured mutation aliases conservatively", () => {
    const aliases = [
      `const { missing: alias0 = globalThis } = {};`,
      ...Array.from(
        { length: 512 },
        (_, index) => `const { missing: alias${index + 1} = alias${index} } = {};`,
      ),
    ];
    expectValid(`${aliases.join("\n")}\nalias512.gs.now = localNow;\ngs.now();`, {
      settings: ES2021,
    });
  });
});

describe("no-br-current-update", () => {
  const { expectInvalid, expectValid, expectActive } = ruleTester(
    "no-br-current-update",
    { filename: "incident.br.js" },
    { messageId: "update" },
  );

  it("flags current.update()", () => void expectInvalid(`current.state = 2;\ncurrent.update();`));

  it("does not treat src/server as a Business Rule", () =>
    void expectValid("current.update();", {
      filename: "src/server/incident.js",
    }));

  it("allows current.update() in unclassified files", () =>
    void expectValid("current.update();", { filename: "utils.js" }));

  it("allows current.update() in a Script Include", () =>
    void expectValid("current.update();", { filename: "helper.si.js" }));

  it("flags current.update() when scriptType forces a Business Rule", () =>
    void expectInvalid("current.update();", undefined, {
      filename: "misc.js",
      settings: { scriptType: "business-rule" },
    }));

  it("allows field assignment", () => void expectActive(`current.state = 2;`));

  it("allows current.update() in a UI Action", () =>
    void expectValid(`current.state = 2;\ncurrent.update();`, {
      filename: "close-incident.ui-action.js",
    }));

  it("stays silent when the body-only current identity can change", () => {
    expectActive(`current = getOtherRecord();\ncurrent.update();`);
    expectActive(`current = null;\ncurrent.update();`);
    expectActive(`current.update = localUpdate;\ncurrent.update();`);
    expectActive(`current.update = undefined;\ncurrent.update();`);
    expectActive(`Object.defineProperty(current, "update", { value: null });\ncurrent.update();`);
    expectActive(`prepare(current);\ncurrent.update();`);
    expectActive(`var record = current;\nprepare(record);\ncurrent.update();`);
  });

  it("does not let a provably later top-level write suppress an earlier update", () => {
    expectInvalid(`current.update();\ncurrent.update = localUpdate;`);
    expectInvalid(`function run() { current.update(); current.update = localUpdate; } run();`);
    expectValid(`current.update();\nfunction later() { current.update = localUpdate; }`);
  });
});

describe("no-hardcoded-table-names", () => {
  const { expectInvalid, expectSkipped, expectValid } = ruleTester(
    "no-hardcoded-table-names",
    {},
    {
      messageId: "literal",
    },
  );

  it("flags string table names", () =>
    void expectInvalid(`var gr = new GlideRecord("x_acme_widget");`));

  it("gates on known classic server-side surfaces (FINDINGS.md COR-015)", () => {
    // The catalog and the generated page declare classic authoring and known
    // instance surfaces; Fluent metadata and unclassified files stay silent.
    expectSkipped(`var gr = new GlideRecord("incident");`, {
      filename: "table.now.ts",
    });
    expectSkipped(`var gr = new GlideRecord("incident");`, {
      filename: "foo.js",
    });
  });

  it("flags string table names on GlideRecordSecure", () =>
    void expectInvalid('var gr = new GlideRecordSecure("incident");'));

  it("allows identifiers", () => void expectValid(`var gr = new GlideRecord(TABLE.WIDGET);`));

  it("allows builtins when configured", () =>
    void expectValid(`var gr = new GlideRecord("incident");`, {
      options: { "no-hardcoded-table-names": [{ allowBuiltins: true }] },
    }));
});

describe("engine feature availability by mode and release", () => {
  const { expectInvalid, expectValid } = ruleTester("no-typed-arrays", ZURICH_ES2021, {
    messageId: "ctor",
  });

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

  it("no-at-method reports the at diagnostic", () => {
    const messages = lint("var last = [1, 2].at(1);", "no-at-method", { settings: ES5 });
    assert.ok(messages.some((message) => message.messageId === "at"));
  });

  it("no-at-method ignores user-defined and unknown receivers", () => {
    assertValid(
      `var cache = { at: function (key) { return key; } }; cache.at("x");`,
      "no-at-method",
      { settings: ES5 },
    );
    assertValid(`function read(value) { return value.at(0); }`, "no-at-method", { settings: ES5 });
    assertValid(`let items = [1, 2]; items.at(0);`, "no-at-method", { settings: ES5 });
    assertValid(`[1, 2].at(0);`, "no-at-method", { settings: ES2021 });
    assertValid(
      `const values = [1, 2]; values.items = customCollection; const { items } = values; items.at(0);`,
      "no-at-method",
      { settings: ES5 },
    );
  });

  it("no-packages-calls flags Packages", () =>
    void assertInvalid(
      `var n = Packages.java.lang.System.nanoTime();`,
      "no-packages-calls",
      {
        messageId: "packages",
      },
      { filename: "src/server/test.js" },
    ));

  it("no-packages-calls reports a Packages chain once", () =>
    void assertInvalid(
      'var s = new Packages.java.lang.String("x");',
      "no-packages-calls",
      { count: 1 },
      { filename: "src/server/test.js" },
    ));

  it("no-packages-calls reports Packages aliases at their source", () => {
    for (const code of [
      "var P = Packages; P.java.lang.System.nanoTime();",
      "var java = Packages.java; java.lang.System.nanoTime();",
      "var { java } = Packages; java.lang.System.nanoTime();",
    ]) {
      assertInvalid(code, "no-packages-calls", { count: 1 }, { filename: "src/server/test.js" });
    }
  });

  it("no-packages-calls flags dynamic computed access", () =>
    void assertInvalid(
      "var value = Packages[name][member];",
      "no-packages-calls",
      { count: 1 },
      { filename: "src/server/test.js" },
    ));

  it("no-packages-calls allows Packages as an object key", () =>
    void assertValid("var o = { Packages: 1 };", "no-packages-calls"));

  it("no-packages-calls allows a Packages member on another object", () =>
    void assertValid("var x = lib.Packages;", "no-packages-calls"));

  it("no-packages-calls allows a local Packages binding", () =>
    void assertValid("var Packages = 2; var y = Packages;", "no-packages-calls"));

  it("no-packages-calls ignores an unclassified file", () =>
    void assertValid("var value = Packages.example;", "no-packages-calls", {
      filename: "plain.js",
    }));

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

  it("does not assume an ordinary unknown-context JavaScript file is ServiceNow", () =>
    void assertValid(`var n = Packages.java.lang.System.nanoTime();`, "no-packages-calls", {
      filename: "index.js",
    }));

  it("treats the documented _next cursor equivalent as requiring a query", () => {
    for (const scope of ["global", "scoped"] as const) {
      assertInvalid(
        `var gr = new GlideRecord("incident"); gr._next();`,
        "require-query-before-next",
        { count: 1, messageId: "missingQuery" },
        { filename: "src/server/test.js", settings: { scope } },
      );
    }
  });

  it("no-weak-references flags WeakRef in any instance mode", () =>
    void assertInvalid(`var ref = new WeakRef(obj);`, "no-weak-references", { messageId: "weak" }));

  it("no-weak-collections flags WeakMap in ES5", () =>
    void assertInvalid(
      `var cache = new WeakMap();`,
      "no-weak-collections",
      { messageId: "weak" },
      {
        settings: ES5,
      },
    ));

  it("no-async-iterators flags for await", () =>
    void assertInvalid(
      `async function drain(items) { for await (const item of items) { gs.info(item); } }`,
      "no-async-iterators",
      { messageId: "forAwait" },
    ));

  it("no-typed-arrays flags Int8Array", () =>
    void expectInvalid(`var bytes = new Int8Array(16);`, undefined, {
      settings: ES5,
    }));

  it("no-typed-arrays flags DataView", () =>
    void expectInvalid(`var view = new DataView(buffer);`, undefined, {
      settings: ES5,
    }));

  it("flags typed-array static factories when their constructor is unavailable", () => {
    for (const code of [
      `Int8Array.from(values);`,
      `Uint8Array.of(1, 2);`,
      `const fromBytes = Int8Array.from; fromBytes(values);`,
    ]) {
      expectInvalid(code, { messageId: "factory" }, AUSTRALIA_ES5);
    }
    expectInvalid(`BigInt64Array.from(values);`, { messageId: "factory" });
    expectValid(`BigInt64Array.from(values);`, {
      settings: AUSTRALIA_ES2021.settings,
    });
    expectValid(`typeof BigInt64Array !== "undefined" && BigInt64Array.from(values);`);
    expectValid(`Int8Array.from = polyfill; Int8Array.from(values);`, {
      settings: AUSTRALIA_ES5.settings,
    });
    expectValid(
      `const { BigInt64Array: Words } = globalThis; Words.from = polyfill; Words.from(values);`,
    );
    expectValid(`const Int8Array = { from: custom }; Int8Array.from(values);`, {
      settings: AUSTRALIA_ES5.settings,
    });
  });

  it("models the Australia TypedArray factory delta independently from constructors", () => {
    for (const code of [
      `Int8Array.from(values);`,
      `Uint8Array["of"](1, 2);`,
      `const Bytes = Int8Array; Bytes.from(values);`,
      `const fromBytes = Int8Array.from; fromBytes(values);`,
    ]) {
      expectInvalid(code, { messageId: "factory" });
      expectValid(code, AUSTRALIA_ES2021);
    }
    expectValid(`Int8Array.from(values);`, {
      settings: ES2021,
    });
  });

  it("requires a method guard when Zurich already provides the TypedArray constructor", () => {
    for (const code of [
      `typeof Int8Array.from === "function" && Int8Array.from(values);`,
      `Int8Array.from && Int8Array.from(values);`,
      `"from" in Int8Array && Int8Array.from(values);`,
      `Int8Array.from?.(values);`,
      `function run() { if (typeof Int8Array.from !== "function") return; Int8Array.from(values); }`,
      `const fromBytes = Int8Array.from; if (typeof fromBytes === "function") fromBytes(values);`,
      `Int8Array.from = polyfill; Int8Array.from(values);`,
      `Object.getPrototypeOf(Int8Array).from = polyfill; Int8Array.from(values);`,
      `const Int8Array = { from: custom }; Int8Array.from(values);`,
    ]) {
      expectValid(code);
    }
    expectInvalid(`typeof Int8Array !== "undefined" && Int8Array.from(values);`, {
      messageId: "factory",
    });
  });

  it("models the BigInt typed-array Australia delta conservatively", () => {
    const code = `var values = new BigInt64Array(4);`;
    expectInvalid(code, { messageId: "bigintCtor" });
    expectValid(code, {
      settings: AUSTRALIA_ES2021.settings,
    });
    expectValid(code, { settings: ES2021 });
    expectInvalid(code, { messageId: "bigintCtor" }, { settings: ES5 });
  });

  it("flags documented DataView BigInt getters through object aliases", () => {
    expectInvalid(
      `const view = new DataView(buffer); const alias = view; alias["getBigInt64"](0);`,
      { messageId: "bigintGetter" },
      AUSTRALIA_ES2021,
    );
    expectInvalid(
      `new DataView(buffer).getBigUint64(0);`,
      { messageId: "bigintGetter" },
      { settings: { release: "australia" } },
    );
    expectInvalid(
      `const DV = DataView; const view = new DV(buffer); view.getBigInt64(0);`,
      { messageId: "bigintGetter" },
      AUSTRALIA_ES2021,
    );
    expectInvalid(
      `const view = new globalThis.DataView(buffer); view.getBigInt64(0);`,
      { messageId: "bigintGetter" },
      AUSTRALIA_ES2021,
    );
  });

  it("follows immutable aliases to typed-array constructors", () => {
    expectInvalid(`const Bytes = Int8Array; new Bytes(4);`, undefined, AUSTRALIA_ES5);
    expectInvalid(`const Words = BigInt64Array; new Words(4);`, { messageId: "bigintCtor" });
    expectInvalid(`const DV = DataView; new DV(buffer);`, undefined, AUSTRALIA_ES5);
    expectInvalid(`const Bytes = globalThis.Int8Array; new Bytes(4);`, undefined, AUSTRALIA_ES5);
    expectInvalid(`const Bytes = (0, Int8Array); new Bytes(4);`, undefined, AUSTRALIA_ES5);
    expectInvalid(`new (0, Int8Array)(4);`, undefined, AUSTRALIA_ES5);
    expectInvalid(`const { BigInt64Array: Words } = globalThis; new Words(4);`, {
      messageId: "bigintCtor",
    });
    expectInvalid(
      `const { DataView: DV } = globalThis; new DV(buffer).getBigInt64(0);`,
      { messageId: "bigintGetter" },
      AUSTRALIA_ES2021,
    );
  });

  it("keeps guarded typed-array features silent", () => {
    expectValid(`if (typeof Int8Array !== "undefined") new Int8Array(4);`, {
      settings: AUSTRALIA_ES5.settings,
    });
    expectValid(`typeof Int8Array !== "undefined" && new Int8Array(4);`, {
      settings: AUSTRALIA_ES5.settings,
    });
    expectValid(`typeof Int8Array !== "function" || new Int8Array(4);`, {
      settings: AUSTRALIA_ES5.settings,
    });
    expectInvalid(
      `const Bytes = globalThis.Int8Array; if (typeof Bytes === "function") new Bytes(4);`,
      undefined,
      AUSTRALIA_ES5,
    );
    expectInvalid(`globalThis.Int8Array?.(4);`, undefined, AUSTRALIA_ES5);
    expectValid(
      `typeof globalThis !== "undefined" && globalThis.Int8Array && new globalThis.Int8Array(4);`,
      AUSTRALIA_ES5,
    );
    expectValid(
      `const Bytes = globalThis.Int8Array; if (typeof Bytes === "function") new Bytes(4);`,
      AUSTRALIA_ES2021,
    );
    expectValid(`"BigInt64Array" in globalThis && new globalThis.BigInt64Array(4);`);
    for (const code of [
      `Int8Array && new Int8Array(4);`,
      `if (Int8Array) new Int8Array(4);`,
      `Int8Array !== undefined && new Int8Array(4);`,
      `if (Int8Array != null) new Int8Array(4);`,
      `const Bytes = Int8Array; if (typeof Bytes !== "undefined") new Bytes(4);`,
      `const Bytes = Int8Array; if (typeof Int8Array !== "undefined") new Bytes(4);`,
      `if (typeof Int8Array === "function") { Int8Array = undefined; new Int8Array(4); }`,
    ]) {
      expectInvalid(code, undefined, AUSTRALIA_ES5);
    }
    for (const code of [
      `const view = new DataView(buffer); view.getBigInt64?.(0);`,
      `const view = new DataView(buffer); view.getBigInt64 && view.getBigInt64(0);`,
      `const view = new DataView(buffer); if (view.getBigInt64) view.getBigInt64(0);`,
      `function run() { const view = new DataView(buffer); if (!view.getBigInt64) return; view.getBigInt64(0); }`,
      `const first = new DataView(a); const second = new DataView(b); if (first.getBigInt64) second.getBigInt64(0);`,
      `const view = new DataView(buffer); if (DataView.prototype.getBigInt64) view.getBigInt64(0);`,
      `const view = new DataView(buffer); !view.getBigInt64 || view.getBigInt64(0);`,
      `const view = new DataView(buffer); "getBigInt64" in DataView.prototype && view.getBigInt64(0);`,
    ]) {
      expectValid(code, AUSTRALIA_ES2021);
    }
    expectInvalid(
      `const view = new DataView(buffer); view?.getBigInt64(0);`,
      { messageId: "bigintGetter" },
      AUSTRALIA_ES2021,
    );
    expectInvalid(
      `const view = new DataView(buffer); if (view.getBigInt64) { view.getBigInt64 = undefined; view.getBigInt64(0); }`,
      { messageId: "bigintGetter" },
      AUSTRALIA_ES2021,
    );
  });

  it("recognizes direct DataView getter invocation helpers", () => {
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
      expectInvalid(code, { messageId: "bigintGetter" }, AUSTRALIA_ES2021);
    }
  });

  it("keeps unproven DataView-like receivers and undocumented setters silent", () => {
    expectValid(`new DataView(buffer).setBigInt64(0, value);`, {
      settings: ZURICH_ES2021.settings,
    });
    expectValid(`view.getBigInt64(0);`, {
      settings: ZURICH_ES2021.settings,
    });
    expectValid(`function DataView() {} const view = new DataView(); view.getBigInt64(0);`);
    expectValid(`let view = new DataView(buffer); view = customView; view.getBigInt64(0);`);
    expectValid(`DataView = CustomView; const view = new DataView(buffer); view.getBigInt64(0);`);
    expectValid(
      `const view = new DataView(buffer); view.getBigInt64 = custom; view.getBigInt64(0);`,
    );
    expectValid(`DataView.prototype.getBigInt64 = custom; new DataView(buffer).getBigInt64(0);`);
    expectValid(`Int8Array = CustomArray; new Int8Array(1);`, {
      settings: AUSTRALIA_ES5.settings,
    });
    expectValid(
      `globalThis.DataView.prototype.getBigInt64 = custom;
new DataView(buffer).getBigInt64(0);`,
      {
        filename: "incident.br.js",
        settings: { javascriptMode: "unknown", release: "australia" },
      },
    );
  });

  it("conservatively suppresses diagnostics after any possible relevant mutation", () => {
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
      `var prototype = DataView.prototype;
prototype.getBigInt64 = custom;
new DataView(buffer).getBigInt64(0);`,
      `let prototype = DataView.prototype;
prototype.getBigInt64 = custom;
new DataView(buffer).getBigInt64(0);`,
    ]) {
      expectValid(code, AUSTRALIA_ES2021);
    }
    expectValid(`install(Int8Array); Int8Array.from(values);`, {
      settings: AUSTRALIA_ES5.settings,
    });
    expectValid(`new Int8Array(1); Int8Array = CustomArray;`, {
      settings: AUSTRALIA_ES5.settings,
    });
    expectInvalid(
      `globalThis.Int8Array = CustomArray; new Int8Array(1);`,
      undefined,
      AUSTRALIA_ES5,
    );
  });

  it("keeps DataView method replacement tied to object identity", () => {
    expectInvalid(
      `const first = new DataView(a); first.getBigInt64 = custom; first.getBigInt64(0);
const second = new DataView(b); second.getBigInt64(0);`,
      { messageId: "bigintGetter", count: 1 },
      AUSTRALIA_ES2021,
    );
    expectInvalid(
      `const cache = {}; cache[key] = value;
const view = new DataView(buffer); view.getBigInt64(0);`,
      { messageId: "bigintGetter", count: 1 },
      AUSTRALIA_ES2021,
    );
    for (const code of [
      `const view = new DataView(buffer); delete view.getBigInt64; view.getBigInt64(0);`,
      `const view = new DataView(buffer); view.getBigInt64 = undefined; view.getBigInt64(0);`,
      `Reflect.set(DataView.prototype, "getBigInt64", custom); new DataView(buffer).getBigInt64(0);`,
      `const view = new DataView(buffer); view.__proto__ = { getBigInt64: custom }; view.getBigInt64(0);`,
      `inspect(DataView.prototype.getBigInt64); new DataView(buffer).getBigInt64(0);`,
    ]) {
      expectInvalid(code, { messageId: "bigintGetter", count: 1 }, AUSTRALIA_ES2021);
    }
  });

  it("no-proxy flags new Proxy", () =>
    void assertInvalid(
      `var p = new Proxy(target, handler);`,
      "no-proxy",
      { messageId: "construct" },
      {
        settings: ES5,
      },
    ));

  it("no-proxy flags Proxy.revocable", () =>
    void assertInvalid(
      `var p = Proxy.revocable(target, handler);`,
      "no-proxy",
      {
        messageId: "revocable",
      },
      { settings: ES5 },
    ));
});

describe("server engine surface gating", () => {
  it("does not apply the server engine matrix to browser-executed client scripts", () => {
    assertValid(`Object.hasOwn(record, "number");`, "no-object-hasown", {
      filename: "form.client.js",
      settings: { ...ZURICH_ES2021.settings, surfaces: ["client"] },
    });
    assertValid(`new BigInt64Array(1);`, "no-typed-arrays", {
      filename: "form.client.js",
      settings: { ...ZURICH_ES2021.settings, surfaces: ["client"] },
    });
    assertValid(`Int8Array.from(values);`, "no-typed-arrays", {
      filename: "form.client.js",
      settings: { ...ZURICH_ES2021.settings, surfaces: ["client"] },
    });
    assertValid(`class Example { #value = 1; }`, "no-unsupported-syntax", {
      filename: "form.client.js",
      settings: { ...AUSTRALIA_ES2021.settings, surfaces: ["client"] },
    });
  });
});
describe("no-object-hasown", () => {
  const { expectInvalid, expectValid } = ruleTester("no-object-hasown", AUSTRALIA_ES5, {
    messageId: "unsupported",
  });

  it("follows the Zurich and Australia release matrix", () => {
    const code = `var owns = Object.hasOwn(record, "number");`;
    expectInvalid(code, undefined, ZURICH_ES2021);
    expectValid(code, {
      settings: AUSTRALIA_ES2021.settings,
    });
    expectValid(code, { settings: ES2021 });
    expectInvalid(code, undefined, { settings: ES5 });
  });

  it("keeps callable facts across stable nullish Object.assign sources", () => {
    for (const declaration of ["var absent = null;", "let absent = undefined;"]) {
      expectInvalid(
        `${declaration}\nObject.assign(Object, absent);\nObject.hasOwn(record, "number");`,
        undefined,
        ZURICH_ES2021,
      );
    }
  });

  it("keeps unrelated apply mutations precise for a stable ES5 array alias", () =>
    void expectInvalid(`var args = [Object, "keys", { value: custom }];
Object.defineProperty.apply(Object, args);
Object.hasOwn(record, "number");`));

  it("recognizes static computed access and proven aliases", () => {
    expectInvalid(`const BuiltinObject = Object; BuiltinObject["hasOwn"](record, "number");`);
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
      expectInvalid(code);
    }
    expectValid(`const { hasOwn = fallback } = Object; hasOwn(record, "number");`);
    for (const code of [
      `const { hasOwn = undefined } = Object; hasOwn(record, "number");`,
      `const { hasOwn = null } = Object; hasOwn(record, "number");`,
    ]) {
      expectInvalid(code, undefined, ZURICH_ES2021);
    }
    expectValid(
      `const { Object: BuiltinObject = CustomObject } = globalThis; BuiltinObject.hasOwn(record, "number");`,
      ZURICH_ES2021,
    );
  });

  it("keeps shadowed, reassigned, dynamic, and unrelated receivers silent", () => {
    expectValid(
      `const Object = { hasOwn: function () { return true; } }; Object.hasOwn(record, "x");`,
    );
    expectValid(
      `let BuiltinObject = Object; BuiltinObject = helper; BuiltinObject.hasOwn(record, "x");`,
    );
    expectValid(`Object[method](record, "x");`);
    expectValid(`helper.hasOwn(record, "x");`);
    expectValid(`const { local } = Object; local.hasOwn(record, "x");`);
    expectValid(`Object.hasOwn = polyfill; Object.hasOwn(record, "x");`);
    expectValid(`Object = custom; Object.hasOwn(record, "x");`);
    expectValid(
      `const BuiltinObject = Object; BuiltinObject.hasOwn = polyfill; BuiltinObject.hasOwn(record, "x");`,
    );
    expectValid(
      `const { Object: BuiltinObject } = globalThis; BuiltinObject.hasOwn = polyfill; BuiltinObject.hasOwn(record, "x");`,
      ZURICH_ES2021,
    );
    expectValid(`Object.hasOwn(record, "x"); Object.hasOwn = polyfill;`);
    expectValid(`const { Object: First } = Second;
const { Object: Second } = First;
First.hasOwn(record, "x");`);
  });

  it("keeps release-portable availability guards silent", () => {
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
      expectValid(code, ZURICH_ES2021);
    }
    expectInvalid(`Object.hasOwn || Object.hasOwn(record, "x");`, undefined, ZURICH_ES2021);
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
      expectInvalid(code, undefined, ZURICH_ES2021);
    }
  });

  it("does not apply a definition-site guard across a function boundary", () =>
    void expectInvalid(
      `if (Object.hasOwn) {
  function owns(record) { return Object.hasOwn(record, "x"); }
}`,
      undefined,
      ZURICH_ES2021,
    ));

  it("conservatively treats possible Object replacements as whole-file taint", () => {
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
      expectValid(code, ZURICH_ES2021);
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
      expectInvalid(code, undefined, ZURICH_ES2021);
    }
    expectInvalid(
      `globalThis.Object.defineProperty(Object, "hasOwn", { value: function () {} }); Object.hasOwn(record, "x");`,
    );
  });
});

describe("no-unsupported-syntax", () => {
  const { expectInvalid, expectValid, expectSkipped } = ruleTester(
    "no-unsupported-syntax",
    { settings: ES5 },
    { messageId: "privateInstance" },
  );

  it("flags optional chaining", () =>
    void expectInvalid(`var name = current.caller_id?.name;`, {
      messageId: "optional",
    }));

  it("flags nullish coalescing", () =>
    void expectInvalid(`var name = value ?? "unknown";`, {
      messageId: "nullish",
    }));

  it("flags logical assignment", () =>
    void expectInvalid(`cache ||= {};`, { messageId: "logicalAssign" }));

  it("flags private class members", () => void expectInvalid(`class C { #hidden = 1; }`));

  it("flags private instance members in both ES2021 releases and with omitted mode", () => {
    for (const release of ["zurich", "australia"] as const) {
      expectInvalid(`class C { #hidden() {} }`, undefined, {
        settings: { javascriptMode: "es2021", release },
      });
    }
    expectInvalid(`class C { get #hidden() { return 1; } }`, undefined, {
      settings: { release: "australia" },
    });
  });

  it("allows private static members in ES2021", () => {
    for (const release of ["zurich", "australia"] as const) {
      expectValid(`class C { static #hidden = 1; }`, {
        settings: { javascriptMode: "es2021", release },
      });
    }
  });

  it("flags regexp lookbehind", () =>
    void expectInvalid(`var r = /(?<=@)\\w+/;`, { messageId: "lookbehind" }));

  it("flags new RegExp lookbehind", () =>
    void expectInvalid(`var r = new RegExp("(?<=a)b");`, {
      messageId: "lookbehind",
    }));

  it("allows named capture groups and lookahead", () =>
    void expectValid(`var r = /(?<name>a)(?=b)/;`, {}));

  it("skips Fluent metadata files", () =>
    void expectSkipped(`const name = current?.caller_id ?? "x";`, {
      filename: "table.now.ts",
    }));
});

describe("no-sync-glideajax", () => {
  const { expectInvalid, expectValid, expectActive } = ruleTester(
    "no-sync-glideajax",
    { filename: "incident.client.js" },
    { messageId: "wait" },
  );

  it("flags getXMLWait", () =>
    void expectInvalid(`var ga = new GlideAjax("x_acme.UserUtils");\nvar xml = ga.getXMLWait();`));

  it("allows getXMLAnswer", () =>
    void expectValid(
      `var ga = new GlideAjax("x_acme.UserUtils");\nga.getXMLAnswer(function (answer) { g_form.setValue("x", answer); });`,
    ));

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
      expectActive(code);
    }
  });
});
