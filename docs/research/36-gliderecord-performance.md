# Research: advanced GlideRecord performance rules

Decision date: 2026-08-19.

## `prefer-setnocount-with-choosewindow` — implement

The reviewed Zurich and Australia scoped GlideRecord references document that `query()` after `chooseWindow()` runs `COUNT(*)`. `setNoCount()` skips that count. `setLimit()` also skips it.

Evidence: [Scoped GlideRecord.chooseWindow and setNoCount](https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html)

Implemented as `strict` / `warn` in `prefer-setnocount-with-choosewindow`.

Detection boundary:

- proven `GlideRecord` binding
- definite `chooseWindow()` on every remaining path
- no `setNoCount()` or `setLimit()` before `query()` / `get()`
- no later `getRowCount()` on that binding
- `chooseWindow`'s third argument is omitted or the boolean literal `false`

Silence when provenance, force-count, or branch agreement is unknown. No autofix: adding `setNoCount()` changes `getRowCount()` semantics.

## Batch update/delete inside loops — hold

`updateMultiple()` and `deleteMultiple()` do not run the same per-row Business Rules, workflows, or audit path as `update()` / `deleteRecord()` in a loop. Official docs do not treat those replacements as equivalent. Do not recommend a bulk rewrite.

## Expanded N+1 — hold

`no-gliderecord-query-in-loop` already covers a proven outer `.next()` loop. Helper wrappers need interprocedural analysis that this plugin does not have. Keep the current strict warning.

## Other count/window folklore — reject

Do not flag `chooseWindow` + `setLimit` together as a universal defect. Official docs describe override behavior, not a forbidden pair. `no-delete-multiple-with-windowing` already covers the proven bulk-delete case.
