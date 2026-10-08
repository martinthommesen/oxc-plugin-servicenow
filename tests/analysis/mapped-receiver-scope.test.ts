import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSync } from "oxc-parser";
import { applyRules } from "../helpers/apply-rules.js";
import type { FileAnalysis } from "../../src/analysis/file-analysis.js";
import { analyzePathBindings } from "../../src/analysis/path-state.js";
import type { ProvenanceQuery } from "../../src/analysis/provenance.js";
import { isNode } from "../../src/utils/ast.js";

function bulkCalls(code: string, sourceType: "script" | "module" = "script"): number {
  const parsed = parseSync("mapped.br.js", code, { sourceType, lang: "js" });
  assert.deepEqual(parsed.errors, []);
  let exhausted: boolean | undefined;
  const messages = applyRules(
    code,
    { ast: parsed.program },
    {
      filename: "mapped.br.js",
      ruleNames: ["no-unfiltered-gliderecord-bulk-operation"],
      onFileAnalysis: (analysis) => {
        exhausted = analysis.pathBudgetExhausted;
      },
    },
  );
  assert.equal(exhausted, false);
  assert.ok(messages.every((message) => message.messageId === "unfiltered"));
  return messages.length;
}

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
  });
  assert.equal(result.outcome, "complete");
  return queries;
}

// @lat: [[tests#Analysis behavior#Mapped receiver alternatives retain evaluated identities]]
describe("mapped receiver alternatives", () => {
  for (const [receiver, expected] of [
    ["pick ? arguments : [0]", 1],
    ["pick ? [0] : arguments", 1],
    ["pick || arguments", 1],
    ["pick && arguments", 1],
    ["pick ?? arguments", 1],
    ["false ? arguments : [0]", 0],
    ["true ? [0] : arguments", 0],
    ["true || arguments", 0],
    ["false && arguments", 0],
    ["0 ?? arguments", 0],
  ] as const) {
    for (const operation of ["[0]++;", "[0] += 1;", "[0] = true;"]) {
      it(`preserves ${receiver} before the member write ${operation}`, () => {
        assert.equal(
          queryCalls(
            `var records = new GlideRecord("task"); function use(run, pick) { run = false; (${receiver})${operation} run &&= records.query(); } use(false, external);`,
          ),
          expected,
        );
      });
    }
  }
});

// @lat: [[tests#Analysis behavior#Strict directives belong to script and function prologues]]
describe("mapped argument strict directive scopes", () => {
  const body = `function use(run) { run = false; arguments[0]++; run &&= records.deleteMultiple(); } use(false);`;
  for (const [scope, expected] of [
    [`{ "use strict"; ${body} }`, 1],
    [`function outer() { { "use strict"; ${body} } } outer();`, 1],
    [`if (true) { "use strict"; ${body} }`, 1],
    [`try { throw 0; } catch (error) { "use strict"; ${body} }`, 1],
    [`"use strict"; ${body}`, 0],
    [`function outer() { "use strict"; ${body} } outer();`, 0],
    [
      `function outer() { { "use strict"; function use(run) { "use strict"; run = false; arguments[0]++; run &&= records.deleteMultiple(); } use(false); } } outer();`,
      0,
    ],
  ] as const) {
    it(`honors actual directive prologues in ${scope}`, () => {
      const code = scope.startsWith('"use strict";')
        ? `"use strict"; var records = new GlideRecord("task"); ${body}`
        : `var records = new GlideRecord("task"); ${scope}`;
      assert.equal(bulkCalls(code), expected);
    });
  }
  it("keeps module helpers strict inside ordinary blocks", () => {
    assert.equal(
      bulkCalls(`var records = new GlideRecord("task"); { "use strict"; ${body} }`, "module"),
      0,
    );
  });
});
