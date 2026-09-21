import { entry, platformMethodAuthorityEvidence } from "./entry.js";
import { noGliderecordQueryInAcl } from "../rules/no-gliderecord-query-in-acl.js";
import * as metadata from "../catalog-metadata.js";

export const noGliderecordQueryInAclEntry = entry(
  "no-gliderecord-query-in-acl",
  noGliderecordQueryInAcl,
  {
    ...metadata.meta(
      metadata.classic(["acl"], "n/a", metadata.ALL_SCOPES, {
        minimumSurfaceConfidence: "filename",
      }),
      [
        metadata.evidenceRecord(
          metadata.SN_SECURE_DATA,
          "ServiceNow's Zurich secure-data guidance advises limiting GlideRecord queries in access control scripts because they can affect performance.",
          "manual",
          "2026-08-24",
        ),
        metadata.evidenceRecord(
          metadata.SN_SECURE_DATA_AUSTRALIA,
          "ServiceNow's Australia secure-data guidance retains the same advice to limit GlideRecord queries in access control scripts.",
          "manual",
          "2026-08-24",
        ),
        metadata.evidenceRecord(
          metadata.SN_GA_AUSTRALIA,
          "The Australia GlideAggregate reference documents it as a GlideRecord extension that executes database aggregation queries.",
          "manual",
          "2026-08-24",
        ),
        metadata.evidenceRecord(
          metadata.SN_ACL_AUSTRALIA,
          "The Australia ACL guidance documents current as the record available to a custom ACL script.",
          "manual",
          "2026-08-24",
        ),
        metadata.evidenceRecord(
          "tests/rules/no-gliderecord-query-in-acl.test.ts",
          "Path-sensitive fixtures cover query executors, current, aliases, joins, reassignment, shadowing, direct and async helper calls, escape, deferred code, scope-specific APIs, and platform-method mutation.",
          "fixture",
          "2026-08-24",
        ),
        metadata.evidenceRecord(
          "tests/integration/profiles/invalid/acl-query.acl.js",
          "Real Oxlint and ESLint ACL profiles report a proven query while recommended remains unchanged.",
          "integration-test",
          "2026-08-24",
        ),
        platformMethodAuthorityEvidence(),
      ],
      {
        overlaps: ["servicenow/no-gliderecord-query-in-loop"],
        lifecycleAssumptions:
          "Only query executions before the first asynchronous suspension on the immediate ACL evaluation path are reviewed. Directly invoked local helpers inherit call-time object identity; uncalled functions, generators, deferred callbacks, post-await continuations, escaped objects, unsupported scope-specific methods, and uncertain platform-method authority stay silent.",
      },
    ),
    placements: [
      { profile: "strict", severity: "warn" },
      { profile: "acl", severity: "warn" },
      { profile: "security", severity: "warn" },
    ],
    optionDescriptor: undefined,
    limitationCases: [
      {
        caseId: "acl-query-deferred-callback",
        kind: "scope-boundary",
        description:
          "Uncalled helpers and deferred callbacks stay silent because their execution during this ACL evaluation is not proven.",
        name: "deferred callback",
        filename: "incident.acl.js",
        code: `function loadUser() {
  var user = new GlideRecord("sys_user");
  user.query();
}
scheduleLater(loadUser);`,
      },
      {
        caseId: "acl-query-post-await",
        kind: "scope-boundary",
        description:
          "A query after the first await stays silent because that continuation does not run during the helper's immediate invocation.",
        name: "post-await continuation",
        filename: "incident.acl.js",
        code: `async function loadUser() {
  await later();
  var user = new GlideRecord("sys_user");
  user.query();
}
loadUser();`,
      },
      {
        caseId: "acl-query-escaped-record",
        kind: "false-negative",
        description:
          "A GlideRecord passed to an unresolved helper stays silent after escape because the helper may replace or otherwise invalidate its method identity.",
        name: "escaped record",
        filename: "incident.acl.js",
        code: `var user = new GlideRecord("sys_user");
prepare(user);
user.query();`,
      },
      {
        caseId: "acl-query-unknown-global-method-scope",
        kind: "scope-boundary",
        description: "Global-only query executors stay silent when application scope is unknown.",
        name: "unknown queryNoDomain scope",
        filename: "incident.acl.js",
        settings: { scope: "unknown", release: "australia" },
        code: `var user = new GlideRecord("sys_user");
user.queryNoDomain();`,
      },
      {
        caseId: "acl-query-file-wide-mutation",
        kind: "false-negative",
        description:
          "A visible GlideRecord prototype or relevant instance-method mutation suppresses matching ACL diagnostics throughout the file.",
        name: "visible query-method mutation",
        filename: "incident.acl.js",
        code: `var user = new GlideRecord("sys_user");
user.query();
user.query = localQuery;`,
      },
    ],
    title: "Review GlideRecord queries in ACLs",
    family: "classic",
    severity: "warn",
    fixable: false,
    hasSuggestions: false,
    description:
      "Review proven GlideRecord, GlideRecordSecure, and GlideAggregate query executions on an ACL's immediate evaluation path. ServiceNow advises limiting GlideRecord queries in access control scripts because they can affect performance. This advisory rule is opt-in through strict, acl, or security profiles and does not claim that every query is incorrect.",
    bad: [
      {
        name: "query during ACL evaluation",
        filename: "incident.acl.js",
        code: `var membership = new GlideRecord("sys_user_grmember");
membership.addQuery("user", gs.getUserID());
membership.addQuery("group", current.assignment_group);
membership.query();
answer = membership.hasNext();`,
      },
    ],
    good: [
      {
        name: "role and loaded-record fields",
        filename: "incident.acl.js",
        code: `answer = gs.hasRole("x_acme.agent") && current.active && current.assigned_to == gs.getUserID();`,
      },
    ],
  },
);
