# servicenow/no-gs-now

`gs.now()` and `gs.nowDateTime()` return timezone-sensitive display strings. `gs.now()` is also gone from client scripts since London. Prefer `new GlideDateTime()`.

- **Family:** classic
- **Preset:** recommended
- **Placements:** recommended (error), client (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to client, server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Actions require an explicit server surface; mixed client/server UI Actions stay silent because execution regions are not classified. Unknown surfaces stay silent.
- **JavaScript mode:** Not instance-executed, or independent of JavaScript mode unless a rule documents a mode gate.
- **Last verified:** 2026-08-24
- **Implementation:** [`src/rules/no-gs-now.ts`](../../src/rules/no-gs-now.ts)

## Applicability

| Dimension | Value |
| --- | --- |
| Authoring | classic |
| Surfaces | Applies to client, server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Actions require an explicit server surface; mixed client/server UI Actions stay silent because execution regions are not classified. Unknown surfaces stay silent. |
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

### Incorrect: gs.now

```js
current.u_opened = gs.now();
```

### Incorrect: gs.nowDateTime

```js
current.u_opened = gs.nowDateTime();
```

## Correct

### Correct: GlideDateTime

```js
current.u_opened = new GlideDateTime();
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: Local objects named gs are not the platform global. false-negative: A possible gs or target-method mutation suppresses every matching call in the file, including calls that appear before the mutation.

## Known false positives

- None recorded.

## Known false negatives

- A possible gs or target-method mutation suppresses every matching call in the file, including calls that appear before the mutation.

## Intentional scope boundaries

- Local objects named gs are not the platform global.

## Overlaps

- `servicenow/no-display-value-date-comparison`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **gs.now() and gs.nowDateTime() return display strings, not GlideDateTime objects.**
  - Verification ID: `rule-evidence-b0fb0fe2`
  - URL: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideDateTimeAPI.html
  - Verified by: manual
  - Verified at: 2026-08-20
- **Host fixtures report gs.now on Business Rule files.**
  - Verification ID: `rule-evidence-af5507fd`
  - URL: tests/integration/fixtures/bad-business-rule.br.js
  - Verified by: integration-test
  - Verified at: 2026-08-20
- **Oxlint and ESLint stay silent when visible writes make the gs global or target method identity unknown.**
  - Verification ID: `rule-evidence-0c8164bf`
  - URL: tests/integration/context-contracts.test.ts
  - Verified by: integration-test
  - Verified at: 2026-08-24

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
