import { ruleTester } from "../helpers/rule-tester.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSync } from "oxc-parser";
import { lint, assertValidActive } from "../helpers/rule-tester.js";
import { lintReshaped, stripOffsets, toRangeOnly } from "../helpers/host-shapes.js";
import {
  deepFluentAliasFixture,
  FLUENT_DIRECTIVE_PROOF_CASES,
  FLUENT_PROPERTY_PROOF_CASES,
  FLUENT_SCOPE_PROOF_CASES,
  FLUENT_WRITE_PROOF_CASES,
  type FluentProofCase,
} from "../helpers/fluent-proof-cases.js";

const FILENAME = "file.now.ts";

function offsetProofCases(cases: readonly FluentProofCase[]): void {
  for (const testCase of cases) {
    it(testCase.name, () => {
      assert.deepEqual(parseSync(FILENAME, testCase.code, { lang: "ts" }).errors, []);
      if (testCase.expected.length === 0) {
        assertValidActive(testCase.code, testCase.rule, { filename: FILENAME });
      }
      for (const reshape of [undefined, toRangeOnly]) {
        const messages = lintReshaped({
          code: testCase.code,
          filename: FILENAME,
          rule: testCase.rule,
          reshape,
        });
        assert.deepEqual(
          messages.map((message) => message.messageId),
          testCase.expected,
        );
      }
      const messages = lintReshaped({
        code: testCase.code,
        filename: FILENAME,
        rule: testCase.rule,
        reshape: stripOffsets,
      });
      assert.deepEqual(
        messages.map((message) => message.messageId),
        testCase.offsetFreeExpected,
      );
    });
  }
}

// @lat: [[tests#Analysis behavior#Fluent alias writes preserve execution order and invalidate unknown values]]
describe("Fluent alias write proof", () => {
  offsetProofCases(FLUENT_WRITE_PROOF_CASES);
});

// @lat: [[tests#Analysis behavior#Fluent properties require effective value proof]]
describe("Fluent effective property proof", () => {
  offsetProofCases(FLUENT_PROPERTY_PROOF_CASES);
});

// @lat: [[tests#Analysis behavior#Fluent directives attach to brace-free branches]]
describe("Fluent directive branch attachment", () => {
  for (const testCase of FLUENT_DIRECTIVE_PROOF_CASES) {
    it(testCase.name, () => {
      assert.deepEqual(parseSync(FILENAME, testCase.code, { lang: "ts" }).errors, []);
      for (const reshape of [undefined, toRangeOnly]) {
        const messages = lintReshaped({
          code: testCase.code,
          filename: FILENAME,
          rule: testCase.rule,
          reshape,
        });
        assert.deepEqual(
          messages.map((message) => message.messageId),
          testCase.expected,
        );
      }
    });
  }
});

describe("Fluent iterative origin traversal", () => {
  const { expectActive, expectInvalid } = ruleTester(
    "require-fluent-id",
    {},
    { messageId: "missing" },
  );

  // @lat: [[tests#Analysis behavior#Deep Fluent alias chains are stack safe]]
  it("resolves a finite 6000-alias chain without exhausting the host stack", () => {
    const code = deepFluentAliasFixture();
    assert.deepEqual(parseSync(FILENAME, code, { lang: "ts" }).errors, []);
    assert.deepEqual(
      lint(code, "require-fluent-id", { filename: FILENAME }).map((message) => message.messageId),
      ["missing"],
    );
  });

  it("keeps alias cycles conservative", () =>
    void expectActive(
      'import { BusinessRule } from "@servicenow/sdk/core";\nlet A = B; let B = A;\nA({ name: "x_test" });',
      { filename: FILENAME },
    ));

  it("retains namespace member identity through immutable aliases", () => {
    expectInvalid(
      'import * as sdk from "@servicenow/sdk/core";\nconst namespace = sdk; const factory = namespace.BusinessRule; const alias = factory;\nalias({ name: "x_test" });',
      undefined,
      { filename: FILENAME },
    );
    expectActive(
      'import * as sdk from "unrelated";\nconst namespace = sdk; const factory = namespace.BusinessRule; const alias = factory;\nalias({ name: "x_test" });',
      { filename: FILENAME },
    );
  });

  offsetProofCases(FLUENT_SCOPE_PROOF_CASES);
});
