import { describe, it } from "node:test";
import { assertInvalid, assertValid, ES5 } from "../helpers/rule-tester.js";

const RULE = "no-proxy" as const;

describe(RULE, () => {
  it("reports direct and stable aliased platform uses", () => {
    assertInvalid(
      `const P = Proxy;
const wrapped = new P(target, handler);`,
      RULE,
      { messageId: "construct" },
      { settings: ES5 },
    );
    assertInvalid(
      `const P = Proxy;
const pair = P.revocable(target, handler);`,
      RULE,
      { messageId: "revocable" },
      { settings: ES5 },
    );
    assertInvalid(
      `const pair = globalThis.Proxy.revocable(target, handler);`,
      RULE,
      { messageId: "revocable" },
      { settings: ES5 },
    );
  });

  it("keeps shadows, mutable aliases, and cross-execution aliases silent", () => {
    assertValid(
      `function Proxy(target) { return target; }
new Proxy(target, handler);`,
      RULE,
      { settings: ES5 },
    );
    assertValid(
      `let P = Proxy;
if (custom) P = LocalProxy;
new P(target, handler);`,
      RULE,
      { settings: ES5 },
    );
    assertValid(
      `const P = Proxy;
function later() { return P.revocable(target, handler); }
later();`,
      RULE,
      { settings: ES5 },
    );
  });

  it("allows structurally dominating availability guards", () => {
    assertValid(
      `if (typeof Proxy === "function") {
  new Proxy(target, handler);
}`,
      RULE,
      { settings: ES5 },
    );
    assertValid(
      `if (typeof Proxy === "function" && typeof Proxy.revocable === "function") {
  Proxy.revocable(target, handler);
}`,
      RULE,
      { settings: ES5 },
    );
    assertInvalid(
      `if (typeof Proxy.revocable === "function") {
  Proxy.revocable(target, handler);
}`,
      RULE,
      { messageId: "revocable" },
      { settings: ES5 },
    );
  });

  it("requires bare owner aliases to be captured inside a guard", () => {
    assertInvalid(
      `const P = Proxy;
if (typeof Proxy === "function") {
  P.revocable(target, handler);
}`,
      RULE,
      { messageId: "revocable" },
      { settings: ES5 },
    );
    assertValid(
      `if (typeof Proxy === "function" && typeof Proxy.revocable === "function") {
  const P = Proxy;
  P.revocable(target, handler);
}`,
      RULE,
      { settings: ES5 },
    );
    assertInvalid(
      `const P = globalThis.Proxy;
if (typeof P === "function") {
  new P(target, handler);
}`,
      RULE,
      { messageId: "construct" },
      { settings: ES5 },
    );
  });

  it("allows callable polyfills but reports non-callable replacements", () => {
    assertValid(
      `Proxy = LocalProxy;
new Proxy(target, handler);`,
      RULE,
      { settings: ES5 },
    );
    assertValid(
      `Proxy.revocable = localRevocable;
Proxy.revocable(target, handler);`,
      RULE,
      { settings: ES5 },
    );
    assertInvalid(
      `Proxy = null;
new Proxy(target, handler);`,
      RULE,
      { messageId: "construct" },
      { settings: ES5 },
    );
    assertInvalid(
      `Proxy.revocable = undefined;
Proxy.revocable(target, handler);`,
      RULE,
      { messageId: "revocable" },
      { settings: ES5 },
    );
    for (const replacement of ["{}", "[]"]) {
      assertInvalid(
        `Proxy = ${replacement};
new Proxy(target, handler);`,
        RULE,
        { messageId: "construct" },
        { settings: ES5 },
      );
      assertInvalid(
        `Object.defineProperty(Proxy, "revocable", { value: ${replacement} });
Proxy.revocable(target, handler);`,
        RULE,
        { messageId: "revocable" },
        { settings: ES5 },
      );
    }
  });

  it("does not accept invalidated guards or dynamic scope", () => {
    assertInvalid(
      `if (typeof Proxy === "function" && typeof Proxy.revocable === "function") {
  Proxy.revocable = null;
  Proxy.revocable(target, handler);
}`,
      RULE,
      { messageId: "revocable" },
      { settings: ES5 },
    );
    assertInvalid(
      `if (typeof Proxy === "function") {
  Object.defineProperty(globalThis, "Proxy", { value: null });
  new Proxy(target, handler);
}`,
      RULE,
      { messageId: "construct" },
      { settings: ES5 },
    );
    assertInvalid(
      `if (typeof Proxy === "function" && typeof Proxy.revocable === "function") {
  Object.defineProperty(Proxy, "revocable", { value: null });
  Proxy.revocable(target, handler);
}`,
      RULE,
      { messageId: "revocable" },
      { settings: ES5 },
    );
    assertValid(
      `eval(source);
Proxy.revocable(target, handler);`,
      RULE,
      { settings: ES5 },
    );
  });
});
