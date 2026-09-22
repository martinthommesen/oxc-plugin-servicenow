import {
  entry,
  platformMethodAuthorityEvidence,
  platformMethodMutationLimitation,
} from "./entry.js";
import { requireQueryBeforeNext } from "../rules/require-query-before-next.js";
import * as metadata from "../catalog-metadata.js";

export const requireQueryBeforeNextEntry = entry(
  "require-query-before-next",
  requireQueryBeforeNext,
  {
    ...metadata.meta(
      metadata.classic(metadata.SERVER_SURFACES),
      [
        metadata.evidenceRecord(
          metadata.SN_GR,
          "query(), _query(), and get() execute a query before next() or _next() advances the cursor.",
          "manual",
          "2026-08-22",
        ),
        metadata.evidenceRecord(
          metadata.SN_GR_GLOBAL,
          "queryNoDomain() is documented on the global API and executes a query while ignoring domains.",
          "manual",
          "2026-08-22",
        ),
        metadata.evidenceRecord(
          "tests/integration/binding-host-contracts.test.ts",
          "Oxlint and ESLint enforce _query(), _next(), and scope-sensitive queryNoDomain() lifecycle contracts.",
          "integration-test",
          "2026-08-22",
        ),
        metadata.evidenceRecord(
          "tests/rules/stateful-lifecycle.test.ts",
          "Aliases, sibling reassignment, and completion-aware paths are unit-tested.",
          "fixture",
          "2026-08-20",
        ),
        platformMethodAuthorityEvidence(),
      ],
      {
        overlaps: ["servicenow/validate-glideaggregate-calls"],
        lifecycleAssumptions:
          "Executors are selected by release and scope. A possible scope-specific executor suppresses a missing-query finding without becoming a definite fact for positive rules. chooseWindow does not execute a query.",
      },
    ),
    placements: [
      { profile: "recommended", severity: "error" },
      { profile: "business-rule", severity: "error" },
    ],
    optionDescriptor: undefined,
    limitationCases: [
      {
        caseId: "require-query-before-next-queried-alias",
        kind: "scope-boundary",
        description: "A query through a proven alias opens the same record cursor.",
        name: "queried alias",
        filename: "queried-alias.server.js",
        code: `var record = new GlideRecord("incident");
var alias = record;
alias.query();
record.next();`,
      },
      platformMethodMutationLimitation(
        "require-query-before-next-file-wide-mutation",
        `var record = new GlideRecord("incident");
record.next();
record.next = localNext;`,
      ),
    ],
    title: "Require query before next",
    family: "classic",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "Require a documented, scope-supported GlideRecord query executor before `.next()` or `._next()`. A cursor advance reports when a reachable path lacks even a possible executor for the configured scope; unproven receivers stay silent.",
    bad: [
      {
        name: "next without query",
        filename: "incident.br.js",
        code: `var gr = new GlideRecord("incident");\ngr.addActiveQuery();\ngr.next();`,
      },
    ],
    good: [
      {
        name: "query + checked next",
        filename: "incident.br.js",
        code: `var gr = new GlideRecord("incident");\ngr.addActiveQuery();\ngr.query();\nwhile (gr.next()) {\n  gs.info(gr.number);\n}`,
      },
    ],
  },
);
