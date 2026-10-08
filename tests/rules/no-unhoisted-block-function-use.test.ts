import { ruleTester } from "../helpers/rule-tester.js";
import { describe, it } from "node:test";
import {
  assertDeclinesNonServerSurfaces,
  AUSTRALIA_ES2021,
  ZURICH_ES2021,
} from "../helpers/rule-tester.js";

const RULE = "no-unhoisted-block-function-use" as const;

describe(RULE, () => {
  const { expectInvalid, expectValid, expectActive } = ruleTester(
    "no-unhoisted-block-function-use",
    ZURICH_ES2021,
    { messageId: "unhoisted" },
  );

  it("reports reads before nested block function declarations in Zurich", () => {
    for (const code of [
      `{
  helper();
  function helper() { return 1; }
}`,
      `function run() {
  if (ready) {
    return add(2, 3);
    function add(left, right) { return left + right; }
  }
}`,
      `function run() {
  try {
    const callback = helper;
    function helper() { return 1; }
    return callback();
  } catch (error) {
    return 0;
  }
}`,
      `function run() {
  do {
    typeof helper;
    function helper() { return 1; }
  } while (false);
}`,
      `function run() {
  for (let index = 0; index < 1; index += 1) {
    helper.call(null);
    function helper() { return 1; }
  }
}`,
      `function helper() { return "outer"; }
{
  helper();
  function helper() { return "block"; }
}`,
    ]) {
      expectInvalid(code);
    }
  });

  it("reports each proven pre-declaration read", () =>
    void expectInvalid(
      `{
  helper();
  const callback = helper;
  function helper() { return 1; }
}`,
      { messageId: "unhoisted", count: 2 },
    ));

  it("indexes abrupt prefixes once for many reads", () => {
    const reads = Array.from({ length: 1_000 }, () => "helper();").join("\n");
    expectInvalid(`{\n${reads}\nfunction helper() { return 1; }\n}`, {
      messageId: "unhoisted",
      count: 1_000,
    });
  });

  it("resolves the declaration in its containing block", () =>
    void expectInvalid(`{
  helper();
  function helper(helper) { return helper; }
}`));

  it("does not report declarations already hoisted by Zurich", () => {
    for (const code of [
      `helper();
function helper() { return 1; }`,
      `function run() {
  helper();
  function helper() { return 1; }
}`,
      `function run() {
  {
    function helper() { return 1; }
    helper();
  }
}`,
    ]) {
      expectValid(code);
    }
  });

  it("stays silent across deferred execution boundaries", () => {
    for (const code of [
      `{
  const callback = () => helper();
  function helper() { return 1; }
  callback();
}`,
      `{
  function callback() { return helper(); }
  function helper() { return 1; }
  callback();
}`,
      `{
  class Runner {
    run() { return helper(); }
  }
  function helper() { return 1; }
  new Runner().run();
}`,
    ]) {
      expectActive(code);
    }
  });

  it("stays silent for statically unreachable pre-declaration reads", () => {
    for (const code of [
      `function run() {
  {
    return;
    helper();
    function helper() { return 1; }
  }
}`,
      `function run() {
  {
    throw failure;
    helper();
    function helper() { return 1; }
  }
}`,
      `while (ready) {
  break;
  helper();
  function helper() { return 1; }
}`,
      `while (ready) {
  continue;
  helper();
  function helper() { return 1; }
}`,
    ]) {
      expectActive(code);
    }
  });

  it("ignores TypeScript-only pre-declaration references", () =>
    void expectActive(
      `{
  type Helper = typeof helper;
  function helper() { return 1; }
}`,
      { ...ZURICH_ES2021, filename: "test.server.ts" },
    ));

  it("requires stable lexical resolution", () => {
    for (const code of [
      `{
  helper = replacement;
  helper();
  function helper() { return 1; }
}`,
      `{
  helper();
  function helper() { return 1; }
  helper = replacement;
}`,
      `eval(sourceText);
{
  helper();
  function helper() { return 1; }
}`,
      `function helper() { return "outer"; }
{
  helper();
  {
    function helper() { return "inner"; }
  }
}`,
      `{
  function helper() { return "first"; }
  helper();
  function helper() { return "second"; }
}`,
    ]) {
      expectValid(code);
    }
  });

  it("keeps direct switch-case declarations outside the proven fix", () =>
    void expectValid(`switch (kind) {
  case "one":
    helper();
    function helper() { return 1; }
}`));

  it("follows the all-modes release delta without guessing an omitted release", () => {
    const code = `{
  helper();
  function helper() { return 1; }
}`;
    for (const javascriptMode of ["compatibility", "es5", "es2021"] as const) {
      expectInvalid(code, undefined, { settings: { javascriptMode, release: "zurich" } });
      expectValid(code, { settings: { javascriptMode, release: "australia" } });
      expectValid(code, { settings: { javascriptMode } });
    }
    expectInvalid(code, undefined, { settings: { release: "zurich" } });
    expectValid(code, { settings: { release: "australia" } });
  });

  it("does not apply server-engine behavior to other execution contexts", () => {
    const code = `{
  helper();
  function helper() { return 1; }
}`;
    assertDeclinesNonServerSurfaces(code, RULE, ZURICH_ES2021.settings);
  });

  it("accepts the corrected Australia behavior", () =>
    void expectValid(
      `{
  helper();
  function helper() { return 1; }
}`,
      AUSTRALIA_ES2021,
    ));
});
