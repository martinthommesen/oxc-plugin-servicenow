import { describe, it } from "node:test";
import { assertInvalid, assertValid, ES5, type RunOptions } from "../helpers/rule-tester.js";

const AUSTRALIA_ES2021 = {
  settings: { javascriptMode: "es2021", release: "australia" },
} satisfies RunOptions;

describe("unsupported constructor provenance", () => {
  it("reports stable aliases of unavailable constructors", () => {
    assertInvalid(
      `const Ref = WeakRef;
const ref = new Ref(value);`,
      "no-weak-references",
      { messageId: "weak", includes: "WeakRef" },
      AUSTRALIA_ES2021,
    );
    assertInvalid(
      `const { FinalizationRegistry: Registry } = globalThis;
const registry = new Registry(cleanup);`,
      "no-weak-references",
      { messageId: "weak", includes: "FinalizationRegistry" },
      AUSTRALIA_ES2021,
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
    assertValid(
      `function WeakRef(value) { this.value = value; }
const ref = new WeakRef(value);`,
      "no-weak-references",
      AUSTRALIA_ES2021,
    );
    assertValid(
      `const Ref = WeakRef;
function create(value) { return new Ref(value); }
create(value);`,
      "no-weak-references",
      AUSTRALIA_ES2021,
    );
  });

  it("allows structurally dominating availability guards", () => {
    assertValid(
      `if (typeof WeakRef === "function") {
  new WeakRef(value);
}`,
      "no-weak-references",
      AUSTRALIA_ES2021,
    );
    assertValid(
      `if ("FinalizationRegistry" in globalThis) {
  new globalThis.FinalizationRegistry(cleanup);
}`,
      "no-weak-references",
      AUSTRALIA_ES2021,
    );
    assertValid(`globalThis.WeakRef?.(value);`, "no-weak-references", AUSTRALIA_ES2021);
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
    assertInvalid(
      `const Ref = WeakRef;
if (typeof WeakRef === "function") {
  new Ref(value);
}`,
      "no-weak-references",
      { messageId: "weak" },
      AUSTRALIA_ES2021,
    );
    assertValid(
      `if (typeof WeakRef === "function") {
  const Ref = WeakRef;
  new Ref(value);
}`,
      "no-weak-references",
      AUSTRALIA_ES2021,
    );
    assertValid(
      `const Ref = globalThis.WeakRef;
if (typeof Ref === "function") {
  new Ref(value);
}`,
      "no-weak-references",
      AUSTRALIA_ES2021,
    );
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
    assertInvalid(
      `if (typeof WeakRef === "function") {
  WeakRef = null;
  new WeakRef(value);
}`,
      "no-weak-references",
      { messageId: "weak" },
      AUSTRALIA_ES2021,
    );
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
      assertInvalid(
        `if (typeof WeakRef === "function") {
  ${mutation}
  new WeakRef(value);
}`,
        "no-weak-references",
        { messageId: "weak" },
        AUSTRALIA_ES2021,
      );
    }
    assertValid(
      `if (typeof WeakRef === "function") {
  new WeakRef(value);
  Object.defineProperty(globalThis, "WeakRef", { value: null });
}`,
      "no-weak-references",
      AUSTRALIA_ES2021,
    );
    assertValid(
      `Object.defineProperty = function () {};
if (typeof WeakRef === "function") {
  Object.defineProperty(globalThis, "WeakRef", { value: null });
  new WeakRef(value);
}`,
      "no-weak-references",
      AUSTRALIA_ES2021,
    );
    assertValid(
      `if (typeof WeakRef === "function") {
  Object.assign(globalThis, "text", null);
  new WeakRef(value);
}`,
      "no-weak-references",
      AUSTRALIA_ES2021,
    );
  });

  it("allows visible callable polyfills but not non-callable replacements", () => {
    assertValid(
      `WeakRef = LocalWeakRef;
const ref = new WeakRef(value);`,
      "no-weak-references",
      AUSTRALIA_ES2021,
    );
    assertValid(
      `Object.defineProperty(globalThis, "FinalizationRegistry", { value: LocalRegistry });
const registry = new globalThis.FinalizationRegistry(cleanup);`,
      "no-weak-references",
      AUSTRALIA_ES2021,
    );
    assertInvalid(
      `WeakRef = null;
const ref = new WeakRef(value);`,
      "no-weak-references",
      { messageId: "weak" },
      AUSTRALIA_ES2021,
    );
    for (const replacement of ["{}", "[]"]) {
      assertInvalid(
        `WeakRef = ${replacement};
const ref = new WeakRef(value);`,
        "no-weak-references",
        { messageId: "weak" },
        AUSTRALIA_ES2021,
      );
      assertInvalid(
        `Object.defineProperty(globalThis, "WeakRef", { value: ${replacement} });
const ref = new globalThis.WeakRef(value);`,
        "no-weak-references",
        { messageId: "weak" },
        AUSTRALIA_ES2021,
      );
    }
    for (const descriptor of [
      `{ value: LocalWeakRef, set: LocalSetter }`,
      `{ get: LocalGetter, writable: true }`,
      `{ set value(next) {} }`,
      `{ set get(next) {} }`,
      `{ value: null, set value(next) {} }`,
    ]) {
      assertInvalid(
        `try {
  Object.defineProperty(globalThis, "WeakRef", ${descriptor});
} catch (error) {}
new WeakRef(value);`,
        "no-weak-references",
        { messageId: "weak" },
        AUSTRALIA_ES2021,
      );
    }
  });

  it("stays silent under direct-eval uncertainty", () => {
    assertValid(
      `eval(source);
const ref = new WeakRef(value);`,
      "no-weak-references",
      AUSTRALIA_ES2021,
    );
  });
});
