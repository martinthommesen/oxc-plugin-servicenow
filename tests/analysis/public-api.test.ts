import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Context, ESTree } from "@oxlint/plugins";
import { analyzeProvenance, getScriptContext } from "../../src/analysis/index.js";
import { getAnalysisPassCount, resetAnalysisPassCount } from "../../src/analysis/internal.js";
import { getName, walk } from "../../src/utils/ast.js";
import { parse } from "../helpers/rule-tester.js";

function testContext(
  code: string,
  filename: string,
  hostDefinedNames: readonly string[] = [],
): Context {
  const parsed = parse(code, filename);
  const sourceCode = {
    ast: parsed.ast,
    text: code,
    getAllComments: () => parsed.comments,
    getScope: () => ({
      set: new Map(hostDefinedNames.map((name) => [name, { defs: [{ type: "Variable" }] }])),
      variables: [],
      upper: null,
    }),
  };
  return {
    filename,
    physicalFilename: `/workspace/${filename}`,
    cwd: "/workspace",
    options: [],
    settings: { servicenow: {} },
    sourceCode,
    getFilename: () => filename,
    getSourceCode: () => sourceCode,
  } as unknown as Context;
}

function lastIdentifier(ast: ESTree.Node, name: string): ESTree.Node {
  let found: ESTree.Node | undefined;
  walk(
    ast,
    {
      Identifier(node) {
        if (getName(node) === name) found = node;
      },
    },
    [],
  );
  assert.ok(found);
  return found;
}

function parseEstree(code: string, filename: string): ESTree.Node {
  // The parser and plugin packages publish distinct Program declarations;
  // this adapter is the test boundary between their runtime-compatible ASTs.
  return parse(code, filename).ast as unknown as ESTree.Node;
}

