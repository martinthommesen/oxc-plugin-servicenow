import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getPathBudgetExceededCount,
  resetPathBudgetExceededCount,
  runWithTraversalBudget,
} from "../../src/analysis/path-state.js";
import { assertValid, lint } from "../helpers/rule-tester.js";

function nestedDoWhile(depth: number): string {
  let body = "var x = 1;\n";
  for (let index = 0; index < depth; index += 1) {
    body = `do {\n${body}} while (cond${index});\n`;
  }
  return body;
}

function nestedCursorDoWhile(depth: number): string {
  let body = 'gs.info("tick");\n';
  for (let index = 0; index < depth; index += 1) {
    body = `var rec${index} = new GlideRecord("incident");\nrec${index}.query();\ndo {\n${body}} while (rec${index}.next());\n`;
  }
  return body;
}

function elapsedMs(run: () => void): number {
  const started = process.hrtime.bigint();
  run();
  return Number(process.hrtime.bigint() - started) / 1e6;
}

// Before the memo, each nested do…while doubled the traversals of its body:
// 26 levels took about 30 seconds in one rule (FINDINGS.md PER-002).
describe("cursor-loop walkers stay bounded (FINDINGS.md PER-002)", () => {
  it("no-glideelement-in-collection finishes on 30 nested do…while statements", () => {
    const took = elapsedMs(() => assertValid(nestedDoWhile(30), "no-glideelement-in-collection"));
    assert.ok(took < 5000, `nested do…while took ${took}ms`);
  });

  it("no-gliderecord-query-in-loop finishes on 24 nested cursor do…while loops", () => {
    let messages: ReturnType<typeof lint> = [];
    const took = elapsedMs(() => {
      messages = lint(nestedCursorDoWhile(24), "no-gliderecord-query-in-loop");
    });
    assert.ok(took < 5000, `nested cursor do…while took ${took}ms`);
    // The budget must not fire at this size: the inner queries inside outer
    // cursor loops are real findings and must survive memoization.
    assert.ok(messages.length > 0, "expected query-in-loop findings on nested cursor loops");
  });

  it("degrades to the fallback and counts the event when the budget is exhausted", () => {
    resetPathBudgetExceededCount();
    const result = runWithTraversalBudget<string[]>((spend) => {
      for (let index = 0; index < 100_000; index += 1) spend();
      return ["finding"];
    }, []);
    assert.deepEqual(result, []);
    assert.equal(getPathBudgetExceededCount(), 1);
    resetPathBudgetExceededCount();
  });
});
