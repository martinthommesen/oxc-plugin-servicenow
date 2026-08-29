import type { RuleName, ServiceNowSettings } from "../../src/index.js";

export interface BindingMatrixCase {
  id: string;
  rule: RuleName;
  code: string;
  filename: string;
  settings?: ServiceNowSettings;
  expected: "report" | "silent";
  messageId?: string;
  message: string;
  start: { line: number; column: number };
  end: { line: number; column: number };
}

function location(code: string, source: string) {
  const offset = code.lastIndexOf(source);
  if (offset < 0) throw new Error(`missing matrix source ${source}`);
  const before = code.slice(0, offset).split("\n");
  const start = { line: before.length, column: before.at(-1)?.length ?? 0 };
  return { start, end: { line: start.line, column: start.column + source.length } };
}

function report(
  id: string,
  rule: RuleName,
  code: string,
  source: string,
  messageId: string,
  message: string,
  filename = "matrix.server.js",
): BindingMatrixCase {
  return {
    id,
    rule,
    code,
    filename,
    expected: "report",
    messageId,
    message,
    ...location(code, source),
  };
}

function silent(
  id: string,
  rule: RuleName,
  code: string,
  filename = "matrix.server.js",
): BindingMatrixCase {
  return {
    id,
    rule,
    code,
    filename,
    expected: "silent",
    message: "",
    start: { line: 0, column: 0 },
    end: { line: 0, column: 0 },
  };
}

