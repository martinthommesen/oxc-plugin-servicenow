import { ruleTester } from "../helpers/rule-tester.js";
import { describe, it } from "node:test";
import { ES5 } from "../helpers/rule-tester.js";

const RULE = "no-proxy" as const;

describe(RULE, () => {
  const { expectInvalid, expectActive, expectValid } = ruleTester(
    "no-proxy",
    {
      settings: ES5,
    },
    { messageId: "revocable" },
  );

  it("reports direct and stable aliased platform uses", () => {
    expectInvalid(
      `const P = Proxy;
const wrapped = new P(target, handler);`,
      { messageId: "construct" },
    );
    expectInvalid(`const P = Proxy;
const pair = P.revocable(target, handler);`);
    expectInvalid(`const pair = globalThis.Proxy.revocable(target, handler);`);
  });

  it("reports revocable calls through Function helpers", () => {
    for (const code of [
      `Proxy.revocable.call(Proxy, target, handler);`,
      `Proxy.revocable.apply(Proxy, [target, handler]);`,
      `Proxy.revocable.bind(Proxy)(target, handler);`,
    ]) {
      expectInvalid(code, { messageId: "revocable", count: 1 });
    }
  });

  it("keeps shadows, mutable aliases, and cross-execution aliases silent", () => {
    expectActive(`function Proxy(target) { return target; }
new Proxy(target, handler);`);
    expectValid(`let P = Proxy;
if (custom) P = LocalProxy;
new P(target, handler);`);
    expectValid(`const P = Proxy;
function later() { return P.revocable(target, handler); }
later();`);
  });

  it("allows structurally dominating availability guards", () => {
    expectValid(`if (typeof Proxy === "function") {
  new Proxy(target, handler);
}`);
    expectValid(`if (typeof Proxy === "function" && typeof Proxy.revocable === "function") {
  Proxy.revocable(target, handler);
}`);
    expectInvalid(`if (typeof Proxy.revocable === "function") {
  Proxy.revocable(target, handler);
}`);
  });

  it("requires bare owner aliases to be captured inside a guard", () => {
    expectInvalid(`const P = Proxy;
if (typeof Proxy === "function") {
  P.revocable(target, handler);
}`);
    expectValid(`if (typeof Proxy === "function" && typeof Proxy.revocable === "function") {
  const P = Proxy;
  P.revocable(target, handler);
}`);
    expectInvalid(
      `const P = globalThis.Proxy;
if (typeof P === "function") {
  new P(target, handler);
}`,
      { messageId: "construct" },
    );
  });

  it("allows callable polyfills but reports non-callable replacements", () => {
    expectValid(`Proxy = LocalProxy;
new Proxy(target, handler);`);
    expectValid(`Proxy.revocable = localRevocable;
Proxy.revocable(target, handler);`);
    expectValid(`Proxy = { revocable: localRevocable };
Proxy.revocable(target, handler);`);
    expectInvalid(
      `Proxy = null;
new Proxy(target, handler);`,
      { messageId: "construct" },
    );
    expectInvalid(`Proxy.revocable = undefined;
Proxy.revocable(target, handler);`);
    for (const replacement of ["{}", "[]"]) {
      expectInvalid(
        `Proxy = ${replacement};
new Proxy(target, handler);`,
        { messageId: "construct" },
      );
      expectInvalid(`Object.defineProperty(Proxy, "revocable", { value: ${replacement} });
Proxy.revocable(target, handler);`);
    }
  });

  it("does not accept invalidated guards or dynamic scope", () => {
    expectInvalid(`if (typeof Proxy === "function" && typeof Proxy.revocable === "function") {
  Proxy.revocable = null;
  Proxy.revocable(target, handler);
}`);
    expectInvalid(
      `if (typeof Proxy === "function") {
  Object.defineProperty(globalThis, "Proxy", { value: null });
  new Proxy(target, handler);
}`,
      { messageId: "construct" },
    );
    expectInvalid(`if (typeof Proxy === "function" && typeof Proxy.revocable === "function") {
  Object.defineProperty(Proxy, "revocable", { value: null });
  Proxy.revocable(target, handler);
}`);
    expectValid(`eval(source);
Proxy.revocable(target, handler);`);
  });

  it("keeps direct Proxy diagnostics after the alias-analysis budget", () => {
    const calls = Array.from({ length: 20_000 }, () => "noop();").join("\n");
    expectInvalid(`${calls}\nnew Proxy(target, handler);`, { messageId: "construct" });
  });
});
