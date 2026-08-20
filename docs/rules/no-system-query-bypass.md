# servicenow/no-system-query-bypass

Opt-in security review for documented ACL-bypass query APIs: `addSystemQuery`, `addSystemEncodedQuery`, `addSystemOrderBy`, `addSystemOrderByDesc`.

- **Family:** classic
- **Preset:** security
- **Placements:** security (warn)
- **Default severity:** warn
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to server, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. Unknown surfaces stay silent.
- **JavaScript mode:** Not instance-executed, or independent of JavaScript mode unless a rule documents a mode gate.
- **Last verified:** 2026-08-20
- **Implementation:** [`src/rules/no-system-query-bypass.ts`](../../src/rules/no-system-query-bypass.ts)

## Applicability

| Dimension | Value |
| --- | --- |
| Authoring | classic |
| Surfaces | Applies to server, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. Unknown surfaces stay silent. |
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

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. False positive: Intentional admin maintenance scripts. False negative: Bypass methods reached through computed names.

## Known false positives

- Intentional admin maintenance scripts.

## Known false negatives

- Bypass methods reached through computed names.

## Overlaps

- None recorded.

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **addSystemQuery and related methods bypass query ACLs and need review.**
  - URL: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html
  - Verified by: declaration-snapshot
  - Verified at: 2026-08-20
- **The security profile reports documented ACL-bypass methods.**
  - URL: tests/integration/profiles/invalid/system-query.br.js
  - Verified by: integration-test
  - Verified at: 2026-08-20

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
