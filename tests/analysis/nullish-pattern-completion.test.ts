import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lintWithAnalysis } from "../helpers/rule-tester.js";

function unfilteredOperations(code: string): number {
  const { messages, analysis } = lintWithAnalysis(
    `var records = new GlideRecord("task"); ${code}`,
    "no-unfiltered-gliderecord-bulk-operation",
  );
  assert.equal(analysis.pathBudgetExhausted, false);
  assert.ok(messages.every((message) => message.messageId === "unfiltered"));
  return messages.length;
}

// @lat: [[tests#Analysis behavior#Nullish parameter patterns stop invocation before later effects]]
describe("nullish parameter pattern completion", () => {
  for (const route of ["Call", "generator Call", "New", "generator Tag"] as const) {
    for (const pattern of ["{value}", "[value]", "{}", "[]"]) {
      for (const argument of ["null", "void 0"]) {
        it(`${route} throws binding ${pattern} from ${argument} before later defaults`, () => {
          const generator = route === "generator Call" || route === "generator Tag" ? "*" : "";
          const strings = route === "generator Tag" ? "strings, " : "";
          const invocation =
            route === "generator Tag"
              ? `void use\`value\${${argument}}\`;`
              : `${route === "New" ? "new " : route === "generator Call" ? "void " : ""}use(${argument});`;
          assert.equal(
            unfilteredOperations(
              `function${generator} use(${strings}${pattern}, later = records.deleteMultiple()) {
                records.deleteMultiple();
              } try { ${invocation} } catch (error) {}`,
            ),
            0,
          );
        });
      }
    }
  }

  for (const [pattern, argument] of [
    ["{value: {nested}}", "{value: null}"],
    ["{value: {nested}}", "{value: void 0}"],
    ["[[nested]]", "[null]"],
    ["[[nested]]", "[void 0]"],
    ["{value: {nested} = null}", "{}"],
    ["[{nested} = void 0]", "[]"],
  ]) {
    it(`stops a nested ${pattern} binding from ${argument}`, () => {
      assert.equal(
        unfilteredOperations(
          `function use(${pattern}, later = records.deleteMultiple()) {}
          try { use(${argument}); } catch (error) {}`,
        ),
        0,
      );
    });
  }

  it("throws before a computed pattern key executes", () => {
    assert.equal(
      unfilteredOperations(
        `function use({[records.deleteMultiple()]: value}) {}
        try { use(null); } catch (error) {}`,
      ),
      0,
    );
  });

  it("keeps the null argument saved before a later argument replaces its binding", () => {
    assert.equal(
      unfilteredOperations(
        `var input = null; input ??= null;
        function use({value}, replacement, later = records.deleteMultiple()) {}
        try { use(input, input = {}); } catch (error) {}`,
      ),
      0,
    );
  });

  it("retains already completed argument effects before binding throws", () => {
    assert.equal(
      unfilteredOperations(
        `function use({value}, input, later = records.deleteMultiple()) {}
        try { use(null, records.deleteMultiple()); } catch (error) {}`,
      ),
      1,
    );
  });

  it("continues through catch after binding throws", () => {
    assert.equal(
      unfilteredOperations(
        `function use({value}, later = records.deleteMultiple()) {}
        try { use(null); } catch (error) { records.deleteMultiple(); }`,
      ),
      1,
    );
  });

  it("skips the body and mapped arguments writes after binding throws", () => {
    assert.equal(
      unfilteredOperations(
        `function use({value}, run = records.deleteMultiple()) {
          arguments[1] = true; run &&= records.deleteMultiple();
        } try { use(null); } catch (error) {}`,
      ),
      0,
    );
  });

  it("skips an outer default for null and then throws binding its pattern", () => {
    assert.equal(
      unfilteredOperations(
        `function use({value} = records.deleteMultiple(), later = records.deleteMultiple()) {}
        try { use(null); } catch (error) {}`,
      ),
      0,
    );
  });

  it("throws when an executed outer default produces null", () => {
    assert.equal(
      unfilteredOperations(
        `function use({value} = null, later = records.deleteMultiple()) {}
        try { use(void 0); } catch (error) {}`,
      ),
      0,
    );
  });

  it("stops binding after joined definite null and undefined arguments", () => {
    assert.equal(
      unfilteredOperations(
        `var input; if (external) { input = null; } else { input = void 0; }
        input &&= null; function use({value}, later = records.deleteMultiple()) {}
        try { use(input); } catch (error) {}`,
      ),
      0,
    );
  });

  it("retains the normal default path when a joined nullish argument may be undefined", () => {
    assert.equal(
      unfilteredOperations(
        `var input; if (external) { input = null; } else { input = void 0; }
        input &&= null; function use({value} = {}, later = records.deleteMultiple()) {}
        try { use(input); } catch (error) {}`,
      ),
      1,
    );
  });

  for (const [parameters, argumentsText, want] of [
    ["value = records.deleteMultiple()", "null", 0],
    ["{value} = {}", "void 0", 1],
    ["[value] = []", "void 0", 1],
    ["{value}", "{}", 1],
    ["[value]", "[]", 1],
    ["...values", "null", 1],
    ["...[value]", "null", 1],
    ["{value}", "input", 1],
  ] as const) {
    it(`preserves normal binding of ${parameters} with ${argumentsText}`, () => {
      assert.equal(
        unfilteredOperations(
          `var input = external; function use(${parameters}) {
            ${want === 0 ? "" : "records.deleteMultiple();"}
          } use(${argumentsText});`,
        ),
        want,
      );
    });
  }
});
