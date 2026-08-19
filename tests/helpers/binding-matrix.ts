import type { ServiceNowSettings } from "../../src/types.js";

/**
 * Reusable near-miss cases for platform-object rules.
 * Each snippet is valid ServiceNow-looking code that must stay silent
 * unless the rule documents a narrower reason to report.
 */
export interface BindingMatrixCase {
  name: string;
  code: string;
  filename?: string;
  settings?: ServiceNowSettings;
}

export function glideRecordBindingMatrix(methodCall: string): BindingMatrixCase[] {
  return [
    {
      name: "shadowed constructor",
      code: `function GlideRecord() {}\nvar rec = new GlideRecord("incident");\nrec.${methodCall};`,
    },
    {
      name: "comment and string",
      code: `// new GlideRecord("incident").${methodCall}\nvar text = "GlideRecord";\n`,
    },
    {
      name: "user object with the same method name",
      code: `var rec = { ${methodCall.split("(")[0]}: function () {} };\nrec.${methodCall};`,
    },
    {
      name: "unknown computed member",
      code: `var rec = new GlideRecord("incident");\nvar name = dyn;\nrec[name]();`,
    },
    {
      name: "escaped helper",
      code: `var rec = new GlideRecord("incident");\nhelper(rec);\nrec.${methodCall};`,
    },
  ];
}
