import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertSkipped, assertValidActive } from "./rule-tester.js";

// The activity-aware assertions must themselves fail in the right direction:
// a gated rule pointed at a file it declines must fail assertValidActive and
// pass assertSkipped (FINDINGS.md TST-004). no-bigint gates on JavaScript
// mode, so with no settings it declines every file.
describe("rule-tester activity assertions (FINDINGS.md TST-004)", () => {
  it("assertValidActive fails when the rule's gate declined the file", () => {
    assert.throws(() => assertValidActive("var n = 10;", "no-bigint"), /declined/);
  });

  it("assertValidActive passes when the rule ran and stayed silent", () => {
    assertValidActive("var n = 10;", "no-bigint", { settings: { javascriptMode: "es5" } });
  });

  it("assertSkipped passes only for a declined file", () => {
    assertSkipped("var n = 10;", "no-bigint");
    assert.throws(
      () => assertSkipped("var n = 10;", "no-bigint", { settings: { javascriptMode: "es5" } }),
      /rule ran/,
    );
  });
});
