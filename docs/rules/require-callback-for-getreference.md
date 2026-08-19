# servicenow/require-callback-for-getreference

`g_form.getReference(field)` without a callback is a synchronous server request. Pass a callback. Evidence: https://www.servicenow.com/docs/r/api-reference/c_GlideFormAPI.html

- **Family:** classic
- **Preset:** recommended
- **Placements:** recommended (error), client (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Classic instance scripts. Client-only rules skip server-only files. Fluent files are skipped.
- **JavaScript mode:** Independent of JavaScript mode unless the rule documents a mode gate.
- **Last verified:** 2026-08-19
- **Implementation:** [`src/rules/require-callback-for-getreference.ts`](../../src/rules/require-callback-for-getreference.ts)

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| _(none)_ | | | This rule has no options. |

## Incorrect

### Incorrect: sync getReference

```js
function onChange() {
  var caller = g_form.getReference("caller_id");
  g_form.setValue("u_manager", caller.manager);
}
```

## Correct

### Correct: async getReference

```js
function onChange() {
  g_form.getReference("caller_id", function (caller) {
    g_form.setValue("u_manager", caller.manager);
  });
}
```

## Limitations

When provenance, surface, or JavaScript mode is unknown, the rule stays silent instead of guessing.

## Evidence

- https://www.servicenow.com/docs/r/api-reference/c_GlideFormAPI.html

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
