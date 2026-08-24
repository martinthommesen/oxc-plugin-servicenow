# servicenow/no-client-gliderecord

Client GlideRecord is unsupported in scoped applications. Query on the server with GlideAjax or Scripted REST.

- **Family:** classic
- **Preset:** recommended
- **Placements:** recommended (error), client (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to client, ui-action when those surfaces are known. Mixed client/server UI Actions stay silent because execution regions are not classified. Unknown surfaces stay silent.
- **JavaScript mode:** Not instance-executed, or independent of JavaScript mode unless a rule documents a mode gate.
- **Last verified:** 2026-08-22
- **Implementation:** [`src/rules/no-client-gliderecord.ts`](../../src/rules/no-client-gliderecord.ts)

## Applicability

| Dimension | Value |
| --- | --- |
| Authoring | classic |
| Surfaces | Applies to client, ui-action when those surfaces are known. Mixed client/server UI Actions stay silent because execution regions are not classified. Unknown surfaces stay silent. |
| Minimum surface confidence | filename-inferred |
| JavaScript modes | n/a |
| Application scopes | scoped |
| ServiceNow releases | zurich, australia |
| Fluent SDK range | n/a |

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| _(none)_ | | | This rule has no options. |

## Incorrect

### Incorrect: client script

```js
function onChange() {
  var gr = new GlideRecord("sys_user");
  gr.addQuery("user_name", g_user.userName);
  gr.query();
}
```

## Correct

### Correct: GlideAjax

```js
function onChange() {
  var ga = new GlideAjax("x_acme.UserUtils");
  ga.addParam("sysparm_name", "getUser");
  ga.getXMLAnswer(function (answer) {
    g_form.setValue("caller_id", answer);
  });
}
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: Mixed client/server UI Actions stay silent because the rule cannot classify execution regions. scope-boundary: Global and unknown application scope stay silent because ServiceNow documents the client API in global applications and only marks scoped applications unsupported.

## Known false positives

- None recorded.

## Known false negatives

- None recorded.

## Intentional scope boundaries

- Mixed client/server UI Actions stay silent because the rule cannot classify execution regions.
- Global and unknown application scope stay silent because ServiceNow documents the client API in global applications and only marks scoped applications unsupported.

## Overlaps

- `servicenow/require-query-before-next`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **The Australia client GlideRecord API is unsupported in scoped applications.**
  - Verification ID: `rule-evidence-063e6d0e`
  - URL: https://www.servicenow.com/docs/r/api-reference/c_GlideRecordClientSideAPI.html
  - Verified by: manual
  - Verified at: 2026-08-22
- **ServiceNow no longer recommends client GlideRecord or getReference for performance because they retrieve all fields.**
  - Verification ID: `rule-evidence-efff6b3b`
  - URL: https://www.servicenow.com/docs/r/api-reference/scripts/client-script-best-practices.html
  - Verified by: manual
  - Verified at: 2026-08-22
- **Recommended Oxlint and ESLint flag GlideRecord in client files.**
  - Verification ID: `rule-evidence-a0a91c4c`
  - URL: tests/integration/profiles/invalid/client-gliderecord.client.js
  - Verified by: integration-test
  - Verified at: 2026-08-20
- **Oxlint and ESLint flag direct, global namespace, computed, aliased, and destructured constructors.**
  - Verification ID: `rule-evidence-781ecc67`
  - URL: tests/integration/context-contracts.test.ts
  - Verified by: integration-test
  - Verified at: 2026-08-21

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
