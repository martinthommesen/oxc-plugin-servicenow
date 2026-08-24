# servicenow/no-system-query-bypass

Opt-in security review for documented ACL-bypass query APIs. Unknown computed GlideRecord access also reports for review.

- **Family:** classic
- **Preset:** security
- **Placements:** security (warn)
- **Default severity:** warn
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to server, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Actions require an explicit server surface; mixed client/server UI Actions stay silent because execution regions are not classified. Unknown surfaces stay silent.
- **JavaScript mode:** Not instance-executed, or independent of JavaScript mode unless a rule documents a mode gate.
- **Last verified:** 2026-08-24
- **Implementation:** [`src/rules/no-system-query-bypass.ts`](../../src/rules/no-system-query-bypass.ts)

## Applicability

| Dimension | Value |
| --- | --- |
| Authoring | classic |
| Surfaces | Applies to server, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Actions require an explicit server surface; mixed client/server UI Actions stay silent because execution regions are not classified. Unknown surfaces stay silent. |
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

### Incorrect: addSystemQuery

```js
var user = new GlideRecord("sys_user");
user.addSystemQuery("active", true);
user.query();
```

## Correct

### Correct: addQuery

```js
var user = new GlideRecord("sys_user");
user.addQuery("active", true);
user.query();
```

## Limitations

Unproven, invalid, or ambiguous GlideRecord bindings stay silent. Proven escaped GlideRecord identities remain reviewable because this opt-in security rule favors surfacing potential ACL bypasses. false-negative: A possible platform constructor namespace reassignment, prototype or relevant instance-method mutation, or dynamic-scope uncertainty suppresses matching diagnostics throughout the file.

## Known false positives

- None recorded.

## Known false negatives

- A possible platform constructor namespace reassignment, prototype or relevant instance-method mutation, or dynamic-scope uncertainty suppresses matching diagnostics throughout the file.

## Intentional scope boundaries

- None recorded.

## Overlaps

- None recorded.

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **addSystemQuery and related methods bypass query ACLs and need review.**
  - Verification ID: `rule-evidence-9eac51a9`
  - URL: https://www.servicenow.com/docs/r/zurich/api-reference/server-api-reference/c_GlideRecordScopedAPI.html
  - Verified by: manual
  - Verified at: 2026-08-20
- **The security profile reports documented ACL-bypass methods.**
  - Verification ID: `rule-evidence-0640c6fe`
  - URL: tests/integration/profiles/invalid/system-query.br.js
  - Verified by: integration-test
  - Verified at: 2026-08-20
- **Oxlint and ESLint report folded, dynamic, extracted, and escaped GlideRecord bypass access.**
  - Verification ID: `rule-evidence-3826e118`
  - URL: tests/integration/context-contracts.test.ts
  - Verified by: integration-test
  - Verified at: 2026-08-21
- **Constructor namespace, prototype, instance-method, and dynamic-scope mutations are covered by shared platform-authority fixtures.**
  - Verification ID: `rule-evidence-4b609d4f`
  - URL: tests/rules/platform-method-authority.test.ts
  - Verified by: fixture
  - Verified at: 2026-08-24
- **The Australia-scoped GlideRecord API was reviewed for the methods and lifecycle facts used by this rule.**
  - Verification ID: `rule-evidence-f5af72f5`
  - URL: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html
  - Verified by: manual
  - Verified at: 2026-08-22
- **The Australia-global GlideRecord API was reviewed for the methods and lifecycle facts used by this rule.**
  - Verification ID: `rule-evidence-a899b39e`
  - URL: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordAPI.html
  - Verified by: manual
  - Verified at: 2026-08-22

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
