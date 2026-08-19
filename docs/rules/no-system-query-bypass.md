# servicenow/no-system-query-bypass

Opt-in security review for documented ACL-bypass query APIs: `addSystemQuery`, `addSystemEncodedQuery`, `addSystemOrderBy`, `addSystemOrderByDesc`.

- **Family:** classic
- **Preset:** security
- **Placements:** security (warn)
- **Default severity:** warn
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Classic instance scripts. Client-only rules skip server-only files. Fluent files are skipped.
- **JavaScript mode:** Independent of JavaScript mode unless the rule documents a mode gate.
- **Last verified:** 2026-08-19
- **Implementation:** [`src/rules/no-system-query-bypass.ts`](../../src/rules/no-system-query-bypass.ts)

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

When provenance, surface, or JavaScript mode is unknown, the rule stays silent instead of guessing.

## Evidence

- None recorded. Add an authoritative ServiceNow or Oxc link before expanding this rule.

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
