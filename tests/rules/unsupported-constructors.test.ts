import { ruleTester } from "../helpers/rule-tester.js";
import { describe, it } from "node:test";
import {
  assertInvalid,
  assertValid,
  assertValidActive,
  ES5,
  type RunOptions,
} from "../helpers/rule-tester.js";

const AUSTRALIA_ES2021 = {
  settings: { javascriptMode: "es2021", release: "australia" },
} satisfies RunOptions;

describe("unsupported constructor provenance", () => {
  const { expectActive, expectInvalid, expectValid } = ruleTester(
    "no-weak-references",
    AUSTRALIA_ES2021,
    { messageId: "weak" },
  );

  // @lat: [[tests#Analysis behavior#Availability proofs ignore unreachable suffix effects]]
  it("preserves availability across unreachable condition writes", () => {
    for (const suffix of [
      "false && (WeakRef = undefined)",
      "true || (WeakRef = undefined)",
      "1 ?? (WeakRef = undefined)",
      "true ? true : (WeakRef = undefined)",
      "false ? (WeakRef = undefined) : true",
      'false && Object.defineProperty(globalThis, "WeakRef", { value: null })',
      "(function () { for (; false; WeakRef = undefined) {} })()",
      "(function () { for (; false;) { WeakRef = undefined; } })()",
    ]) {
      expectActive(
        `if (typeof WeakRef === "function" && (${suffix}, true)) { new WeakRef(value); }`,
      );
    }
    for (const suffix of [
      "true && (WeakRef = undefined)",
      "false || (WeakRef = undefined)",
      "null ?? (WeakRef = undefined)",
      "false ? true : (WeakRef = undefined)",
      "flag ? true : (WeakRef = undefined)",
      "(function () { for (; flag; WeakRef = undefined) {} })()",
    ]) {
      expectInvalid(
        `if (typeof WeakRef === "function" && (${suffix}, true)) { new WeakRef(value); }`,
      );
    }
  });

  // @lat: [[tests#Analysis behavior#Availability proofs respect condition effect order]]
  it("invalidates availability after later effects in compound conditions", () => {
    for (const mutation of [
      "WeakRef = undefined",
      'Object.defineProperty(globalThis, "WeakRef", { value: null })',
      "Object.assign(globalThis, { WeakRef: null })",
    ]) {
      for (const code of [
        `if (typeof WeakRef === "function" && (${mutation}, true)) { new WeakRef(value); }`,
        `while (typeof WeakRef === "function" && (${mutation}, true)) { new WeakRef(value); break; }`,
        `for (; typeof WeakRef === "function" && (${mutation}, true);) { new WeakRef(value); break; }`,
        `typeof WeakRef === "function" && (${mutation}, true) ? new WeakRef(value) : null;`,
        `function run() { if (typeof WeakRef !== "function" || (${mutation}, false)) return; new WeakRef(value); }`,
      ]) {
        expectInvalid(code);
      }
      expectActive(
        `if ((${mutation}, true) && typeof WeakRef === "function") { new WeakRef(value); }`,
      );
    }
  });

  it("uses the latest availability check within an ordered sequence", () => {
    expectInvalid(
      'if ((typeof WeakRef === "function", WeakRef = null, true)) { new WeakRef(value); }',
    );
    expectActive('if ((WeakRef = null, typeof WeakRef === "function")) { new WeakRef(value); }');
  });

  it("reports stable aliases of unavailable constructors", () => {
    expectInvalid(
      `const Ref = WeakRef;
const ref = new Ref(value);`,
      { messageId: "weak", includes: "WeakRef" },
    );
    expectInvalid(
      `const { FinalizationRegistry: Registry } = globalThis;
const registry = new Registry(cleanup);`,
      { messageId: "weak", includes: "FinalizationRegistry" },
    );
    assertInvalid(
      `const Cache = WeakMap;
const cache = new Cache();`,
      "no-weak-collections",
      { messageId: "weak", includes: "WeakMap" },
      { settings: ES5 },
    );
  });

  it("keeps lexical shadows and cross-execution aliases silent", () => {
    expectActive(`function WeakRef(value) { this.value = value; }
const ref = new WeakRef(value);`);
    assertValidActive(
      `function WeakMap() {}
const cache = new WeakMap();`,
      "no-weak-collections",
      { settings: ES5 },
    );
    expectValid(`const Ref = WeakRef;
function create(value) { return new Ref(value); }
create(value);`);
  });

  it("allows structurally dominating availability guards", () => {
    expectValid(`if (typeof WeakRef === "function") {
  new WeakRef(value);
}`);
    expectValid(`if ("FinalizationRegistry" in globalThis) {
  new globalThis.FinalizationRegistry(cleanup);
}`);
    expectValid(`globalThis.WeakRef?.(value);`);
    assertValid(`typeof WeakMap === "function" && new WeakMap();`, "no-weak-collections", {
      settings: ES5,
    });
  });

  it("does not transfer an unsafe qualified guard to a bare constructor", () => {
    for (const guard of [
      `globalThis.WeakMap`,
      `typeof globalThis.WeakMap === "function"`,
      `"WeakMap" in globalThis`,
    ]) {
      assertInvalid(
        `if (${guard}) {
  new WeakMap();
}`,
        "no-weak-collections",
        { messageId: "weak" },
        { settings: ES5 },
      );
      assertValid(
        `typeof globalThis !== "undefined" && ${guard} && new WeakMap();`,
        "no-weak-collections",
        { settings: ES5 },
      );
    }
    assertInvalid(
      `const root = globalThis;
if (typeof globalThis !== "undefined" && "WeakMap" in root) {
  new WeakMap();
}`,
      "no-weak-collections",
      { messageId: "weak" },
      { settings: ES5 },
    );
    assertValid(
      `if (typeof globalThis !== "undefined") {
  const root = globalThis;
  if ("WeakMap" in root) new WeakMap();
}`,
      "no-weak-collections",
      { settings: ES5 },
    );
  });

  it("requires a bare alias origin to be guarded before capture", () => {
    expectInvalid(`const Ref = WeakRef;
if (typeof WeakRef === "function") {
  new Ref(value);
}`);
    expectValid(`if (typeof WeakRef === "function") {
  const Ref = WeakRef;
  new Ref(value);
}`);
    expectValid(`const Ref = globalThis.WeakRef;
if (typeof Ref === "function") {
  new Ref(value);
}`);
    assertInvalid(
      `const Cache = globalThis.WeakMap;
if (typeof Cache === "function") {
  new Cache();
}`,
      "no-weak-collections",
      { messageId: "weak" },
      { settings: ES5 },
    );
  });

  it("does not accept guards invalidated before invocation", () => {
    expectInvalid(`if (typeof WeakRef === "function") {
  WeakRef = null;
  new WeakRef(value);
}`);
    for (const mutation of [
      `Object.defineProperty(globalThis, "WeakRef", { value: null });`,
      `Object.defineProperties(globalThis, { WeakRef: { value: null } });`,
      `Object.assign(globalThis, { WeakRef: null });`,
      `const { defineProperty } = Object;
defineProperty(globalThis, "WeakRef", { value: null });`,
      `const define = Object.defineProperty;
define(globalThis, "WeakRef", { value: null });`,
      `Object.defineProperty.call(Object, globalThis, "WeakRef", { value: null });`,
      `Object.defineProperty.apply(Object, [globalThis, "WeakRef", { value: null }]);`,
      `const define = Object.defineProperty.bind(Object);
define(globalThis, "WeakRef", { value: null });`,
    ]) {
      expectInvalid(`if (typeof WeakRef === "function") {
  ${mutation}
  new WeakRef(value);
}`);
    }
    expectValid(`if (typeof WeakRef === "function") {
  new WeakRef(value);
  Object.defineProperty(globalThis, "WeakRef", { value: null });
}`);
    expectValid(`Object.defineProperty = function () {};
if (typeof WeakRef === "function") {
  Object.defineProperty(globalThis, "WeakRef", { value: null });
  new WeakRef(value);
}`);
    expectValid(`if (typeof WeakRef === "function") {
  Object.assign(globalThis, "text", null);
  new WeakRef(value);
}`);
  });

  it("allows visible callable polyfills but not non-callable replacements", () => {
    expectValid(`WeakRef = LocalWeakRef;
const ref = new WeakRef(value);`);
    expectValid(`Object.defineProperty(globalThis, "FinalizationRegistry", { value: LocalRegistry });
const registry = new globalThis.FinalizationRegistry(cleanup);`);
    expectInvalid(`WeakRef = null;
const ref = new WeakRef(value);`);
    for (const replacement of ["{}", "[]"]) {
      expectInvalid(`WeakRef = ${replacement};
const ref = new WeakRef(value);`);
      expectInvalid(`Object.defineProperty(globalThis, "WeakRef", { value: ${replacement} });
const ref = new globalThis.WeakRef(value);`);
    }
    for (const descriptor of [
      `{ value: LocalWeakRef, set: LocalSetter }`,
      `{ get: LocalGetter, writable: true }`,
      `{ set value(next) {} }`,
      `{ set get(next) {} }`,
      `{ value: null, set value(next) {} }`,
    ]) {
      expectInvalid(`try {
  Object.defineProperty(globalThis, "WeakRef", ${descriptor});
} catch (error) {}
new WeakRef(value);`);
    }
  });

  it("stays silent under direct-eval uncertainty", () =>
    void expectActive(`eval(source);
const ref = new WeakRef(value);`));

  it("keeps direct constructor diagnostics after the alias-analysis budget", () => {
    const calls = Array.from({ length: 20_000 }, () => "noop();").join("\n");
    expectInvalid(`${calls}\nnew WeakRef(value);`);
  });
});
