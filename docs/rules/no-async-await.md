# servicenow/no-async-await

async/await is not implemented in Compatibility or ES5 Standards mode.

- **Family:** engine
- **Preset:** classic-es5
- **Placements:** classic-es5 (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Classic instance scripts. Fluent files are skipped.
- **JavaScript mode:** Runs when `javascriptMode` is `compatibility` or `es5`. Unknown mode stays silent.
- **Implementation:** [`src/rules/no-async-await.ts`](../../src/rules/no-async-await.ts)

## Incorrect

### Incorrect: async function

```js
async function loadIncident(id) {
  return await fetchIncident(id);
}
```

## Correct

### Correct: sync function

```js
function loadIncident(id) {
  var gr = new GlideRecord("incident");
  return gr.get(id) ? gr : null;
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
