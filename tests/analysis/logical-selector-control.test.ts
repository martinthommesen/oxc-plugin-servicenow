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

// @lat: [[tests#Analysis behavior#Evaluated logical selectors choose reachable control flow]]
describe("evaluated logical selector control flow", () => {
  for (const [name, body, expected] of [
    ["false if arm", "var flag=false; if(flag &&= true){gr.next();}", 0],
    ["true if arm", "var flag=false; if(flag ||= true){gr.next();}", 1],
    ["false alternate arm", "var flag=false; if(flag &&= true){} else{gr.next();}", 1],
    ["false conditional arm", "var flag=false; (flag &&= true) ? gr.next() : 0;", 0],
    ["true conditional arm", "var flag=null; (flag ??= true) ? gr.next() : 0;", 1],
    ["false logical and arm", "var flag=false; (flag &&= true) && gr.next();", 0],
    ["true logical or arm", "var flag=true; (flag ||= false) || gr.next();", 0],
    ["nonnull logical nullish arm", "var flag=0; (flag ??= null) ?? gr.next();", 0],
    ["nullish selected value", "var flag=true; (flag &&= null) ?? gr.next();", 1],
    ["nested logical selector", "var flag=false; ((flag &&= true) || false) && gr.next();", 0],
    ["sequence selector", "var flag=false; if((0, flag &&= true)){gr.next();}", 0],
    ["selector effects", "var flag=false; if((gr.query(), flag &&= true)){} gr.next();", 0],
    [
      "selected alternate effects",
      "var flag=false; (flag &&= true) ? 0 : gr.query(); gr.next();",
      0,
    ],
    ["skipped body preserves identity", "var flag=false; if(flag &&= true){gr={};} gr.next();", 1],
    ["unknown if selector", "var flag=external; if(flag &&= true){gr.next();}", 1],
    ["unknown logical selector", "var flag=external; (flag &&= true) && gr.next();", 1],
    ["false while header", "var flag=false; while(flag &&= true){gr.next();} gr.next();", 1],
    ["false for header", "var flag=false; for(;flag &&= true;gr.next()){gr.next();} gr.next();", 1],
    [
      "do while false backedge",
      "var flag=false; do{gr.next();gr.query();}while(flag &&= true); gr.next();",
      1,
    ],
    [
      "evaluated false backedge",
      "var flag=true; while(flag &&= true){gr.next();gr.query();flag=false;} gr.next();",
      1,
    ],
    [
      "header effects before skipped loop",
      "var flag=false; while((gr.query(),flag &&= true)){gr.next();} gr.next();",
      0,
    ],
    [
      "update effects before false backedge",
      "var flag=true; for(;flag &&= true;flag &&= false){gr.next();gr.query();} gr.next();",
      1,
    ],
    [
      "true loop with false backedge",
      "var flag=false; while(flag ||= true){gr.next(); flag=true; break;} gr.next();",
      2,
    ],
    ["unknown loop selector", "var flag=external; while(flag &&= true){gr.next();break;}", 1],
    [
      "discarded initializer",
      "var flag=false; for(flag &&= true;false;){gr.next();} gr.next();",
      1,
    ],
    ["ordinary identifier stays conservative", "var flag=false; if(flag){gr.next();}", 1],
    [
      "abrupt selected branch",
      "var flag=false; function stop(){throw 0;} try{if(flag ||= stop()){gr.next();}}catch(error){gr.next();}",
      1,
    ],
    [
      "abrupt selected loop header",
      "var flag=false; function stop(){throw 0;} try{while(flag ||= stop()){gr.next();}}catch(error){gr.next();}",
      1,
    ],
    [
      "correlated argument selectors",
      "function inspect(flag){if(flag &&= true){gr.query();} gr.next();} inspect(external ? true : false);",
      1,
    ],
  ] as const) {
    it(name, () => assert.equal(missingQueries(body), expected));
  }

  for (const [name, body, expected] of [
    [
      "skipped await preserves following execution",
      "var flag=false; if(flag &&= await later()){gr.query();} gr.query();",
      1,
    ],
    [
      "evaluated await suspends following execution",
      "var flag=true; if(flag &&= await later()){gr.query();} gr.query();",
      0,
    ],
    [
      "unknown await retains normal execution",
      "var flag=external; if(flag &&= await later()){} gr.query();",
      1,
    ],
  ] as const) {
    it(name, () => {
      const { messages, analysis } = lintWithAnalysis(
        `var gr=new GlideRecord("task"); async function inspect(){${body}} inspect();`,
        "no-gliderecord-query-in-acl",
        { filename: "task.acl.js" },
      );
      assert.equal(analysis.pathBudgetExhausted, false);
      assert.equal(messages.length, expected);
    });
  }
});
