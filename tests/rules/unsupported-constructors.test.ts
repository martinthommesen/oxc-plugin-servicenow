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
