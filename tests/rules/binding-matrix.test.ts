import { describe, it } from "node:test";
import { assertInvalid, assertValid } from "../helpers/rule-tester.js";
import { glideRecordBindingMatrix, STATEFUL_MATRIX_RULES } from "../helpers/binding-matrix.js";

describe("binding and control-flow matrix", () => {
  for (const rule of STATEFUL_MATRIX_RULES) {
    describe(rule, () => {
      for (const testCase of glideRecordBindingMatrix("next()")) {
        it(`${testCase.name} ${testCase.expect === "report" && rule === "require-query-before-next" ? "reports" : "stays silent"}`, () => {
          const options = {
            filename: testCase.filename ?? "incident.br.js",
            settings: testCase.settings,
          };
          if (testCase.expect === "report" && rule === "require-query-before-next") {
            assertInvalid(testCase.code, rule, { messageId: "missingQuery" }, options);
          } else {
            assertValid(testCase.code, rule, options);
          }
        });
      }
    });
  }
});
