# Research: metadata-aware Business Rule rules

Decision date: 2026-08-19.

## Required metadata

Script text cannot prove Business Rule timing. The package now accepts an explicit setting:

```json
{
  "settings": {
    "servicenow": {
      "surfaces": ["business-rule"],
      "businessRuleSourceFormat": "full-script",
      "businessRuleWhen": "before"
    }
  }
}
```

`businessRuleWhen` defaults to `unknown`. Filename inference must not set it.

Fluent metadata can supply `when` only when the factory argument is a static string literal in the same file.

## Candidates

### `no-previous-in-async-business-rule` — hold

Official classic Business Rule documentation states that `previous` is not available on async operations, and that `changes()` / `changesTo()` / `changesFrom()` do not work in async scripts.

Evidence: [Classic Business rules](https://www.servicenow.com/docs/r/api-reference/business-rules-classic/c_BusinessRules.html)

Do not implement an AST-only rule. A future rule may run only when `businessRuleWhen` is `async` or a Fluent `when: "async"` literal is in the same file as an inline `previous` read. `Now.include()` scripts stay out of scope.

### `no-setabortaction-outside-before-business-rule` — hold

Australia scoped GlideRecord says: use `setAbortAction()` in an `onBefore` Business Rule. The method only prevents the database action. Later Business Rules still run.

Evidence: [Scoped GlideRecord.setAbortAction](https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html)

A future rule may flag proven `current.setAbortAction(...)` only when timing is explicitly `after`, `async`, or `display`. Unknown timing stays silent.

### `require-business-rule-condition` — reject as a JavaScript rule

A missing Condition field is not a universal defect. Many rules are intended to run on every operation. Check this only as an optional Fluent/metadata policy, not as `recommended`.

### `no-initialize-before-update` — hold

`initialize()` is the documented empty-record setup API. `initialize()` then `insert()` is valid. `initialize()` then `update()` can be correct after `setNewGuidValue` or `sys_id` assignment. There is no authoritative sequence that is always a defect without record identity data.

## AST versus metadata

| Input | Available today |
| --- | --- |
| Script AST | `current` / `previous` reads, `setAbortAction` calls |
| Filename | Surface only. Not timing. |
| `businessRuleWhen` setting | Explicit timing |
| Fluent `when` literal | Same-file metadata only |

No candidate advances on community folklore.
