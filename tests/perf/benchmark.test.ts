import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyRules } from "../../src/runtime/apply-rules.js";
import { parse } from "../helpers/rule-tester.js";

function repeatScript(count: number): string {
  const block = `var rec${count} = new GlideRecord("incident");
rec${count}.addQuery("active", true);
rec${count}.query();
while (rec${count}.next()) {
  gs.info(rec${count}.getValue("number"));
}
`;
  return Array.from({ length: count }, (_, index) => block.replaceAll(String(count), String(index))).join("\n");
}

describe("rule performance", () => {
  it("analyzes a large GlideRecord file in under two seconds", () => {
    const code = repeatScript(80);
    const filename = "load.br.js";
    const parsed = parse(code, filename);
    const started = Date.now();
    const messages = applyRules(code, parsed, { filename });
    const elapsed = Date.now() - started;
    assert.ok(elapsed < 2000, `applyRules took ${elapsed}ms`);
    assert.equal(messages.filter((message) => message.ruleId.includes("no-unfiltered")).length, 0);
  });
});
