# FINDINGS.md remediation ledger

Disposition of every active record in `FINDINGS.md` (super-review of
2026-08-29 at `798d286`). One commit per record on
`pr51-remediation/layer6`; the commit subject carries the record ID.

## Verification state

- Hermetic `npm test`: 820/820.
- `npm run validate` (workflow, compat, lint, format, typecheck, fixtures,
  build, test, evidence, offline acceptance, docs, manifest, bench,
  release artifact): passes end to end. Every step is offline by
  construction (hermetic test set, `--offline` acceptance mode, no
  consumer install); a network-disabled end-to-end run was not executed
  in this environment. The networked steps moved to `npm run
  validate:live`, which also passes.
- Offline `acceptance:check`: 533 criteria, 448 verified at exact head,
  53 pending or implemented, 32 live-pending (the 2 packed-consumer-backed
  criteria defer to Live-pending offline). The full capture verifies all
  450 with 822/822 tests.
- Red-before-green: the COR-007 parity fixtures (5 of 6 cases), the
  COR-008 name matrix (4 cases), the COR-009 alias cases, and the DOC-002
  widened guard all fail on the pre-fix tree.
- PER-002 measured: the depth-20 nested `do…while` reproduction took
  454 ms before the fix and 8.7 ms at depth 30 after it.
- DOC-002: the Zurich replacement page was fetched and carries the same
  async-`previous` statements as the Xanadu page it replaces.

## Dispositions

| ID | Disposition | Commit | Note |
| --- | --- | --- | --- |
| COR-007 | Fixed | ebc4636 | `nodeEnd` and `commentOffsets` beside `nodeStart`; fluent-imports, bindings, glide-setnocount, fluent-directives, prefer-glideaggregate, and the harness routed through them; unknown offsets make aliases uncertain; hermetic range-only parity suite plus a source ban on the raw idioms; packed-consumer alias and directive cases added. |
| PER-002 | Fixed | 964dca9 | `(node, cursor-set)` memo removes the exponential; both walkers run under the path evaluator's budget via `runWithTraversalBudget`, degrading to zero findings and counting the event; `nested-do-while` benchmark fixture added (baseline row seeded from the nested-scopes cell until the next baseline write). |
| COR-008 | Fixed | 83eaae1 | Digest words anchored to whole name components; ten-name two-directional matrix; changelog names the affected spellings. |
| COR-009 | Fixed | bd73b57 | `VariableDeclarator` visitor joins the COR-006 execution-order model when a binding has multiple declarators; both directions, the assignment control, and the conditional case pinned. |
| API-002 | Fixed (deprecation) | ea0d47f | Four never-computed lifecycle fields annotated `@deprecated` on the public and internal records; 3.0 removal recorded in `docs/decisions.md` behind the shared dependents check; contract test pins the constant values. |
| OPS-004 | Fixed | 6b890e2 | `acceptance:check` runs offline (hermetic inventory, consumer criteria recorded Live-pending, no tracked-file writes); full capture moved to `acceptance:capture` in the networked CI `consumer` job and the release validate job; `npm run validate` is fully offline; networked steps moved to `validate:live`; `consumer` added to the desired required checks. |
| REL-003 | Fixed | 8a81385 | ASCII relational compare replaces `localeCompare`; mixed-case pairs and a full-list sort pinned. |
| OPS-008 | Fixed | 24cafc0 | Nightly cron (offset from CI) on `governance-audit.yml`; stays out of required checks; test asserts drift-detection workflows declare a schedule; cadence documented in `docs/release.md`. |
| MNT-004 | Fixed | 4fcbe99 | `--oidc-subject` is now cross-checked against the plain subject derived from the verified certificate expectations; mismatches fail with `provenance-expectation`; negative test added. |
| DOC-002 | Fixed | eb9ef8d | Xanadu link repointed to the fetched Zurich page; the release-segment guard now scans file-path evidence documents and everything `docs/non-goals.md` links. |
| IMP-001 | Fixed | 4be575e | Option A (keep and harden): block-scalar lines skipped, empty-owner references fail, pin table is a `Map`; still dependency-free; scan exported and unit-tested. |
| REM-002 | Decision recorded | c811a0e | Retirement trigger, archive plan, and post-removal gate conditions in `docs/decisions.md`; nothing deleted before the PR #51 merge. |
| FEAT-002 | Investigated | 00dc3bd | npm downloads 194/week on 2026-08-29; dependents unreadable without auth, so per the recorded threshold the concrete 3.0 action is: retire only `@sn-es-latest`, re-check at the boundary. |
| FEAT-001 | Decision stands | 1d7044b | Thin presets stay through 2.x; the 3.0 trigger in `docs/decisions.md` is unchanged and now shares the dated dependents-evidence note. |
| REM-001 | Decision stands | 1d7044b | `validate-gliderecord-calls` removal in 3.0 remains announced in the changelog, rule page, and README. |
| POS-001..004 | Preserved | — | No protected pattern weakened. PER-002 extends the POS-004 budget discipline to the cursor-loop walkers; unknown still means silent (COR-007 declines instead of guessing); the catalog derivation and provenance binding are untouched. |

Documentation corrections carried with their related records: the stale
`isSynchronousIife` and `constantTruthiness` comments in `path-state.ts`
(with PER-002), the CONTRIBUTING.md invariants for portable offsets,
budgeted traversals, and dependency-free workflow scripts (with OPS-004),
and this ledger's previous claim that the required `test` check no longer
covered the packed-consumer path — it did, through `acceptance:check`;
after OPS-004 that coverage moves to the `consumer` job, which is why
`consumer` must become a required check.

## Outstanding external actions

1. Merging into `main`: this branch still shares its base with the
   pre-2.0 history while `origin/main` shipped 2.0.0. Reconciling the two
   lines is a maintainer decision outside this remediation. The REM-002
   retirement trigger fires on that merge.
2. Add the CI `consumer` job to the required status checks of ruleset
   21081867. After OPS-004 this is mandatory, not advisory: the required
   `test` job now runs the offline acceptance mode, so `consumer` is the
   only required coverage of the packed-consumer path once applied.
   `scripts/release-governance.json` already lists it as desired policy,
   and the governance audit will report the drift nightly until the live
   ruleset is updated.
3. `npm trust list` in the governance audit still needs an npm login; the
   scheduled run reports the GitHub half only.
4. The benchmark baseline row for the new `nested-do-while/recommended`
   cell is seeded from the `nested-scopes/recommended` cell; the next
   `npm run bench -- --write` on the baseline host recalibrates it.
