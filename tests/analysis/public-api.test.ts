import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Context, ESTree } from "@oxlint/plugins";
import { analyzeProvenance, getScriptContext } from "../../src/analysis/index.js";
import { getName, walk } from "../../src/utils/ast.js";
import { parse } from "../helpers/rule-tester.js";

function testContext(code: string, filename: string): Context {
  const parsed = parse(code, filename);
  const sourceCode = {
    ast: parsed.ast,
    text: code,
    getAllComments: () => parsed.comments,
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

describe("public analysis API", () => {
  it("analyzes the explicitly supplied AST, not hidden context state (FINDINGS.md API-001)", () => {
    const glideCode = 'var gr = new GlideRecord("incident");';
    const otherCode = "var other = 1;";
    const glideAst = parse(glideCode, "a.br.js").ast as unknown as ESTree.Node;
    const context = testContext(otherCode, "a.br.js");
    const glideDecl = (glideAst as unknown as { body: any[] }).body[0].declarations[0]
      .init as ESTree.Node;

    // The alternate AST is honored: the GlideRecord constructor from the
    // supplied tree is proven even though context.sourceCode holds another
    // program.
    const alternate = analyzeProvenance(context, glideAst);
    assert.equal(alternate.ofExpression(glideDecl)?.kind, "GlideRecord");

    // The default analysis describes context.sourceCode and knows nothing
    // about foreign nodes.
    const standard = analyzeProvenance(context);
    assert.equal(standard.ofExpression(glideDecl), null);

    // Passing the context's own AST stays equivalent to omitting it.
    const same = analyzeProvenance(context, (context.sourceCode as { ast: ESTree.Node }).ast);
    const ownDecl = (context.sourceCode as unknown as { ast: { body: any[] } }).ast.body[0]
      .declarations[0].init as ESTree.Node;
    assert.equal(same.ofExpression(ownDecl), standard.ofExpression(ownDecl));
  });

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
