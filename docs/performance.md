# Performance benchmarks

Stateful GlideRecord analysis must stay approximately linear for local provenance.

## Command

```bash
npm run bench
```

The command generates deterministic GlideRecord blocks (20, 80, and 200 instances) and times `applyRules`.

`npm test` also runs `tests/perf/benchmark.test.ts`, which fails if 80 blocks take 2000 ms or more.

## Release gate

A performance change blocks release when:

- the 80-block `applyRules` fixture exceeds 2000 ms on Node 20 or 22
- the 200-block run is more than about 15 times the 20-block run for the same analysis

Those thresholds detect quadratic scans. They are not nanosecond budgets.

## Skip cost

Rules return `false` from `before()` when the file surface or JavaScript mode does not apply. Whole-file analyses run from a `Program` visitor so oxlint does not drop diagnostics.

Record a new baseline in the pull request when you change provenance, path-sensitive analysis, or the recommended rule set.
