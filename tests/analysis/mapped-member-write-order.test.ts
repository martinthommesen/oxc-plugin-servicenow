import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSync } from "oxc-parser";
import type { FileAnalysis } from "../../src/analysis/file-analysis.js";
import { analyzePathBindings } from "../../src/analysis/path-state.js";
import type { ProvenanceQuery } from "../../src/analysis/provenance.js";
import { isNode } from "../../src/utils/ast.js";
import { applyRules } from "../helpers/apply-rules.js";

function queryCalls(effect: string, async = false): number {
  const code = `var gr = new GlideRecord("task"); function fail() { throw 0; } ${async ? "async " : ""}function use(run) { run = false; ${effect} run &&= gr.query(); } use(true);`;
  const parsed = parseSync("mapped.br.js", code, { sourceType: "script", lang: "js" });
  assert.deepEqual(parsed.errors, []);
  assert.ok(isNode(parsed.program));
  let fileAnalysis: FileAnalysis | undefined;
  applyRules(
    code,
    { ast: parsed.program },
    {
      filename: "mapped.br.js",
      ruleNames: ["require-query-before-next"],
      onFileAnalysis: (analysis) => {
        fileAnalysis = analysis;
      },
    },
  );
  assert.ok(fileAnalysis);
  const analysis: ProvenanceQuery = {
    bindings: fileAnalysis.bindings,
    glide: fileAnalysis.glide,
    ofIdentifier: () => null,
    ofExpression: () => null,
    trustedExpression: () => null,
    isPlatformGlobal: () => true,
    isPlatformCtor: (_node, names) => names.includes("GlideRecord"),
    isPlatformMember: () => false,
  };
  let queries = 0;
  const result = analyzePathBindings<boolean>({
    program: parsed.program,
    analysis,
    kinds: ["GlideRecord"],
    emptyData: () => false,
    cloneData: (data) => data,
    mergeData: (left, right) => left || right,
    equalsData: (left, right) => left === right,
    onCall: ({ property }) => {
      if (property === "query") queries += 1;
    },
    analyzeUncalledFunctions: false,
    stopAtAwait: async,
  });
  assert.equal(result.outcome, "complete");
  return queries;
}

// @lat: [[tests#Analysis behavior#Mapped member writes obey evaluation order]]
describe("mapped member write evaluation order", () => {
  for (const [effect, expected] of [
    ["try { arguments[0] += fail(); } catch (error) {}", 0],
    ["try { arguments[0] = fail(); } catch (error) {}", 0],
    ["try { arguments[fail()]++; } catch (error) {}", 0],
    ["var target = external; target[0] += (target = arguments, 1);", 0],
    ["var target = external; target[(target = arguments, 0)]++;", 0],
    ["var target = external; target[0] = (target = arguments, true);", 0],
    ["var target = arguments; target[0] += (target = [], 1);", 1],
    ["var target = arguments; target[(target = [], 0)]++;", 1],
    ["var target = arguments; target[0] = (target = [], true);", 1],
  ] as const) {
    it(`retains only executed mapped writes in ${effect}`, () => {
      assert.equal(queryCalls(effect), expected);
    });
  }
  it("does not write a mapped member after its RHS suspends", () => {
    assert.equal(queryCalls("arguments[0] += await external;", true), 0);
  });
  it("keeps earlier RHS effects when the later RHS operation throws", () => {
    assert.equal(queryCalls("try { arguments[0] += (run = true, fail()); } catch (error) {}"), 1);
  });
});
