# Performance benchmarks

Stateful GlideRecord analysis must stay approximately linear for local provenance.

## Command

```bash
npm run bench
```

The command generates deterministic fixtures and times the real `oxlint` executable. It measures:

- small, medium, and large classic GlideRecord files
- branch-heavy alias and try/catch analysis
- nested scopes
- large Fluent metadata
- skip-path client files
- a mixed repository

Each case records median elapsed time and peak RSS after one warm-up run and three samples.

Profiles compared:

- oxlint with the plugin disabled
- one representative rule (`require-query-before-next`)
- recommended
- all/strict

`docs/performance-baseline.json` stores the last recorded result, including Node, oxlint, plugin version, CPU model, fixture names, and date. Update that file with `npm run bench -- --write` when provenance, path-sensitive analysis, or the recommended rule set changes.

## Release gate

A performance change blocks release when:

- `classic-large/recommended` exceeds 15000 ms
- the recommended large/small scale ratio exceeds 20
- a fixture's median elapsed time exceeds `baseline * 2.5 + 500 ms`
- a fixture's peak RSS exceeds `baseline * 2 + 50 MB`

Those thresholds detect repeated full-file analysis and quadratic scans. They are not nanosecond budgets.

CI runs `npm run bench` and uploads `docs/performance-baseline.json` as an artifact.

## Skip cost

Rules return `false` from `before()` when the file surface or JavaScript mode does not apply. Whole-file analyses run from a `Program` visitor so oxlint does not drop diagnostics. The `skip-client/recommended` fixture records that overhead.
