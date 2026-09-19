import { entry } from "./entry.js";
import { requireBusinessRuleWrapper } from "../rules/require-business-rule-wrapper.js";
import * as metadata from "../catalog-metadata.js";

export const requireBusinessRuleWrapperEntry = entry(
  "require-business-rule-wrapper",
  requireBusinessRuleWrapper,
  {
    ...metadata.meta(
      {
        authoring: "classic",
        surfaces: ["business-rule"],
        minimumSurfaceConfidence: "explicit-only",
        javascriptModes: "n/a",
        scopes: metadata.ALL_SCOPES,
      },
      [
        metadata.evidenceRecord(
          metadata.SN_BR,
          "Full-script Business Rules use the executeRule(current, previous) IIFE so top-level bindings do not leak.",
          "manual",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/integration/profiles/invalid/unwrapped.br.js",
          "The wrapper rule reports only when businessRuleSourceFormat is full-script.",
          "integration-test",
          "2026-08-20",
        ),
      ],
      {
        overlaps: [],
      },
    ),
    placements: [
      { profile: "recommended", severity: "error" },
      { profile: "business-rule", severity: "error" },
    ] as const,
    optionDescriptor: undefined,
    limitationCases: [
      {
        caseId: "require-wrapper-body-only",
        kind: "scope-boundary",
        description: "Body-only Business Rule source does not contain the platform wrapper.",
        name: "body-only source",
        filename: "body-only.br.js",
        settings: {
          authoring: "classic",
          surfaces: ["business-rule"],
          businessRuleSourceFormat: "body-only",
        },
        code: `current.short_description = "Updated";`,
      },
    ],
    title: "Require Business Rule wrapper",
    family: "classic",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "Full-script Business Rules must wrap logic in the standard IIFE so top-level variables do not leak. The rule is silent unless `businessRuleSourceFormat` is `full-script`.",
    bad: [
      {
        name: "unwrapped",
        filename: "incident.br.js",
        settings: { businessRuleSourceFormat: "full-script" },
        code: `var targetGroup = gs.getProperty("x_acme.target_group");\nif (current.assignment_group.nil()) {\n  current.assignment_group = targetGroup;\n}`,
      },
    ],
    good: [
      {
        name: "IIFE wrapper",
        filename: "incident.br.js",
        settings: { businessRuleSourceFormat: "full-script" },
        code: `(function executeRule(current, previous) {\n  var targetGroup = gs.getProperty("x_acme.target_group");\n  if (current.assignment_group.nil()) {\n    current.assignment_group = targetGroup;\n  }\n})(current, previous);`,
      },
    ],
  },
);
