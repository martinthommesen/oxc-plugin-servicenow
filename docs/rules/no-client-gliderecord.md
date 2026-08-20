# servicenow/no-client-gliderecord

Client-side GlideRecord is slow, often blocked, and a security smell. Use GlideAjax, Scripted REST, or `g_form.getReference()`.

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
- **Implementation:** [`src/rules/no-client-gliderecord.ts`](../../src/rules/no-client-gliderecord.ts)

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

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. False positive: Server UI Actions that only share a client-looking filename when surfaces are explicit. False negative: Client scripts whose surface stays unknown.

## Known false positives

- Server UI Actions that only share a client-looking filename when surfaces are explicit.

## Known false negatives

- Client scripts whose surface stays unknown.

## Overlaps

- `servicenow/require-query-before-next`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **GlideRecord is a server API and is not a client-side record cursor.**
  - URL: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html
  - Verified by: declaration-snapshot
  - Verified at: 2026-08-20
- **Recommended Oxlint and ESLint flag GlideRecord in client files.**
  - URL: tests/integration/profiles/invalid/client-gliderecord.client.js
  - Verified by: integration-test
  - Verified at: 2026-08-20

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
