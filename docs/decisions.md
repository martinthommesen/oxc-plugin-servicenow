# Recorded decisions

Current compatibility and analysis decisions, with the conditions that would justify changing them. Historical deliberations remain in Git history.

## Compatibility through 3.x

- Keep the named policy and security presets. Consumer usage was unmeasurable at the 3.0 boundary; reassess at 4.0. A category of roughly five rules justifies its own preset, while proven absence of consumers can justify removing one at a major boundary.
- Keep deprecated `scriptType` and `ecmaLatest` settings. The 3.0 usage check could not establish that they were unused. Prefer `authoring`, `surfaces`, and `javascriptMode`; conflicting settings still throw.
- The repository-specific `@sn-es-latest` pragma was retired in 3.0. A pragma-only file now has unknown mode.
- `validate-gliderecord-calls` was removed in 3.0. Use `require-query-before-next` for cursor sequencing; the old unused-return check has no replacement.
- The public provenance fields `queryState`, `windowed`, `sysparmName`, `aggregates`, and `QueryState` were removed in 3.0 because they never carried computed facts. Lifecycle facts belong to the per-domain analyzers and rules.

See [the 3.0 migration guide](migration-3.0.md) for consumer changes.

## sys_id configuration has one canonical casing

Detection accepts uppercase and mixed-case hexadecimal literals, but the configured `allowedSysIds` list requires lowercase 32-character ids. Both sides are normalized before comparison, so suppression remains exact. Keep this configuration contract through 3.x.

## Shared analysis has one rule entry point

Rules import analysis through `src/analysis/internal.ts`. Direct imports can rebuild facts outside the per-file cache and disagree with other rules. The catalog gate enforces the boundary for both rule files and delegate factories; add needed symbols to the barrel rather than widening the exception.

## Diagnostics do not rewrite code

No rule ships a fix or suggestion. Reintroduce fix machinery only with a semantics-preserving rewrite and the exact-output, syntax, idempotence, and comment-preservation tests required by [Contributing](../CONTRIBUTING.md).

## Historical remediation tracking is retired

The PR #51 ledger and plans tracked a past workstream rather than the current product contract. The simplification removes the historical status report, its private lock, generated reports and duplicate CI runs. A compact [finding rationale index](../FINDINGS.md) preserves the IDs cited by current code, tests and knowledge-graph documentation.

Historical records remain at commit `c510575` and on `archive/pr51-b87972a`. Outstanding historical live-audit and approval criteria are retired as tracking obligations, not asserted to have passed.

Lint, formatting, types, rule regression tests, documentation evidence, manifest drift, workflow, compatibility, benchmark, packed-consumer and release-artifact gates remain required. CI runs the packed consumer directly in its registry-dependent job.
