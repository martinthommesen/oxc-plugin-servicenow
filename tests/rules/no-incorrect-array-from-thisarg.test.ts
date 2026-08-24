import { describe, it } from "node:test";
import { assertInvalid, assertValid } from "../helpers/rule-tester.js";

const RULE = "no-incorrect-array-from-thisarg" as const;
const ZURICH = { javascriptMode: "es2021", release: "zurich" } as const;
const AUSTRALIA = { javascriptMode: "es2021", release: "australia" } as const;

describe(RULE, () => {
  it("reports explicit primitive mapper this arguments in Zurich", () => {
    for (const code of [
      `Array.from(source, function (value) { return value; }, null);`,
      `Array.from(source, function (value) { return value; }, undefined);`,
      `Array.from(source, function (value) { return value; }, void sideEffect());`,
      `Array.from(source, function (value) { return value; }, "scope");`,
      `Array.from(source, function (value) { return value; }, 42);`,
      `Array.from(source, function (value) { return value; }, true);`,
      `Array.from(source, function (value) { return value; }, 1n);`,
      "Array.from(source, function (value) { return value; }, `scope`);",
      `const thisArg = null; Array.from(source, function (value) { return value; }, thisArg);`,
      `const thisArg = "scope"; Array.from(source, function (value) { return value; }, thisArg);`,
    ]) {
      assertInvalid(code, RULE, { messageId: "primitive" }, { settings: ZURICH });
    }
  });

  it("reports primitive arguments regardless of mapper strictness or this usage", () => {
    for (const code of [
      `Array.from(source, (value) => value, null);`,
      `Array.from(source, function (value) { "use strict"; return value; }, null);`,
      `Array.from(source, function (value) { return this ? value : value; }, "scope");`,
    ]) {
      assertInvalid(code, RULE, { messageId: "primitive" }, { settings: ZURICH });
    }
  });

  it("reports omitted this arguments only for proven sloppy mappers that read their this", () => {
    for (const code of [
      `Array.from(source, function (value) { return this.normalize(value); });`,
      `function mapper(value) { return this.normalize(value); }
Array.from(source, mapper);`,
      `const mapper = function (value) { return this.normalize(value); };
Array.from(source, mapper);`,
      `const mapper = function (value) { return () => this.normalize(value); };
Array.from(source, mapper);`,
      `Array.from(source, function (value = this.fallback) { return value; });`,
    ]) {
      assertInvalid(code, RULE, { messageId: "omitted" }, { settings: ZURICH });
    }
  });

  it("recognizes stable native Array owner identities", () => {
    for (const code of [
      `globalThis.Array.from(source, function (value) { return value; }, null);`,
      `const PlatformArray = Array;
PlatformArray["from"](source, function (value) { return value; }, null);`,
      `const { Array: PlatformArray } = globalThis;
PlatformArray.from(source, function (value) { return this.normalize(value); });`,
      `Array.from && Array.from(source, function (value) { return value; }, null);`,
    ]) {
      assertInvalid(code, RULE, {}, { settings: ZURICH });
    }
  });

  it("keeps omitted-this cases silent when the mapper cannot observe the defect", () => {
    for (const code of [
      `Array.from(source, (value) => this.normalize(value));`,
      `Array.from(source, function (value) { return value; });`,
      `Array.from(source, function (value) {
  function later() { return this.normalize(value); }
  return later;
});`,
      `Array.from(source, function (value) {
  "use strict";
  return this === undefined ? value : null;
});`,
      `"use strict";
Array.from(source, function (value) { return this === undefined ? value : null; });`,
      `function run() {
  "use strict";
  return Array.from(source, function (value) { return this === undefined ? value : null; });
}
run();`,
      `class Runner {
  run() {
    return Array.from(source, function (value) { return this === undefined ? value : null; });
  }
}`,
      `Array.from([], function (value) { return this.normalize(value); });`,
      `Array.from("", function (value) { return this.normalize(value); });`,
      "const source = ``; Array.from(source, function (value) { return this.normalize(value); });",
    ]) {
      assertValid(code, RULE, { settings: ZURICH });
    }
  });

  it("accepts object this arguments and conservatively unknown primitives", () => {
    for (const code of [
      `Array.from(source, function (value) { return this.normalize(value); }, normalizer);`,
      `Array.from(source, function (value) { return value; }, {});`,
      `Array.from(source, function (value) { return value; }, new String("scope"));`,
      `Array.from(source, function (value) { return value; }, /scope/);`,
      "Array.from(source, function (value) { return value; }, `scope-${suffix}`);",
      `Array.from(source, function (value) { return value; }, Symbol("scope"));`,
    ]) {
      assertValid(code, RULE, { settings: ZURICH });
    }
  });

  it("requires a syntax-proven stable callable mapper", () => {
    for (const code of [
      `Array.from(source, mapper, null);`,
      `Array.from(source, helpers.mapper, null);`,
      `let mapper = function (value) { return value; };
Array.from(source, mapper, null);`,
      `function mapper(value) { return value; }
mapper = replacement;
Array.from(source, mapper, null);`,
      `Array.from(source, class Mapper {}, null);`,
      `const mapper = function (value) { return value; };
function later() { return Array.from(source, mapper, null); }
later();`,
      `function convert(undefined) {
  return Array.from(source, function (value) { return value; }, undefined);
}`,
    ]) {
      assertValid(code, RULE, { settings: ZURICH });
    }
  });

  it("stays silent when argument positions or reaching mapper setup are unknown", () => {
    for (const code of [
      `Array.from(null, function (value) { return value; }, null);`,
      `Array.from(undefined, function (value) { return this.normalize(value); });`,
      `const source = null;
Array.from(source, function (value) { return value; }, null);`,
      `Array.from(...argumentsList);`,
      `Array.from(source, ...mapperArguments);`,
      `Array.from(source, function (value) { return value; }, ...thisArguments);`,
    ]) {
      assertValid(code, RULE, { settings: ZURICH });
    }
  });

  it("requires native Array.from authority", () => {
    for (const code of [
      `const Array = { from: localFrom };
Array.from(source, mapper, null);`,
      `function convert(Array) { return Array.from(source, mapper, null); }`,
      `Array.from = localFrom;
Array.from(source, function (value) { return value; }, null);`,
      `Object.defineProperty(Array, "from", { value: localFrom });
Array.from(source, function (value) { return value; }, null);`,
      `installPolyfill(Array);
Array.from(source, function (value) { return value; }, null);`,
      `const from = Array.from;
from(source, function (value) { return value; }, null);`,
      `const PlatformArray = Array;
function later() {
  return PlatformArray.from(source, function (value) { return value; }, null);
}
later();`,
      `eval(sourceText);
Array.from(source, function (value) { return value; }, null);`,
    ]) {
      assertValid(code, RULE, { settings: ZURICH });
    }
  });

  it("follows the release delta without guessing an omitted release", () => {
    const primitive = `Array.from(source, function (value) { return value; }, null);`;
    const omitted = `Array.from(source, function (value) { return this.normalize(value); });`;
    for (const code of [primitive, omitted]) {
      assertInvalid(code, RULE, {}, { settings: ZURICH });
      assertValid(code, RULE, { settings: AUSTRALIA });
      assertValid(code, RULE, { settings: { javascriptMode: "es2021" } });
      for (const javascriptMode of ["compatibility", "es5"] as const) {
        assertValid(code, RULE, {
          settings: { javascriptMode, release: "zurich" },
        });
      }
    }
  });

  it("does not apply server-engine behavior to other execution contexts", () => {
    const code = `Array.from(source, function (value) { return value; }, null);`;
    assertValid(code, RULE, {
      filename: "form.client.js",
      settings: { ...ZURICH, surfaces: ["client"] },
    });
    assertValid(code, RULE, { filename: "metadata.now.ts", settings: ZURICH });
    assertValid(code, RULE, {
      filename: "mixed.ui-action.js",
      settings: { ...ZURICH, surfaces: ["client", "server", "ui-action"] },
    });
  });
});
