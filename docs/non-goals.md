# Non-goals and rejected rule ideas

This document records lint-rule ideas that this package rejects by default. Read it before you propose a new rule.

Each decision includes a revisit condition. A rejected idea can return only when the listed capability or evidence exists.

## Blanket platform or style bans

| Idea | Why it is rejected | Narrow alternative | Revisit when |
| --- | --- | --- | --- |
| Ban every native `Date` | ServiceNow scripts use `Date` for display and interop. A blanket ban is noisy. | Portability research in #38 | A versioned engine table proves `Date` is unsafe in a documented mode. |
| Ban every hardcoded table name | Many scripts name platform tables on purpose. | Opt-in `no-hardcoded-table-names` in `policy` | A project schema or allowlist is part of the supported settings model. |
| Universally ban client `GlideRecord` without context | The current rule already covers proven client surfaces. Expanding it to unknown files creates false positives. | `no-client-gliderecord` | Client detection has a stronger metadata source than filename and strong globals. |
| Require `GlideAggregate` for every `getRowCount()` | Counting a filtered set can be correct. | `prefer-glideaggregate` at `strict/warn` | Query cardinality is statically known. |
| Ban encoded queries | Encoded queries are a documented API. | None | ServiceNow documents the API as unsafe in a specific mode. |
| Always require `GlideRecordSecure` | Trusted jobs and global scripts often need `GlideRecord`. | `no-system-query-bypass` (#27) | Context identifies privileged versus user-facing scripts reliably. |
| Ban all dot-walking | Field access is normal GlideRecord usage. | `no-glideelement-in-collection` (#21) | Schema-aware analysis can prove invalid paths. |
| Ban all direct GlideRecord field properties | Direct access is valid when the value is used immediately. | `no-glideelement-in-collection` for retained elements | Escape analysis is proven on real repositories. |
| Make every query-in-loop an error | Tiny loops and cache misses are legitimate. | `no-gliderecord-query-in-loop` at `strict/warn` (#26) | Record counts or batching intent are statically known. |
| Ban general logic in `.now.ts` | Some metadata factories need small helpers. | `no-complex-fluent-logic` in `policy` | The SDK forbids the pattern in a documented version. |

## Claims that need unavailable information

| Idea | Why it is rejected | Narrow alternative | Revisit when |
| --- | --- | --- | --- |
| Table, field, or choice validation without schema input | The plugin has no instance schema. | None | A generated schema or typed SDK artifact is a supported input. |
| Cross-scope legality from namespace strings | Prefixes are not proof of runtime scope. | `settings.servicenow.scope` when explicit | ServiceNow exports machine-readable scope metadata into the repo. |
| Cross-file `$id` uniqueness | File-local analysis cannot see the project index. | `no-duplicate-fluent-id` in one file; research #39 | A project-wide Fluent index exists. |
| Taint or redirect security conclusions | AST-only analysis cannot prove sources and sinks. | Research #37 | A conservative taint model is evidence-backed. |
| Business Rule timing claims without metadata | `when` / `order` live outside the script. | `require-business-rule-wrapper` when format is explicit; research #35 | Business Rule metadata is available to the linter. |

## Incorrect Fluent assumptions

| Idea | Why it is rejected | Narrow alternative | Revisit when |
| --- | --- | --- | --- |
| Require `$id` for every Fluent factory | The SDK manifest marks some factories as optional or forbidden. | `require-fluent-id` plus the versioned manifest | The manifest for the configured SDK version changes. |
| Treat naming conventions as correctness | Naming is style, not a runtime defect. | `fluent-naming-convention` at `strict/warn` | The SDK makes a name a hard build failure. |
| Assume every API is `@servicenow/sdk/core` | Some APIs have unknown or other modules. | `fluent-proper-imports` and the manifest | Official docs assign a module. |

## Core-rule duplication

Do not add a ServiceNow-branded copy of a generic Oxlint or ESLint rule, including unused variables, unreachable code, duplicate object keys, generic complexity, or formatter-only style.

Revisit when the ServiceNow engine documents a different semantic for that generic construct.

## Review checklist

A new rule proposal must state:

1. Why it is not a documented non-goal.
2. What ServiceNow or Oxc evidence supports the detection boundary.
3. Why silence is preferred when provenance, mode, or metadata is unknown.
