import assert from "node:assert/strict";
import { it } from "node:test";
import { applyRules } from "../src/runtime/apply-rules.js";
import { parse } from "./helpers/rule-tester.js";

it("falls back to source comments when parsed comments are omitted", () => {
  const source =
    'import { Record } from "@servicenow/sdk/core";\n' +
    "// @fluent-disable-sync-for-file\n" +
    'Record({ $id: Now.ID["x"], table: "incident", data: {} });\n';
  const parsed = parse(source, "table.now.ts");
  const messages = applyRules(
    source,
    { ast: parsed.ast },
    {
      filename: "table.now.ts",
      ruleNames: ["fluent-directives"],
    },
  );
  assert.equal(messages.length, 1);
  assert.equal(messages[0]?.messageId, "firstLine");
});
