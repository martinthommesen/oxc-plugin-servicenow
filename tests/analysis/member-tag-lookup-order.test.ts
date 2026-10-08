import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lintWithAnalysis } from "../helpers/rule-tester.js";

function missingQueries(code: string, expected: number): void {
  const { messages, analysis } = lintWithAnalysis(code, "require-query-before-next");
  assert.equal(analysis.pathBudgetExhausted, false);
  assert.ok(messages.every((message) => message.messageId === "missingQuery"));
  assert.equal(messages.length, expected);
}

// @lat: [[tests#Analysis behavior#Member template tag lookup preserves receiver and key effects]]
describe("member template tag lookup ordering", () => {
  const prefix = 'var gr = new GlideRecord("task"); var run = false; run ||= false; var alias; ';
  const suffix = "alias.next();";
  const cases = [
    [
      "receiver effects before a lookup catch",
      "try { (alias = gr, external).tag``; } catch (error) {} ",
      1,
    ],
    [
      "computed key effects before a lookup catch",
      'var obj = {}; try { obj[(alias = gr, "tag")]``; } catch (error) {} ',
      1,
    ],
    [
      "receiver assignment before a lookup catch",
      "var obj = {}; try { (alias = gr, obj).tag``; } catch (error) {} ",
      1,
    ],
    ["receiver effects without a catch", "(alias = gr, external).tag``; ", 1],
    ["computed key effects without a catch", 'var obj = {}; obj[(alias = gr, "tag")]``; ', 1],
    [
      "substitutions after a possible member lookup throw",
      "var obj = {}; try { obj.tag`${(alias = gr, 0)}`; } catch (error) {} ",
      0,
    ],
    [
      "getter lookup after computed key effects",
      'var obj = { get tag() { throw 0; } }; try { obj[(alias = gr, "tag")]``; } catch (error) {} ',
      1,
    ],
    [
      "proxy lookup after computed key effects",
      'var obj = new Proxy({}, { get() { throw 0; } }); try { obj[(alias = gr, "tag")]``; } catch (error) {} ',
      1,
    ],
    [
      "throwing receiver before computed key and substitutions",
      'function fail() { throw 0; } try { fail()[(alias = gr, "tag")]`${(alias = gr, 0)}`; } catch (error) {} ',
      0,
    ],
    [
      "completed receiver effects before a later receiver throw",
      'function fail() { throw 0; } try { (alias = gr, fail())["tag"]``; } catch (error) {} ',
      1,
    ],
    [
      "completed key effects before a later key throw",
      'var obj = {}; function fail() { throw 0; } try { obj[(alias = gr, fail())]`${(alias = new GlideRecord("incident"), 0)}`; } catch (error) {} ',
      1,
    ],
    [
      "passed record substitution retains existing escape policy",
      "var obj = {}; try { obj.tag`${alias = gr}`; } catch (error) {} ",
      0,
    ],
  ] as const;
  for (const [name, expression, expected] of cases) {
    it(name, () => {
      missingQueries(prefix + expression + suffix, expected);
    });
  }
  for (const [name, expression] of [
    ["receiver", "try { (alias = gr, external).tag``; } catch (error) {} "],
    ["computed key", 'var obj = {}; try { obj[(alias = gr, "tag")]``; } catch (error) {} '],
  ] as const) {
    it(`retains ${name} effects without logical assignment selectors`, () => {
      missingQueries('var gr = new GlideRecord("task"); var alias; ' + expression + suffix, 1);
    });
  }
});
