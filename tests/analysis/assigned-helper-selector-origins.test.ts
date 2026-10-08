import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lintWithAnalysis } from "../helpers/rule-tester.js";
import { assertSubQuadratic } from "../helpers/scaling.js";

function cursorCalls(body: string, expected: number): void {
  const { messages, analysis } = lintWithAnalysis(
    `var gr = new GlideRecord("task"); ${body}`,
    "require-query-before-next",
  );
  assert.equal(analysis.pathBudgetExhausted, false);
  assert.equal(messages.length, expected);
}

function repeatedCalls(count: number): string {
  return `var use; use = function(flag) { flag &&= gr.next(); }; var disabled = false;
${Array.from({ length: count }, () => "use(disabled);").join("\n")}
gr.next();`;
}

// @lat: [[tests#Analysis behavior#Assigned helpers preserve every callable origin]]
describe("assigned helper selector origins", () => {
  for (const [name, body] of [
    ["function expression", "var use; use = function(flag) { flag &&= gr.next(); };"],
    ["arrow expression", "var use; use = (flag) => { flag &&= gr.next(); };"],
    ["named expression", "var use; use = function selected(flag) { flag &&= gr.next(); };"],
    ["default parameter", "var use; use = function(flag = true) { flag &&= gr.next(); };"],
    ["sequence result", "var use; use = (0, function(flag) { flag &&= gr.next(); });"],
    [
      "logical sequence result",
      "var use = false; use ||= (0, function(flag) { flag &&= gr.next(); });",
    ],
    [
      "conditional result",
      "var use; use = external ? function(first) { first &&= gr.next(); } : function(second) { second &&= gr.next(); };",
    ],
    ["logical result", "var use; use = external || function(flag) { flag &&= gr.next(); };"],
    [
      "nested logical assignment",
      "var slot = false; var use; use = (slot ||= function(flag) { flag &&= gr.next(); });",
    ],
  ] as const) {
    it(`skips a disabled right operand in an assigned ${name}`, () => {
      cursorCalls(`${body} var disabled = false; use(disabled); gr.next();`, 1);
    });
  }

  it("retains both successive assignment origins", () => {
    cursorCalls(
      "var use; var firstDisabled = false; var secondDisabled = false; use = function(unused, first) { first &&= gr.next(); }; use(external, firstDisabled); use = function(second, unused) { second &&= gr.next(); }; use(secondDisabled, external); gr.next();",
      1,
    );
  });

  it("retains an initializer and its later assignment origin", () => {
    cursorCalls(
      "var use = function(unused, first) { first &&= gr.next(); }; var firstDisabled = false; var secondDisabled = false; use(external, firstDisabled); use = function(second, unused) { second &&= gr.next(); }; use(secondDisabled, external); gr.next();",
      1,
    );
  });

  it("retains both branch assignment origins", () => {
    cursorCalls(
      "var use; if (external) use = function(first) { first &&= gr.next(); }; else use = function(second) { second &&= gr.next(); }; var disabled = false; use(disabled); gr.next();",
      1,
    );
  });

  it("propagates an assigned function through an alias", () => {
    cursorCalls(
      "var use; use = function(flag) { flag &&= gr.next(); }; var alias = use; var disabled = false; alias(disabled); gr.next();",
      1,
    );
  });

  for (const argument of ["true", "external"]) {
    it(`retains the reachable right operand for ${argument}`, () => {
      cursorCalls(
        `var use; use = function(flag) { flag &&= gr.next(); }; var enabled = ${argument}; use(enabled);`,
        1,
      );
    });
  }

  it("keeps repeated calls through an assigned helper within budget", () => {
    cursorCalls(repeatedCalls(500), 1);
  });

  it("stays subquadratic when assigned-helper calls quadruple", () => {
    const small = repeatedCalls(125);
    const large = repeatedCalls(500);
    assertSubQuadratic({
      label: "assigned helper selector calls",
      smallLabel: "125 calls",
      largeLabel: "500 calls",
      small: () => cursorCalls(small, 1),
      large: () => cursorCalls(large, 1),
    });
  });
});
