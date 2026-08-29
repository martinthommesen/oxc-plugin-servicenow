# PR #51 review layers

This document assigns the #51 change set to independently reviewable layers. PR #51 remains the tracking pull request until the layered commits below are reviewed. Do not merge or publish 2.0.0 while release-blocking issues from #52–#76 remain open.

## Dependency graph

```
1 Context, settings, options
        ↓
2 Binding, object identity, provenance, control flow
        ↓
3 Stateful classic rules
        ↓
4 Fluent version and binding identity
        ↓
5 Generated documentation and evidence
        ↓
6 Packed compatibility and real benchmarks
        ↓
7 Release provenance (privileged workflows only)
```

Each layer has its own tests. Later layers consume earlier contracts and must not reintroduce name-keyed analysis.

## Layer 1 — Context, settings, and option foundation

**Owns:** `src/settings/`, `src/context/`, `src/options/`, `src/types.ts`, filename classification, `ServiceNowSettingsError`.

**Contract:** Unknown context stays unknown. Contradictory settings throw. Shared defaults are deeply immutable. Rule options parse from one descriptor.

**Rollback:** Revert settings, context, and option commits. Do not keep rules that depend on the new settings object.

## Layer 2 — Lexical binding, object identity, provenance, and control flow

**Owns:** `src/analysis/` except `src/analysis/now-id.ts` and `src/analysis/fluent-imports.ts`.

**Contract:** Binding identity is not object identity. Joins intersect must-facts and union risk. Abrupt completion does not flow into later statements. Analysis runs once per source file.

**Rollback:** Revert analysis commits and any later rule that calls `analyzePathBindings`.

## Layer 3 — Stateful classic rules

**Owns:** query-before-next, GlideAggregate, bulk filters, GlideAjax params, setNoCount epochs, query-in-loop, GlideRecord manifest.

**Tests:** `tests/rules/stateful-lifecycle.test.ts` and host fixtures under `tests/integration/profiles/`.

## Layer 4 — Fluent version manifests and binding-aware Fluent rules

**Owns:** `src/fluent/registry.ts`, `src/analysis/fluent-imports.ts`, `src/analysis/now-id.ts`, Fluent rules.

**Tests:** `tests/rules/fluent-identity.test.ts`, typed packed-consumer Fluent lint.

## Layer 5 — Generated documentation and evidence

**Owns:** `src/catalog-metadata.ts`, `scripts/generate-rule-docs.mjs`, `scripts/check-catalog-docs.mjs`, `docs/rules/`.

**Contract:** Generated pages stay in the same change as their descriptors.

## Layer 6 — Packed compatibility matrix and real benchmarks

**Owns:** `scripts/compat-matrix.json`, `scripts/compat-consumer.mjs`, `scripts/benchmark.mjs`, `docs/compatibility.md`, `docs/performance-baseline.json`, CI `compat` and `bench` jobs.

**Does not own:** npm publish permissions.

## Layer 7 — Release provenance

**Owns:** `.github/workflows/release.yml`, `scripts/check-release-artifact.mjs`, `scripts/verify-published-package.mjs`, `docs/release.md`, `tests/release/`.

**Contract:** Validation is read-only. One inspected tarball is the consumer-test input and the `npm publish` argument. Tag ancestry is verified from `main`. Publish uses OIDC trusted publishing and `--ignore-scripts`. Review this layer separately from rule and analysis changes.

## File assignment

| Path prefix | Layer |
| --- | --- |
| `src/settings/`, `src/options/`, `src/context/`, `src/types.ts` | 1 |
| `src/analysis/` except `src/analysis/now-id.ts` and `src/analysis/fluent-imports.ts` | 2 |
| `src/rules/` classic stateful + `src/glide/` | 3 |
| `src/fluent/`, Fluent rules, `src/analysis/now-id.ts`, `src/analysis/fluent-imports.ts` | 4 |
| `src/catalog.ts`, `src/catalog-metadata.ts`, `docs/rules/`, `scripts/generate-rule-docs.mjs`, `scripts/check-catalog-docs.mjs` | 5 |
| `scripts/compat-*.mjs`, `scripts/compat-matrix.json`, `scripts/benchmark.mjs`, `tests/integration/packed-consumer.test.ts`, `tests/perf/` | 6 |
| `.github/workflows/release.yml`, `scripts/check-release-artifact.mjs`, `scripts/verify-published-package.mjs`, `docs/release.md`, `tests/release/` | 7 |

Shared tests that span layers stay with the highest layer they prove.

## Rollback boundaries

- A correctness defect in layer 2 invalidates layers 3–6 until the foundation is fixed.
- A documentation-only defect stays in layer 5.
- A release-workflow defect stays in layer 7 and must not ship with unreviewed analysis changes.
