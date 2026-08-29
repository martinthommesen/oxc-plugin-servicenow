# servicenow/no-packages-calls

The Rhino `Packages.*` Java bridge is unavailable in scoped apps and on the modern engine.

- **Family:** classic
- **Preset:** recommended
- **Placements:** recommended (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to client, server, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. Unknown surfaces stay silent.
- **JavaScript mode:** Runs when javascriptMode is compatibility, es5, es2021. Unknown mode stays silent.
- **Last verified:** 2026-08-21
- **Implementation:** [`src/rules/no-packages-calls.ts`](../../src/rules/no-packages-calls.ts)

## Applicability

| Dimension | Value |
| --- | --- |
| Authoring | classic |
| Surfaces | Applies to client, server, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. Unknown surfaces stay silent. |
| Minimum surface confidence | filename-inferred |
| JavaScript modes | compatibility, es5, es2021 |
| Application scopes | global, scoped, unknown |
| ServiceNow releases | zurich |
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

Unknown, escaped, or ambiguous bindings stay silent instead of guessing.

## Known false positives

- None recorded.

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

- **Packages.* Java interop is not a supported ServiceNow JavaScript API.**
  - Verification ID: `rule-evidence-0e3b2a8d`
  - URL: https://www.servicenow.com/docs/r/zurich/api-reference/scripts/javascript-engine-feature-support.html
  - Verified by: manual
  - Verified at: 2026-08-20
- **Fixtures cover static and dynamic Packages access versus local bindings named Packages.**
  - Verification ID: `rule-evidence-2126ac25`
  - URL: tests/rules/glide-and-engine.test.ts
  - Verified by: fixture
  - Verified at: 2026-08-21

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
