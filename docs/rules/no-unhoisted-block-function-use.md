# servicenow/no-unhoisted-block-function-use

Before Australia, ServiceNow does not correctly hoist nested block function declarations to block entry. This rule reports binding-proven reads before the declaration in the same execution body across every instance JavaScript mode.

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
- **Implementation:** [`src/rules/no-unhoisted-block-function-use.ts`](../../src/rules/no-unhoisted-block-function-use.ts)

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

### Incorrect: nested helper called before declaration in Zurich

```js
function calculate() {
  try {
    return add(2, 3);
    function add(left, right) { return left + right; }
  } catch (error) {
    return 0;
  }
}
```

## Correct

### Correct: helper declared before use

```js
function calculate() {
  try {
    function add(left, right) { return left + right; }
    return add(2, 3);
  } catch (error) {
    return 0;
  }
}
```

### Correct: Australia block hoisting

```js
{
  helper();
  function helper() { return 1; }
}
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. false-negative: References inside nested functions or classes stay silent because their invocation can occur after the block declaration has executed. false-negative: A reassigned function binding or direct eval/with makes pre-declaration identity unknown, so every matching use in that file stays silent. scope-boundary: Function declarations directly owned by switch cases stay silent because Rhino PR 1806 explicitly left switch hoisting outside its proven implementation. scope-boundary: Pre-declaration uses stay silent when settings.servicenow.release is omitted because Zurich and Australia have different hoisting behavior.

## Known false positives

- None recorded.

## Known false negatives

- References inside nested functions or classes stay silent because their invocation can occur after the block declaration has executed.
- A reassigned function binding or direct eval/with makes pre-declaration identity unknown, so every matching use in that file stays silent.

## Intentional scope boundaries

- Function declarations directly owned by switch cases stay silent because Rhino PR 1806 explicitly left switch hoisting outside its proven implementation.
- Pre-declaration uses stay silent when settings.servicenow.release is omitted because Zurich and Australia have different hoisting behavior.

## Overlaps

- None recorded.

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **The Australia engine update lists Rhino PR 1806, Fix hoisting behavior, as a fix applicable to all JavaScript modes.**
  - Verification ID: `rule-evidence-0dcef443`
  - URL: https://www.servicenow.com/docs/r/api-reference/scripts/updates-javascript-engine.html
  - Verified by: manual
  - Verified at: 2026-08-24
- **Fixtures cover nested blocks, loops, try/catch, reads, shadowing, deferred bodies, mutation, dynamic scope, switch boundaries, releases, modes, and execution contexts.**
  - Verification ID: `rule-evidence-f23df002`
  - URL: tests/rules/no-unhoisted-block-function-use.test.ts
  - Verified by: fixture
  - Verified at: 2026-08-24
- **Real Oxlint and ESLint contracts verify the nested-block hoisting delta in Zurich, Australia, omitted-release, ES5, and ES2021 configurations.**
  - Verification ID: `rule-evidence-383d0f82`
  - URL: tests/integration/release-contracts.test.ts
  - Verified by: integration-test
  - Verified at: 2026-08-24

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
