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

  it("forgets a reassigned canonical current wrapper parameter", () => {
    assertValid(
      `(function executeRule(current, previous) {\n  current = getOtherRecord();\n  current.update();\n})(current, previous);`,
      "no-br-current-update",
      FULL_SCRIPT,
    );
  });

  it("keeps canonical current authority temporal and method-specific", () => {
    assertValid(
      `(function executeRule(current, previous) {
  prepare(current);
  current.update();
})(current, previous);`,
      "no-br-current-update",
      FULL_SCRIPT,
    );
    assertValid(
      `(function executeRule(current, previous) {
  current.update = localUpdate;
  current.update();
})(current, previous);`,
      "no-br-current-update",
      FULL_SCRIPT,
    );
    assertValid(
      `(function executeRule(current, previous) {
  globalThis.current.update = localUpdate;
  current.update();
})(current, previous);`,
      "no-br-current-update",
      FULL_SCRIPT,
    );
    assertValid(
      `(function executeRule(current, previous) {
  prepare(globalThis.current);
  current.update();
})(current, previous);`,
      "no-br-current-update",
      FULL_SCRIPT,
    );
    assertValid(
      `(function executeRule(current, previous) {
  GlideRecord.prototype.update = localUpdate;
  current.update();
})(current, previous);`,
      "no-br-current-update",
      FULL_SCRIPT,
    );
    assertInvalid(
      `(function executeRule(current, previous) {
  current.update();
  prepare(current);
})(current, previous);`,
      "no-br-current-update",
      { messageId: "update" },
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

  it("tracks local GlideElement values through aliases and all-path joins", () => {
    assertInvalid(
      `var rec = new GlideRecord("incident");
var values = [];
rec.query();
while (rec.next()) {
  var field = rec.number;
  var alias = field;
  prepare(alias);
  values.push({ field: alias });
}`,
      "no-glideelement-in-collection",
      { messageId: "retained", includes: "alias" },
      SERVER,
    );
    assertInvalid(
      `var rec = new GlideRecord("incident");
var values = [];
rec.query();
while (rec.next()) {
  var field;
  if (useNumber) field = rec.number;
  else field = rec.short_description;
  values.push(field);
}`,
      "no-glideelement-in-collection",
      { messageId: "retained", includes: "field" },
      SERVER,
    );
    assertInvalid(
      `var rec = new GlideRecord("incident");
var values = [];
rec.query();
while (rec.next()) {
  (function (field) { values.push(field); })(rec.getElement("number"));
}`,
      "no-glideelement-in-collection",
      { messageId: "retained", includes: "field" },
      SERVER,
    );
  });

  it("invalidates uncertain or converted GlideElement aliases", () => {
    assertValid(
      `var rec = new GlideRecord("incident");
var values = [];
var stale;
rec.query();
while (rec.next()) {
  var fresh = rec.number;
  if (capture) stale = fresh;
  values.push(stale);
}`,
      "no-glideelement-in-collection",
      SERVER,
    );
    assertValid(
      `var rec = new GlideRecord("incident");
var other = new GlideRecord("task");
var values = [];
rec.query();
other.query();
while (rec.next() && other.next()) {
  var field;
  if (useIncident) field = rec.number;
  else field = other.number;
  values.push(field);
}`,
      "no-glideelement-in-collection",
      SERVER,
    );
    assertValid(
      `var rec = new GlideRecord("incident");
var values = [];
rec.query();
while (rec.next()) {
  var field = rec.number;
  field = field.toString();
  values.push(field);
}`,
      "no-glideelement-in-collection",
      SERVER,
    );
    assertValid(
      `var rec = new GlideRecord("incident");
var values = [];
rec.query();
while (rec.next()) {
  var field;
  if (includeField) field = rec.number;
  else field = "safe";
  values.push(field);
}`,
      "no-glideelement-in-collection",
      SERVER,
    );
    assertValid(
      `var rec = new GlideRecord("incident");
var values = [];
rec.query();
while (rec.next()) {
  var field = rec.number;
  field++;
  values.push(field);
}`,
      "no-glideelement-in-collection",
      SERVER,
    );
    assertValid(
      `var rec = new GlideRecord("incident");
var values = [];
rec.query();
while (rec.next()) {
  var field = rec.number;
  { let field = "safe"; values.push(field); }
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
