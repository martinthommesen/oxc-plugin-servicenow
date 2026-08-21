# servicenow/no-sync-glideajax

`getXMLWait()` blocks the browser and does not work in Service Portal. Use `getXML()` / `getXMLAnswer()`.

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
- **Implementation:** [`src/rules/no-sync-glideajax.ts`](../../src/rules/no-sync-glideajax.ts)

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

### Incorrect: getXMLWait

```js
var ga = new GlideAjax("x_acme.UserUtils");
ga.addParam("sysparm_name", "getUser");
var xml = ga.getXMLWait();
var answer = xml.documentElement.getAttribute("answer");
```

## Correct

### Correct: getXMLAnswer

```js
var ga = new GlideAjax("x_acme.UserUtils");
ga.addParam("sysparm_name", "getUser");
ga.getXMLAnswer(function (answer) {
  g_form.setValue("caller_id", answer);
});
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing.

## Known false positives

- None recorded.

## Known false negatives

- None recorded.

## Intentional scope boundaries

- None recorded.

## Overlaps

- `servicenow/no-glideajax-getanswer`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **getXMLWait is a synchronous browser request.**
  - Verification ID: `rule-evidence-cb70312b`
  - URL: https://www.servicenow.com/docs/r/api-reference/c_GlideAjaxAPI.html
  - Verified by: manual
  - Verified at: 2026-08-20
- **Catalog examples cover getXMLWait versus getXMLAnswer.**
  - Verification ID: `rule-evidence-49c24e2d`
  - URL: src/catalog.ts
  - Verified by: fixture
  - Verified at: 2026-08-20

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
