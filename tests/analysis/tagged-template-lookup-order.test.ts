import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lintWithAnalysis } from "../helpers/rule-tester.js";

function missingQueries(code: string): number {
  const { messages, analysis } = lintWithAnalysis(code, "require-query-before-next");
  assert.equal(analysis.pathBudgetExhausted, false);
  assert.ok(messages.every((message) => message.messageId === "missingQuery"));
  return messages.length;
}

// @lat: [[tests#Analysis behavior#Proven template tag lookups retain substitution effects on catches]]
describe("tagged template lookup and invocation throws", () => {
  const prefix = 'var gr = new GlideRecord("task"); var run = false; run ||= false; var alias; ';
  const suffix = "alias.next();";

  it("retains alias effects before a proven local tag can throw on invocation", () => {
    assert.equal(
      missingQueries(
        prefix + "function tag() {} try { tag`${(alias = gr, 0)}`; } catch (error) {} " + suffix,
      ),
      1,
    );
  });

  it("retains substitution effects for a parenthesized function literal tag", () => {
    assert.equal(
      missingQueries(
        prefix + "try { (function () {})`${(alias = gr, 0)}`; } catch (error) {} " + suffix,
      ),
      1,
    );
  });

  it("retains alias effects before a known generator initializes parameters", () => {
    assert.equal(
      missingQueries(
        prefix +
          "function* tag(strings = 0) {} try { tag`${(alias = gr, 0)}`; } catch (error) {} " +
          suffix,
      ),
      1,
    );
  });

  it("saves the selected tag before a substitution replaces its binding", () => {
    assert.equal(
      missingQueries(
        prefix +
          "var tag = function () {}; try { tag`${(alias = gr, tag = function () { gr.query(); }, 0)}`; } catch (error) {} " +
          suffix,
      ),
      1,
    );
  });

  it("keeps uncertain identifier lookups able to throw before substitutions", () => {
    assert.equal(
      missingQueries(prefix + "try { external`${(alias = gr, 0)}`; } catch (error) {} " + suffix),
      0,
    );
  });

  it("keeps member lookup throws before substitutions", () => {
    assert.equal(
      missingQueries(
        prefix +
          "function tag() {} try { tag.call`${(alias = gr, 0)}`; } catch (error) {} " +
          suffix,
      ),
      0,
    );
  });

  it("keeps passed record values subject to the existing argument escape policy", () => {
    assert.equal(
      missingQueries(
        prefix + "function tag() {} try { tag`${alias = gr}`; } catch (error) {} " + suffix,
      ),
      0,
    );
  });
});
