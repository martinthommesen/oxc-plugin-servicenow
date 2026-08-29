import { describe, it } from "node:test";
import { assertInvalid, assertValid } from "../helpers/rule-tester.js";

// Nested cursor loops must traverse in linear time. The do/while and for
// branches of both cursor walkers visit a loop body once per cursor mode;
// without the (node, cursor-state) memo the visits compose exponentially,
// so this depth would not complete within the suite timeout
// (FINDINGS.md PER-002).
function nestedDoWhile(depth: number, inner: string): string {
  let body = inner;
  for (let index = 0; index < depth; index += 1) {
    body = `do { ${body} } while (gr.next());`;
  }
  return `var gr = new GlideRecord('incident'); gr.query(); ${body}`;
}

describe("nested cursor-loop scaling (FINDINGS.md PER-002)", () => {
  it("completes a deeply nested do/while without exponential re-traversal", () => {
    assertValid(nestedDoWhile(24, "gs.info(1);"), "no-gliderecord-query-in-loop");
    assertValid(nestedDoWhile(24, "var x = String(gr.sys_id); arr.push(x);"), "no-glideelement-in-collection");
  });

  it("still reports a query inside the re-entered do/while body", () => {
    const inner = "var o = new GlideRecord('task'); o.addQuery('active', true); o.query();";
    assertInvalid(nestedDoWhile(12, inner), "no-gliderecord-query-in-loop");
  });

  it("still reports a retained element inside the re-entered do/while body", () => {
    assertInvalid(nestedDoWhile(12, "arr.push(gr.sys_id);"), "no-glideelement-in-collection");
  });
});
