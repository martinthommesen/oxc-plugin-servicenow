import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSync } from "oxc-parser";
import type { FileAnalysis } from "../../src/analysis/file-analysis.js";
import { analyzePathBindings } from "../../src/analysis/path-state.js";
import { isNode } from "../../src/utils/ast.js";
import { applyRules } from "../helpers/apply-rules.js";
import { lintWithAnalysis } from "../helpers/rule-tester.js";

function bulkFindings(body: string, expected: number): void {
  const { messages, analysis } = lintWithAnalysis(
    `var gr = new GlideRecord("task"); var alias; ${body} alias.deleteMultiple();`,
    "no-unfiltered-gliderecord-bulk-operation",
  );
  assert.equal(analysis.pathBudgetExhausted, false);
  assert.ok(messages.every((message) => message.messageId === "unfiltered"));
  assert.equal(messages.length, expected);
}

function sharedBulkCalls(body: string, expected: number): void {
  const source = `var gr = new GlideRecord("task"); var alias; ${body} alias.deleteMultiple();`;
  const parsed = parseSync("lookup.br.js", source, { sourceType: "script", lang: "js" });
  assert.deepEqual(parsed.errors, []);
  assert.ok(isNode(parsed.program));
  let analysis: FileAnalysis | undefined;
  applyRules(
    source,
    { ast: parsed.program },
    {
      filename: "lookup.br.js",
      ruleNames: ["no-unfiltered-gliderecord-bulk-operation"],
      onFileAnalysis: (value) => {
        analysis = value;
      },
    },
  );
  assert.ok(analysis);
  assert.equal(analysis.pathBudgetExhausted, false);
  let calls = 0;
  const outcome = analyzePathBindings({
    program: parsed.program,
    analysis: analysis.provenance,
    kinds: ["GlideRecord"],
    emptyData: () => 0,
    cloneData: (value) => value,
    mergeData: (left, right) => Math.max(left, right),
    equalsData: (left, right) => left === right,
    analyzeUncalledFunctions: false,
    onCall: ({ rec, property }) => {
      if (rec && property === "deleteMultiple") calls += 1;
    },
  });
  assert.equal(outcome.outcome, "complete");
  assert.equal(calls, expected);
}

// @lat: [[tests#Analysis behavior#Safe local call lookup preserves completed argument effects]]
describe("safe local invocation lookup timing", () => {
  for (const [name, setup, callee] of [
    ["hoisted declaration", "function f() {}", "f"],
    ["initialized function expression", "var f = function () {};", "f"],
    ["initialized arrow", "var f = () => {};", "f"],
    ["saved callable alias", "function f() {} var saved = f;", "saved"],
    ["parenthesized identifier", "function f() {}", "((f))"],
    ["function literal", "", "(function () {})"],
    ["arrow literal", "", "(() => {})"],
    ["known alternatives", "var f = external ? function () {} : function () {};", "f"],
  ] as const) {
    it(`retains argument assignment before invoking a ${name}`, () => {
      bulkFindings(`${setup} try { ${callee}(alias = gr); } catch {}`, 1);
    });
  }

  it("retains assigned arguments before a throwing local body", () => {
    bulkFindings("function f() { throw 0; } try { f(alias = gr); } catch {}", 1);
  });
  it("retains completed assignment before a later argument throws", () => {
    bulkFindings(
      "function f() {} function fail() { throw 0; } try { f((alias = gr, fail())); } catch {}",
      1,
    );
  });
  it("saves the known callee before an argument replaces its binding", () => {
    bulkFindings("function f() {} try { f(alias = gr, f = external); } catch {}", 1);
  });
  it("retains the existing possible invocation throw after arguments", () => {
    bulkFindings("function f() {} try { f(); alias = gr; } catch {}", 0);
  });
  it("retains a known bad path alongside an unknown callable alternative", () => {
    bulkFindings("var f = external ? function () {} : missing; try { f(alias = gr); } catch {}", 1);
  });

  for (const [name, body] of [
    ["unknown reference", "try { missing(alias = gr); } catch {}"],
    ["rebound callable", "function f() {} f = external; try { f(alias = gr); } catch {}"],
    ["uninitialized lexical callable", "try { f(alias = gr); } catch {} let f = function () {};"],
    ["throwing getter", "var obj = { get f() { throw 0; } }; try { obj.f(alias = gr); } catch {}"],
    [
      "throwing computed key",
      "function fail() { throw 0; } var obj = {}; try { obj[fail()](alias = gr); } catch {}",
    ],
    [
      "throw before assignment",
      "function f() {} function fail() { throw 0; } try { f((fail(), alias = gr)); } catch {}",
    ],
    ["complex sequence callee", "function f() {} try { (0, f)(alias = gr); } catch {}"],
  ] as const) {
    it(`keeps ${name} lookup or argument uncertainty`, () => bulkFindings(body, 0));
  }

  for (const [name, setup, callee] of [
    ["ordinary declaration", "function C() {}", "C"],
    ["saved constructor", "function C() {} var saved = C;", "saved"],
    ["function literal", "", "(function () {})"],
  ] as const) {
    it(`retains scalar argument effects before a ${name} construction`, () => {
      bulkFindings(`${setup} try { new ${callee}((alias = gr, 0)); } catch {}`, 1);
    });
  }
  it("retains construction argument assignment before a later argument throws", () => {
    bulkFindings(
      "function C() {} function fail() { throw 0; } try { new C((alias = gr, fail())); } catch {}",
      1,
    );
  });
  it("retains existing construction argument export policy", () => {
    bulkFindings("function C() {} try { new C(alias = gr); } catch {}", 0);
  });
  it("keeps an unknown constructor's early uncertainty", () => {
    bulkFindings("try { new missing((alias = gr, 0)); } catch {}", 0);
  });
  it("skips construction arguments after an uninitialized class lookup", () => {
    bulkFindings("try { new C((alias = gr, 0)); } catch {} class C {}", 0);
  });
  it("keeps a throwing member constructor lookup before its arguments", () => {
    bulkFindings(
      "var obj = { get C() { throw 0; } }; try { new obj.C((alias = gr, 0)); } catch {}",
      0,
    );
  });

  it("keeps With-captured lookup uncertainty when the callback runs outside With", () => {
    sharedBulkCalls(
      "function f() {} var callback; with ({ get f() { throw 0; } }) { callback = function () { try { f((alias = gr, 0)); } catch {} }; } callback();",
      0,
    );
  });
  it("keeps With-captured constructor lookup uncertainty outside With", () => {
    sharedBulkCalls(
      "function C() {} var callback; with ({ get C() { throw 0; } }) { callback = function () { try { new C((alias = gr, 0)); } catch {} }; } callback();",
      0,
    );
  });
  it("keeps With-captured tag lookup uncertainty outside With", () => {
    sharedBulkCalls(
      "function f() {} var callback; with ({ get f() { throw 0; } }) { callback = function () { try { f`${(alias = gr, 0)}`; } catch {} }; } callback();",
      0,
    );
  });
  it("does not add identifier lookup uncertainty to a direct function literal", () => {
    sharedBulkCalls(
      "if (false) { with ({}) {} } try { (function () {})(alias = gr); } catch {}",
      1,
    );
  });
});
