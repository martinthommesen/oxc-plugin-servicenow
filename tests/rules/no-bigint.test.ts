import { describe, it } from "node:test";
import { assertInvalid, assertValid } from "../helpers/rule-tester.js";

const RULE = "no-bigint" as const;

describe(RULE, () => {
  it("flags bigint literals", () => {
    assertInvalid(`var n = 10n;`, RULE, { messageId: "literal" });
  });

  it("flags BigInt()", () => {
    assertInvalid(`var n = BigInt(10);`, RULE, { messageId: "ctor" });
  });

  it("allows Number", () => {
    assertValid(`var n = 10;`, RULE);
  });
});
