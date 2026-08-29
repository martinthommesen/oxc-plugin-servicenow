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
});
