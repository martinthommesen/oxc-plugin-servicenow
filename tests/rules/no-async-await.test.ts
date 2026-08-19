import { describe, it } from "node:test";
import { assertInvalid, assertValid } from "../helpers/rule-tester.js";

const RULE = "no-async-await" as const;

describe(RULE, () => {
  it("flags async functions", () => {
    assertInvalid(`async function load() { return 1; }`, RULE, { messageId: "asyncFn" });
  });

  it("flags await", () => {
    assertInvalid(`async function load() { await other(); }`, RULE, { count: 2 });
  });

  it("allows sync functions", () => {
    assertValid(`function load() { return 1; }`, RULE);
  });

  it("skips when settings.ecmaLatest is set", () => {
    assertValid(`async function load() { await other(); }`, RULE, {
      settings: { ecmaLatest: true },
    });
  });
});
