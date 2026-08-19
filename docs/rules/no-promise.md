# servicenow/no-promise

Compatibility and ES5 Standards modes do not implement Promises. The rule is silent when JavaScript mode is unknown or ES2021. Local `Promise` bindings are ignored.

- **Family:** engine
- **Preset:** classic-es5
- **Placements:** classic-es5 (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Classic instance scripts. Fluent files are skipped.
- **JavaScript mode:** Runs when `javascriptMode` is `compatibility` or `es5`. Unknown mode stays silent.
- **Last verified:** 2026-08-19
- **Implementation:** [`src/rules/no-promise.ts`](../../src/rules/no-promise.ts)

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| _(none)_ | | | This rule has no options. |

## Incorrect

### Incorrect: constructor

```js
var p = new Promise(function (resolve) { resolve(1); });
```

## Correct

### Correct: synchronous Glide

```js
var gr = new GlideRecord("incident");
if (gr.get(sysId)) {
  gs.info(gr.number);
}
```

## Limitations

When provenance, surface, or JavaScript mode is unknown, the rule stays silent instead of guessing.

## Evidence

- None recorded. Add an authoritative ServiceNow or Oxc link before expanding this rule.

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
