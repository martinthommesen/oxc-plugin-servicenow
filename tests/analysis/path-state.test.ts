import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parse } from "../helpers/rule-tester.js";
import { createFileBindings } from "../../src/analysis/bindings.js";
import {
  analyzePathBindings,
  dedupePathFindings,
  type PathCallInput,
} from "../../src/analysis/path-state.js";
import { findGlideAjaxParamIssues } from "../../src/analysis/glideajax-params.js";
import type { ProvenanceQuery } from "../../src/analysis/provenance.js";
import { ctorProvenanceKind } from "../../src/analysis/provenance.js";
import { resolveGlideCapabilities } from "../../src/glide/manifest.js";

interface Data {
  calls: string[];
  queryState: "unopened" | "opened" | "unknown";
  counter: number;
  queryEvents: number;
  budgetExceeded: boolean;
}

function analysisFor(program: any): ProvenanceQuery {
  const context = {
    filename: "test.js",
    options: [],
    settings: {},
    sourceCode: { ast: program, text: "" },
  } as any;
  const bindings = createFileBindings(context, program);
  return {
    bindings,
    glide: resolveGlideCapabilities({ scope: "global", release: "zurich" }),
    ofIdentifier: () => null,
    ofExpression: () => null,
    isPlatformGlobal: () => true,
    isPlatformCtor: (_node, names) => names.includes("GlideRecord") || names.includes("GlideAjax"),
    isPlatformMember: () => false,
  };
}

function run(code: string, maxWork = 50_000, nonConverging = false): Data {
  const program = parse(code).ast as any;
  const result: Data = {
    calls: [],
    queryState: "unopened",
    counter: 0,
    queryEvents: 0,
    budgetExceeded: false,
  };
  analyzePathBindings<Data>({
    program,
    analysis: analysisFor(program),
    kinds: ["GlideRecord"],
    emptyData: () => ({
      calls: [],
      queryState: "unopened",
      counter: 0,
      queryEvents: 0,
      budgetExceeded: false,
    }),
    cloneData: (data) => ({
      calls: [...data.calls],
      queryState: data.queryState,
      counter: data.counter,
      queryEvents: data.queryEvents,
      budgetExceeded: data.budgetExceeded,
    }),
    mergeData: (left, right) => ({
      calls: [...new Set([...left.calls, ...right.calls])],
      queryState: left.queryState === right.queryState ? left.queryState : "unknown",
      counter: Math.max(left.counter, right.counter),
      queryEvents: left.queryEvents,
      budgetExceeded: left.budgetExceeded,
    }),
    equalsData: (left, right) =>
      left.queryState === right.queryState &&
      left.counter === right.counter &&
      left.calls.join(",") === right.calls.join(","),
    onCall({ rec, property }: PathCallInput<Data>) {
      if (!property) return;
      if (!rec) {
        result.calls.push(`${property}:none`);
        return;
      }
      rec.data.calls.push(property);
      if (property === "query") {
        rec.data.queryState = "opened";
        result.queryEvents += 1;
        if (nonConverging) rec.data.counter += 1;
      }
      if (property === "next") result.calls.push(`${property}:${rec.data.queryState}`);
    },
    onBudgetExceeded() {
      result.calls.length = 0;
      result.queryEvents = 0;
      result.budgetExceeded = true;
    },
    maxWork,
  });
  return result;
}

