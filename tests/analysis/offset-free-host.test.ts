import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyRules } from "../../src/runtime/apply-rules.js";
import { parse } from "../helpers/rule-tester.js";

// Strips every offset shape nodeStart() understands while keeping `loc`, so
// the AST models a host adapter that supplies no byte offsets. Analyzer
// de-duplication used to key findings on nodeStart(call), which returns -1
// for such nodes and collapsed every finding in the file onto one key
// (FINDINGS.md COR-016).
function stripOffsets(value: unknown, seen = new Set<object>()): void {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) stripOffsets(item, seen);
    return;
  }
  const record = value as Record<string, unknown>;
  delete record.start;
  delete record.end;
  delete record.range;
  delete record.span;
  for (const key of Object.keys(record)) {
    if (key === "loc") continue;
    stripOffsets(record[key], seen);
  }
}

describe("offset-free host nodes (FINDINGS.md COR-016)", () => {
  it("keeps one finding per violating node when nodes carry no offsets", () => {
    const code = [
      'var a = new GlideRecord("incident");',
      "a.next();",
      'var b = new GlideRecord("task");',
      "b.next();",
    ].join("\n");
    const filename = "src/server/test.js";
    const parsed = parse(code, filename);
    stripOffsets(parsed.ast);
    const messages = applyRules(code, parsed, {
      filename,
      ruleNames: ["require-query-before-next"],
    });
    assert.equal(
      messages.length,
      2,
      `expected both cursor advances to report, got:\n${messages.map((m) => `  - ${m.message}`).join("\n")}`,
    );
  });

  it("keeps one GlideAjax finding per request when nodes carry no offsets", () => {
    const code = [
      'var a = new GlideAjax("x_acme.A");',
      "a.getXMLAnswer(handleA);",
      'var b = new GlideAjax("x_acme.B");',
      "b.getXMLAnswer(handleB);",
    ].join("\n");
    const filename = "incident.client.js";
    const parsed = parse(code, filename);
    stripOffsets(parsed.ast);
    const messages = applyRules(code, parsed, {
      filename,
      ruleNames: ["require-glideajax-sysparm-name"],
    });
    assert.equal(
      messages.length,
      2,
      `expected both requests to report, got:\n${messages.map((m) => `  - ${m.message}`).join("\n")}`,
    );
  });

  it("keeps one GlideAggregate finding per read when nodes carry no offsets", () => {
    const code = [
      'var count = new GlideAggregate("incident");',
      'count.addAggregate("COUNT");',
      "if (count.next()) {",
      '  gs.info(count.getAggregate("COUNT"));',
      "}",
    ].join("\n");
    const filename = "incident.br.js";
    const parsed = parse(code, filename);
    stripOffsets(parsed.ast);
    const messages = applyRules(code, parsed, {
      filename,
      ruleNames: ["validate-glideaggregate-calls"],
    });
    assert.equal(
      messages.length,
      2,
      `expected both unqueried reads to report, got:\n${messages.map((m) => `  - ${m.message}`).join("\n")}`,
    );
  });
});
