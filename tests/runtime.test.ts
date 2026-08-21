import assert from "node:assert/strict";
import { it } from "node:test";
import { applyRules } from "../src/runtime/apply-rules.js";
import { parse } from "./helpers/rule-tester.js";

it("falls back to source comments when parsed comments are omitted", () => {
  const source = "// @sn-es-latest\nPromise.resolve(1);";
  const parsed = parse(source, "latest.server.js");
  assert.deepEqual(
    applyRules(source, { ast: parsed.ast }, {
      filename: "latest.server.js",
      ruleNames: ["no-promise"],
    }),
    [],
  );
});
