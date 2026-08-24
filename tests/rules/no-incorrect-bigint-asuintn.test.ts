import { describe, it } from "node:test";
import { assertInvalid, assertValid } from "../helpers/rule-tester.js";

const RULE = "no-incorrect-bigint-asuintn" as const;
const ZURICH = { javascriptMode: "es2021", release: "zurich" } as const;
const AUSTRALIA = { javascriptMode: "es2021", release: "australia" } as const;

describe(RULE, () => {
  it("reports the statically proven Zurich early-return cases", () => {
    for (const code of [
      `BigInt.asUintN(8, -1n);`,
      `BigInt.asUintN(8.9, -1n);`,
      `BigInt.asUintN(16, -129n);`,
      `BigInt.asUintN(16, -1_000n);`,
      `BigInt.asUintN(32, -256n);`,
      `BigInt.asUintN(64, -0x1n);`,
      `BigInt["asUintN"](64, -(1n));`,
    ]) {
      assertInvalid(code, RULE, { messageId: "incorrect" }, { settings: ZURICH });
    }
  });

  it("keeps exact byte-boundary near misses silent", () => {
    for (const code of [
      `BigInt.asUintN(0, -1n);`,
      `BigInt.asUintN(1, -1n);`,
      `BigInt.asUintN(7, -1n);`,
      `BigInt.asUintN(7.9, -1n);`,
      `BigInt.asUintN(8, -129n);`,
      `BigInt.asUintN(15, -129n);`,
      `BigInt.asUintN(16, -32769n);`,
      `BigInt.asUintN(64, 18446744073709551616n);`,
      `BigInt.asUintN(64, -(-1n));`,
    ]) {
      assertValid(code, RULE, { settings: ZURICH });
    }
  });

  it("follows the Zurich and Australia release delta without guessing omission", () => {
    const code = `BigInt.asUintN(64, -1n);`;
    assertInvalid(code, RULE, { messageId: "incorrect" }, { settings: ZURICH });
    assertValid(code, RULE, { settings: AUSTRALIA });
    assertValid(code, RULE, { settings: { javascriptMode: "es2021" } });
    for (const javascriptMode of ["compatibility", "es5"] as const) {
      assertValid(code, RULE, {
        settings: { javascriptMode, release: "zurich" },
      });
    }
  });

  it("recognizes stable native owner identities", () => {
    for (const code of [
      `globalThis.BigInt.asUintN(64, -1n);`,
      `const PlatformBigInt = BigInt; PlatformBigInt.asUintN(64, -1n);`,
      `const { BigInt: PlatformBigInt } = globalThis; PlatformBigInt["asUintN"](64, -1n);`,
    ]) {
      assertInvalid(code, RULE, { messageId: "incorrect" }, { settings: ZURICH });
    }
  });

  it("does not mistake availability checks for semantic repairs", () => {
    for (const code of [
      `BigInt.asUintN && BigInt.asUintN(64, -1n);`,
      `typeof BigInt.asUintN === "function" && BigInt.asUintN(64, -1n);`,
      `if (BigInt.asUintN) BigInt.asUintN(64, -1n);`,
    ]) {
      assertInvalid(code, RULE, { messageId: "incorrect" }, { settings: ZURICH });
    }
  });

  it("stays silent for dynamic operands and signed narrowing", () => {
    for (const code of [
      `BigInt.asUintN(bits, -1n);`,
      `BigInt.asUintN(64, value);`,
      `const bits = 64; BigInt.asUintN(bits, -1n);`,
      `const value = -1n; BigInt.asUintN(64, value);`,
      `BigInt.asUintN(64, BigInt("-1"));`,
      `BigInt.asUintN(4097, -1n);`,
      `BigInt.asIntN(64, -1n);`,
    ]) {
      assertValid(code, RULE, { settings: ZURICH });
    }
  });

  it("requires native BigInt and asUintN authority", () => {
    for (const code of [
      `const BigInt = { asUintN: localAsUintN }; BigInt.asUintN(64, -1n);`,
      `function BigInt() {} BigInt.asUintN = localAsUintN; BigInt.asUintN(64, -1n);`,
      `class BigInt { static asUintN(bits, value) { return value; } } BigInt.asUintN(64, -1n);`,
      `function narrow(BigInt) { return BigInt.asUintN(64, -1n); }`,
      `try { load(); } catch (BigInt) { BigInt.asUintN(64, -1n); }`,
      `BigInt.asUintN = localAsUintN; BigInt.asUintN(64, -1n);`,
      `Object.defineProperty(BigInt, "asUintN", { value: localAsUintN }); BigInt.asUintN(64, -1n);`,
      `installPolyfills(BigInt); BigInt.asUintN(64, -1n);`,
      `const narrow = BigInt.asUintN; narrow(64, -1n);`,
      `const PlatformBigInt = BigInt; function later() { return PlatformBigInt.asUintN(64, -1n); } later();`,
      `eval(source); BigInt.asUintN(64, -1n);`,
    ]) {
      assertValid(code, RULE, { settings: ZURICH });
    }

    assertInvalid(
      `BigInt.asIntN = localAsIntN; BigInt.asUintN(64, -1n);`,
      RULE,
      { messageId: "incorrect" },
      { settings: ZURICH },
    );
  });

  it("does not apply server-engine behavior to other execution contexts", () => {
    const code = `BigInt.asUintN(64, -1n);`;
    assertValid(code, RULE, {
      filename: "form.client.js",
      settings: { ...ZURICH, surfaces: ["client"] },
    });
    assertValid(code, RULE, { filename: "metadata.now.ts", settings: ZURICH });
    assertValid(code, RULE, {
      filename: "mixed.ui-action.js",
      settings: { ...ZURICH, surfaces: ["client", "server"] },
    });
  });
});