describe("public analysis API", () => {
  it("exposes immutable context and provenance views without internal state", () => {
    const code = 'var rec = new GlideRecord("incident");\nrec.next();';
    const context = testContext(code, "incident.br.js");
    const script = getScriptContext(context);

    assert.equal(Object.isFrozen(script), true);
    assert.equal(Object.isFrozen(script.sources), true);
    assert.equal(Object.isFrozen(script.deprecations), true);
    assert.equal(typeof (script.surfaces as Set<string>).add, "undefined");
    assert.throws(() => ((script as { scope: string }).scope = "global"), TypeError);

    let use: ESTree.Node | undefined;
    const ancestors: ESTree.Node[] = [];
    walk(
      context.sourceCode.ast as ESTree.Node,
      {
        Identifier(node) {
          if (getName(node) === "rec") use = node;
        },
      },
      ancestors,
    );
    assert.ok(use);

    const query = analyzeProvenance(context);
    assert.equal(Object.isFrozen(query), true);
    assert.deepEqual(Object.keys(query).sort(), [
      "isPlatformCtor",
      "isPlatformGlobal",
      "isPlatformMember",
      "ofExpression",
      "ofIdentifier",
    ]);
    assert.equal("bindings" in query, false);
    assert.equal("glide" in query, false);

    const provenance = query.ofIdentifier(use);
    assert.ok(provenance);
    assert.equal(Object.isFrozen(provenance), true);
    assert.equal(typeof (provenance.aggregates as Set<string>).add, "undefined");
    assert.throws(
      () => ((provenance as { escaped: boolean }).escaped = !provenance.escaped),
      TypeError,
    );
  });

  it("keeps rule-specific DataView identity out of the public provenance contract", () => {
    const code =
      "var view = new DataView(buffer);\nview.getBigInt64(0);\nvar proto = DataView.prototype;";
    const context = testContext(code, "data-view.script-include.js");
    let viewUse: ESTree.Node | undefined;
    let directMember: ESTree.MemberExpression | undefined;
    const ancestors: ESTree.Node[] = [];
    walk(
      context.sourceCode.ast as ESTree.Node,
      {
        Identifier(node) {
          if (getName(node) === "view") viewUse = node;
        },
        MemberExpression(node) {
          const member = node as ESTree.MemberExpression;
          if (getName(member.object) === "DataView") directMember = member;
        },
      },
      ancestors,
    );
    assert.ok(viewUse);
    assert.ok(directMember);

    const query = analyzeProvenance(context);
    assert.equal(query.ofIdentifier(viewUse), null);
    assert.equal(query.isPlatformMember(directMember, "DataView", "prototype"), true);

    let aliasedMember: ESTree.MemberExpression | undefined;
    walk(
      context.sourceCode.ast as ESTree.Node,
      {
        MemberExpression(node) {
          const member = node as ESTree.MemberExpression;
          if (getName(member.object) === "view") aliasedMember = member;
        },
      },
      [],
    );
    assert.ok(aliasedMember);
    assert.equal(query.isPlatformMember(aliasedMember, "DataView", "getBigInt64"), false);
  });

  it("keeps rule-specific Set identity out of the public provenance contract", () => {
    const code = "const values = new Set();\nvalues.union(other);\nconst proto = Set.prototype;";
    const context = testContext(code, "set-methods.script-include.js");
    const query = analyzeProvenance(context);
    const values = lastIdentifier(context.sourceCode.ast as ESTree.Node, "values");
    assert.equal(query.ofIdentifier(values), null);

    let prototype: ESTree.MemberExpression | undefined;
    walk(
      context.sourceCode.ast as ESTree.Node,
      {
        MemberExpression(node) {
          const member = node as ESTree.MemberExpression;
          if (getName(member.object) === "Set") prototype = member;
        },
      },
      [],
    );
    assert.ok(prototype);
    assert.equal(query.isPlatformMember(prototype, "Set", "prototype"), true);
  });

  it("analyzes an explicit AST independently from the host source tree", () => {
    resetAnalysisPassCount();
    const context = testContext(
      'var GlideRecord = function () {}; var local = new GlideRecord("incident"); local.next();',
      "host.script-include.js",
      ["GlideRecord"],
    );
    // A real host scope graph belongs to context.sourceCode.ast. Treating
    // GlideRecord as local there proves foreign AST nodes do not borrow it.

    const hostUse = lastIdentifier(context.sourceCode.ast as ESTree.Node, "local");
    assert.equal(analyzeProvenance(context).ofIdentifier(hostUse), null);
    assert.equal(
      analyzeProvenance(context, context.sourceCode.ast as ESTree.Node).ofIdentifier(hostUse),
      null,
    );

    const globalAst = parseEstree(
      'var rec = new GlideRecord("incident"); rec.next();',
      "alternate.script-include.js",
    );
    const globalUse = lastIdentifier(globalAst, "rec");
    assert.equal(
      analyzeProvenance(context, globalAst).ofIdentifier(globalUse)?.kind,
      "GlideRecord",
    );

    const shadowedAst = parseEstree(
      'function GlideRecord() {} var rec = new GlideRecord("incident"); rec.next();',
      "shadowed.script-include.js",
    );
    const shadowedUse = lastIdentifier(shadowedAst, "rec");
    assert.equal(analyzeProvenance(context, shadowedAst).ofIdentifier(shadowedUse), null);

    assert.equal(
      analyzeProvenance(context, globalAst).ofIdentifier(globalUse)?.kind,
      "GlideRecord",
    );
    assert.equal(getAnalysisPassCount(), 3);
  });

  it("pins the constant deprecated lifecycle fields (FINDINGS.md API-002)", () => {
    // This source would change every one of the four fields if they were
    // computed: the query is opened, windowed, aggregated, and carries a
    // sysparm_name. The fields are deprecated as never computed and are
    // removed in 3.0; a future implementation change must surface here.
    const code = [
      'var rec = new GlideAggregate("incident");',
      'rec.addAggregate("COUNT", "state");',
      "rec.setLimit(10);",
      "rec.query();",
      "rec.next();",
      'var ajax = new GlideAjax("Helper");',
      'ajax.addParam("sysparm_name", "run");',
      "ajax.getXMLAnswer(cb);",
    ].join("\n");
    const context = testContext(code, "incident.br.js");
    const query = analyzeProvenance(context);
    const uses = new Map<string, ESTree.Node>();
    walk(context.sourceCode.ast as ESTree.Node, {
      Identifier(node) {
        const name = getName(node);
        if (name === "rec" || name === "ajax") uses.set(name, node);
      },
    });
    const rec = query.ofIdentifier(uses.get("rec")!);
    assert.ok(rec);
    assert.equal(rec.queryState, "unopened");
    assert.equal(rec.windowed, false);
    assert.equal(rec.aggregates.size, 0);
    const ajax = query.ofIdentifier(uses.get("ajax")!);
    assert.ok(ajax);
    assert.equal(ajax.sysparmName, false);
  });
});
