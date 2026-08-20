import type { ServiceNowSettings } from "../../src/types.js";
import type { RuleName } from "../../src/rules/index.js";

/**
 * Reusable near-miss and control-flow cases for platform-object rules.
 * Valid cases must stay silent unless the rule documents a narrower reason
 * to report. Invalid cases must report through shared object identity.
 */
export interface BindingMatrixCase {
  name: string;
  code: string;
  filename?: string;
  settings?: ServiceNowSettings;
  expect?: "silent" | "report";
}

export function glideRecordBindingMatrix(methodCall: string): BindingMatrixCase[] {
  return [
    {
      name: "shadowed constructor",
      expect: "silent",
      code: `function GlideRecord() {}\nvar rec = new GlideRecord("incident");\nrec.${methodCall};`,
    },
    {
      name: "comment and string",
      expect: "silent",
      code: `// new GlideRecord("incident").${methodCall}\nvar text = "GlideRecord";\n`,
    },
    {
      name: "user object with the same method name",
      expect: "silent",
      code: `var rec = { ${methodCall.split("(")[0]}: function () {} };\nrec.${methodCall};`,
    },
    {
      name: "unknown computed member",
      expect: "silent",
      code: `var rec = new GlideRecord("incident");\nvar name = dyn;\nrec[name]();`,
    },
    {
      name: "escaped helper",
      expect: "silent",
      code: `var rec = new GlideRecord("incident");\nhelper(rec);\nrec.${methodCall};`,
    },
    {
      name: "sibling reassignment keeps the old object",
      expect: "silent",
      code: `var rec = new GlideRecord("incident");\nvar alias = rec;\nrec = other;\nalias.addQuery("active", true);\nalias.query();\nalias.next();`,
    },
    {
      name: "no-op join keeps identity",
      expect: "silent",
      code: `var rec = new GlideRecord("incident");\nif (flag) { gs.info("noop"); }\nrec.addQuery("active", true);\nrec.query();\nrec.next();`,
    },
    {
      name: "different branch identities stay unknown",
      expect: "silent",
      code: `var rec = flag ? new GlideRecord("incident") : new GlideRecord("problem");\nrec.query();\nrec.next();`,
    },
    {
      name: "block shadowing",
      expect: "silent",
      code: `var rec = new GlideRecord("incident");\nrec.query();\n{\n  var rec = { next: function () {} };\n  rec.next();\n}`,
    },
    {
      name: "parameter shadowing",
      expect: "silent",
      code: `var rec = new GlideRecord("incident");\nfunction wrap(rec) { rec.next(); }\nrec.query();\nwrap({ next: function () {} });`,
    },
    {
      name: "short-circuit and and query",
      expect: "silent",
      code: `var rec = new GlideRecord("incident");\nrec.addQuery("active", true) && rec.query();\nrec.next();`,
    },
    {
      name: "nested function without capture",
      expect: "silent",
      code: `var rec = new GlideRecord("incident");\nrec.query();\nfunction helper() {\n  var other = new GlideRecord("problem");\n  other.query();\n  other.next();\n}\nhelper();\nrec.next();`,
    },
    {
      name: "member and array storage escape",
      expect: "silent",
      code: `var rec = new GlideRecord("incident");\nvar bag = { rec: rec };\nvar list = [rec];\nrec.next();`,
    },
  ];
}

export const STATEFUL_MATRIX_RULES: readonly RuleName[] = [
  "require-query-before-next",
  "validate-glideaggregate-calls",
  "no-unfiltered-gliderecord-bulk-operation",
  "no-gliderecord-query-in-loop",
];
