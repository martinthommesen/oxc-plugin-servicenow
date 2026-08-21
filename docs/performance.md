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

Each case records raw samples, median elapsed time, and peak RSS after one warm-up run and ten samples. A sample is rejected unless Oxlint exits successfully, emits one complete JSON document, and reports no diagnostics.

Profiles compared:

- oxlint with the plugin disabled
- one representative rule (`require-query-before-next`)
- recommended
- all/strict

`docs/performance-baseline.json` is the reviewed comparison baseline. `npm run bench` writes the current run to `artifacts/performance-current.json`. In pull-request CI, pass a baseline extracted from the target-branch merge base. Do not use a baseline modified by the same pull request.

Refresh the baseline in a separate reviewed pull request with `npm run bench -- --write`. A baseline change must not excuse the performance change that it measures.

## Release gate

A performance change blocks release when:

- `classic-large/recommended` exceeds 5,000 ms
- the recommended large/small scale ratio exceeds 4

CI also reports trend warnings when:

- a fixture's median elapsed time exceeds `baseline * 1.5 + 100 ms`
- a fixture's peak RSS exceeds `baseline * 1.25 + 25,000 KB`

Absolute measurements from uncontrolled public runners are trend evidence. The blocking limits detect repeated full-file analysis and quadratic scans.

The path-sensitive interpreter also has a deterministic per-pass work budget and a maximum traversal depth. If either limit is reached, the pass stops and returns unknown facts. This fail-safe bounds adversarial machine-generated input without inventing a definite result.

CI uploads the current result as `performance-current`. The checked-in baseline is never uploaded under a current-result name.

## Skip cost

Rules return `false` from `before()` when the file surface or JavaScript mode does not apply. Whole-file analyses run from a `Program` visitor so oxlint does not drop diagnostics. The `skip-client/recommended` fixture records that overhead.
