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
- **Last verified:** 2026-08-20
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

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. False positive: Object keys named Packages. False negative: Indirect Packages access through computed members.

## Known false positives

- Object keys named Packages.

## Known false negatives

- Indirect Packages access through computed members.

## Overlaps

- None recorded.

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **Packages.* Java interop is not a supported ServiceNow JavaScript API.**
  - URL: https://www.servicenow.com/docs/r/zurich/api-reference/scripts/javascript-engine-feature-support.html
  - Verified by: declaration-snapshot
  - Verified at: 2026-08-20
- **Catalog examples cover Packages.java versus local bindings named Packages.**
  - URL: src/catalog.ts
  - Verified by: fixture
  - Verified at: 2026-08-20

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
