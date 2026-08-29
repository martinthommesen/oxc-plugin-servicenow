import { describe, it } from "node:test";
import { assertInvalid, assertValid, ES5, ES2021 } from "../helpers/rule-tester.js";

const RULE = "no-unsupported-syntax" as const;

describe(`${RULE} RegExp identity`, () => {
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
      assertInvalid(code, RULE, { messageId: "lookbehind" }, { settings: ES5 });
    }
  });

  it("does not mistake shadows or path-dependent aliases for the built-in", () => {
    for (const code of [
      `function RegExp(pattern) { return pattern; } RegExp("(?<=a)b");`,
      `let Regex = RegExp; if (custom) Regex = localRegex; Regex("(?<=a)b");`,
      `const Regex = RegExp; function later() { return Regex("(?<=a)b"); } later();`,
      `eval(source); RegExp("(?<=a)b");`,
    ]) {
      assertValid(code, RULE, { settings: ES5 });
    }
  });

  it("stays silent after visible RegExp authority loss", () => {
    for (const replacement of ["LocalRegExp", "null", "{}"]) {
      assertValid(`RegExp = ${replacement}; RegExp("(?<=a)b");`, RULE, { settings: ES5 });
    }
  });

  it("does not treat constructor availability as lookbehind support", () => {
    assertInvalid(
      `if (typeof RegExp === "function") { RegExp("(?<=a)b"); }`,
      RULE,
      { messageId: "lookbehind" },
      { settings: ES5 },
    );
  });

  it("keeps literal syntax diagnostics independent of constructor authority", () => {
    assertInvalid(
      `RegExp = LocalRegExp; var value = /(?<=a)b/;`,
      RULE,
      { messageId: "lookbehind" },
      { settings: ES5 },
    );
  });

  it("allows constructor lookbehind in ES2021 and unknown mode", () => {
    assertValid(`new RegExp("(?<=a)b");`, RULE, { settings: ES2021 });
    assertValid(`new RegExp("(?<=a)b");`, RULE);
  });
});

describe(`${RULE} object method syntax`, () => {
  it("flags shorthand object methods in classic modes", () => {
    for (const javascriptMode of ["compatibility", "es5"] as const) {
      for (const code of [
        `var definitions = { create() {} };`,
        `var definitions = { ["create"]() {} };`,
        `var definitions = { *create() { yield 1; } };`,
        `var definitions = { async create() {} };`,
      ]) {
        assertInvalid(code, RULE, { messageId: "objectMethod" }, { settings: { javascriptMode } });
      }
    }
  });

  it("allows classic object forms and ES2021 shorthand methods", () => {
    for (const code of [
      `var definitions = { create: function () {} };`,
      `var definitions = { get create() { return value; } };`,
      `var definitions = { set create(value) { stored = value; } };`,
    ]) {
      assertValid(code, RULE, { settings: ES5 });
    }
    assertValid(`const definitions = { create() {} };`, RULE, { settings: ES2021 });
    assertValid(`const definitions = { create() {} };`, RULE);
  });

  it("does not apply server syntax restrictions to client or Fluent files", () => {
    const code = `const definitions = { create() {} };`;
    assertValid(code, RULE, {
      filename: "form.client.js",
      settings: { javascriptMode: "es5", surfaces: ["client"] },
    });
    assertValid(code, RULE, {
      filename: "metadata.now.ts",
      settings: { javascriptMode: "es5" },
    });
  });
});
