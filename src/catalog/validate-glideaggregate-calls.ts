import {
  entry,
  platformMethodAuthorityEvidence,
  platformMethodMutationLimitation,
} from "./entry.js";
import { validateGlideaggregateCalls } from "../rules/validate-glideaggregate-calls.js";
import * as metadata from "../catalog-metadata.js";

export const validateGlideaggregateCallsEntry = entry(
  "validate-glideaggregate-calls",
  validateGlideaggregateCalls,
  {
    ...metadata.meta(
      metadata.classic(metadata.SERVER_SURFACES),
      [
        metadata.evidenceRecord(
          metadata.SN_GA_AUSTRALIA,
          "The Australia GlideAggregate API documents addAggregate before query and getAggregate on the returned aggregate result.",
          "manual",
          "2026-08-22",
        ),
        metadata.evidenceRecord(
          metadata.SN_GA_GLOBAL_AUSTRALIA,
          "The Australia global GlideAggregate API documents the corresponding aggregate lifecycle methods.",
          "manual",
          "2026-08-22",
        ),
        metadata.evidenceRecord(
          "tests/integration/profiles/invalid/aggregate-type-only-field.br.js",
          "Type-only COUNT does not satisfy a field-specific getAggregate.",
          "integration-test",
          "2026-08-20",
        ),
        platformMethodAuthorityEvidence(),
      ],
      {
        overlaps: ["servicenow/require-query-before-next"],
        lifecycleAssumptions:
          "Must-tuples intersect on join. addAggregate after query() does not validate the already-open result.",
      },
    ),
    placements: [
      { profile: "recommended", severity: "error" },
      { profile: "business-rule", severity: "error" },
    ] as const,
    optionDescriptor: undefined,
    limitationCases: [
      platformMethodMutationLimitation(
        "validate-glideaggregate-file-wide-mutation",
        `var aggregate = new GlideAggregate("incident");
aggregate.next();
aggregate.next = localNext;`,
      ),
    ],
    title: "Validate GlideAggregate calls",
    family: "classic",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "A proven GlideAggregate must call `query()` before `next()` or `getAggregate()`. Static `getAggregate(type, field?)` must match an exact `addAggregate` tuple that was registered before that `query()`.",
    bad: [
      {
        name: "next before query",
        filename: "incident.br.js",
        code: `var count = new GlideAggregate("incident");\ncount.addAggregate("COUNT");\nif (count.next()) {\n  gs.info(count.getAggregate("COUNT"));\n}`,
      },
    ],
    good: [
      {
        name: "query then next",
        filename: "incident.br.js",
        code: `var count = new GlideAggregate("incident");\ncount.addAggregate("COUNT");\ncount.query();\nif (count.next()) {\n  gs.info(count.getAggregate("COUNT"));\n}`,
      },
    ],
  },
);
