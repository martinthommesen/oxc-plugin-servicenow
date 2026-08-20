# servicenow/no-unfiltered-gliderecord-bulk-operation

`updateMultiple()` / `deleteMultiple()` without a proven restricting filter can touch every row. `query`, `orderBy`, `setLimit`, and `chooseWindow` are not filters. Empty `addQuery()` / `addEncodedQuery("")` do not count.

- **Family:** classic
- **Preset:** recommended
- **Placements:** recommended (warn)
- **Default severity:** warn
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Classic instance scripts. Client-only rules skip server-only files. Fluent files are skipped.
- **JavaScript mode:** Independent of JavaScript mode unless the rule documents a mode gate.
- **Last verified:** 2026-08-20
- **Implementation:** [`src/rules/no-unfiltered-gliderecord-bulk-operation.ts`](../../src/rules/no-unfiltered-gliderecord-bulk-operation.ts)

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| _(none)_ | | | This rule has no options. |

## Incorrect

### Incorrect: deleteMultiple with no filter

```js
var staging = new GlideRecord("x_acme_staging");
staging.deleteMultiple();
```

## Correct

### Correct: filtered updateMultiple

```js
var task = new GlideRecord("task");
task.addQuery("active", false);
task.setValue("u_migrated", true);
task.updateMultiple();
```

## Limitations

Static analysis cannot prove runtime field names or encoded-query syntax. Missing or empty filter arguments do not count. Dynamic filter expressions and one-branch filters stay silent.

## Evidence

- None recorded. Add an authoritative ServiceNow or Oxc link before expanding this rule.

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
