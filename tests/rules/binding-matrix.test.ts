import { describe, it } from "node:test";
import { assertValid } from "../helpers/rule-tester.js";
import { glideRecordBindingMatrix, STATEFUL_MATRIX_RULES } from "../helpers/binding-matrix.js";

describe("binding and control-flow matrix", () => {
  for (const rule of STATEFUL_MATRIX_RULES) {
    describe(rule, () => {
      for (const testCase of glideRecordBindingMatrix("next()")) {
        it(`${testCase.name} stays silent`, () => {
          assertValid(testCase.code, rule, {
            filename: testCase.filename ?? "incident.br.js",
            settings: testCase.settings,
          });
        });
      }
    });
  }
});
