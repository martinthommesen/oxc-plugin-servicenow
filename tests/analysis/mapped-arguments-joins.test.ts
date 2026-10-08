import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSync } from "oxc-parser";
import { applyRules } from "../helpers/apply-rules.js";
import type { FileAnalysis } from "../../src/analysis/file-analysis.js";
import { analyzePathBindings } from "../../src/analysis/path-state.js";
import type { ProvenanceQuery } from "../../src/analysis/provenance.js";
import { isNode } from "../../src/utils/ast.js";

function queryCalls(code: string): number {
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
    onExit: (states) => {
      assert.ok(states.every((state) => state.records.length === 1));
    },
  });
  assert.equal(result.outcome, "complete");
  return queries;
}

// @lat: [[tests#Analysis behavior#Mapped arguments identities survive preceding joins]]
describe("mapped arguments preceding joins", () => {
  for (const header of [
    "if (pick) {}",
    "if (pick) { run = false; } else { run = false; }",
    "try { unknown(); } catch (_) {}",
    "while (pick) { break; }",
  ]) {
    for (const receiver of ["arguments", "saved"]) {
      it(`keeps ${receiver} through ${header}`, () => {
        assert.equal(
          queryCalls(
            `var records = new GlideRecord("task"); function use(run, pick) { run = false; var saved = arguments; ${header} ${receiver}[0] = true; run &&= records.query(); } use(false, external);`,
          ),
          1,
        );
      });
    }
  }
  it("retains conservative uncertainty after one branch replaces arguments", () => {
    assert.equal(
      queryCalls(
        'var records = new GlideRecord("task"); function use(run, pick) { run = false; if (pick) arguments = [0]; arguments[0] = true; run &&= records.query(); } use(false, external);',
      ),
      1,
    );
  });
  it("keeps a definite replacement independent", () => {
    assert.equal(
      queryCalls(
        'var records = new GlideRecord("task"); function use(run, pick) { run = false; if (pick) {} arguments = [0]; arguments[0] = true; run &&= records.query(); } use(false, external);',
      ),
      0,
    );
  });
  it("keeps strict parameters independent across joins", () => {
    assert.equal(
      queryCalls(
        'var records = new GlideRecord("task"); function use(run, pick) { "use strict"; run = false; if (pick) {} arguments[0] = true; run &&= records.query(); } use(false, external);',
      ),
      0,
    );
  });
});
