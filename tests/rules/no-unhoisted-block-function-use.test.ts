import { describe, it } from "node:test";
import { assertInvalid, assertValid } from "../helpers/rule-tester.js";

const RULE = "no-unhoisted-block-function-use" as const;
const ZURICH = { javascriptMode: "es2021", release: "zurich" } as const;
const AUSTRALIA = { javascriptMode: "es2021", release: "australia" } as const;

describe(RULE, () => {
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
      assertInvalid(code, RULE, { messageId: "unhoisted" }, { settings: ZURICH });
    }
  });

  it("reports each proven pre-declaration read", () => {
    assertInvalid(
      `{
  helper();
  const callback = helper;
  function helper() { return 1; }
}`,
      RULE,
      { messageId: "unhoisted", count: 2 },
      { settings: ZURICH },
    );
  });

  it("resolves the declaration in its containing block", () => {
    assertInvalid(
      `{
  helper();
  function helper(helper) { return helper; }
}`,
      RULE,
      { messageId: "unhoisted" },
      { settings: ZURICH },
    );
  });

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
      assertValid(code, RULE, { settings: ZURICH });
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
      assertValid(code, RULE, { settings: ZURICH });
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
      assertValid(code, RULE, { settings: ZURICH });
    }
  });

  it("ignores TypeScript-only pre-declaration references", () => {
    assertValid(
      `{
  type Helper = typeof helper;
  function helper() { return 1; }
}`,
      RULE,
      { settings: ZURICH },
    );
  });

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
      assertValid(code, RULE, { settings: ZURICH });
    }
  });

  it("keeps direct switch-case declarations outside the proven fix", () => {
    assertValid(
      `switch (kind) {
  case "one":
    helper();
    function helper() { return 1; }
}`,
      RULE,
      { settings: ZURICH },
    );
  });

  it("follows the all-modes release delta without guessing an omitted release", () => {
    const code = `{
  helper();
  function helper() { return 1; }
}`;
    for (const javascriptMode of ["compatibility", "es5", "es2021"] as const) {
      assertInvalid(code, RULE, {}, { settings: { javascriptMode, release: "zurich" } });
      assertValid(code, RULE, { settings: { javascriptMode, release: "australia" } });
      assertValid(code, RULE, { settings: { javascriptMode } });
    }
    assertInvalid(code, RULE, {}, { settings: { release: "zurich" } });
    assertValid(code, RULE, { settings: { release: "australia" } });
  });

  it("does not apply server-engine behavior to other execution contexts", () => {
    const code = `{
  helper();
  function helper() { return 1; }
}`;
    assertValid(code, RULE, {
      filename: "form.client.js",
      settings: { ...ZURICH, surfaces: ["client"] },
    });
    assertValid(code, RULE, { filename: "metadata.now.ts", settings: ZURICH });
    assertValid(code, RULE, {
      filename: "mixed.ui-action.js",
      settings: { ...ZURICH, surfaces: ["client", "server", "ui-action"] },
    });
  });

  it("accepts the corrected Australia behavior", () => {
    assertValid(
      `{
  helper();
  function helper() { return 1; }
}`,
      RULE,
      { settings: AUSTRALIA },
    );
  });
});
