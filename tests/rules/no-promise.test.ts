import { ruleTester } from "../helpers/rule-tester.js";
import { describe, it } from "node:test";
import { ES5, ES2021 } from "../helpers/rule-tester.js";

const RULE = "no-promise" as const;

describe(RULE, () => {
  const { expectInvalid, expectValid, expectActive, expectSkipped } = ruleTester(
    "no-promise",
    {
      settings: ES5,
    },
    { messageId: "staticMethod" },
  );

  it("flags new Promise in ES5", () =>
    void expectInvalid(`var p = new Promise(function (resolve) { resolve(1); });`, {
      messageId: "construct",
    }));

  it("flags Promise.resolve in ES5", () => void expectInvalid(`Promise.resolve(1);`));

  it("continues to own Australia-added Promise methods in classic modes", () => {
    for (const code of [`Promise.try(load);`, `Promise.withResolvers();`]) {
      expectInvalid(code);
    }
  });

  it("reports stable constructor and static-method owner aliases", () => {
    expectInvalid(
      `const P = Promise;
const value = new P(function (resolve) { resolve(1); });`,
      { messageId: "construct", count: 1 },
    );
    expectInvalid(
      `const P = Promise;
P.resolve(1);`,
      { messageId: "staticMethod", count: 1 },
    );
    expectInvalid(`globalThis.Promise.resolve(1);`, { messageId: "staticMethod", count: 1 });
  });

  it("reports static method calls through Function helpers", () => {
    for (const code of [
      `Promise.resolve.call(Promise, 1);`,
      `Promise.resolve.apply(Promise, [1]);`,
      `Promise.resolve.bind(Promise)(1);`,
      `Reflect.apply(Promise.resolve, Promise, [1]);`,
    ]) {
      expectInvalid(code, { messageId: "staticMethod", count: 1 });
    }
    for (const code of [
      `Reflect = localReflect; Reflect.apply(Promise.resolve, Promise, [1]);`,
      `Reflect.apply = localApply; Reflect.apply(Promise.resolve, Promise, [1]);`,
    ]) {
      expectValid(code);
    }
  });

  it("treats bound built-in arguments as namespace escapes", () => {
    for (const argument of ["Promise", "...[Promise]"]) {
      expectValid(`Proxy.revocable.bind(Proxy, ${argument});
Promise.resolve(1);`);
    }
  });

  it("keeps mutable and cross-execution aliases silent", () => {
    expectValid(`let P = Promise;
if (custom) P = LocalPromise;
new P(function () {});`);
    expectValid(`const P = Promise;
function later() { return P.resolve(1); }
later();`);
  });

  it("allows structurally dominating availability guards", () => {
    expectValid(`if (typeof Promise === "function") {
  new Promise(function () {});
}`);
    expectValid(`if (typeof Promise === "function" && typeof Promise.resolve === "function") {
  Promise.resolve(1);
}`);
    expectInvalid(`if (typeof Promise.resolve === "function") {
  Promise.resolve(1);
}`);
  });

  it("requires bare owner aliases to be captured inside a guard", () => {
    expectInvalid(
      `const P = Promise;
if (typeof Promise === "function") {
  new P(function () {});
}`,
      { messageId: "construct" },
    );
    expectInvalid(`const P = Promise;
if (typeof Promise === "function") {
  P.resolve(1);
}`);
    expectValid(`if (typeof Promise === "function" && typeof Promise.resolve === "function") {
  const P = Promise;
  P.resolve(1);
}`);
    expectInvalid(`const P = globalThis.Promise;
if (typeof P === "function" && typeof P.resolve === "function") {
  P.resolve(1);
}`);
  });

  it("does not accept guards invalidated before the invocation", () => {
    expectInvalid(`if (typeof Promise === "function" && typeof Promise.resolve === "function") {
  Promise.resolve = null;
  Promise.resolve(1);
}`);
    expectInvalid(
      `if (typeof Promise === "function") {
  Object.defineProperty(globalThis, "Promise", { value: null });
  new Promise(function () {});
}`,
      { messageId: "construct" },
    );
    for (const mutation of [
      `Object.defineProperty(Promise, "resolve", { value: null });`,
      `Object.defineProperties(Promise, { resolve: { value: null } });`,
      `const define = Object.defineProperty;
define.call(Object, Promise, "resolve", { value: null });`,
    ]) {
      expectInvalid(`if (typeof Promise === "function" && typeof Promise.resolve === "function") {
  ${mutation}
  Promise.resolve(1);
}`);
    }
    expectValid(`if (typeof Promise === "function" && typeof Promise.resolve === "function") {
  Promise.resolve(1);
  Object.defineProperty(Promise, "resolve", { value: null });
}`);
    expectValid(`Object.defineProperty = function () {};
if (typeof Promise === "function" && typeof Promise.resolve === "function") {
  Object.defineProperty(Promise, "resolve", { value: null });
  Promise.resolve(1);
}`);
  });

  it("allows callable polyfills but reports non-callable replacements", () => {
    expectValid(`Promise = LocalPromise;
new Promise(function () {});`);
    expectValid(`Promise.resolve = localResolve;
Promise.resolve(1);`);
    expectValid(`Promise = { resolve: localResolve };
Promise.resolve(1);`);
    expectInvalid(
      `Promise = null;
new Promise(function () {});`,
      { messageId: "construct" },
    );
    expectInvalid(`Promise.resolve = undefined;
Promise.resolve(1);`);
    for (const replacement of ["{}", "[]"]) {
      expectInvalid(
        `Promise = ${replacement};
new Promise(function () {});`,
        { messageId: "construct" },
      );
      expectInvalid(`Object.defineProperty(Promise, "resolve", { value: ${replacement} });
Promise.resolve(1);`);
    }
  });

  it("stays silent under dynamic-scope uncertainty", () =>
    void expectActive(`eval(source);
Promise.resolve(1);`));

  it("does not flag unrelated .then chains", () =>
    void expectValid(`fetchThing().then(function () {});`));

  it("keeps direct Promise diagnostics after the alias-analysis budget", () => {
    const calls = Array.from({ length: 20_000 }, () => "noop();").join("\n");
    expectInvalid(`${calls}\nPromise.resolve(1);`);
  });

  it("does not flag a shadowed Promise binding", () =>
    void expectActive(`function Promise(fn) { fn(); }\nvar p = new Promise(function () {});`));

  // @lat: [[tests#Context evidence#Engine rules run on server-named UI Actions]]
  it("runs on a documented server UI Action filename (FINDINGS.md COR-017)", () => {
    const code = `var p = new Promise(function (resolve) { resolve(1); });`;
    for (const filename of ["approve.server.ui-action.js", "src/server/approve.ui-action.js"]) {
      expectInvalid(code, { messageId: "construct" }, { filename, settings: ES5 });
    }
    // A bare UI Action still names a record type rather than a surface, so the
    // engine gate keeps declining it.
    expectSkipped(code, { filename: "approve.ui-action.js", settings: ES5 });
  });

  it("skips unknown JavaScript mode", () =>
    void expectSkipped(`var p = new Promise(function (resolve) { resolve(1); });`, {}));

  it("skips ES2021", () =>
    void expectSkipped(`var p = new Promise(function (resolve) { resolve(1); });`, {
      settings: ES2021,
    }));

  it("skips Fluent metadata files", () =>
    void expectSkipped(`const p = new Promise((resolve) => resolve(1));`, {
      filename: "table.now.ts",
    }));
});
