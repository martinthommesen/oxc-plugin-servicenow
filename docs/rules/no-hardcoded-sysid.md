# servicenow/no-hardcoded-sysid

Hardcoded 32-character sys_ids break when an app is installed on another instance. Store them in a system property, a named constant, or Fluent `Now.ID`.

- **Family:** classic
- **Preset:** recommended
- **Placements:** recommended (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to client, server, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Actions require an explicit server surface; mixed client/server UI Actions stay silent because execution regions are not classified. Unknown surfaces stay silent.
- **JavaScript mode:** Not instance-executed, or independent of JavaScript mode unless a rule documents a mode gate.
- **Last verified:** 2026-08-21
- **Implementation:** [`src/rules/no-hardcoded-sysid.ts`](../../src/rules/no-hardcoded-sysid.ts)

## Applicability

| Dimension | Value |
| --- | --- |
| Authoring | classic |
| Surfaces | Applies to client, server, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Actions require an explicit server surface; mixed client/server UI Actions stay silent because execution regions are not classified. Unknown surfaces stay silent. |
| Minimum surface confidence | filename-inferred |
| JavaScript modes | n/a |
| Application scopes | global, scoped, unknown |
| ServiceNow releases | zurich, australia |
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

Unknown, escaped, or ambiguous bindings stay silent instead of guessing.

## Known false positives

- None recorded.

## Known false negatives

- None recorded.

## Intentional scope boundaries

- None recorded.

## Overlaps

- `servicenow/no-now-id-as-reference`
- `core no-restricted-syntax`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **Named Fluent Now.ID keys are the supported portable identity, not raw sys_id literals.**
  - Verification ID: `rule-evidence-2d6f67d8`
  - URL: https://www.servicenow.com/docs/r/application-development/servicenow-sdk/fluent-constructs.html
  - Verified by: manual
  - Verified at: 2026-08-20
- **Literal, uppercase, concatenated, and static-template sys_ids report; exact allow-lists and algorithm-specific hash contexts suppress.**
  - Verification ID: `rule-evidence-586f6257`
  - URL: tests/rules/no-hardcoded-sysid.test.ts
  - Verified by: fixture
  - Verified at: 2026-08-21

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
