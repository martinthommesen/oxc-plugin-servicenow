# servicenow/no-hardcoded-sysid

Hardcoded 32-character sys_ids break when an app is installed on another instance. Store them in a system property, a named constant, or Fluent `Now.ID`.

- **Family:** classic
- **Preset:** recommended
- **Placements:** recommended (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Classic instance scripts. Client-only rules skip server-only files. Fluent files are skipped.
- **JavaScript mode:** Independent of JavaScript mode unless the rule documents a mode gate.
- **Last verified:** 2026-08-19
- **Implementation:** [`src/rules/no-hardcoded-sysid.ts`](../../src/rules/no-hardcoded-sysid.ts)

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `allowedSysIds` | string[] | `[]` | Additional sys_ids that this rule allows. Settings `allowedSysIds` are also allowed. |
| `ignoreHashNames` | boolean | `true` | Ignore 32-character hex strings next to names that look like MD5 hashes. |

## Incorrect

### Incorrect: literal sys_id

```js
var assignmentGroup = "97c04b3b1b12100043ab85e5bd0713e2";
current.assignment_group = assignmentGroup;
```

## Correct

### Correct: system property

```js
var assignmentGroup = gs.getProperty("x_acme.default_assignment_group");
current.assignment_group = assignmentGroup;
```

## Limitations

When provenance, surface, or JavaScript mode is unknown, the rule stays silent instead of guessing.

## Evidence

- None recorded. Add an authoritative ServiceNow or Oxc link before expanding this rule.

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
