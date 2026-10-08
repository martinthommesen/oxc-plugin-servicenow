import { ruleTester } from "../helpers/rule-tester.js";
import { describe, it } from "node:test";
import { assertDeclinesNonServerSurfaces, ES2021, ES5 } from "../helpers/rule-tester.js";

const RULE = "no-unsupported-syntax" as const;

describe(`${RULE} RegExp identity`, () => {
  const { expectActive, expectInvalid, expectValid } = ruleTester(
    "no-unsupported-syntax",
    { settings: ES5 },
    { messageId: "lookbehind" },
  );

  // @lat: [[tests#Analysis behavior#Regex features respect lexical boundaries]]
  it("allows lookbehind marker text in character classes and escaped literals", () => {
    for (const pattern of ["[(?<=)]", "[(?<!)]", String.raw`\(\?<=`, String.raw`[(?<=)\]]`]) {
      expectActive(`var re = /${pattern}/;`);
      expectActive(`new RegExp(${JSON.stringify(pattern)});`);
    }
  });

  it("recognizes real assertions after classes and escaped backslashes", () => {
    for (const pattern of ["[(?<=)](?<=a)b", "[(?<!)](?<!a)b", String.raw`\\(?<=a)b`]) {
      expectInvalid(`var re = /${pattern}/;`);
      expectInvalid(`new RegExp(${JSON.stringify(pattern)});`);
    }
  });

  it("flags direct and stable same-execution RegExp calls", () => {
    for (const code of [
      `RegExp("(?<=a)b");`,
      `new RegExp("(?<!a)b");`,
      `globalThis.RegExp("(?<=a)b");`,
      `const Regex = RegExp; Regex("(?<=a)b");`,
      `const Regex = RegExp; new Regex("(?<!a)b");`,
      `const Base = RegExp; const Regex = Base; Regex("(?<=a)b");`,
      `const { RegExp: Regex } = globalThis; Regex("(?<!a)b");`,
    ]) {
      expectInvalid(code);
    }
  });

  it("does not mistake shadows or path-dependent aliases for the built-in", () => {
    for (const code of [
      `function RegExp(pattern) { return pattern; } RegExp("(?<=a)b");`,
      `let Regex = RegExp; if (custom) Regex = localRegex; Regex("(?<=a)b");`,
      `const Regex = RegExp; function later() { return Regex("(?<=a)b"); } later();`,
      `eval(source); RegExp("(?<=a)b");`,
    ]) {
      expectValid(code);
    }
  });

  it("stays silent after visible RegExp authority loss", () => {
    for (const replacement of ["LocalRegExp", "null", "{}"]) {
      expectActive(`RegExp = ${replacement}; RegExp("(?<=a)b");`);
    }
  });

  it("resolves long constructor alias chains without recursive stack growth", () => {
    const aliases = Array.from(
      { length: 2_000 },
      (_, index) => `const Alias${index + 1} = Alias${index};`,
    );
    expectInvalid(`const Alias0 = RegExp;\n${aliases.join("\n")}\nAlias2000("(?<=a)b");`);
  });

  it("does not treat constructor availability as lookbehind support", () =>
    void expectInvalid(`if (typeof RegExp === "function") { RegExp("(?<=a)b"); }`));

  it("keeps literal syntax diagnostics independent of constructor authority", () =>
    void expectInvalid(`RegExp = LocalRegExp; var value = /(?<=a)b/;`));

  it("allows constructor lookbehind in ES2021 and unknown mode", () => {
    expectValid(`new RegExp("(?<=a)b");`, { settings: ES2021 });
    expectValid(`new RegExp("(?<=a)b");`, {});
  });
});

describe(`${RULE} object method syntax`, () => {
  const { expectInvalid, expectValid } = ruleTester(
    "no-unsupported-syntax",
    { settings: ES5 },
    { messageId: "objectMethod" },
  );

  it("flags shorthand object methods in classic modes", () => {
    for (const javascriptMode of ["compatibility", "es5"] as const) {
      for (const code of [
        `var definitions = { create() {} };`,
        `var definitions = { ["create"]() {} };`,
        `var definitions = { *create() { yield 1; } };`,
        `var definitions = { async create() {} };`,
      ]) {
        expectInvalid(code, undefined, { settings: { javascriptMode } });
      }
    }
  });

  it("allows classic object forms and ES2021 shorthand methods", () => {
    for (const code of [
      `var definitions = { create: function () {} };`,
      `var definitions = { get create() { return value; } };`,
      `var definitions = { set create(value) { stored = value; } };`,
    ]) {
      expectValid(code);
    }
    expectValid(`const definitions = { create() {} };`, { settings: ES2021 });
    expectValid(`const definitions = { create() {} };`, {});
  });

  it("does not apply server syntax restrictions to client or Fluent files", () => {
    const code = `const definitions = { create() {} };`;
    assertDeclinesNonServerSurfaces(code, RULE, ES5);
  });
});
