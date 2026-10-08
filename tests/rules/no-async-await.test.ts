import { ruleTester } from "../helpers/rule-tester.js";
import { describe, it } from "node:test";
import { ES5 } from "../helpers/rule-tester.js";

const RULE = "no-async-await" as const;

describe(RULE, () => {
  const { expectInvalid, expectActive, expectSkipped } = ruleTester(
    "no-async-await",
    { settings: ES5 },
    { messageId: "asyncFn" },
  );

  it("flags async functions", () => void expectInvalid(`async function load() { return 1; }`));

  it("flags await", () =>
    void expectInvalid(`async function load() { await other(); }`, { count: 2 }));

  it("allows sync functions", () => void expectActive(`function load() { return 1; }`));

  it("skips when settings.ecmaLatest is set", () =>
    void expectSkipped(`async function load() { await other(); }`, {
      settings: { ecmaLatest: true },
    }));

  it("skips when settings.scriptType is fluent", () =>
    void expectSkipped(`async function f() {}`, {
      filename: "misc.js",
      settings: { scriptType: "fluent" },
    }));
});
