import { ruleTester } from "../helpers/rule-tester.js";
import { describe, it } from "node:test";
import {
  assertDeclinesNonServerSurfaces,
  AUSTRALIA_ES2021,
  ZURICH_ES2021,
} from "../helpers/rule-tester.js";

const RULE = "no-unsupported-set-methods" as const;
const METHODS = [
  "difference",
  "intersection",
  "isDisjointFrom",
  "isSubsetOf",
  "isSupersetOf",
  "symmetricDifference",
  "union",
] as const;

describe(RULE, () => {
  const { expectInvalid, expectValid, expectActive } = ruleTester(
    "no-unsupported-set-methods",
    ZURICH_ES2021,
    { messageId: "unsupported" },
  );

  it("follows the Zurich and Australia release delta for all seven methods", () => {
    for (const method of METHODS) {
      const code = `new Set(left).${method}(right);`;
      expectInvalid(code, { messageId: "unsupported", includes: method });
      expectValid(code, AUSTRALIA_ES2021);
      expectValid(code, { settings: { javascriptMode: "es2021" } });
    }
  });

  it("recognizes computed calls, constructor aliases, and receiver aliases", () => {
    for (const code of [
      `const values = new Set(left); values["union"](right);`,
      `const NativeSet = Set; new NativeSet(left).intersection(right);`,
      `const values = new globalThis.Set(left); values.difference(right);`,
      `const { Set: NativeSet } = globalThis; new NativeSet(left).symmetricDifference(right);`,
      `const values = new Set(left); const alias = values; alias.isSubsetOf(right);`,
      `const values = new Set(left); let alias; if (condition) alias = values; else alias = values; alias.isSupersetOf(right);`,
      `const values = new Set(left); if (condition) values.isDisjointFrom(right);`,
      `const values = new Set(); function later() { return values.union(other); } later();`,
      `const values = new Set(); (() => values.intersection(other))();`,
    ]) {
      expectInvalid(code);
    }
  });

  it("keeps unproven, shadowed, reassigned, and escaped receivers silent", () => {
    for (const code of [
      `customCollection.union(other);`,
      `const values = { union: localUnion }; values.union(other);`,
      `function Set() {} new Set().union(other);`,
      `function combine(Set) { return new Set().union(other); }`,
      `let values = new Set(); values = customCollection; values.union(other);`,
      `const values = condition ? new Set() : customCollection; values.union(other);`,
      `createSet().union(other);`,
      `const values = new Set(); installPolyfills(values); values.union(other);`,
      `const values = new Set(); function later() { return values.union(other); }`,
      `const values = new Set(); function later() { return values.union(other); } install(later); later();`,
      `class OrderedSet extends Set {} new OrderedSet().union(other);`,
      `eval(source); new Set().union(other);`,
      `new Set()[method](other);`,
    ]) {
      expectValid(code);
    }
  });

  it("honors receiver-specific and prototype availability guards", () => {
    for (const code of [
      `const values = new Set(); values.union && values.union(other);`,
      `const values = new Set(); typeof values.union === "function" && values.union(other);`,
      `const values = new Set(); "union" in values && values.union(other);`,
      `const values = new Set(); if (values.union) values.union(other);`,
      `const values = new Set(); values.union?.(other);`,
      `function combine() { const values = new Set(); if (!values.union) return; return values.union(other); }`,
      `const values = new Set(); Set.prototype.union && values.union(other);`,
      `const values = new Set(); typeof Set.prototype.union === "function" && values.union(other);`,
      `const values = new Set(); "union" in Set.prototype && values.union(other);`,
      `const values = new Set(); const proto = Set.prototype; if (proto.union) values.union(other);`,
      `const values = new Set(); const union = values.union; if (union) values.union(other);`,
      `const values = new Set(); const alias = values; if (alias.union) values.union(other);`,
    ]) {
      expectValid(code);
    }
  });

  it("does not accept unrelated receiver, method, constructor, or optional-receiver guards", () => {
    for (const code of [
      `const first = new Set(); const second = new Set(); first.union && second.union(other);`,
      `const values = new Set(); values.intersection && values.union(other);`,
      `const values = new Set(); if (Set) values.union(other);`,
      `const values = new Set(); Set.prototype.intersection && values.union(other);`,
      `const values = new Set(); values?.union(other);`,
    ]) {
      expectInvalid(code);
    }
  });

  it("stays silent after visible constructor, prototype, or receiver mutation", () => {
    for (const code of [
      `Set = LocalSet; new Set().union(other);`,
      `Set.prototype.union = localUnion; new Set().union(other);`,
      `Object.defineProperty(Set.prototype, "union", { value: localUnion }); new Set().union(other);`,
      `Object.assign(Set.prototype, { union: localUnion }); new Set().union(other);`,
      `installPolyfills(Set.prototype); new Set().union(other);`,
      `const values = new Set(); values.union = localUnion; values.union(other);`,
      `const values = new Set(); delete values.union; values.union(other);`,
      `const values = new Set(); if (values.union) { values.union = undefined; values.union(other); }`,
    ]) {
      expectActive(code);
    }
  });

  it("keeps instance mutation tied to the affected Set identity", () =>
    void expectInvalid(
      `const customized = new Set(); customized.union = localUnion; customized.union(other);
const values = new Set(); values.union(other);`,
      { messageId: "unsupported", count: 1 },
    ));

  it("handles many receivers without rebuilding block guard indexes", () => {
    const guards = Array.from({ length: 64 }, () => `if (false) return;`);
    const calls = Array.from({ length: 128 }, () => `new Set().union(other);`);
    expectInvalid(`function combine() {\n${[...guards, ...calls].join("\n")}\n}`, {
      messageId: "unsupported",
      count: 128,
    });
  });

  it("keeps extracted invocations and unsupported execution contexts silent", () => {
    expectValid(
      `const values = new Set(); const union = values.union.bind(values); union(other); values.union.call(values, other);`,
    );
    for (const javascriptMode of ["compatibility", "es5"] as const) {
      expectValid(`new Set().union(other);`, {
        settings: { javascriptMode, release: "zurich" },
      });
    }
    assertDeclinesNonServerSurfaces(`new Set().union(other);`, RULE, ZURICH_ES2021.settings);
    expectValid(`new Set().union(other);`, {});
  });
});
