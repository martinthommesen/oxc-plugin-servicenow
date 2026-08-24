import { describe, it } from "node:test";
import { assertInvalid, assertValid, ES5 } from "../helpers/rule-tester.js";

const RULE = "no-at-method" as const;

describe(`${RULE} polyfill authority`, () => {
  it("allows visible Array and String prototype replacements", () => {
    for (const code of [
      `Array.prototype.at = localAt; [1, 2].at(-1);`,
      `String.prototype.at = localAt; "text".at(0);`,
      `Object.defineProperty(Array.prototype, "at", { value: localAt }); [1, 2].at(-1);`,
      `Object.defineProperty(String.prototype, "at", { value: null }); "text".at(0);`,
      `Array = LocalArray; [1, 2].at(-1);`,
      `Array.prototype = localPrototype; [1, 2].at(-1);`,
      `String = LocalString; "text".at(0);`,
      `prepare(Array.prototype); [1, 2].at(-1);`,
      `eval(source); [1, 2].at(-1);`,
    ]) {
      assertValid(code, RULE, { settings: ES5 });
    }
  });

  it("keeps Array and String authority independent", () => {
    assertInvalid(
      `Array.prototype.at = localAt; [1, 2].at(-1); "text".at(0);`,
      RULE,
      { messageId: "at", count: 1 },
      { settings: ES5 },
    );
    assertInvalid(
      `String.prototype.at = localAt; "text".at(0); [1, 2].at(-1);`,
      RULE,
      { messageId: "at", count: 1 },
      { settings: ES5 },
    );
  });

  it("allows structurally dominating prototype availability guards", () => {
    for (const code of [
      `if (typeof Array.prototype.at === "function") { [1, 2].at(-1); }`,
      `Array.prototype.at && [1, 2].at(-1);`,
      `if ("at" in String.prototype) { "text".at(0); }`,
      `function last() {
  if (typeof Array.prototype.at !== "function") return null;
  return [1, 2].at(-1);
}`,
      `[1, 2].at?.(-1);`,
    ]) {
      assertValid(code, RULE, { settings: ES5 });
    }
  });

  it("does not accept unrelated or shadowed guards", () => {
    assertInvalid(
      `if (custom.at) { [1, 2].at(-1); }`,
      RULE,
      { messageId: "at" },
      { settings: ES5 },
    );
    assertInvalid(
      `const Array = { prototype: { at: localAt } };
if (Array.prototype.at) { [1, 2].at(-1); }`,
      RULE,
      { messageId: "at" },
      { settings: ES5 },
    );
    assertInvalid(
      `prepare(Array.prototype.at); [1, 2].at(-1);`,
      RULE,
      { messageId: "at" },
      { settings: ES5 },
    );
  });
});
