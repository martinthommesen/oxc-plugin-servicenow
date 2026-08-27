import { describe, it } from "node:test";
import { assertInvalid, assertValid, ES5, ES2021 } from "../helpers/rule-tester.js";

const RULE = "no-promise" as const;

describe(RULE, () => {
  it("flags new Promise in ES5", () => {
    assertInvalid(
      `var p = new Promise(function (resolve) { resolve(1); });`,
      RULE,
      {
        messageId: "construct",
      },
      { settings: ES5 },
    );
  });

  it("flags Promise.resolve in ES5", () => {
    assertInvalid(`Promise.resolve(1);`, RULE, { messageId: "staticMethod" }, { settings: ES5 });
  });

  it("continues to own Australia-added Promise methods in classic modes", () => {
    for (const code of [`Promise.try(load);`, `Promise.withResolvers();`]) {
      assertInvalid(code, RULE, { messageId: "staticMethod" }, { settings: ES5 });
    }
  });

  it("reports stable constructor and static-method owner aliases", () => {
    assertInvalid(
      `const P = Promise;
const value = new P(function (resolve) { resolve(1); });`,
      RULE,
      { messageId: "construct", count: 1 },
      { settings: ES5 },
    );
    assertInvalid(
      `const P = Promise;
P.resolve(1);`,
      RULE,
      { messageId: "staticMethod", count: 1 },
      { settings: ES5 },
    );
    assertInvalid(
      `globalThis.Promise.resolve(1);`,
      RULE,
      { messageId: "staticMethod", count: 1 },
      { settings: ES5 },
    );
  });

  it("reports static method calls through Function helpers", () => {
    for (const code of [
      `Promise.resolve.call(Promise, 1);`,
      `Promise.resolve.apply(Promise, [1]);`,
      `Promise.resolve.bind(Promise)(1);`,
      `Reflect.apply(Promise.resolve, Promise, [1]);`,
    ]) {
      assertInvalid(code, RULE, { messageId: "staticMethod", count: 1 }, { settings: ES5 });
    }
    for (const code of [
      `Reflect = localReflect; Reflect.apply(Promise.resolve, Promise, [1]);`,
      `Reflect.apply = localApply; Reflect.apply(Promise.resolve, Promise, [1]);`,
    ]) {
      assertValid(code, RULE, { settings: ES5 });
    }
  });

  it("treats bound built-in arguments as namespace escapes", () => {
    for (const argument of ["Promise", "...[Promise]"]) {
      assertValid(
        `Proxy.revocable.bind(Proxy, ${argument});
Promise.resolve(1);`,
        RULE,
        { settings: ES5 },
      );
    }
  });

  it("keeps mutable and cross-execution aliases silent", () => {
    assertValid(
      `let P = Promise;
if (custom) P = LocalPromise;
new P(function () {});`,
      RULE,
      { settings: ES5 },
    );
    assertValid(
      `const P = Promise;
function later() { return P.resolve(1); }
later();`,
      RULE,
      { settings: ES5 },
    );
  });

  it("allows structurally dominating availability guards", () => {
    assertValid(
      `if (typeof Promise === "function") {
  new Promise(function () {});
}`,
      RULE,
      { settings: ES5 },
    );
    assertValid(
      `if (typeof Promise === "function" && typeof Promise.resolve === "function") {
  Promise.resolve(1);
}`,
      RULE,
      { settings: ES5 },
    );
    assertInvalid(
      `if (typeof Promise.resolve === "function") {
  Promise.resolve(1);
}`,
      RULE,
      { messageId: "staticMethod" },
      { settings: ES5 },
    );
  });

  it("requires bare owner aliases to be captured inside a guard", () => {
    assertInvalid(
      `const P = Promise;
if (typeof Promise === "function") {
  new P(function () {});
}`,
      RULE,
      { messageId: "construct" },
      { settings: ES5 },
    );
    assertInvalid(
      `const P = Promise;
if (typeof Promise === "function") {
  P.resolve(1);
}`,
      RULE,
      { messageId: "staticMethod" },
      { settings: ES5 },
    );
    assertValid(
      `if (typeof Promise === "function" && typeof Promise.resolve === "function") {
  const P = Promise;
  P.resolve(1);
}`,
      RULE,
      { settings: ES5 },
    );
    assertInvalid(
      `const P = globalThis.Promise;
if (typeof P === "function" && typeof P.resolve === "function") {
  P.resolve(1);
}`,
      RULE,
      { messageId: "staticMethod" },
      { settings: ES5 },
    );
  });

  it("does not accept guards invalidated before the invocation", () => {
    assertInvalid(
      `if (typeof Promise === "function" && typeof Promise.resolve === "function") {
  Promise.resolve = null;
  Promise.resolve(1);
}`,
      RULE,
      { messageId: "staticMethod" },
      { settings: ES5 },
    );
    assertInvalid(
      `if (typeof Promise === "function") {
  Object.defineProperty(globalThis, "Promise", { value: null });
  new Promise(function () {});
}`,
      RULE,
      { messageId: "construct" },
      { settings: ES5 },
    );
    for (const mutation of [
      `Object.defineProperty(Promise, "resolve", { value: null });`,
      `Object.defineProperties(Promise, { resolve: { value: null } });`,
      `const define = Object.defineProperty;
define.call(Object, Promise, "resolve", { value: null });`,
    ]) {
      assertInvalid(
        `if (typeof Promise === "function" && typeof Promise.resolve === "function") {
  ${mutation}
  Promise.resolve(1);
}`,
        RULE,
        { messageId: "staticMethod" },
        { settings: ES5 },
      );
    }
    assertValid(
      `if (typeof Promise === "function" && typeof Promise.resolve === "function") {
  Promise.resolve(1);
  Object.defineProperty(Promise, "resolve", { value: null });
}`,
      RULE,
      { settings: ES5 },
    );
    assertValid(
      `Object.defineProperty = function () {};
if (typeof Promise === "function" && typeof Promise.resolve === "function") {
  Object.defineProperty(Promise, "resolve", { value: null });
  Promise.resolve(1);
}`,
      RULE,
      { settings: ES5 },
    );
  });

  it("allows callable polyfills but reports non-callable replacements", () => {
    assertValid(
      `Promise = LocalPromise;
new Promise(function () {});`,
      RULE,
      { settings: ES5 },
    );
    assertValid(
      `Promise.resolve = localResolve;
Promise.resolve(1);`,
      RULE,
      { settings: ES5 },
    );
    assertValid(
      `Promise = { resolve: localResolve };
Promise.resolve(1);`,
      RULE,
      { settings: ES5 },
    );
    assertInvalid(
      `Promise = null;
new Promise(function () {});`,
      RULE,
      { messageId: "construct" },
      { settings: ES5 },
    );
    assertInvalid(
      `Promise.resolve = undefined;
Promise.resolve(1);`,
      RULE,
      { messageId: "staticMethod" },
      { settings: ES5 },
    );
    for (const replacement of ["{}", "[]"]) {
      assertInvalid(
        `Promise = ${replacement};
new Promise(function () {});`,
        RULE,
        { messageId: "construct" },
        { settings: ES5 },
      );
      assertInvalid(
        `Object.defineProperty(Promise, "resolve", { value: ${replacement} });
Promise.resolve(1);`,
        RULE,
        { messageId: "staticMethod" },
        { settings: ES5 },
      );
    }
  });

  it("stays silent under dynamic-scope uncertainty", () => {
    assertValid(
      `eval(source);
Promise.resolve(1);`,
      RULE,
      { settings: ES5 },
    );
  });

  it("does not flag unrelated .then chains", () => {
    assertValid(`fetchThing().then(function () {});`, RULE, { settings: ES5 });
  });

  it("does not flag a shadowed Promise binding", () => {
    assertValid(`function Promise(fn) { fn(); }\nvar p = new Promise(function () {});`, RULE, {
      settings: ES5,
    });
  });

  it("skips unknown JavaScript mode", () => {
    assertValid(`var p = new Promise(function (resolve) { resolve(1); });`, RULE);
  });

  it("skips ES2021", () => {
    assertValid(`var p = new Promise(function (resolve) { resolve(1); });`, RULE, {
      settings: ES2021,
    });
  });

  it("skips Fluent metadata files", () => {
    assertValid(`const p = new Promise((resolve) => resolve(1));`, RULE, {
      filename: "table.now.ts",
    });
  });

  it("skips @sn-es-latest files", () => {
    assertValid(`// @sn-es-latest\nconst p = Promise.resolve(1);\n`, RULE);
  });

  it("does not treat a pragma inside a template literal as enabling ES2021", () => {
    assertInvalid(
      "var s = `\n// @sn-es-latest\n`;\nvar p = new Promise(function(){});",
      RULE,
      { messageId: "construct" },
      { settings: ES5 },
    );
  });
});
