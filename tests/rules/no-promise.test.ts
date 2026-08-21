import { describe, it } from "node:test";
import { assertInvalid, assertValid, ES5, ES2021 } from "../helpers/rule-tester.js";

const RULE = "no-promise" as const;

describe(RULE, () => {
  it("flags new Promise in ES5", () => {
    assertInvalid(
      `var p = new Promise(function (resolve) { resolve(1); });`,
      RULE,
      {
        messageId: "construct",
      },
      { settings: ES5 },
    );
  });

  it("flags Promise.resolve in ES5", () => {
    assertInvalid(`Promise.resolve(1);`, RULE, { messageId: "staticMethod" }, { settings: ES5 });
  });

  it("does not flag unrelated .then chains", () => {
    assertValid(`fetchThing().then(function () {});`, RULE, { settings: ES5 });
  });

  it("does not flag a shadowed Promise binding", () => {
    assertValid(`function Promise(fn) { fn(); }\nvar p = new Promise(function () {});`, RULE, {
      settings: ES5,
    });
  });

  it("skips unknown JavaScript mode", () => {
    assertValid(`var p = new Promise(function (resolve) { resolve(1); });`, RULE);
  });

  it("skips ES2021", () => {
    assertValid(`var p = new Promise(function (resolve) { resolve(1); });`, RULE, {
      settings: ES2021,
    });
  });

  it("skips Fluent metadata files", () => {
    assertValid(`const p = new Promise((resolve) => resolve(1));`, RULE, {
      filename: "table.now.ts",
    });
  });

  it("skips @sn-es-latest files", () => {
    assertValid(`// @sn-es-latest\nconst p = Promise.resolve(1);\n`, RULE);
  });

  it("does not treat a pragma inside a template literal as enabling ES2021", () => {
    assertInvalid(
      "var s = `\n// @sn-es-latest\n`;\nvar p = new Promise(function(){});",
      RULE,
      { messageId: "construct" },
      { settings: ES5 },
    );
  });
});
