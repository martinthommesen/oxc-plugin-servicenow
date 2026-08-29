# servicenow/no-object-method-constructor

ServiceNow Australia enforces ECMAScript's non-constructible shorthand object methods, while Zurich's ES2021 engine incorrectly permits them. This rule reports direct `new` calls through a stable object or method alias only when method identity cannot have changed.

- **Family:** engine
- **Preset:** es2021
- **Placements:** es2021 (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Actions require an explicit server surface; mixed client/server UI Actions stay silent because execution regions are not classified. An explicit javascriptMode also enables documented engine checks in otherwise unclassified files.
- **JavaScript mode:** Runs when javascriptMode is es2021. Unknown mode stays silent.
- **Last verified:** 2026-08-24
- **Implementation:** [`src/rules/no-object-method-constructor.ts`](../../src/rules/no-object-method-constructor.ts)

## Applicability

| Dimension | Value |
| --- | --- |
| Authoring | classic |
| Surfaces | Applies to server, acl, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Actions require an explicit server surface; mixed client/server UI Actions stay silent because execution regions are not classified. An explicit javascriptMode also enables documented engine checks in otherwise unclassified files. |
| Minimum surface confidence | filename-inferred |
| JavaScript modes | es2021 |
| Application scopes | global, scoped, unknown |
| ServiceNow releases | zurich, australia |
| Fluent SDK range | n/a |

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| _(none)_ | | | This rule has no options. |

## Incorrect

### Incorrect: shorthand method used as a constructor in Australia

```js
const definitions = { Task() {} };
const task = new definitions.Task();
```

## Correct

### Correct: function-valued constructible property

```js
const definitions = { Task: function Task() {} };
const task = new definitions.Task();
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. false-negative: An object with any unrecognized reference, call, mutation, or escape stays silent because its method property may have been replaced before construction. false-negative: Destructured, mutable, conditional, and cross-execution aliases stay silent because their exact callable identity is not proven at the construction site. scope-boundary: Class prototype and static methods stay outside this rule until their pre-Australia ServiceNow behavior is independently proven. scope-boundary: Method construction stays silent when settings.servicenow.release is omitted because Zurich permits it and Australia throws.

## Known false positives

- None recorded.

## Known false negatives

- An object with any unrecognized reference, call, mutation, or escape stays silent because its method property may have been replaced before construction.
- Destructured, mutable, conditional, and cross-execution aliases stay silent because their exact callable identity is not proven at the construction site.

## Intentional scope boundaries

- Class prototype and static methods stay outside this rule until their pre-Australia ServiceNow behavior is independently proven.
- Method construction stays silent when settings.servicenow.release is omitted because Zurich permits it and Australia throws.

## Overlaps

- None recorded.

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **The Australia engine update lists Rhino PR 1774, Don't allow methods to be used as constructors, as an ECMAScript 2021 fix.**
  - Verification ID: `rule-evidence-304f9a1e`
  - URL: https://www.servicenow.com/docs/r/api-reference/scripts/updates-javascript-engine.html
  - Verified by: manual
  - Verified at: 2026-08-24
- **Fixtures cover direct and computed methods, immutable object and method aliases, generators, final-property selection, mutation, escape, shadowing, dynamic scope, releases, modes, and execution contexts.**
  - Verification ID: `rule-evidence-a4d67dde`
  - URL: tests/rules/no-object-method-constructor.test.ts
  - Verified by: fixture
  - Verified at: 2026-08-24
- **Real Oxlint and ESLint contracts verify the object-method construction delta in Zurich, Australia, and omitted-release ES2021 configurations.**
  - Verification ID: `rule-evidence-dbdc25a7`
  - URL: tests/integration/release-contracts.test.ts
  - Verified by: integration-test
  - Verified at: 2026-08-24

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
