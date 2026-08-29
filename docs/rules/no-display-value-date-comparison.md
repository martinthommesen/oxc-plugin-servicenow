# servicenow/no-display-value-date-comparison

Do not relationally compare `GlideDateTime.getDisplayValue()` strings. Use `getNumericValue()` or a date-aware API.

- **Family:** classic
- **Preset:** strict
- **Placements:** strict (warn)
- **Default severity:** warn
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Actions require an explicit server surface; mixed client/server UI Actions stay silent because execution regions are not classified. Unknown surfaces stay silent.
- **JavaScript mode:** Not instance-executed, or independent of JavaScript mode unless a rule documents a mode gate.
- **Last verified:** 2026-08-24
- **Implementation:** [`src/rules/no-display-value-date-comparison.ts`](../../src/rules/no-display-value-date-comparison.ts)

## Applicability

| Dimension | Value |
| --- | --- |
| Authoring | classic |
| Surfaces | Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Actions require an explicit server surface; mixed client/server UI Actions stay silent because execution regions are not classified. Unknown surfaces stay silent. |
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

### Incorrect: display string compare

```js
var start = new GlideDateTime(current.start_date);
var end = new GlideDateTime(current.end_date);
if (start.getDisplayValue() > end.getDisplayValue()) {
  gs.addErrorMessage("Start must be before end");
}
```

## Correct

### Correct: numeric compare

```js
var start = new GlideDateTime(current.start_date);
var end = new GlideDateTime(current.end_date);
if (start.getNumericValue() > end.getNumericValue()) {
  gs.addErrorMessage("Start must be before end");
}
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. false-negative: Display values copied into locals are not tracked before comparison. false-negative: A possible platform constructor namespace reassignment, prototype or relevant instance-method mutation, or dynamic-scope uncertainty suppresses matching diagnostics throughout the file.

## Known false positives

- None recorded.

## Known false negatives

- Display values copied into locals are not tracked before comparison.
- A possible platform constructor namespace reassignment, prototype or relevant instance-method mutation, or dynamic-scope uncertainty suppresses matching diagnostics throughout the file.

## Intentional scope boundaries

- None recorded.

## Overlaps

- `servicenow/no-gs-now`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **GlideDateTime.getDisplayValue() follows the session format and is not a chronological sort key.**
  - Verification ID: `rule-evidence-16c3e6e5`
  - URL: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideDateTimeAPI.html
  - Verified by: manual
  - Verified at: 2026-08-20
- **Catalog examples cover display-value comparison versus getNumericValue.**
  - Verification ID: `rule-evidence-54d15346`
  - URL: src/catalog.ts
  - Verified by: fixture
  - Verified at: 2026-08-20
- **Constructor namespace, prototype, instance-method, and dynamic-scope mutations are covered by shared platform-authority fixtures.**
  - Verification ID: `rule-evidence-825ff6f9`
  - URL: tests/rules/platform-method-authority.test.ts
  - Verified by: fixture
  - Verified at: 2026-08-24

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
