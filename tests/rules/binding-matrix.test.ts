import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertInvalid, assertValid } from "../helpers/rule-tester.js";
import { BINDING_MATRIX_CASES, STATEFUL_MATRIX_RULES } from "../helpers/binding-matrix.js";

// @lat: [[tests#Silence on unknown facts#Identity decisions follow the binding matrix]]
describe("rule-specific binding and lifecycle matrix", () => {
  for (const rule of STATEFUL_MATRIX_RULES) {
    const cases = BINDING_MATRIX_CASES.filter((testCase) => testCase.rule === rule);
    it(`${rule} has direct reporting and adjacent silent cases`, () => {
      assert.ok(cases.some((testCase) => testCase.expected === "report"));
      assert.ok(cases.some((testCase) => testCase.expected === "silent"));
    });
    for (const testCase of cases) {
      it(`${testCase.id}: ${testCase.expected}`, () => {
        const options = { filename: testCase.filename, settings: testCase.settings };
        if (testCase.expected === "silent") {
          assertValid(testCase.code, testCase.rule, options);
          return;
        }
        const [message] = assertInvalid(
          testCase.code,
          testCase.rule,
          {
            messageId: testCase.messageId,
            count: 1,
            range: {
              line: testCase.start.line,
              column: testCase.start.column,
              endLine: testCase.end.line,
              endColumn: testCase.end.column,
            },
          },
          options,
        );
        assert.equal(message?.message, testCase.message);
      });
    }
  }
});
