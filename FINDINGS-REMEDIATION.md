# FINDINGS.md remediation ledger

Disposition of every record in `FINDINGS.md` (super-review of 2026-08-29,
revision `61ebe20`). The review ran against the `pr51-remediation/layer6`
worktree, which was 142 commits ahead of and 40 commits behind
`origin/main`; `main` had meanwhile executed plans 007–015, shipped v2.0.0
and the Australia release family, and ported the branch's early remediation
layers in #121.

## Reconciliation (DOC-003)

The branch was reconciled by merging `origin/main` with main's tree taken
wholesale (`b644c02`): main rebuilt the modules the 230 both-added
conflicts covered, so a textual merge would have interleaved stale branch
code into newer implementations. The branch's own report (`FINDINGS.md`) is
the only file kept from the branch side. Every branch-only fix was then
re-verified against the merged tree and re-ported only where the defect
still reproduced. Every active finding was likewise re-verified by
reproduction before being fixed or closed.

## Active findings

| ID | Disposition | Evidence |
| --- | --- | --- |
| COR-010 | Fixed upstream, verified | `resolveConstValue` carries a visited set; cycle and mutual-cycle probes report zero without throwing, control reports one. |
| COR-011 | Fixed upstream, verified; registry-wide harness added | One-instance/two-file probe reports `[1,1]`; `tests/rules/multi-file-lifecycle.test.ts` now replays one instance of every rule over three files. |
| COR-012 | Fixed upstream, verified | Unknown scope resolves to the union of documented surfaces; `getAsync` was removed upstream as undocumented, with an acceptance-ledger row and a pinning test. |
| COR-013 | Half fixed upstream, half this session | Infinite do-while fixed upstream; the `for (var … of/in …)` head now invalidates its declared names whatever the kind. Tests in `tests/rules/loop-head-rebind.test.ts`. |
| COR-014 | Fixed this session | Filename convention runs only for Fluent filenames (`isFluentFile` gate). |
| COR-015 | Mostly fixed upstream; one gate added this session | `no-packages-calls` gated and page prose corrected upstream (verified by probes). `no-hardcoded-table-names` still reported on `.now.ts` and unknown surfaces; it now carries the same server-instance gate its page declares. |
| COR-016 | Fixed this session | Four analyzers de-duplicate on node identity; an offset-free host fixture pins that every finding survives. |
| PER-003 | Fixed this session | Budget scales at 128 units/AST node (50k floor, 5M ceiling); dense scripts complete to ~1,200 lines and findings grow with file size. Baseline regenerated in the same change. |
| PER-004 | Mostly fixed upstream; completed this session | Upstream added a 64 MB buffer to the extraction call; the pack, listing, and package.json calls now carry it too. |
| PER-005 | Fixed upstream, verified | Alias scaling measured linear (13 ms at 400 aliases vs 511 ms in the review). |
| SEC-001 | Fixed upstream, verified | Absent rulesets produce drift errors (probe over the real desired file), and a missing-ruleset test exists. |
| TST-003 | Fixed this session | A named path that does not resolve fails the run; the networked exclusion applies to directory arguments, and only naming the file opts in. |
| TST-004 | Fixed this session | `applyRules` reports a declined file; `assertValidActive`/`assertSkipped` added with a self-test; six settings-free catalog good examples that executed with the rule disabled now carry their bad twin's settings, and the catalog test rejects the class. |
| DOC-003 | Addressed by the merge plus this session | Release-line artifacts (changelog gate direction, plans, releases list) come from main; this round's changes are recorded under the `Unreleased` heading, deferring the patch-versus-minor decision (open question 6). |
| DOC-004 | Partly fixed upstream; completed this session | README/CONTRIBUTING validate description was already consistent on main. The decision record now names the real conflict-check count (five of six legacy-only) and no longer waits on lint-time deprecation messages the plugin deliberately never emits. |
| DOC-005 | Fixed this session | README troubleshooting section covers the three silence causes with the filename-convention table; `businessRuleWhen` documented; oxfmt table lists all override groups and ignore patterns. |
| OPS-009 | Fixed this session | Both matrix workflow steps run the check on its own line; the CI test job runs `compat:check`. |
| OPS-010 | Fixed this session | `check-script-paths.mjs` asserts every file under `scripts/` is tracked; verified in both directions. |
| OPS-011 | Partly fixed upstream; floor pinned this session | The matrix now spans the ESLint and TypeScript endpoints. `@types/node` is pinned to the engines floor line and held there by Dependabot. Remaining maintainer decisions: oxlint/oxfmt peers above the highest tested version, and the ESLint 10 + typescript-eslint pairing the matrix check forbids while the peers allow it. |
| MNT-005 | Addressed this session (stopgap per the finding) | A parity test pins each `scripts/*.d.mts` export list against its implementation both ways; five drifted declarations fixed. Checked JavaScript reported 176 errors on first run, so the finding's own fallback applies. |
| MNT-006 | Fixed upstream, verified; review premise partially wrong | The derivation computes the earliest deprecating version and the fixture pins it. The review's claim that the manual `List: 4.1.0` should be 4.0.0 is contradicted by the recorded SDK lifecycle evidence; a trial edit to 4.0.0 was caught by the guard, which also proves the guard is no longer vacuous. |
| MNT-007 | Fixed this session | Examples declare their dependencies, `lint` runs the valid tree cleanly with `lint:invalid` split out, the loose configs join the fixture type-check (which surfaced and fixed an oxfmt type incompatibility), the ui-action config states its documented surfaces, the missing Fluent server include exists, and two README rows match the folders. |
| MNT-008 | Fixed this session | Dead `src/glide/query-methods.ts` deleted; `ReadonlySetView` replaced by `immutableSet`; path-state resolves constructor kinds through `ctorProvenanceKind`. The derived `GLIDE_*` sets stay: upstream's plan-015 tests deliberately assert them and COR-012's fix removed the scope disagreement. |
| REL-004 | Fixed this session | Baseline regenerated with the 10-sample configuration on this hardware; `bench` removed from the required checks and the desired-governance validator; the merge-base baseline extraction stays. |
| API-002 | Remediated for 2.x; removal stays a 3.0 decision | The four never-computed fields carry `@deprecated` markers, a contract test pins the constants, and `docs/decisions.md` records the 3.0 removal behind the shared dependents check. |
| API-003 | Fixed this session | The analysis entry point and the root export every referenced type; a type-level fixture annotates each. |
| IMP-001 | Fixed upstream, verified; trade-off noted | All five evading spellings are caught by the parser-based checker. Upstream traded the pre-install property for `npm ci --ignore-scripts` before the check; the compensating controls are the ignored lifecycle scripts and the pinned lockfile. |
| REM-001 | Disposition only | Removal at 3.0 stands as recorded in `docs/decisions.md`; the alias stays `off` through 2.x. |
| REM-002 | Disposition only; trigger not met | The apparatus retires when this line merges to `main`. The retirement record (trigger, archive requirement, post-removal gate) is restored in `docs/decisions.md`. |
| FEAT-001 | Disposition only | Thin presets stay through 2.x; reassess at 3.0 with the shared dependents check, per the recorded decision. |
| FEAT-002 | Disposition only; evidence recorded | The 2026-08-29 evidence outcome (194 weekly downloads, dependents unreadable without authentication) is restored in `docs/decisions.md`; the concrete 3.0 action is to retire only `@sn-es-latest`. |
| FEAT-003 | Disposition only | Blocked on the FEAT-001 decision; the two records point in opposite directions on the same two presets and must be decided together at 3.0. |
| POS-001…POS-005 | Preserved | Context gates untouched; provenance verification extended (MNT-004) not relaxed; catalog regeneration byte-clean after every change (`docs:check`); the budget stays deterministic while its size scales; settings validation untouched. |

