import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lint } from "../helpers/rule-tester.js";
import { BINDING_MATRIX_CASES, STATEFUL_MATRIX_RULES } from "../helpers/binding-matrix.js";

describe("rule-specific binding and lifecycle matrix", () => {
  for (const rule of STATEFUL_MATRIX_RULES) {
    const cases = BINDING_MATRIX_CASES.filter((testCase) => testCase.rule === rule);
    it(`${rule} has direct reporting and adjacent silent cases`, () => {
      assert.ok(cases.some((testCase) => testCase.expected === "report"));
      assert.ok(cases.some((testCase) => testCase.expected === "silent"));
    });
    for (const testCase of cases) {
      it(`${testCase.id}: ${testCase.expected}`, () => {
        const messages = lint(testCase.code, testCase.rule, {
          filename: testCase.filename,
          settings: testCase.settings,
        });
        if (testCase.expected === "silent") {
          assert.deepEqual(messages, []);
          return;
        }
        assert.equal(messages.length, 1);
        const message = messages[0];
        assert.equal(message?.messageId, testCase.messageId);
        assert.equal(message?.message, testCase.message);
        assert.deepEqual({ line: message?.line, column: message?.column }, testCase.start);
        assert.deepEqual({ line: message?.endLine, column: message?.endColumn }, testCase.end);
      });
    }
  }
});
