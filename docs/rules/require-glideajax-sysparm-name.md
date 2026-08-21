# servicenow/require-glideajax-sysparm-name

GlideAjax requires a non-empty `addParam("sysparm_name", method)` before `getXML` / `getXMLAnswer` / `getXMLWait`. Extra static keys must start with `sysparm_`. Evidence: https://www.servicenow.com/docs/r/api-reference/scripts/p_AJAX.html

- **Family:** classic
- **Preset:** recommended
- **Placements:** recommended (error), client (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to client, ui-action when those surfaces are known. Unknown surfaces stay silent.
- **JavaScript mode:** Not instance-executed, or independent of JavaScript mode unless a rule documents a mode gate.
- **Last verified:** 2026-08-20
- **Implementation:** [`src/rules/require-glideajax-sysparm-name.ts`](../../src/rules/require-glideajax-sysparm-name.ts)

## Applicability

| Dimension | Value |
| --- | --- |
| Authoring | classic |
| Surfaces | Applies to client, ui-action when those surfaces are known. Unknown surfaces stay silent. |
| Minimum surface confidence | filename-inferred |
| JavaScript modes | n/a |
| Application scopes | global, scoped, unknown |
| ServiceNow releases | zurich |
| Fluent SDK range | n/a |

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| _(none)_ | | | This rule has no options. |

## Incorrect

### Incorrect: missing sysparm_name

```js
var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_user_id", g_form.getValue("caller_id"));
ajax.getXMLAnswer(handleAnswer);
```

## Correct

### Correct: named method

```js
var ajax = new GlideAjax("x_acme.UserLookup");
ajax.addParam("sysparm_name", "getManager");
ajax.addParam("sysparm_user_id", g_form.getValue("caller_id"));
ajax.getXMLAnswer(handleAnswer);
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. lifecycle: A later request on the same object requires a new usable sysparm_name.

## Known false positives

- None recorded.

## Known false negatives

- None recorded.

## Intentional scope boundaries

- None recorded.

## Overlaps

- `servicenow/no-glideajax-getanswer`
- `servicenow/no-sync-glideajax`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: A later request on the same object requires a new usable sysparm_name.

## Evidence

- **GlideAjax requires a non-empty sysparm_name before getXML, getXMLAnswer, or getXMLWait.**
  - Verification ID: `rule-evidence-6bbe917f`
  - URL: https://www.servicenow.com/docs/r/api-reference/scripts/p_AJAX.html
  - Verified by: manual
  - Verified at: 2026-08-20
- **Empty or missing sysparm_name values report on the client host fixtures.**
  - Verification ID: `rule-evidence-2360ef01`
  - URL: tests/integration/profiles/invalid/glideajax-empty-sysparm.client.js
  - Verified by: integration-test
  - Verified at: 2026-08-20

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
