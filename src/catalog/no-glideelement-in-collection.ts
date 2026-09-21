import {
  entry,
  platformMethodAuthorityEvidence,
  platformMethodMutationLimitation,
} from "./entry.js";
import { noGlideelementInCollection } from "../rules/no-glideelement-in-collection.js";
import * as metadata from "../catalog-metadata.js";

export const noGlideelementInCollectionEntry = entry(
  "no-glideelement-in-collection",
  noGlideelementInCollection,
  {
    ...metadata.meta(metadata.classic(metadata.SERVER_SURFACES), [
      metadata.evidenceRecord(
        metadata.SN_GR,
        "A GlideElement follows a cursor advanced by next() or _next(); collections must store extracted values.",
        "manual",
        "2026-08-22",
      ),
      metadata.evidenceRecord(
        "tests/integration/profiles/invalid/glideelement-push.br.js",
        "Recommended hosts report pushing a cursor field into an array.",
        "integration-test",
        "2026-08-20",
      ),
      metadata.evidenceRecord(
        "tests/rules/platform-binding-identity.test.ts",
        "Path-sensitive fixtures cover local aliases, reassignment, shadowing, all-path joins, and IIFE parameters.",
        "fixture",
        "2026-08-22",
      ),
      platformMethodAuthorityEvidence(),
    ]),
    placements: [
      { profile: "recommended", severity: "error" },
      { profile: "business-rule", severity: "error" },
    ],
    optionDescriptor: undefined,
    limitationCases: [
      {
        caseId: "no-glideelement-deferred-helper",
        kind: "scope-boundary",
        description:
          "Separately declared helpers and deferred callbacks stay silent because their invocation timing and value flow are not proven by the cursor traversal.",
        name: "separate helper",
        filename: "incident.br.js",
        code: `function retain(field) { values.push(field); }
var rec = new GlideRecord("incident");
rec.query();
while (rec.next()) retain(rec.number);`,
      },
      platformMethodMutationLimitation(
        "no-glideelement-file-wide-mutation",
        `var rec = new GlideRecord("incident");
var values = [];
while (rec.next()) values.push(rec.number);
rec.next = localNext;`,
      ),
    ],
    title: "No GlideElement in a collection",
    family: "classic",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "Direct GlideRecord field access and path-proven local aliases are GlideElements tied to the cursor. Do not `push` / `unshift` them inside a `.next()` or `._next()` loop.",
    bad: [
      {
        name: "push field",
        filename: "incident.br.js",
        code: `var numbers = [];\nvar incident = new GlideRecord("incident");\nincident.query();\nwhile (incident.next()) {\n  numbers.push(incident.number);\n}`,
      },
      {
        name: "push field alias",
        filename: "incident.br.js",
        code: `var numbers = [];\nvar incident = new GlideRecord("incident");\nincident.query();\nwhile (incident.next()) {\n  var number = incident.number;\n  numbers.push(number);\n}`,
      },
    ],
    good: [
      {
        name: "getValue",
        filename: "incident.br.js",
        code: `var numbers = [];\nvar incident = new GlideRecord("incident");\nincident.query();\nwhile (incident.next()) {\n  numbers.push(incident.getValue("number"));\n}`,
      },
    ],
  },
);
