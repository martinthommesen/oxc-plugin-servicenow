import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lintReshaped, stripOffsets } from "../helpers/host-shapes.js";

// Analyzer de-duplication used to key findings on nodeStart(call), which
// returns -1 on an offset-free host and collapsed every finding in the file
// onto one key (FINDINGS.md COR-016).

describe("offset-free host nodes (FINDINGS.md COR-016)", () => {
  it("keeps one finding per violating node when nodes carry no offsets", () => {
    const code = [
      'var a = new GlideRecord("incident");',
      "a.next();",
      'var b = new GlideRecord("task");',
      "b.next();",
    ].join("\n");
    const messages = lintReshaped({
      code,
      filename: "src/server/test.js",
      rule: "require-query-before-next",
      reshape: stripOffsets,
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
    const messages = lintReshaped({
      code,
      filename: "incident.client.js",
      rule: "require-glideajax-sysparm-name",
      reshape: stripOffsets,
    });
    assert.equal(
      messages.length,
      2,
      `expected both requests to report, got:\n${messages.map((m) => `  - ${m.message}`).join("\n")}`,
    );
  });

  it("keeps chooseWindow alternatives distinct when nodes carry no offsets", () => {
    // The two query() results are distinct alternatives. Keying them on a node
    // offset collapsed both onto one key on an offset-free host and dropped a
    // finding, so the count must not depend on the offsets being present.
    const code = [
      'var a = new GlideRecord("incident");',
      "if (flag) {",
      "  a.chooseWindow(0, 10);",
      "  a.query();",
      "} else {",
      "  a.chooseWindow(0, 20);",
      "  a.query();",
      "}",
    ].join("\n");
    const shape = {
      code,
      filename: "incident.br.js",
      rule: "prefer-setnocount-with-choosewindow",
    } as const;
    const withOffsets = lintReshaped(shape);
    const withoutOffsets = lintReshaped({ ...shape, reshape: stripOffsets });
    assert.ok(withOffsets.length > 0, "expected the offset-carrying host to report");
    assert.equal(
      withoutOffsets.length,
      withOffsets.length,
      `expected the same count without offsets, got:\n${withoutOffsets.map((m) => `  - ${m.message}`).join("\n")}`,
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
    const messages = lintReshaped({
      code,
      filename: "incident.br.js",
      rule: "validate-glideaggregate-calls",
      reshape: stripOffsets,
    });
    assert.equal(
      messages.length,
      2,
      `expected both unqueried reads to report, got:\n${messages.map((m) => `  - ${m.message}`).join("\n")}`,
    );
  });
});
