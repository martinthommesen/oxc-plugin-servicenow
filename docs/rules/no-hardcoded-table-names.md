# servicenow/no-hardcoded-table-names

Optional organizational policy. String-literal table names in `GlideRecord` / `GlideRecordSecure` / `GlideAggregate` are hard to rename. Prefer named constants or Fluent table exports.

- **Family:** classic
- **Preset:** policy
- **Placements:** policy (warn)
- **Default severity:** warn
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Actions require an explicit server surface; mixed client/server UI Actions stay silent because execution regions are not classified. Unknown surfaces stay silent.
- **JavaScript mode:** Not instance-executed, or independent of JavaScript mode unless a rule documents a mode gate.
- **Last verified:** 2026-08-20
- **Implementation:** [`src/rules/no-hardcoded-table-names.ts`](../../src/rules/no-hardcoded-table-names.ts)

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
| `allowedTables` | string[] | `[]` | Additional table names this rule allows. Settings `allowedTables` are also allowed. |
| `allowBuiltins` | boolean | `false` | Allow the built-in platform table list from `BUILTIN_TABLES`. |

## Incorrect

### Incorrect: literal table

```js
var gr = new GlideRecord("x_acme_widget");
```

## Correct

### Correct: named constant

```js
var TABLE = { WIDGET: "x_acme_widget" };
var gr = new GlideRecord(TABLE.WIDGET);
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

- `servicenow/fluent-naming-convention`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **Table names passed to GlideRecord constructors are string identities that do not rename safely.**
  - Verification ID: `rule-evidence-cdad38f6`
  - URL: https://www.servicenow.com/docs/r/zurich/api-reference/server-api-reference/c_GlideRecordScopedAPI.html
  - Verified by: manual
  - Verified at: 2026-08-20
- **Literal tables report; named constants and allow-lists stay silent.**
  - Verification ID: `rule-evidence-413d1e54`
  - URL: tests/rules/glide-and-engine.test.ts
  - Verified by: fixture
  - Verified at: 2026-08-20

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
