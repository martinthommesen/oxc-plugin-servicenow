# servicenow/no-client-gliderecord

Proven platform GlideRecord calls are unsupported in scoped client applications. Query on the server with GlideAjax or Scripted REST.

- **Family:** classic
- **Preset:** recommended
- **Placements:** recommended (error), client (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to client, ui-action when those surfaces are known. Mixed client/server UI Actions stay silent because execution regions are not classified. Unknown surfaces stay silent.
- **JavaScript mode:** Not instance-executed, or independent of JavaScript mode unless a rule documents a mode gate.
- **Last verified:** 2026-08-24
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

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: Mixed client/server UI Actions stay silent because the rule cannot classify execution regions. scope-boundary: Global and unknown application scope stay silent because ServiceNow documents the client API in global applications and only marks scoped applications unsupported. false-negative: Aliases assigned outside their declaration stay silent even when every visible branch selects a platform constructor; proving that identity requires path-sensitive constructor-value analysis. false-negative: Aliases used from another function body stay silent because source order alone cannot prove that the initializer ran before the function was called. false-negative: A possible platform-constructor or namespace replacement suppresses matching calls throughout the file, including calls that appear before the replacement; source order alone does not establish runtime order across function bodies.

## Known false positives

- None recorded.

## Known false negatives

- Aliases assigned outside their declaration stay silent even when every visible branch selects a platform constructor; proving that identity requires path-sensitive constructor-value analysis.
- Aliases used from another function body stay silent because source order alone cannot prove that the initializer ran before the function was called.
- A possible platform-constructor or namespace replacement suppresses matching calls throughout the file, including calls that appear before the replacement; source order alone does not establish runtime order across function bodies.

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
- **Oxlint and ESLint flag direct, global namespace, computed, stable aliased, and destructured constructors without leaking mutually exclusive alias assignments.**
  - Verification ID: `rule-evidence-601c887d`
  - URL: tests/integration/context-contracts.test.ts
  - Verified by: integration-test
  - Verified at: 2026-08-24
- **Adversarial fixtures cover branch order, alias writes and dominance, shadowing, dynamic scope, namespace escape, and visible platform replacement.**
  - Verification ID: `rule-evidence-759a7da8`
  - URL: tests/rules/no-client-gliderecord.test.ts
  - Verified by: fixture
  - Verified at: 2026-08-24

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
