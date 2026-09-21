import { describe, it } from "node:test";
import { assertInvalid, assertSkipped, assertValidActive, ES5 } from "../helpers/rule-tester.js";

const RULE = "no-async-await" as const;

describe(RULE, () => {
  it("flags async functions", () => {
    assertInvalid(
      `async function load() { return 1; }`,
      RULE,
      { messageId: "asyncFn" },
      { settings: ES5 },
    );
  });

  it("flags await", () => {
    assertInvalid(
      `async function load() { await other(); }`,
      RULE,
      { count: 2 },
      { settings: ES5 },
    );
  });

  it("allows sync functions", () => {
    assertValidActive(`function load() { return 1; }`, RULE, { settings: ES5 });
  });

  it("skips when settings.ecmaLatest is set", () => {
    assertSkipped(`async function load() { await other(); }`, RULE, {
      settings: { ecmaLatest: true },
    });
  });

  it("skips when settings.scriptType is fluent", () => {
    assertSkipped(`async function f() {}`, RULE, {
      filename: "misc.js",
      settings: { scriptType: "fluent" },
    });
  });
});
