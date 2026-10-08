import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSync } from "oxc-parser";
import { applyRules } from "../helpers/apply-rules.js";
import type { FileAnalysis } from "../../src/analysis/file-analysis.js";
import { analyzePathBindings } from "../../src/analysis/path-state.js";
import type { ProvenanceQuery } from "../../src/analysis/provenance.js";
import { isNode } from "../../src/utils/ast.js";

function queries(code: string): number {
  const parsed = parseSync("capture.br.js", code, { sourceType: "script", lang: "js" });
  assert.deepEqual(parsed.errors, []);
  assert.ok(isNode(parsed.program));
  let file: FileAnalysis | undefined;
  applyRules(
    code,
    { ast: parsed.program },
    {
      filename: "capture.br.js",
      ruleNames: ["require-query-before-next"],
      onFileAnalysis: (analysis) => {
        file = analysis;
      },
    },
  );
  assert.ok(file);
  const analysis: ProvenanceQuery = {
    bindings: file.bindings,
    glide: file.glide,
    ofIdentifier: () => null,
    ofExpression: () => null,
    trustedExpression: () => null,
    isPlatformGlobal: () => true,
    isPlatformCtor: (_node, names) => names.includes("GlideRecord"),
    isPlatformMember: () => false,
  };
  let count = 0;
  const result = analyzePathBindings<boolean>({
    program: parsed.program,
    analysis,
    kinds: ["GlideRecord"],
    emptyData: () => false,
    cloneData: (data) => data,
    mergeData: (left, right) => left || right,
    equalsData: (left, right) => left === right,
    onCall: ({ property }) => {
      if (property === "query") count += 1;
    },
  });
  assert.equal(result.outcome, "complete");
  return count;
}

// @lat: [[tests#Analysis behavior#Lexical arguments captures allocate stable owner identities]]
describe("lexical arguments capture identities", () => {
  for (const invocation of [
    "(0, outer)(true);",
    "(external ? outer : outer)(true);",
    "var alias = outer; (0, alias)(true);",
    "outer(true);",
  ]) {
    it(`invalidates the mapped selector after earlier uncalled analysis: ${invocation}`, () => {
      assert.equal(
        queries(
          'var records = new GlideRecord("task"); function outer(run) { run = false; external(() => { arguments[0] = true; }); run &&= records.query(); } ' +
            invocation,
        ),
        1,
      );
    });
  }
  it("keeps nested ordinary function arguments independent", () => {
    assert.equal(
      queries(
        'var records = new GlideRecord("task"); function outer(run) { run = false; external(() => { function inner(value) { arguments[0] = true; } inner(false); }); run &&= records.query(); } (0, outer)(true);',
      ),
      0,
    );
  });
  it("keeps strict function parameters independent", () => {
    assert.equal(
      queries(
        'var records = new GlideRecord("task"); function outer(run) { "use strict"; run = false; external(() => { arguments[0] = true; }); run &&= records.query(); } (0, outer)(true);',
      ),
      0,
    );
  });
});
