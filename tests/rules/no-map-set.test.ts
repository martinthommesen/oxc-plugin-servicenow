import { describe, it } from "node:test";
import { assertInvalid, assertValid } from "../helpers/rule-tester.js";

const RULE = "no-map-set" as const;
const CLASSIC_MODES = ["compatibility", "es5"] as const;
const RELEASES = [undefined, "zurich", "australia"] as const;

describe(RULE, () => {
  it("reports Map and Set in both classic modes for every reviewed release", () => {
    for (const javascriptMode of CLASSIC_MODES) {
      for (const release of RELEASES) {
        const settings = release === undefined ? { javascriptMode } : { javascriptMode, release };
        assertInvalid(
          `var cache = new Map();`,
          RULE,
          { messageId: "unsupported", includes: "Map" },
          { settings },
        );
        assertInvalid(
          `var seen = new Set();`,
          RULE,
          { messageId: "unsupported", includes: "Set" },
          { settings },
        );
      }
    }
  });

  it("accepts Map and Set in ES2021", () => {
    for (const release of RELEASES) {
      const settings =
        release === undefined
          ? { javascriptMode: "es2021" as const }
          : { javascriptMode: "es2021" as const, release };
      assertValid(`const cache = new Map(); const seen = new Set();`, RULE, { settings });
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
      assertInvalid(
        code,
        RULE,
        { messageId: "unsupported" },
        { settings: { javascriptMode: "es5" } },
      );
    }
  });

  it("requires a bare alias to be captured inside its availability guard", () => {
    assertInvalid(
      `const NativeMap = Map;
if (typeof Map === "function") new NativeMap();`,
      RULE,
      { messageId: "unsupported" },
      { settings: { javascriptMode: "es5" } },
    );
    assertValid(
      `if (typeof Map === "function") {
  const NativeMap = Map;
  new NativeMap();
}`,
      RULE,
      { settings: { javascriptMode: "es5" } },
    );
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
      assertValid(code, RULE, { settings: { javascriptMode: "es5" } });
    }
    assertInvalid(
      `if (typeof Map === "function") new Set();`,
      RULE,
      { messageId: "unsupported", includes: "Set" },
      { settings: { javascriptMode: "es5" } },
    );
  });

  it("allows visible callable polyfills but not non-callable replacements", () => {
    for (const code of [`Map = LocalMap; new Map();`, `new Set(); Set = LocalSet;`]) {
      assertValid(code, RULE, { settings: { javascriptMode: "es5" } });
    }
    for (const replacement of ["null", "{}", "[]"]) {
      assertInvalid(
        `Set = ${replacement}; new Set();`,
        RULE,
        { messageId: "unsupported", includes: "Set" },
        { settings: { javascriptMode: "es5" } },
      );
    }
    assertInvalid(
      `Map = LocalMap; new Set();`,
      RULE,
      { messageId: "unsupported", includes: "Set" },
      { settings: { javascriptMode: "es5" } },
    );
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
      assertValid(code, RULE, { settings: { javascriptMode: "es5" } });
    }
  });

  it("stays silent outside proven classic server execution", () => {
    assertValid(`new Map();`, RULE);
    assertValid(`new Map();`, RULE, {
      filename: "form.client.js",
      settings: { javascriptMode: "es5", surfaces: ["client"] },
    });
    assertValid(`new Set();`, RULE, {
      filename: "action.ui-action.js",
      settings: {
        javascriptMode: "es5",
        surfaces: ["client", "server", "ui-action"],
      },
    });
    assertValid(`new Map();`, RULE, { filename: "metadata.now.ts" });
  });
});
