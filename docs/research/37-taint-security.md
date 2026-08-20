# Research: taint-aware query and redirect security

Decision date: 2026-08-19.

## Decision — hold

Do not ship encoded-query or redirect rules from method names or string concatenation.

## Sources that would matter

These are surface-specific. The plugin cannot prove they are untrusted without a taint model:

| Surface | Typical sources |
| --- | --- |
| Scripted REST | `request` body, query, path, headers |
| Processor | `g_request` |
| GlideAjax Script Include | `this.getParameter("sysparm_*")` |
| UI Action / Client | `g_form` values, URL parameters |
| Portal | widget `input` / `options` |

## Sinks

| API | Why it is sensitive |
| --- | --- |
| `addEncodedQuery` / `addUserEncodedQuery` | Query language injection |
| `g_navigation.open` / redirect helpers | Open redirect |
| Dynamic table names | Cross-table access |

## Sanitizers

There is no single official sanitizer that makes an arbitrary encoded query safe. Allowlists and `GlideFilter` checks are context-specific. A rule that ignores sanitizers will false-positive.

## Oxc feasibility

The JS-plugin API is file-local. Intraprocedural taint is possible later as a dedicated analyzer, not as a visitor that flags every `+` into `addEncodedQuery`. Interprocedural and schema-dependent cases stay future.

Any first rule must:

- require a proven source and a proven sink in the same function
- stay out of `recommended`
- live in `security`
- stay silent on concatenation of static strings

No rule is proposed for implementation in this release.
