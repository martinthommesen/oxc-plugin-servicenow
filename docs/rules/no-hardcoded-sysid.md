# servicenow/no-hardcoded-sysid

Hardcoded 32-character sys_ids break when an app is installed on another instance. Store them in a system property, a named constant, or Fluent `Now.ID`.

- **Family:** classic
- **Preset:** recommended
- **Placements:** recommended (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to client, server, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. Unknown surfaces stay silent.
- **JavaScript mode:** Not instance-executed, or independent of JavaScript mode unless a rule documents a mode gate.
- **Last verified:** 2026-08-20
- **Implementation:** [`src/rules/no-hardcoded-sysid.ts`](../../src/rules/no-hardcoded-sysid.ts)

## Applicability

| Dimension | Value |
| --- | --- |
| Authoring | classic |
| Surfaces | Applies to client, server, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. Unknown surfaces stay silent. |
| Minimum surface confidence | filename-inferred |
| JavaScript modes | n/a |
| Application scopes | global, scoped, unknown |
| ServiceNow releases | zurich |
| Fluent SDK range | n/a |

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

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. False positive: Uppercase 32-hex strings that are not ServiceNow sys_ids. False positive: MD5-like binding names when ignoreHashNames is true. False negative: sys_ids built by concatenation or runtime encoding.

## Known false positives

- Uppercase 32-hex strings that are not ServiceNow sys_ids.
- MD5-like binding names when ignoreHashNames is true.

## Known false negatives

- sys_ids built by concatenation or runtime encoding.

## Overlaps

- `servicenow/no-now-id-as-reference`
- `core no-restricted-syntax`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **Named Fluent Now.ID keys are the supported portable identity, not raw sys_id literals.**
  - URL: https://www.servicenow.com/docs/r/application-development/servicenow-sdk/fluent-constructs.html
  - Verified by: declaration-snapshot
  - Verified at: 2026-08-20
- **Literal 32-hex strings report; settings and option allow-lists suppress.**
  - URL: tests/rules/no-hardcoded-sysid.test.ts
  - Verified by: fixture
  - Verified at: 2026-08-20

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
