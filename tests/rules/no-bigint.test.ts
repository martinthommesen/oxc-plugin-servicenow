import { describe, it } from "node:test";
import { assertInvalid, assertValid, ES5, ES2021 } from "../helpers/rule-tester.js";

const RULE = "no-bigint" as const;

describe(RULE, () => {
  it("flags bigint literals", () => {
    assertInvalid(`var n = 10n;`, RULE, { messageId: "literal" }, { settings: ES5 });
  });

  it("flags direct BigInt calls and construction", () => {
    assertInvalid(`var n = BigInt(10);`, RULE, { messageId: "ctor" }, { settings: ES5 });
    assertInvalid(`var n = new BigInt(10);`, RULE, { messageId: "ctor" }, { settings: ES5 });
    assertInvalid(`var n = globalThis.BigInt(10);`, RULE, { messageId: "ctor" }, { settings: ES5 });
  });

  it("reports stable same-execution aliases", () => {
    assertInvalid(
      `const ToBigInt = BigInt;
var n = ToBigInt(10);`,
      RULE,
      { messageId: "ctor" },
      { settings: ES5 },
    );
    assertInvalid(
      `const { BigInt: ToBigInt } = globalThis;
var n = ToBigInt(10);`,
      RULE,
      { messageId: "ctor" },
      { settings: ES5 },
    );
  });

  it("keeps shadows, mutable aliases, and cross-execution aliases silent", () => {
    assertValid(
      `function BigInt(value) { return value; }
BigInt(10);`,
      RULE,
      { settings: ES5 },
    );
    assertValid(
      `let ToBigInt = BigInt;
if (custom) ToBigInt = localBigInt;
ToBigInt(10);`,
      RULE,
      { settings: ES5 },
    );
    assertValid(
      `const ToBigInt = BigInt;
function later() { return ToBigInt(10); }
later();`,
      RULE,
      { settings: ES5 },
    );
  });

  it("requires bare aliases to be captured inside an availability guard", () => {
    assertValid(
      `if (typeof BigInt === "function") {
  BigInt(10);
}`,
      RULE,
      { settings: ES5 },
    );
    assertInvalid(
      `const ToBigInt = BigInt;
if (typeof BigInt === "function") {
  ToBigInt(10);
}`,
      RULE,
      { messageId: "ctor" },
      { settings: ES5 },
    );
    assertValid(
      `if (typeof BigInt === "function") {
  const ToBigInt = BigInt;
  ToBigInt(10);
}`,
      RULE,
      { settings: ES5 },
    );
    assertInvalid(
      `const ToBigInt = globalThis.BigInt;
if (typeof ToBigInt === "function") {
  ToBigInt(10);
}`,
      RULE,
      { messageId: "ctor" },
      { settings: ES5 },
    );
  });

  it("does not accept availability guards invalidated before use", () => {
    assertInvalid(
      `if (typeof BigInt === "function") {
  BigInt = null;
  BigInt(10);
}`,
      RULE,
      { messageId: "ctor" },
      { settings: ES5 },
    );
    assertInvalid(
      `if (typeof BigInt === "function") {
  Object.defineProperty(globalThis, "BigInt", { value: null });
  BigInt(10);
}`,
      RULE,
      { messageId: "ctor" },
      { settings: ES5 },
    );
    assertValid(
      `if (typeof BigInt === "function") {
  BigInt(10);
  Object.defineProperty(globalThis, "BigInt", { value: null });
}`,
      RULE,
      { settings: ES5 },
    );
  });

  it("allows callable polyfills but reports non-callable replacements", () => {
    assertValid(
      `BigInt = localBigInt;
BigInt(10);`,
      RULE,
      { settings: ES5 },
    );
    for (const replacement of ["null", "{}", "[]"]) {
      assertInvalid(
        `BigInt = ${replacement};
BigInt(10);`,
        RULE,
        { messageId: "ctor" },
        { settings: ES5 },
      );
    }
  });

  it("stays silent under direct-eval uncertainty", () => {
    assertValid(
      `eval(source);
BigInt(10);`,
      RULE,
      { settings: ES5 },
    );
  });

  it("allows Number", () => {
    assertValid(`var n = 10;`, RULE);
  });

  it("skips unknown mode, ES2021, and Fluent metadata", () => {
    assertValid(`BigInt(10);`, RULE);
    assertValid(`BigInt(10);`, RULE, { settings: ES2021 });
    assertValid(`BigInt(10);`, RULE, { filename: "table.now.ts", settings: ES5 });
  });
});
