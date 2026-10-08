import { ruleTester } from "../helpers/rule-tester.js";
import { describe, it } from "node:test";
import { assertDeclinesNonServerSurfaces, ES5 } from "../helpers/rule-tester.js";

const RULE = "no-map-set" as const;
const CLASSIC_MODES = ["compatibility", "es5"] as const;
const RELEASES = [undefined, "zurich", "australia"] as const;

describe(RULE, () => {
  const { expectInvalid, expectSkipped, expectValid, expectActive } = ruleTester(
    "no-map-set",
    { settings: ES5 },
    { messageId: "unsupported", includes: "Set" },
  );

  it("reports Map and Set in both classic modes for every reviewed release", () => {
    for (const javascriptMode of CLASSIC_MODES) {
      for (const release of RELEASES) {
        const settings = release === undefined ? { javascriptMode } : { javascriptMode, release };
        expectInvalid(
          `var cache = new Map();`,
          { messageId: "unsupported", includes: "Map" },
          { settings },
        );
        expectInvalid(`var seen = new Set();`, undefined, { settings });
      }
    }
  });

  it("accepts Map and Set in ES2021", () => {
    for (const release of RELEASES) {
      const settings =
        release === undefined
          ? { javascriptMode: "es2021" as const }
          : { javascriptMode: "es2021" as const, release };
      expectSkipped(`const cache = new Map(); const seen = new Set();`, { settings });
    }
  });

  it("resolves direct calls and stable same-execution aliases", () => {
    for (const code of [
      `Map();`,
      `Set();`,
      `const NativeMap = Map; new NativeMap();`,
      `const NativeSet = globalThis["Set"]; new NativeSet();`,
      `const { Map: NativeMap } = globalThis; NativeMap();`,
      `const NativeSet = Set; { const alias = NativeSet; new alias(); }`,
    ]) {
      expectInvalid(code, { messageId: "unsupported" });
    }
  });

  it("requires a bare alias to be captured inside its availability guard", () => {
    expectInvalid(
      `const NativeMap = Map;
if (typeof Map === "function") new NativeMap();`,
      { messageId: "unsupported" },
    );
    expectValid(`if (typeof Map === "function") {
  const NativeMap = Map;
  new NativeMap();
}`);
  });

  it("honors dominating availability guards without protecting sibling features", () => {
    for (const code of [
      `if (typeof Map === "function") new Map();`,
      `typeof Set === "function" && new Set();`,
      `function create() { if (typeof Map !== "function") return; return new Map(); } create();`,
      `if (typeof globalThis !== "undefined" && typeof globalThis.Map === "function") {
  new globalThis.Map();
}`,
    ]) {
      expectValid(code);
    }
    expectInvalid(`if (typeof Map === "function") new Set();`);
  });

  it("allows visible callable polyfills but not non-callable replacements", () => {
    for (const code of [`Map = LocalMap; new Map();`, `new Set(); Set = LocalSet;`]) {
      expectValid(code);
    }
    for (const replacement of ["null", "{}", "[]"]) {
      expectInvalid(`Set = ${replacement}; new Set();`);
    }
    expectInvalid(`Map = LocalMap; new Set();`);
  });

  it("keeps shadows, unstable aliases, cross-execution aliases, and dynamic scope silent", () => {
    for (const code of [
      `function Map() {} new Map();`,
      `class Set {} new Set();`,
      `function create(Set) { return new Set(); } create(LocalSet);`,
      `try { work(); } catch (Map) { new Map(); }`,
      `import { Map } from "./collections.js"; new Map();`,
      `let NativeMap = Map; NativeMap = LocalMap; new NativeMap();`,
      `const NativeMap = condition ? Map : LocalMap; new NativeMap();`,
      `const NativeSet = Set; function create() { return new NativeSet(); } create();`,
      `eval(source); new Map();`,
    ]) {
      expectActive(code);
    }
  });

  it("stays silent outside proven classic server execution", () => {
    expectSkipped(`new Map();`, {});
    assertDeclinesNonServerSurfaces(`new Map();`, RULE, ES5);
    assertDeclinesNonServerSurfaces(`new Set();`, RULE, ES5);
  });
});
