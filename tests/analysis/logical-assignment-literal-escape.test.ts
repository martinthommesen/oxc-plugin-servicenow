import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lintWithAnalysis } from "../helpers/rule-tester.js";

function missingQueries(body: string): number {
  const { messages, analysis } = lintWithAnalysis(
    `var gr = new GlideRecord("task"); ${body}`,
    "require-query-before-next",
  );
  assert.equal(analysis.pathBudgetExhausted, false);
  assert.ok(messages.every((message) => message.messageId === "missingQuery"));
  return messages.length;
}

// @lat: [[tests#Analysis behavior#Selected logical assignment literals escape constructed payloads]]
describe("logical assignment literal escape", () => {
  for (const literal of ["[gr]", "{ record: gr }", "[{ cb: function () { gr.query(); } }]"]) {
    for (const [operator, selected, skipped] of [
      ["||=", "false", "true"],
      ["&&=", "true", "false"],
      ["??=", "null", "false"],
    ] as const) {
      for (const [initial, expected] of [
        [selected, 0],
        [skipped, 1],
      ] as const) {
        it(`retains the payload escape for ${initial} ${operator} ${literal}`, () => {
          assert.equal(
            missingQueries(
              `function expose() { var selector = ${initial}; return (selector ${operator} ${literal}); } expose(); gr.next();`,
            ),
            expected,
          );
        });
      }
    }
  }
  for (const literal of ["[gr]", "{ record: gr }"]) {
    it(`escapes the constructed thrown payload ${literal}`, () => {
      assert.equal(
        missingQueries(
          `function expose() { var selector = false; throw (selector ||= ${literal}); } try { expose(); } catch (error) {} gr.next();`,
        ),
        0,
      );
    });
  }
});
