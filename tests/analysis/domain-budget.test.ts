import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getPathBudgetExceededCount,
  resetPathBudgetExceededCount,
} from "../../src/analysis/path-state.js";
import { lintWithAnalysis } from "../helpers/rule-tester.js";

function aggregateBranches(count: number, options: { distinct: boolean }): string {
  const branches = Array.from(
    { length: count },
    (_, index) =>
      `if (flag${index}) agg.addAggregate("COUNT", "field${options.distinct ? index : 0}");`,
  ).join("\n");
  return `var agg = new GlideAggregate("incident"); agg.next(); ${branches} agg.query(); agg.getAggregate("SUM", "missing");`;
}

function distinctCursorLoops(depth: number): string {
  let body = `arr.push(String(gr0.sys_id));`;
  const declarations: string[] = [];
  for (let index = 0; index < depth; index += 1) {
    declarations.push(`var gr${index} = new GlideRecord("incident"); gr${index}.query();`);
    body = `do { ${body} } while (gr${index}.next());`;
  }
  return `${declarations.join("\n")} while (gr0.next()) { arr.push(gr0.sys_id); } ${body}`;
}

function callableBranches(count: number, options: { independent: boolean }): string {
  const branches = Array.from({ length: count }, (_, index) => {
    const binding = options.independent ? `run${index}` : "run";
    return `var ${binding}; if (flag${index}) ${binding} = function () {}; else ${binding} = function () { gr.query(); };`;
  }).join("\n");
  return `var gr = new GlideRecord("incident"); gr.next(); ${branches}`;
}

// @lat: [[tests#Analysis behavior#Callable correlations remain bounded]]
describe("callable correlation budget", () => {
  it("discards earlier findings when independent callable choices exhaust work", () => {
    const { messages, analysis } = lintWithAnalysis(
      callableBranches(16, { independent: true }),
      "require-query-before-next",
    );
    assert.equal(analysis.pathBudgetExhausted, true);
    assert.deepEqual(messages, []);
  });

  it("compacts repeated choices of one callable binding without exhausting work", () => {
    const { messages, analysis } = lintWithAnalysis(
      callableBranches(18, { independent: false }),
      "require-query-before-next",
    );
    assert.equal(analysis.pathBudgetExhausted, false);
    assert.deepEqual(
      messages.map((message) => message.messageId),
      ["missingQuery"],
    );
  });
});

// @lat: [[tests#Analysis behavior#Alternative payload work consumes the path budget]]
describe("alternative payload budget", () => {
  it("discards early and late findings after distinct tuple alternatives exhaust work", () => {
    resetPathBudgetExceededCount();
    const { messages, analysis } = lintWithAnalysis(
      aggregateBranches(14, { distinct: true }),
      "validate-glideaggregate-calls",
    );
    assert.equal(analysis.pathBudgetExhausted, true);
    assert.ok(getPathBudgetExceededCount() > 0);
    assert.deepEqual(messages, []);
  });

  it("completes repeated tuple branches with both expected findings", () => {
    resetPathBudgetExceededCount();
    const { messages, analysis } = lintWithAnalysis(
      aggregateBranches(18, { distinct: false }),
      "validate-glideaggregate-calls",
    );
    assert.equal(analysis.pathBudgetExhausted, false);
    assert.equal(getPathBudgetExceededCount(), 0);
    assert.deepEqual(
      messages.map((message) => message.messageId),
      ["missingQuery", "unknownAggregate"],
    );
  });

  it("preserves distinct tuple diagnostics below the bound", () => {
    const { messages, analysis } = lintWithAnalysis(
      aggregateBranches(5, { distinct: true }),
      "validate-glideaggregate-calls",
    );
    assert.equal(analysis.pathBudgetExhausted, false);
    assert.deepEqual(
      messages.map((message) => message.messageId),
      ["missingQuery", "unknownAggregate"],
    );
  });
});

// @lat: [[tests#Analysis behavior#Independent retention work is bounded]]
describe("retained element traversal budget", () => {
  it("completes deeply nested same-cursor states without degrading", () => {
    let body = "arr.push(String(gr.sys_id));";
    for (let index = 0; index < 24; index += 1) body = `do { ${body} } while (gr.next());`;
    const { messages, analysis } = lintWithAnalysis(
      `var gr = new GlideRecord("incident"); gr.query(); ${body}`,
      "no-glideelement-in-collection",
    );
    assert.equal(analysis.pathBudgetExhausted, false);
    assert.deepEqual(messages, []);
  });

  it("discards an earlier finding after distinct cursor subsets exhaust work", () => {
    const { messages, analysis } = lintWithAnalysis(
      distinctCursorLoops(16),
      "no-glideelement-in-collection",
    );
    assert.equal(analysis.pathBudgetExhausted, true);
    assert.deepEqual(messages, []);
  });

  it("keeps ordinary findings below the independent traversal bound", () => {
    const { messages, analysis } = lintWithAnalysis(
      distinctCursorLoops(6),
      "no-glideelement-in-collection",
    );
    assert.equal(analysis.pathBudgetExhausted, false);
    assert.deepEqual(
      messages.map((message) => message.messageId),
      ["retained"],
    );
  });
});
