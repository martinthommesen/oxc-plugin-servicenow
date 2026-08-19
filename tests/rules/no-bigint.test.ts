import { describe, it } from "node:test";
import { assertInvalid, assertValid, ES5 } from "../helpers/rule-tester.js";

const RULE = "no-bigint" as const;

describe(RULE, () => {
  it("flags bigint literals", () => {
    assertInvalid(`var n = 10n;`, RULE, { messageId: "literal" }, { settings: ES5 });
  });

  it("flags BigInt()", () => {
    assertInvalid(`var n = BigInt(10);`, RULE, { messageId: "ctor" }, { settings: ES5 });
  });

  it("allows Number", () => {
    assertValid(`var n = 10;`, RULE);
  });
});
