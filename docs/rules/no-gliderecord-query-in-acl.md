# servicenow/no-gliderecord-query-in-acl

Review proven GlideRecord, GlideRecordSecure, and GlideAggregate query executions on an ACL's immediate evaluation path. ServiceNow advises limiting GlideRecord queries in access control scripts because they can affect performance. This advisory rule is opt-in through strict, ACL, or security profiles and does not claim that every query is incorrect.

- **Family:** classic
- **Preset:** strict
- **Placements:** strict (warn), acl (warn), security (warn)
- **Default severity:** warn
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to acl when those surfaces are known. Unknown surfaces stay silent.
- **JavaScript mode:** Not instance-executed, or independent of JavaScript mode unless a rule documents a mode gate.
- **Last verified:** 2026-08-24
- **Implementation:** [`src/rules/no-gliderecord-query-in-acl.ts`](../../src/rules/no-gliderecord-query-in-acl.ts)

## Applicability

| Dimension | Value |
| --- | --- |
| Authoring | classic |
| Surfaces | Applies to acl when those surfaces are known. Unknown surfaces stay silent. |
| Minimum surface confidence | filename-inferred |
| JavaScript modes | n/a |
| Application scopes | global, scoped, unknown |
| ServiceNow releases | zurich, australia |
| Fluent SDK range | n/a |

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| _(none)_ | | | This rule has no options. |

## Incorrect

### Incorrect: query during ACL evaluation

```js
var membership = new GlideRecord("sys_user_grmember");
membership.addQuery("user", gs.getUserID());
membership.addQuery("group", current.assignment_group);
membership.query();
answer = membership.hasNext();
```

## Correct

### Correct: role and loaded-record fields

```js
answer = gs.hasRole("x_acme.agent") && current.active && current.assigned_to == gs.getUserID();
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: Uncalled helpers and deferred callbacks stay silent because their execution during this ACL evaluation is not proven. scope-boundary: A query after the first await stays silent because that continuation does not run during the helper's immediate invocation. false-negative: A GlideRecord passed to an unresolved helper stays silent after escape because the helper may replace or otherwise invalidate its method identity. scope-boundary: Global-only query executors stay silent when application scope is unknown. false-negative: A visible GlideRecord prototype or relevant instance-method mutation suppresses matching ACL diagnostics throughout the file. lifecycle: Only query executions before the first asynchronous suspension on the immediate ACL evaluation path are reviewed. Directly invoked local helpers inherit call-time object identity; uncalled functions, generators, deferred callbacks, post-await continuations, escaped objects, unsupported scope-specific methods, and uncertain platform-method authority stay silent.

## Known false positives

- None recorded.

## Known false negatives

- A GlideRecord passed to an unresolved helper stays silent after escape because the helper may replace or otherwise invalidate its method identity.
- A visible GlideRecord prototype or relevant instance-method mutation suppresses matching ACL diagnostics throughout the file.

## Intentional scope boundaries

- Uncalled helpers and deferred callbacks stay silent because their execution during this ACL evaluation is not proven.
- A query after the first await stays silent because that continuation does not run during the helper's immediate invocation.
- Global-only query executors stay silent when application scope is unknown.

## Overlaps

- `servicenow/no-gliderecord-query-in-loop`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: Only query executions before the first asynchronous suspension on the immediate ACL evaluation path are reviewed. Directly invoked local helpers inherit call-time object identity; uncalled functions, generators, deferred callbacks, post-await continuations, escaped objects, unsupported scope-specific methods, and uncertain platform-method authority stay silent.

## Evidence

- **ServiceNow's Zurich secure-data guidance advises limiting GlideRecord queries in access control scripts because they can affect performance.**
  - Verification ID: `rule-evidence-e759c4c5`
  - URL: https://www.servicenow.com/docs/r/zurich/application-development/building-applications/secure-data.html
  - Verified by: manual
  - Verified at: 2026-08-24
- **ServiceNow's Australia secure-data guidance retains the same advice to limit GlideRecord queries in access control scripts.**
  - Verification ID: `rule-evidence-2946db41`
  - URL: https://www.servicenow.com/docs/r/application-development/secure-data.html
  - Verified by: manual
  - Verified at: 2026-08-24
- **The Australia GlideAggregate reference documents it as a GlideRecord extension that executes database aggregation queries.**
  - Verification ID: `rule-evidence-36d2276b`
  - URL: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideAggregateScopedAPI.html
  - Verified by: manual
  - Verified at: 2026-08-24
- **The Australia ACL guidance documents current as the record available to a custom ACL script.**
  - Verification ID: `rule-evidence-a6a6d86f`
  - URL: https://www.servicenow.com/docs/r/platform-security/access-control/t_CreateAnACLRule.html
  - Verified by: manual
  - Verified at: 2026-08-24
- **Path-sensitive fixtures cover query executors, current, aliases, joins, reassignment, shadowing, direct and async helper calls, escape, deferred code, scope-specific APIs, and platform-method mutation.**
  - Verification ID: `rule-evidence-7c851911`
  - URL: tests/rules/no-gliderecord-query-in-acl.test.ts
  - Verified by: fixture
  - Verified at: 2026-08-24
- **Real Oxlint and ESLint ACL profiles report a proven query while recommended remains unchanged.**
  - Verification ID: `rule-evidence-c64a1231`
  - URL: tests/integration/profiles/invalid/acl-query.acl.js
  - Verified by: integration-test
  - Verified at: 2026-08-24
- **Constructor namespace, prototype, instance-method, and dynamic-scope mutations are covered by shared platform-authority fixtures.**
  - Verification ID: `rule-evidence-73185b82`
  - URL: tests/rules/platform-method-authority.test.ts
  - Verified by: fixture
  - Verified at: 2026-08-24
- **The Australia-scoped GlideRecord API was reviewed for the methods and lifecycle facts used by this rule.**
  - Verification ID: `rule-evidence-cb5299b6`
  - URL: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html
  - Verified by: manual
  - Verified at: 2026-08-22
- **The Australia-global GlideRecord API was reviewed for the methods and lifecycle facts used by this rule.**
  - Verification ID: `rule-evidence-bfdb4bf5`
  - URL: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordAPI.html
  - Verified by: manual
  - Verified at: 2026-08-22
- **The Australia-global GlideAggregate API was reviewed for the methods and lifecycle facts used by this rule.**
  - Verification ID: `rule-evidence-ca184ced`
  - URL: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideAggregateAPI.html
  - Verified by: manual
  - Verified at: 2026-08-22

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
