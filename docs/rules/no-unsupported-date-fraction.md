# servicenow/no-unsupported-date-fraction

Australia adds variable-length ISO fractional-second parsing to all JavaScript modes, while Zurich accepts fractional seconds only when exactly three digits are present. This rule reports statically proven native Date constructor or Date.parse calls whose otherwise valid timestamp uses a different length.

- **Family:** engine
- **Preset:** classic-es5
- **Placements:** classic-es5 (error), es2021 (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Actions require an explicit server surface; mixed client/server UI Actions stay silent because execution regions are not classified. An explicit javascriptMode also enables documented engine checks in otherwise unclassified files.
- **JavaScript mode:** Runs when javascriptMode is compatibility, es5, es2021, unknown. Universal restrictions can run with unknown mode when the file is a known instance script.
- **Last verified:** 2026-08-24
- **Implementation:** [`src/rules/no-unsupported-date-fraction.ts`](../../src/rules/no-unsupported-date-fraction.ts)

## Applicability

| Dimension | Value |
| --- | --- |
| Authoring | classic |
| Surfaces | Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Actions require an explicit server surface; mixed client/server UI Actions stay silent because execution regions are not classified. An explicit javascriptMode also enables documented engine checks in otherwise unclassified files. |
| Minimum surface confidence | filename-inferred |
| JavaScript modes | compatibility, es5, es2021, unknown |
| Application scopes | global, scoped, unknown |
| ServiceNow releases | zurich, australia |
| Fluent SDK range | n/a |

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| _(none)_ | | | This rule has no options. |

## Incorrect

### Incorrect: two fractional digits in Zurich

```js
var parsed = new Date("2025-05-07T09:05:20.78Z");
```

## Correct

### Correct: two fractional digits in Australia

```js
var parsed = new Date("2025-05-07T09:05:20.78Z");
```

### Correct: portable three-digit fraction

```js
var parsed = new Date("2025-05-07T09:05:20.780Z");
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. false-negative: Dynamic date strings stay silent; the rule requires a static string or a dominating same-execution const alias. false-negative: Extended years, timezone offsets without a colon, and other legacy Date string forms stay silent; the rule validates a narrow complete ISO timestamp before diagnosing. false-negative: Extracted Date.parse methods, call/apply/bind helpers, Reflect.construct, subclasses, and constructor or string aliases crossing an execution boundary stay silent; the rule models direct native parsing operations and stable same-execution owner aliases. scope-boundary: A possible Date binding replacement suppresses constructor diagnostics; a Date namespace escape or Date.parse replacement suppresses static-method diagnostics because those operations can select different parsing semantics. scope-boundary: Variable-length fractional seconds stay silent when settings.servicenow.release is omitted because Zurich and Australia disagree.

## Known false positives

- None recorded.

## Known false negatives

- Dynamic date strings stay silent; the rule requires a static string or a dominating same-execution const alias.
- Extended years, timezone offsets without a colon, and other legacy Date string forms stay silent; the rule validates a narrow complete ISO timestamp before diagnosing.
- Extracted Date.parse methods, call/apply/bind helpers, Reflect.construct, subclasses, and constructor or string aliases crossing an execution boundary stay silent; the rule models direct native parsing operations and stable same-execution owner aliases.

## Intentional scope boundaries

- A possible Date binding replacement suppresses constructor diagnostics; a Date namespace escape or Date.parse replacement suppresses static-method diagnostics because those operations can select different parsing semantics.
- Variable-length fractional seconds stay silent when settings.servicenow.release is omitted because Zurich and Australia disagree.

## Overlaps

- None recorded.

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **The Australia JavaScript engine update lists Rhino PR 1896, Enhance date string parsing with optional millisecond digits, as a feature applicable to all JavaScript modes.**
  - Verification ID: `rule-evidence-b608b229`
  - URL: https://www.servicenow.com/docs/r/api-reference/scripts/updates-javascript-engine.html
  - Verified by: manual
  - Verified at: 2026-08-24
- **Fixtures cover one, two, and more than three fraction digits; calendar, time, and offset validity; all modes; release omission; static aliases; native Date authority; shadowing; and unsupported contexts.**
  - Verification ID: `rule-evidence-9e667042`
  - URL: tests/rules/no-unsupported-date-fraction.test.ts
  - Verified by: fixture
  - Verified at: 2026-08-24
- **Real Oxlint and ESLint contracts verify Zurich, Australia, and omitted-release behavior for native Date construction and Date.parse.**
  - Verification ID: `rule-evidence-17ae981b`
  - URL: tests/integration/release-contracts.test.ts
  - Verified by: integration-test
  - Verified at: 2026-08-24

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