describe("path-state evaluator", () => {
  it("keeps case-test effects on a switch no-match path", () => {
    const result = run(`
      const gr = new GlideRecord("incident");
      switch (value) {
        case gr.query(): break;
      }
      gr.next();
    `);
    assert.deepEqual(result.calls, ["next:opened"]);
  });

  it("visits a catch handler on a possible throw path", () => {
    const result = run(`
      const gr = new GlideRecord("incident");
      try { gr.query(); } catch (error) { gr.setLimit(1); }
      gr.next();
    `);
    assert.ok(result.calls.includes("next:unknown"));
  });

  it("does not keep a definite receiver across a possible throwing catch", () => {
    const result = run(`
      let gr = new GlideRecord("incident");
      try { gr.query(); } catch (error) { gr = new GlideRecord("task"); }
      gr.next();
    `);
    assert.ok(result.calls.includes("next:none"));
  });

  it("starts a possible catch path before try-body mutations", () => {
    const result = run(`
      let gr = new GlideRecord("incident");
      try { gr.query(); } catch (error) {}
      gr.next();
    `);
    assert.ok(result.calls.includes("next:unknown"));
  });

  it("does not visit a catch handler after a demonstrably non-throwing try body", () => {
    const result = run(`
      const gr = new GlideRecord("incident");
      try { const answer = 42; } catch (error) { gr.next(); }
    `);
    assert.deepEqual(result.calls, []);
  });

  it("visits a catch handler before an operation that may throw", () => {
    const result = run(`
      const gr = new GlideRecord("incident");
      try { maybeThrow(); } catch (error) { gr.query(); }
      gr.next();
    `);
    assert.ok(result.calls.includes("next:unknown"));
  });

  it("keeps argument effects on the call-invocation catch path", () => {
    const result = run(`
      const gr = new GlideRecord("incident");
      try { maybeThrow(gr.query()); } catch (error) { gr.next(); }
    `);
    assert.ok(result.calls.includes("next:opened"));
  });

  it("keeps argument effects on the constructor-invocation catch path", () => {
    const result = run(`
      const gr = new GlideRecord("incident");
      try { new MaybeThrow(gr.query()); } catch (error) { gr.next(); }
    `);
    assert.ok(result.calls.includes("next:opened"));
  });

  it("visits a catch handler after an explicit throw", () => {
    const result = run(`
      const gr = new GlideRecord("incident");
      try { throw error; } catch (error) { gr.query(); }
      gr.next();
    `);
    assert.deepEqual(result.calls, ["next:opened"]);
  });

  it("stops a stable loop after its abstract state converges", () => {
    const result = run(`
      const gr = new GlideRecord("incident");
      while (condition) { gr.query(); }
      gr.next();
    `);
    assert.equal(result.queryEvents, 2);
  });

  it("does not publish definite records after a non-converging loop", () => {
    const result = run(
      `
        const gr = new GlideRecord("incident");
        while (condition) { gr.query(); }
        gr.next();
      `,
      10_000,
      true,
    );
    assert.equal(result.calls.length, 0);
    assert.equal(result.budgetExceeded, true);
  });

  it("escapes values captured through nested closures", () => {
    const result = run(`
      const gr = new GlideRecord("incident");
      function outer() { return () => gr.query(); }
      use(outer);
      gr.next();
    `);
    assert.deepEqual(result.calls, ["query:none", "next:none"]);
  });

  it("escapes an enclosing function local captured by an escaping callback", () => {
    const result = run(`
      function factory() {
        const gr = new GlideRecord("incident");
        const callback = () => gr.query();
        use(callback);
        gr.next();
      }
      factory();
    `);
    assert.deepEqual(result.calls, ["query:none", "next:none"]);
  });

  it("does not escape an enclosing function local when its callback is direct-only", () => {
    const result = run(`
      function factory() {
        const gr = new GlideRecord("incident");
        const callback = () => gr.query();
        callback();
        gr.next();
      }
      factory();
    `);
    assert.deepEqual(result.calls, ["next:opened"]);
  });

  it("does not execute or escape discarded generator bodies", () => {
    const result = run(`
      const gr = new GlideRecord("incident");
      function* open() { gr.query(); }
      open();
      gr.next();
    `);
    assert.deepEqual(result.calls, ["next:unopened"]);
  });

  it("escapes captures when a generator result can execute elsewhere", () => {
    const result = run(`
      const gr = new GlideRecord("incident");
      function* open() { gr.query(); }
      const iterator = open();
      use(iterator);
      gr.next();
    `);
    assert.deepEqual(result.calls, ["next:none"]);
  });

  it("deduplicates by call and message when requested", () => {
    const node = parse("gr.next();").ast as any;
    const call = node.body[0].expression;
    const findings = [
      { node: call, messageId: "afterTerminal" },
      { node: call, messageId: "badPrefix" },
      { node: call, messageId: "afterTerminal" },
    ];
    assert.deepEqual(
      dedupePathFindings(findings, (finding) => finding.messageId),
      findings.slice(0, 2),
    );
  });

  it("keeps distinct GlideAjax findings on one call node", () => {
    const program = parse(`
      const gj = new GlideAjax("handler");
      gj.getXML();
      gj.addParam("foo", 1);
    `).ast as any;
    const findings = findGlideAjaxParamIssues(program, analysisFor(program));
    assert.deepEqual(
      findings.map((finding) => finding.messageId),
      ["missingName", "afterTerminal", "badPrefix"],
    );
  });

  it("does not treat prototype names as constructors", () => {
    assert.equal(ctorProvenanceKind("toString"), null);
    assert.equal(ctorProvenanceKind("constructor"), null);
    assert.equal(ctorProvenanceKind("GlideRecord"), "GlideRecord");
  });
});
