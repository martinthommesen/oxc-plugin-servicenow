import { ruleTester } from "../helpers/rule-tester.js";
import { describe, it } from "node:test";
import { ES5, ES2021 } from "../helpers/rule-tester.js";

const RULE = "no-bigint" as const;

describe(RULE, () => {
  const { expectInvalid, expectActive, expectValid, expectSkipped } = ruleTester(
    "no-bigint",
    { settings: ES5 },
    { messageId: "ctor" },
  );

  it("flags bigint literals", () => void expectInvalid(`var n = 10n;`, { messageId: "literal" }));

  it("flags direct BigInt calls and construction", () => {
    expectInvalid(`var n = BigInt(10);`);
    expectInvalid(`var n = new BigInt(10);`);
    expectInvalid(`var n = globalThis.BigInt(10);`);
  });

  it("reports stable same-execution aliases", () => {
    expectInvalid(`const ToBigInt = BigInt;
var n = ToBigInt(10);`);
    expectInvalid(`const { BigInt: ToBigInt } = globalThis;
var n = ToBigInt(10);`);
    expectInvalid(`for (const ToBigInt = BigInt; ready; ) {
  ToBigInt(10);
}`);
    expectInvalid(`for (var ToBigInt = BigInt; ready; ) {
  ToBigInt(10);
}`);
  });

  it("keeps shadows, mutable aliases, and cross-execution aliases silent", () => {
    expectActive(`function BigInt(value) { return value; }
BigInt(10);`);
    expectValid(`let ToBigInt = BigInt;
if (custom) ToBigInt = localBigInt;
ToBigInt(10);`);
    expectValid(`const ToBigInt = BigInt;
function later() { return ToBigInt(10); }
later();`);
  });

  it("requires bare aliases to be captured inside an availability guard", () => {
    expectValid(`if (typeof BigInt === "function") {
  BigInt(10);
}`);
    expectInvalid(`const ToBigInt = BigInt;
if (typeof BigInt === "function") {
  ToBigInt(10);
}`);
    expectValid(`if (typeof BigInt === "function") {
  const ToBigInt = BigInt;
  ToBigInt(10);
}`);
    expectInvalid(`const ToBigInt = globalThis.BigInt;
if (typeof ToBigInt === "function") {
  ToBigInt(10);
}`);
  });

  it("does not accept availability guards invalidated before use", () => {
    expectInvalid(`if (typeof BigInt === "function") {
  BigInt = null;
  BigInt(10);
}`);
    expectInvalid(`if (typeof BigInt === "function") {
  Object.defineProperty(globalThis, "BigInt", { value: null });
  BigInt(10);
}`);
    expectValid(`if (typeof BigInt === "function") {
  BigInt(10);
  Object.defineProperty(globalThis, "BigInt", { value: null });
}`);
  });

  it("allows callable polyfills but reports non-callable replacements", () => {
    expectValid(`BigInt = localBigInt;
BigInt(10);`);
    for (const replacement of ["null", "{}", "[]"]) {
      expectInvalid(`BigInt = ${replacement};
BigInt(10);`);
    }
  });

  it("stays silent under direct-eval uncertainty", () =>
    void expectActive(`eval(source);
BigInt(10);`));

  it("allows Number", () => void expectActive(`var n = 10;`));

  it("skips unknown mode, ES2021, and Fluent metadata", () => {
    expectSkipped(`BigInt(10);`, {});
    expectSkipped(`BigInt(10);`, { settings: ES2021 });
    expectSkipped(`BigInt(10);`, { filename: "table.now.ts", settings: ES5 });
  });
});
