import { describe, it } from "node:test";
import { assertInvalid, assertValid } from "../helpers/rule-tester.js";

const SERVER = { filename: "incident.br.js" };
const CLIENT = { filename: "incident.client.js" };
const FULL_SCRIPT = {
  filename: "incident.br.js",
  settings: { businessRuleSourceFormat: "full-script" as const },
};

describe("Layer 3 platform aliases and wrappers", () => {
  it("tracks proven current and gs aliases without matching shadowed parameters", () => {
    assertInvalid(
      `var record = current;
record.update();`,
      "no-br-current-update",
      { messageId: "update" },
      SERVER,
    );
    assertValid(
      `function save(current) {
  current.update();
}`,
      "no-br-current-update",
      SERVER,
    );
    assertInvalid(
      `var service = gs;
service.now();`,
      "no-gs-now",
      { messageId: "server" },
      SERVER,
    );
    assertValid(
      `function read(gs) {
  gs.now();
}`,
      "no-gs-now",
      SERVER,
    );
  });

  it("accepts a directive prologue before the canonical wrapper", () => {
    assertValid(
      `"use strict";
(function executeRule(current, previous) {
  current.short_description = "ok";
})(current, previous);`,
      "require-business-rule-wrapper",
      FULL_SCRIPT,
    );
  });

  it("recognizes current only in the canonical full-script wrapper", () => {
    assertInvalid(
      `(function executeRule(current, previous) {
  current.update();
})(current, previous);`,
      "no-br-current-update",
      { messageId: "update" },
      FULL_SCRIPT,
    );
    assertValid(
      `(function executeRule(current, previous) {
  current.update();
})(localCurrent, previous);`,
      "no-br-current-update",
      FULL_SCRIPT,
    );
  });
});

describe("Layer 3 identity-based stateful consumers", () => {
  it("retains GlideElements by cursor ObjectId across aliases", () => {
    assertInvalid(
      `var rec = new GlideRecord("incident");
var gr = rec;
rec.query();
while (gr.next()) {
  values.push(rec.number);
}`,
      "no-glideelement-in-collection",
      { messageId: "retained" },
      SERVER,
    );
    assertInvalid(
      `var rec = new GlideRecord("incident");
var alias = rec;
rec.query();
while (alias.next()) {
  values.push(rec.getElement("number"));
}`,
      "no-glideelement-in-collection",
      { messageId: "retained" },
      SERVER,
    );
    assertInvalid(
      `var rec = new GlideRecord("incident");
rec.query();
while (rec.next()) {
  helper(rec.getElement("number"));
  values.push(rec.number);
}`,
      "no-glideelement-in-collection",
      { messageId: "retained" },
      SERVER,
    );
    assertValid(
      `var rec = new GlideRecord("incident");
rec.query();
while (rec.next()) {
  function nested(rec) { values.push(rec.number); }
  nested(rec);
}`,
      "no-glideelement-in-collection",
      SERVER,
    );
  });

  it("keys prefer-glideaggregate state by ObjectId, not names", () => {
    assertInvalid(
      `var outer = new GlideRecord("incident");
var alias = outer;
outer.query();
var n = 0;
while (alias.next()) {
  n++;
}`,
      "prefer-glideaggregate",
      { messageId: "iterateCount" },
      SERVER,
    );
    assertValid(
      `var gr = new GlideRecord("incident");
function nested(gr) {
  gr.query();
  while (gr.next()) { log(gr.number); }
}
gr.query();
while (gr.next()) { log(gr.number); }`,
      "prefer-glideaggregate",
      SERVER,
    );
  });

  it("reports a definite system-query receiver when an argument aliases it", () => {
    assertInvalid(
      `var gr = new GlideRecord("incident");
gr.addSystemQuery(gr);`,
      "no-system-query-bypass",
      { messageId: "bypass" },
      SERVER,
    );
    assertInvalid(
      `var gr = new GlideRecord("incident");
prepare(gr);
gr.addSystemQuery(gr);`,
      "no-system-query-bypass",
      { messageId: "bypass" },
      SERVER,
    );
  });
});

describe("Layer 3 callback arity", () => {
  it("does not claim a spread call is callback-free", () => {
    assertValid("g_form.getReference(...args);", "require-callback-for-getreference", CLIENT);
    assertValid(
      `g_form.getReference("caller_id", ...args);`,
      "require-callback-for-getreference",
      CLIENT,
    );
  });
});
