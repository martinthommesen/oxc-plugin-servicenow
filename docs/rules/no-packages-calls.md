# servicenow/no-packages-calls

Optional migration policy. Review Rhino `Packages.*` bridge calls; Australia's removal tool specifically targets ServiceNow Java classes and distinguishes MID Server execution.

- **Family:** classic
- **Preset:** policy
- **Placements:** policy (warn)
- **Default severity:** warn
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Actions require an explicit server surface; mixed client/server UI Actions stay silent because execution regions are not classified. Unknown surfaces stay silent.
- **JavaScript mode:** Not instance-executed, or independent of JavaScript mode unless a rule documents a mode gate.
- **Last verified:** 2026-08-22
- **Implementation:** [`src/rules/no-packages-calls.ts`](../../src/rules/no-packages-calls.ts)

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

### Incorrect: Packages call

```js
var result = Packages.com.glide.sys.GlideSystem.now();
```

## Correct

### Correct: Glide API

```js
var result = new GlideDateTime();
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. false-positive: The syntax-only review also flags Java classes outside the scope of the ServiceNow class-removal tool. false-positive: Static source alone cannot prove that a record executes on a MID Server, which Australia documents as a separate review outcome.

## Known false positives

- The syntax-only review also flags Java classes outside the scope of the ServiceNow class-removal tool.
- Static source alone cannot prove that a record executes on a MID Server, which Australia documents as a separate review outcome.

## Known false negatives

- None recorded.

## Intentional scope boundaries

- None recorded.

## Overlaps

- None recorded.

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **The Australia Packages Call Removal Tool says Packages calls to ServiceNow Java classes will be prevented in a future release.**
  - Verification ID: `rule-evidence-3a0c56bc`
  - URL: https://www.servicenow.com/docs/r/api-reference/scripts/c_PackagesCallRemovalTool.html
  - Verified by: manual
  - Verified at: 2026-08-22
- **Fixtures cover static and dynamic Packages access versus local bindings named Packages.**
  - Verification ID: `rule-evidence-842a8fbc`
  - URL: tests/rules/glide-and-engine.test.ts
  - Verified by: fixture
  - Verified at: 2026-08-21

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
