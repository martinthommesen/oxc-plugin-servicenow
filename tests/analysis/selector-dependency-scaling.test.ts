import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lintWithAnalysis } from "../helpers/rule-tester.js";
import { assertSubQuadratic } from "../helpers/scaling.js";

function aliasCalls(count: number, logicalAssignment = true): string {
  const declarations = Array.from(
    { length: count },
    (_, index) => `var alias${index + 1} = alias${index};`,
  );
  const calls = Array.from({ length: count }, () => `alias${count}();`);
  return `var alias0 = external;
${declarations.join("\n")}
${calls.join("\n")}
${logicalAssignment ? "var selector = false; selector &&= true;" : ""}
var gr = new GlideRecord("task"); gr.deleteMultiple();`;
}

function assertBulkFinding(code: string): void {
  const { messages, analysis } = lintWithAnalysis(
    code,
    "no-unfiltered-gliderecord-bulk-operation",
    {
      filename: "selector-aliases.br.js",
    },
  );
  assert.equal(analysis.pathBudgetExhausted, false);
  assert.equal(messages.length, 1);
  assert.equal(messages[0]?.messageId, "unfiltered");
}

// @lat: [[tests#Analysis behavior#Selector alias dependencies reuse callable origins]]
describe("selector dependency alias work", () => {
  it("retains the security finding after five hundred deepest-alias calls", () => {
    assertBulkFinding(aliasCalls(500, false));
    assertBulkFinding(aliasCalls(500));
  });

  it("stays sub-quadratic when shared alias ancestry and calls quadruple", () => {
    const small = aliasCalls(125);
    const large = aliasCalls(500);
    assertSubQuadratic({
      label: "selector dependency alias calls",
      smallLabel: "125 aliases and calls",
      largeLabel: "500 aliases and calls",
      small: () => assertBulkFinding(small),
      large: () => assertBulkFinding(large),
    });
  });

  for (const [name, aliases] of [
    ["cycle", "var alias = inspect; var cycle = alias; alias = cycle; cycle(source);"],
    [
      "diamond",
      "var left = inspect; var right = inspect; var chosen; if (external) chosen = left; else chosen = right; chosen(source);",
    ],
  ] as const) {
    it(`preserves helper parameter dependencies through an alias ${name}`, () => {
      const { messages, analysis } = lintWithAnalysis(
        `var gr = new GlideRecord("task"); var source = false; function inspect(value) { value &&= gr.next(); } ${aliases} gr.next();`,
        "require-query-before-next",
      );
      assert.equal(analysis.pathBudgetExhausted, false);
      assert.equal(messages.length, 1);
    });
  }

  it("keeps distinct scalar arguments independent across calls through one alias", () => {
    const { messages, analysis } = lintWithAnalysis(
      `var gr = new GlideRecord("task"); var disabled = false; var enabled = true; function inspect(value) { value &&= gr.next(); } var alias = inspect; alias(disabled); alias(enabled);`,
      "require-query-before-next",
    );
    assert.equal(analysis.pathBudgetExhausted, false);
    assert.equal(messages.length, 1);
  });
});
