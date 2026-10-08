import { ruleTester } from "../helpers/rule-tester.js";
import { describe, it } from "node:test";
import {
  assertDeclinesNonServerSurfaces,
  AUSTRALIA_ES2021,
  ZURICH_ES2021,
} from "../helpers/rule-tester.js";

const RULE = "no-object-method-constructor" as const;

describe(RULE, () => {
  const { expectInvalid, expectValid, expectActive } = ruleTester(
    "no-object-method-constructor",
    AUSTRALIA_ES2021,
    { messageId: "notConstructor" },
  );

  it("reports direct and stable object-method constructions in Australia", () => {
    for (const code of [
      `new ({ create() {} }).create();`,
      `new ({ ["create"]() {} })["create"]();`,
      `new ({ ""() {} })[""]();`,
      `new ({ 0() {} })[0]();`,
      `const definitions = { create() {} };
new definitions.create();`,
      `const definitions = { *create() { yield 1; } };
new definitions.create();`,
      `const definitions = { async create() {} };
new definitions.create();`,
      `const definitions = { create() {} };
const alias = definitions;
const Constructor = alias["create"];
new Constructor();`,
      `const definitions = { create: function () {}, create() {} };
new definitions.create();`,
      `const definitions = { [dynamicKey]: replacement, create() {} };
new definitions.create();`,
    ]) {
      expectInvalid(code);
    }
  });

  it("reports every proven construction from one stable object", () =>
    void expectInvalid(
      `const definitions = { create() {} };
new definitions.create();
const Constructor = definitions.create;
new Constructor();`,
      { messageId: "notConstructor", count: 2 },
    ));

  it("propagates long object alias chains in one pass", () => {
    const aliases = Array.from(
      { length: 1_000 },
      (_, index) => `const alias${index + 1} = alias${index};`,
    );
    expectInvalid(
      `const alias0 = { create() {} };\n${aliases.join("\n")}\nnew alias1000.create();`,
    );
  });

  it("ignores erased TypeScript references when proving object stability", () =>
    void expectInvalid(
      `const definitions = { create() {} };
type Definitions = typeof definitions;
new definitions.create();`,
      undefined,
      { filename: "factory.server.ts", settings: AUSTRALIA_ES2021.settings },
    ));

  it("distinguishes constructible function-valued properties and final overrides", () => {
    for (const code of [
      `const definitions = { create: function () {} };
new definitions.create();`,
      `const definitions = { create() {}, create: function () {} };
new definitions.create();`,
      `const definitions = { create() {}, ...extensions };
new definitions.create();`,
      `const definitions = { create() {}, [dynamicKey]: replacement };
new definitions.create();`,
      `const definitions = { get create() { return function () {}; } };
new definitions.create();`,
      `function Constructor() {}
new Constructor();`,
    ]) {
      expectValid(code);
    }
  });

  it("stays silent when object identity or property stability is not proven", () => {
    for (const code of [
      `const definitions = { create() {} };
consume(definitions);
new definitions.create();`,
      `const definitions = { create() {} };
definitions.create = replacement;
new definitions.create();`,
      `const definitions = { create() {} };
definitions.create();
new definitions.create();`,
      `const definitions = { create() {} };
const Constructor = definitions.create;
definitions.create = replacement;
new Constructor();`,
      `const definitions = { create() {} };
let Constructor = definitions.create;
Constructor = replacement;
new Constructor();`,
      `const definitions = { create() {} };
const { create: Constructor } = definitions;
new Constructor();`,
      `const definitions = { create() {} };
{
  const definitions = { create: function () {} };
  new definitions.create();
}`,
      `const definitions = { create() { return definitions; } };
new definitions.create();`,
      `const definitions = { create() {} };
function later() { new definitions.create(); }
later();`,
      `class Definitions { create() {} }
new Definitions.prototype.create();`,
      `eval(sourceText);
const definitions = { create() {} };
new definitions.create();`,
    ]) {
      expectActive(code);
    }
  });

  it("follows the Australia ES2021 release boundary", () => {
    const code = `const definitions = { create() {} };
new definitions.create();`;
    expectInvalid(code);
    expectValid(code, ZURICH_ES2021);
    expectValid(code, { settings: { javascriptMode: "es2021" } });
    expectValid(code, {
      settings: { javascriptMode: "es5", release: "australia" },
    });
    expectValid(code, {
      settings: { javascriptMode: "compatibility", release: "australia" },
    });
  });

  it("does not apply server-engine behavior to other execution contexts", () => {
    const code = `const definitions = { create() {} };
new definitions.create();`;
    assertDeclinesNonServerSurfaces(code, RULE, AUSTRALIA_ES2021.settings);
  });
});
