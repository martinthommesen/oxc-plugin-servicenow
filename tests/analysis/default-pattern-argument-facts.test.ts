import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lintWithAnalysis } from "../helpers/rule-tester.js";

// @lat: [[tests#Analysis behavior#Known default patterns preserve argument facts]]
describe("known default pattern argument facts", () => {
  for (const route of ["Call", "generator Call", "generator Tag"] as const) {
    for (const pattern of ["{value}", "[value]"]) {
      for (const value of ["null", "void 0"]) {
        for (const alias of [false, true]) {
          it(`${route} ${alias ? "aliased" : "literal"} ${value} skips only inapplicable ${pattern} defaults`, () => {
            const argument = alias ? "input" : value;
            const declaration = alias ? `var input = ${value};` : "";
            const generator = route === "Call" ? "" : "*";
            const strings = route === "generator Tag" ? "strings, " : "";
            const invocation =
              route === "generator Tag" ? `use\`value\${${argument}}\`;` : `use(${argument});`;
            const { messages, analysis } = lintWithAnalysis(
              `var gr = new GlideRecord("task"); var selector = false; selector &&= true;
${declaration} function${generator} use(${strings}${pattern} = gr.next()) {}
try { ${invocation} } catch (error) {} gr.next();`,
              "require-query-before-next",
            );
            assert.equal(analysis.pathBudgetExhausted, false);
            assert.equal(messages.length, value === "null" ? 1 : 2);
          });
        }
      }
    }
  }

  for (const route of ["Call", "generator Tag"] as const) {
    for (const expression of [
      "(0, input)",
      "true ? input : void 0",
      "false || input",
      "false ?? input",
    ]) {
      it(`${route} preserves the selected argument from ${expression}`, () => {
        const generator = route === "Call" ? "" : "*";
        const strings = route === "generator Tag" ? "strings, " : "";
        const invocation =
          route === "generator Tag" ? `use\`value\${${expression}}\`;` : `use(${expression});`;
        const { messages, analysis } = lintWithAnalysis(
          `var gr = new GlideRecord("task"); var selector = false; selector &&= true; var input = null;
function${generator} use(${strings}{value} = gr.next()) {}
try { ${invocation} } catch (error) {} gr.next();`,
          "require-query-before-next",
        );
        assert.equal(analysis.pathBudgetExhausted, false);
        assert.equal(messages.length, 1);
      });
    }
  }
});
