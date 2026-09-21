import {
  entry,
  platformMethodAuthorityEvidence,
  platformMethodMutationLimitation,
} from "./entry.js";
import { noGliderecordQueryInLoop } from "../rules/no-gliderecord-query-in-loop.js";
import * as metadata from "../catalog-metadata.js";

export const noGliderecordQueryInLoopEntry = entry(
  "no-gliderecord-query-in-loop",
  noGliderecordQueryInLoop,
  {
    ...metadata.meta(
      metadata.classic(metadata.SERVER_SURFACES),
      [
        metadata.evidenceRecord(
          metadata.SN_GR,
          "A documented GlideRecord query executor inside a next() or _next() loop is an N+1 pattern.",
          "manual",
          "2026-08-22",
        ),
        metadata.evidenceRecord(
          metadata.SN_GA,
          "GlideAggregate documents query() and next() for aggregate cursor iteration.",
          "manual",
          "2026-08-22",
        ),
        metadata.evidenceRecord(
          "tests/integration/profiles/invalid/nested-cursor-query.br.js",
          "Strict hosts report a nested query inside a proven cursor loop.",
          "integration-test",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/integration/profiles/valid/custom-iterator-loop.br.js",
          "Custom iterators with next() do not establish cursor depth.",
          "integration-test",
          "2026-08-20",
        ),
        metadata.evidenceRecord(
          "tests/rules/phase3.test.ts",
          "Stable one-call-site local helpers inherit cursor depth; mutable, multiply called, generator, shadowed, and indirect helpers stay silent.",
          "fixture",
          "2026-08-22",
        ),
        platformMethodAuthorityEvidence(),
      ],
      {
        overlaps: ["servicenow/require-query-before-next"],
        lifecycleAssumptions:
          "A proven GlideRecord next() / _next() or GlideAggregate next() receiver establishes cursor depth. Direct IIFEs and direct calls to an unmodified local function with one statically visible call site inherit that depth. GlideRecord executors must be definite for the configured scope. GlideAggregate analysis follows its directly documented query() / next() lifecycle; inherited or undocumented executors and cursor aliases stay silent.",
      },
    ),
    placements: [{ profile: "strict", severity: "warn" }],
    optionDescriptor: undefined,
    limitationCases: [
      {
        caseId: "query-in-loop-multiple-helper-call-sites",
        kind: "false-negative",
        description:
          "Mutable helpers and helpers with multiple direct call sites stay silent because shared provenance is not call-context-sensitive.",
        name: "multiply called helper",
        filename: "multiply-called.server.js",
        code: `function loadCaller() {
  var caller = new GlideRecord("sys_user");
  caller.query();
}
loadCaller();
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) loadCaller();`,
      },
      {
        caseId: "query-in-loop-indirect-helper-invocation",
        kind: "false-negative",
        description:
          "Indirect `.call()`, `.apply()`, `.bind()`, constructor, and deferred callback invocations do not inherit cursor depth.",
        name: "indirect helper invocation",
        filename: "indirect-helper.server.js",
        code: `function loadCaller() {
  var caller = new GlideRecord("sys_user");
  caller.query();
}
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) loadCaller.call(null);`,
      },
      platformMethodMutationLimitation(
        "query-in-loop-file-wide-mutation",
        `var outer = new GlideRecord("incident");
var inner = new GlideRecord("sys_user");
while (outer.next()) inner.query();
inner.query = localQuery;`,
      ),
    ],
    title: "No GlideRecord query in a cursor loop",
    family: "classic",
    severity: "warn",
    fixable: false,
    hasSuggestions: false,
    description:
      "A query inside a proven record cursor loop is an N+1 pattern. Direct IIFEs and stable one-call-site local helpers inherit cursor depth. GlideRecord uses release-keyed executors and `.next()` / `._next()`; GlideAggregate uses its directly documented `query()` / `.next()` lifecycle. Unrelated iterators stay silent.",
    bad: [
      {
        name: "nested get",
        filename: "incident.br.js",
        code: `var incident = new GlideRecord("incident");\nincident.query();\nwhile (incident.next()) {\n  var caller = new GlideRecord("sys_user");\n  caller.get(incident.getValue("caller_id"));\n  gs.info(caller.getDisplayValue());\n}`,
      },
      {
        name: "query in a stable helper",
        filename: "incident.br.js",
        code: `function loadCaller(id) {
  var caller = new GlideRecord("sys_user");
  caller.get(id);
}
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) loadCaller(incident.getValue("caller_id"));`,
      },
    ],
    good: [
      {
        name: "display value",
        filename: "incident.br.js",
        code: `var incident = new GlideRecord("incident");\nincident.query();\nwhile (incident.next()) {\n  gs.info(incident.getDisplayValue("caller_id"));\n}`,
      },
    ],
  },
);