export const BINDING_MATRIX_CASES: readonly BindingMatrixCase[] = [
  report(
    "query-direct-unopened",
    "require-query-before-next",
    'var rec = new GlideRecord("incident");\nrec.next();',
    "rec.next()",
    "missingQuery",
    "`rec.next()` is called without a preceding `.query()` or `.get()` on every path. Call `.query()` or `.get()` on every path before `.next()`; `chooseWindow()` only configures a later query.",
  ),
  silent(
    "query-direct-opened",
    "require-query-before-next",
    'var rec = new GlideRecord("incident");\nrec.query();\nrec.next();',
  ),
  report(
    "aggregate-next-before-query",
    "validate-glideaggregate-calls",
    'var agg = new GlideAggregate("incident");\nagg.next();',
    "agg.next()",
    "missingQuery",
    "`agg.next()` runs before `query()`. Configure aggregates, call `query()`, then read results.",
  ),
  silent(
    "aggregate-registered-query-read",
    "validate-glideaggregate-calls",
    'var agg = new GlideAggregate("incident");\nagg.addAggregate("COUNT");\nagg.query();\nif (agg.next()) { agg.getAggregate("COUNT"); }',
  ),
  report(
    "bulk-direct-unfiltered",
    "no-unfiltered-gliderecord-bulk-operation",
    'var rec = new GlideRecord("incident");\nrec.deleteMultiple();',
    "rec.deleteMultiple()",
    "unfiltered",
    "`rec.deleteMultiple()` has no proven query filter. Add `addQuery` / `addEncodedQuery` (or another documented filter), or suppress this with a rationale for a whole-table job.",
  ),
  silent(
    "bulk-direct-filtered",
    "no-unfiltered-gliderecord-bulk-operation",
    'var rec = new GlideRecord("incident");\nrec.addQuery("active", true);\nrec.deleteMultiple();',
  ),
  report(
    "loop-nested-query",
    "no-gliderecord-query-in-loop",
    'var outer = new GlideRecord("incident");\nouter.query();\nwhile (outer.next()) {\n  var inner = new GlideRecord("problem");\n  inner.query();\n}',
    "inner.query()",
    "nestedQuery",
    "`inner.query()` runs inside a GlideRecord cursor loop. Prefer a display/reference value or one query outside the loop.",
  ),
  silent(
    "loop-query-before-cursor",
    "no-gliderecord-query-in-loop",
    'var inner = new GlideRecord("problem");\ninner.query();\nvar outer = new GlideRecord("incident");\nouter.query();\nwhile (outer.next()) { gs.info(inner.getValue("number")); }',
  ),
  report(
    "modifier-after-query-before-consume",
    "no-gliderecord-query-modifier-after-query",
    'var rec = new GlideRecord("incident");\nrec.query();\nrec.addQuery("active", true);\nrec.next();',
    "rec.next()",
    "lateModifier",
    "`rec.next()` consumes a cursor after a query modifier. Call `query()` again, or move the modifier before the first query.",
  ),
  silent(
    "modifier-before-query",
    "no-gliderecord-query-modifier-after-query",
    'var rec = new GlideRecord("incident");\nrec.addQuery("active", true);\nrec.query();\nrec.next();',
  ),
  report(
    "delete-windowed",
    "no-delete-multiple-with-windowing",
    'var rec = new GlideRecord("incident");\nrec.setLimit(10);\nrec.deleteMultiple();',
    "rec.deleteMultiple()",
    "windowed",
    "`rec.deleteMultiple()` ignores a preceding `setLimit()` / `chooseWindow()`. Remove the window, or delete records one at a time after `query()` / `next()`.",
  ),
  silent(
    "delete-without-window",
    "no-delete-multiple-with-windowing",
    'var rec = new GlideRecord("incident");\nrec.addQuery("active", true);\nrec.deleteMultiple();',
  ),
  report(
    "window-query-count",
    "prefer-setnocount-with-choosewindow",
    'var rec = new GlideRecord("incident");\nrec.chooseWindow(0, 10);\nrec.query();',
    "rec.query()",
    "missing",
    "`rec.query()` after `chooseWindow()` runs a `COUNT(*)` unless `setNoCount()` or `setLimit()` skips it. Add `rec.setNoCount()` before `query()` when the full match count is unused.",
  ),
  silent(
    "window-query-no-count",
    "prefer-setnocount-with-choosewindow",
    'var rec = new GlideRecord("incident");\nrec.chooseWindow(0, 10);\nrec.setNoCount();\nrec.query();',
  ),
  report(
    "glideajax-missing-name",
    "require-glideajax-sysparm-name",
    'var ajax = new GlideAjax("Example");\najax.getXML(callback);',
    "ajax.getXML(callback)",
    "missingName",
    '`ajax` starts a GlideAjax request without `addParam("sysparm_name", ...)`. Call `addParam` with a non-empty Script Include method name before the request.',
    "matrix.client.js",
  ),
  silent(
    "glideajax-named-request",
    "require-glideajax-sysparm-name",
    'var ajax = new GlideAjax("Example");\najax.addParam("sysparm_name", "load");\najax.getXML(callback);',
    "matrix.client.js",
  ),
  report(
    "element-retained-in-array",
    "no-glideelement-in-collection",
    'var values = [];\nvar rec = new GlideRecord("incident");\nrec.query();\nwhile (rec.next()) { values.push(rec.number); }',
    "rec.number",
    "retained",
    "`rec.number` field access yields a GlideElement bound to the current cursor. Extract a value before `push` / `unshift`.",
  ),
  silent(
    "element-extracted-value",
    "no-glideelement-in-collection",
    'var values = [];\nvar rec = new GlideRecord("incident");\nrec.query();\nwhile (rec.next()) { values.push(rec.getValue("number")); }',
  ),
  report(
    "fluent-required-id-missing",
    "require-fluent-id",
    'import { BusinessRule as BR } from "@servicenow/sdk/core";\nBR({ table: "incident", name: "Test" });',
    "BR",
    "missing",
    "`BusinessRule()` is missing `$id`. The Fluent SDK manifest requires `$id` for this API so `keys.ts` can track the record. Add `$id: Now.ID['test']`.",
    "matrix.now.ts",
  ),
  silent(
    "fluent-required-id-canonical",
    "require-fluent-id",
    'import { BusinessRule } from "@servicenow/sdk/core";\nBusinessRule({ $id: Now.ID["test"], table: "incident", name: "Test" });',
    "matrix.now.ts",
  ),
  report(
    "now-id-used-as-reference",
    "no-now-id-as-reference",
    'import { BusinessRule } from "@servicenow/sdk/core";\nBusinessRule({ $id: Now.ID["rule"], table: Now.ID["table"], name: "Test" });',
    'Now.ID["table"]',
    "asReference",
    "`Now.ID` defines a metadata identity. Do not use it as a reference. Pass the factory object or `Now.ref()`.",
    "matrix.now.ts",
  ),
  silent(
    "now-id-used-as-id",
    "no-now-id-as-reference",
    'import { BusinessRule } from "@servicenow/sdk/core";\nBusinessRule({ $id: Now.ID["rule"], table: "incident", name: "Test" });',
    "matrix.now.ts",
  ),
] as const;

export const STATEFUL_MATRIX_RULES = [
  ...new Set(BINDING_MATRIX_CASES.map((testCase) => testCase.rule)),
];
