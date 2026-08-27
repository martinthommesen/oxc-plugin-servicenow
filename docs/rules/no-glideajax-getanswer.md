# servicenow/no-glideajax-getanswer

`getAnswer()` belongs to synchronous GlideAjax. Use `getXMLAnswer(callback)` instead. Evidence: https://www.servicenow.com/docs/r/api-reference/c_GlideAjaxAPI.html

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
- **Implementation:** [`src/rules/no-glideajax-getanswer.ts`](../../src/rules/no-glideajax-getanswer.ts)

## Applicability

| Dimension | Value |
| --- | --- |
| Authoring | classic |
| Surfaces | Applies to client, ui-action when those surfaces are known. Mixed client/server UI Actions stay silent because execution regions are not classified. Unknown surfaces stay silent. |
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

### Incorrect: getAnswer after getXML

```js
var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_name", "getManager");
ajax.getXML(handleResponse);
var answer = ajax.getAnswer();
```

## Correct

### Correct: getXMLAnswer callback

```js
var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_name", "getManager");
ajax.getXMLAnswer(function (answer) {
  g_form.setValue("u_manager", answer);
});
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. false-negative: A possible GlideAjax constructor, prototype, or getAnswer mutation suppresses matching calls throughout the file.

## Known false positives

- None recorded.

## Known false negatives

- A possible GlideAjax constructor, prototype, or getAnswer mutation suppresses matching calls throughout the file.

## Intentional scope boundaries

- None recorded.

## Overlaps

- `servicenow/no-sync-glideajax`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **getAnswer belongs to the synchronous getXMLWait pattern.**
  - Verification ID: `rule-evidence-29a12bef`
  - URL: https://www.servicenow.com/docs/r/api-reference/c_GlideAjaxAPI.html
  - Verified by: manual
  - Verified at: 2026-08-20
- **Recommended hosts report getAnswer on proven GlideAjax objects.**
  - Verification ID: `rule-evidence-2082b02e`
  - URL: tests/integration/profiles/invalid/glideajax-getanswer.client.js
  - Verified by: integration-test
  - Verified at: 2026-08-20
- **Constructor, prototype, instance-method, and dynamic-scope mutations remain silent.**
  - Verification ID: `rule-evidence-1218bf8a`
  - URL: tests/rules/no-glideajax-getanswer.test.ts
  - Verified by: fixture
  - Verified at: 2026-08-24

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
