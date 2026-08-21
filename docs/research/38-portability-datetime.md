# Research: portability and date/time rules

Decision date: 2026-08-19.

## Blanket bans — reject

| Idea | Decision |
| --- | --- |
| Ban every native `Date` | Reject. Scripts use `Date` for display and interop. |
| Ban every `service-now.com` URL | Reject. Docs, tests, and integrations use those hosts on purpose. |

## Hardcoded instance URLs — hold

A future `policy` / portability rule may flag literals that match `https://<instance>.service-now.com` when they are not in comments, tests, or an allowlist setting. That setting does not exist yet. Do not guess production versus documentation files.

## Display-value date comparison — already implemented

`no-display-value-date-comparison` covers relational and subtraction operators on proven `GlideDateTime.getDisplayValue()`. Do not expand it to every string that looks like a date.

## Mixing `Date` and `GlideDateTime` — hold

Without types, `new Date(glideDateTime)` versus `new Date(glideDateTime.getValue())` cannot be distinguished from user wrappers. Keep this research-only.

## Persisting display strings — hold

Writing `getDisplayValue()` into a date/time field needs schema. The plugin has no instance schema.

## Additional string comparisons — hold

Equality on display strings is often intentional UI logic. Do not generalize #24 beyond relational operators on proven display values.
