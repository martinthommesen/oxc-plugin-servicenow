import { describe, it } from "node:test";
import { assertInvalid, assertValid } from "../helpers/rule-tester.js";

const RULE = "no-unsupported-set-methods" as const;
const ZURICH = { javascriptMode: "es2021", release: "zurich" } as const;
const AUSTRALIA = { javascriptMode: "es2021", release: "australia" } as const;
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
  it("follows the Zurich and Australia release delta for all seven methods", () => {
    for (const method of METHODS) {
      const code = `new Set(left).${method}(right);`;
      assertInvalid(
        code,
        RULE,
        { messageId: "unsupported", includes: method },
        { settings: ZURICH },
      );
      assertValid(code, RULE, { settings: AUSTRALIA });
      assertValid(code, RULE, { settings: { javascriptMode: "es2021" } });
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
    ]) {
      assertInvalid(code, RULE, { messageId: "unsupported" }, { settings: ZURICH });
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
      `const values = new Set(); function later() { return values.union(other); } later();`,
      `class OrderedSet extends Set {} new OrderedSet().union(other);`,
      `eval(source); new Set().union(other);`,
      `new Set()[method](other);`,
    ]) {
      assertValid(code, RULE, { settings: ZURICH });
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
      assertValid(code, RULE, { settings: ZURICH });
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
      assertInvalid(code, RULE, { messageId: "unsupported" }, { settings: ZURICH });
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
      assertValid(code, RULE, { settings: ZURICH });
    }
  });

  it("keeps instance mutation tied to the affected Set identity", () => {
    assertInvalid(
      `const customized = new Set(); customized.union = localUnion; customized.union(other);
const values = new Set(); values.union(other);`,
      RULE,
      { messageId: "unsupported", count: 1 },
      { settings: ZURICH },
    );
  });

  it("keeps extracted invocations and unsupported execution contexts silent", () => {
    assertValid(
      `const values = new Set(); const union = values.union.bind(values); union(other); values.union.call(values, other);`,
      RULE,
      { settings: ZURICH },
    );
    for (const javascriptMode of ["compatibility", "es5"] as const) {
      assertValid(`new Set().union(other);`, RULE, {
        settings: { javascriptMode, release: "zurich" },
      });
    }
    assertValid(`new Set().union(other);`, RULE, {
      filename: "form.client.js",
      settings: { ...ZURICH, surfaces: ["client"] },
    });
    assertValid(`new Set().union(other);`, RULE, { filename: "metadata.now.ts" });
    assertValid(`new Set().union(other);`, RULE);
  });
});
