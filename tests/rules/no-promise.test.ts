import { describe, it } from "node:test";
import { assertInvalid, assertValid } from "../helpers/rule-tester.js";

const RULE = "no-promise" as const;

describe(RULE, () => {
  it("flags new Promise", () => {
    assertInvalid(`var p = new Promise(function (resolve) { resolve(1); });`, RULE, {
      messageId: "construct",
    });
  });

  it("flags Promise.resolve", () => {
    assertInvalid(`Promise.resolve(1);`, RULE, { messageId: "staticMethod" });
  });

  it("flags .then chains", () => {
    assertInvalid(`fetchThing().then(function () {});`, RULE, { messageId: "thenable" });
  });

  it("skips Fluent metadata files", () => {
    assertValid(`const p = new Promise((resolve) => resolve(1));`, RULE, {
      filename: "table.now.ts",
    });
  });

  it("skips @sn-es-latest files", () => {
    assertValid(`// @sn-es-latest\nconst p = Promise.resolve(1);\n`, RULE);
  });
});
