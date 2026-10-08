import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lintWithAnalysis } from "../helpers/rule-tester.js";

function findings(code: string, expected: number): void {
  const { messages, analysis } = lintWithAnalysis(code, "no-unfiltered-gliderecord-bulk-operation");
  assert.equal(analysis.pathBudgetExhausted, false);
  assert.ok(messages.every((message) => message.messageId === "unfiltered"));
  assert.equal(messages.length, expected);
}

const conditionalBulk = 'function use(flag) { flag &&= new GlideRecord("task").deleteMultiple(); }';

// @lat: [[tests#Analysis behavior#Opaque helper invocations retain isolated inspection]]
describe("opaque helper inspection eligibility", () => {
  it("retains a body reached by call after a disabled direct invocation", () => {
    findings(`${conditionalBulk} use(false); use.call(null, true);`, 1);
  });
  it("retains a callback exposed after a disabled direct invocation", () => {
    findings(`${conditionalBulk} use(false); external(use);`, 1);
  });

  for (const [name, effect] of [
    ["call before direct", "use.call(null, true); use(false);"],
    ["apply after direct", "use(false); use.apply(null, [true]);"],
    ["apply before direct", "use.apply(null, [true]); use(false);"],
    ["tag after direct", "use(false); use``;"],
    ["tag before direct", "use``; use(false);"],
    ["exposure before direct", "external(use); use(false);"],
    ["call alias", "use(false); var alias = use; alias.call(null, true);"],
    ["tag alias", "use(false); var alias = use; alias``;"],
    [
      "exposed wrapper",
      "use(false); function wrapper(flag) { use(flag); } wrapper(false); external(wrapper);",
    ],
    ["standalone call", "use.call(null, true);"],
    ["standalone tag", "use``;"],
    // Function methods keep the existing opaque argument policy.
    ["opaque false call arguments", "use(false); use.call(null, false);"],
  ] as const) {
    it(`retains isolated body eligibility for ${name}`, () => {
      findings(`${conditionalBulk} ${effect}`, 1);
    });
  }

  for (const [name, effect] of [
    ["known false invocation", "use(false);"],
    ["repeated known false invocations", "use(false); use(false);"],
    ["skipped call", "use(false); if (false) use.call(null, true);"],
    ["skipped tag", "use(false); if (false) use``;"],
    ["skipped exposure", "use(false); if (false) external(use);"],
    [
      "throwing call argument",
      "use(false); function fail() { throw 0; } try { use.call(null, fail()); } catch {}",
    ],
    [
      "throwing tag substitution",
      "use(false); function fail() { throw 0; } try { use`${fail()}`; } catch {}",
    ],
    [
      "throwing exposure argument",
      "use(false); function fail() { throw 0; } try { external(fail(), use); } catch {}",
    ],
    [
      "disabled exposed wrapper",
      "use(false); function wrapper() { use(false); } wrapper(); external(wrapper);",
    ],
    ["replaced safe callback", "use(false); use = function() {}; external(use);"],
  ] as const) {
    it(`preserves the quiet ${name}`, () => {
      findings(`${conditionalBulk} ${effect}`, 0);
    });
  }

  it("preserves false facts established inside an opaquely invoked body", () => {
    findings(
      'function use(flag) { flag = false; flag &&= new GlideRecord("task").deleteMultiple(); } use(false); use``;',
      0,
    );
  });

  for (const declaration of ["function*", "async function*"]) {
    for (const invocation of ["use(true)", "use``"]) {
      it(`keeps a retained ${declaration} value from ${invocation} under the existing deferred-body policy`, () => {
        findings(
          `${declaration} use(flag) { flag &&= new GlideRecord("task").deleteMultiple(); } use(false); var iterator = ${invocation};`,
          0,
        );
      });
    }
  }

  it("keeps a supplied generator parameter from inventing a skipped default", () => {
    findings(
      'function* use(value = new GlideRecord("task").deleteMultiple()) {} var iterator = use(null);',
      0,
    );
  });

  it("keeps an active generator tag default from inspecting an unexecuted body", () => {
    findings(
      'function* use(value = use``) { new GlideRecord("task").deleteMultiple(); } var iterator = use();',
      0,
    );
  });

  it("retains inspection when the actual generator function escapes to unknown code", () => {
    findings(
      'function* use(flag) { flag &&= new GlideRecord("task").deleteMultiple(); } use(false); external(use);',
      1,
    );
  });

  it("does not enqueue five hundred exposed empty zero-parameter bodies", () => {
    findings(
      Array.from(
        { length: 500 },
        (_, index) => `function empty${index}() {} external(empty${index});`,
      ).join(" ") + 'var records = new GlideRecord("task"); records.deleteMultiple();',
      1,
    );
  });
});