## Retired-finding regression guard

The theirs-style merge could drop branch-only fixes. Each retired ID was
re-checked against the merged tree:

- Re-ported because the defect reproduced: COR-008 (anchored digest-name
  components), OPS-008 (nightly audit schedule), MNT-004 (trusted-publisher
  subject bound to repository and environment, adapted to main's enriched
  subject design), REL-003 (ASCII prerelease order), PER-002 (cursor-walker
  memoization, adapted to main's rebuilt walkers), API-002 (deprecation
  markers and decision record).
- Present upstream, no port needed: COR-007, OPS-004 (hermetic default
  suite), DOC-002, MNT-003, COR-003/004/005, API-001, TST-001,
  OPS-002/005/006, COR-009, IMP-002 and the rest of the #121 port list.
- Reclassified: the branch's offline `validate` split (part of OPS-004) is
  superseded by main's documented networked `validate`; CONTRIBUTING and
  the README describe it consistently, so it is upstream's design, not a
  regression.

## Open questions from the review

1. Whether the governance audit can authenticate against live rulesets is
   still unverifiable offline; the audit is scheduled nightly again and
   fails closed either way.
2. The real oxlint host lifecycle is modeled (one `createOnce` per process,
   fresh SourceCode per file) by the new multi-file harness; the host
   binary itself was not driven.
3. No offset-free host adapter is known; COR-016 is fixed regardless.
4. The budget multiple was measured: 128 units/node completes dense scripts
   to ~1,200 lines with branch-heavy at a 519 ms committed median
   (`docs/performance-baseline.json`), versus 1.5 s at 256.
5. The ESLint 10 + typescript-eslint pairing is treated as a range
   oversight and left to a maintainer range decision (OPS-011).
6. The release version is deferred through the `Unreleased` changelog
   heading.
