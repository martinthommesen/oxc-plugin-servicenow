# servicenow/no-hardcoded-table-names

Optional organizational policy. String-literal table names in `GlideRecord` / `GlideRecordSecure` / `GlideAggregate` are hard to rename. Prefer named constants or Fluent table exports.

- **Family:** classic
- **Preset:** policy
- **Placements:** policy (warn)
- **Default severity:** warn
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Classic instance scripts. Client-only rules skip server-only files. Fluent files are skipped.
- **JavaScript mode:** Independent of JavaScript mode unless the rule documents a mode gate.
- **Last verified:** 2026-08-19
- **Implementation:** [`src/rules/no-hardcoded-table-names.ts`](../../src/rules/no-hardcoded-table-names.ts)

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

When provenance, surface, or JavaScript mode is unknown, the rule stays silent instead of guessing.

## Evidence

- None recorded. Add an authoritative ServiceNow or Oxc link before expanding this rule.

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
