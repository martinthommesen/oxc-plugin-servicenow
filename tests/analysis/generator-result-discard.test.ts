import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lintWithAnalysis } from "../helpers/rule-tester.js";

function missingQueries(code: string, filename = "src/server/test.js"): number {
  const { messages, analysis } = lintWithAnalysis(code, "require-query-before-next", { filename });
  assert.equal(analysis.pathBudgetExhausted, false);
  assert.ok(messages.every((message) => message.messageId === "missingQuery"));
  return messages.length;
}

// @lat: [[tests#Analysis behavior#Discarded generator values keep bodies deferred]]
describe("discarded generator values", () => {
  const prefix = 'var gr = new GlideRecord("task"); var selector = false; selector &&= 0; ';

  for (const invocation of ["use()", "use``"]) {
    const definition = "function* use(value) { gr.query(); } ";
    for (const expression of [
      "CALL;",
      "(CALL);",
      "void CALL;",
      "void (void (CALL));",
      "(CALL, 0);",
      "(0, CALL);",
      "var value = (CALL, 0);",
      "void (external ? CALL : 0);",
      "external ? CALL : 0;",
      "void (external && CALL);",
      "external && CALL;",
      "CALL || 0;",
      "CALL ?? 0;",
    ]) {
      it(`preserves the later diagnostic when ${expression.replace("CALL", invocation)} discards the iterator`, () => {
        assert.equal(
          missingQueries(
            prefix + definition + expression.replace("CALL", invocation) + " gr.next();",
          ),
          1,
        );
      });
    }

    for (const expression of [
      "var iterator = CALL;",
      "var iterator = (0, CALL);",
      "external(CALL);",
      "var iterator; void (iterator = CALL);",
      "var iterator = external ? CALL : 0;",
      "var iterator = external && CALL;",
      "var iterator = CALL || 0;",
      "if (CALL) {}",
    ]) {
      it(`retains conservative captures when ${expression.replace("CALL", invocation)} consumes the iterator`, () => {
        assert.equal(
          missingQueries(
            prefix + definition + expression.replace("CALL", invocation) + " gr.next();",
          ),
          0,
        );
      });
    }

    const defaultParameters =
      invocation === "use()" ? "value = gr.next()" : "strings, value = gr.next()";
    it(`executes an immediate operation in a discarded ${invocation} default`, () => {
      assert.equal(
        missingQueries(
          prefix + `function* use(${defaultParameters}) { gr.query(); } void ${invocation};`,
        ),
        1,
      );
    });

    const queryParameters =
      invocation === "use()" ? "value = gr.query()" : "strings, value = gr.query()";
    it(`projects a query from a discarded ${invocation} default`, () => {
      assert.equal(
        missingQueries(
          prefix + `function* use(${queryParameters}) {} void ${invocation}; gr.next();`,
        ),
        0,
      );
    });

    const scalarParameters =
      invocation === "use()" ? "value = (run = true)" : "strings, value = (run = true)";
    it(`projects selector writes without exposing the deferred ${invocation} body`, () => {
      assert.equal(
        missingQueries(
          prefix +
            `var run = false; function* use(${scalarParameters}) { gr.query(); } void ${invocation}; run &&= gr.next();`,
        ),
        1,
      );
    });

    const throwParameters = invocation === "use()" ? "value = fail()" : "strings, value = fail()";
    it(`keeps throws from discarded ${invocation} parameters synchronous`, () => {
      assert.equal(
        missingQueries(
          prefix +
            `function fail() { throw 0; } function* use(${throwParameters}) { gr.query(); } try { void ${invocation}; gr.query(); } catch (error) {} gr.next();`,
        ),
        1,
      );
    });

    const orderedParameters =
      invocation === "use()"
        ? "first = (run = true), second = fail()"
        : "strings, first = (run = true), second = fail()";
    it(`keeps earlier parameter effects when discarded ${invocation} initialization throws`, () => {
      assert.equal(
        missingQueries(
          prefix +
            `var run = false; function fail() { throw 0; } function* use(${orderedParameters}) {} try { void ${invocation}; } catch (error) {} run &&= gr.next();`,
        ),
        1,
      );
    });

    for (const asyncPrefix of ["", "async "]) {
      it(`keeps the ${asyncPrefix || "ordinary "}${invocation} body deferred through void`, () => {
        assert.equal(
          missingQueries(
            prefix + `${asyncPrefix}function* use() { gr.query(); } void ${invocation}; gr.next();`,
          ),
          1,
        );
      });
    }

    for (const expression of [
      "void (CALL as unknown);",
      "void (CALL!);",
      "(CALL satisfies unknown, 0);",
    ]) {
      it(`follows transparent TypeScript wrappers in ${expression.replace("CALL", invocation)}`, () => {
        assert.equal(
          missingQueries(
            prefix + definition + expression.replace("CALL", invocation) + " gr.next();",
            "src/server/test.ts",
          ),
          1,
        );
      });
    }
  }
});
