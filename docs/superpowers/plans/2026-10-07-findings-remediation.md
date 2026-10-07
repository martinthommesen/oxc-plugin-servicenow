# Findings remediation implementation plan

Resolve the active defects in `FINDINGS.md` with focused changes and executable regression proofs.

**Goal:** Correct all confirmed defects, assess the optional optimization and conditional retirement, and preserve the report's positive patterns.

**Architecture:** Repair existing fact owners and conservative proof boundaries. Keep deterministic exhaustion, immutable public facts, catalog-derived documentation, and release identity validation.

**Spec:** `FINDINGS.md`, sections 6-8; `CODING_STANDARDS.md`.

## Work packages

Independent packages have separate source ownership; the controller integrates documentation and verification.

- [x] Path state and budgets: COR-003, PER-002, PER-007; implement IMP-003 in `path-state.ts`, domain payloads, retention and bindings. Prove impossible-loop suppression, branch-independent callable joins, and bounded distinct-state work.
- [x] Fluent proofs: COR-006, COR-020, COR-025, COR-024, REL-005. Prove RHS completion, unsupported-write invalidation, effective-property uncertainty, branch attachment and deep iterative aliases.
- [x] Validation boundaries: REL-006, OPS-004, TST-007, API-004, DOC-009. Prove retry normalization, offline dispatch, parser/host rejection, readonly contexts and strict omission-based settings examples.
- [x] Local correctness: COR-019, COR-021, COR-022, COR-023. Prove structural cache separation, regex lexical features, static template runs and ordered availability invalidation.
- [x] Documentation: DOC-007, DOC-008; correct lifecycle/support claims and mixed UI Action applicability without changing runtime policy.
- [x] Lifecycle decision: REM-002; inspect merge, outstanding criteria and archive conditions. Retain the tracker because the PR closed without merge and the other retirement conditions remain unmet.

## Regression cycle

Every behavioral fix first reproduces its finding with a failing test, then makes the minimal owning-module change and runs relevant tests. Preserve positive controls, unknown offsets, short-circuit order, execution boundaries and host failures.

## Integration gates

Completion requires fresh evidence from the repository's checks and an accurate report disposition.

- [x] Review every assigned patch and finding against its reproduction; the first independent review found no additional actionable defect; the subsequent local-changes review is recorded below.
- [x] Update current-state `lat.md/` architecture and test specifications, then run `lat check`.
- [x] Run build, all type projects, lint, format, 1,673 passing tests, all eight real-host examples, catalog/docs/evidence and workflow/matrix checks.
- [x] Run packed consumers, the time/RSS benchmark and release-artifact consumer checks; document external lifecycle limitations.
- [x] Retire the 19 defect and one improvement identities with proof mappings, preserve the exact original report, and retain REM-002 plus the five positive patterns.

## Local changes review and PR integration

The subsequent Standards and Spec reviews reproduce edge cases before preparing the findings PR as the bottom of the user-approved stack.

- [x] Correct Standards findings: fuse scope indexing into the existing walk, share host and retry assertions, name fixture options and retain the private document exclusion.
- [x] Extend Spec proofs for inherited and Proxy-backed settings, unreachable availability writes, and correlated callable results, argument continuations and callee capture.
- [x] Run fresh full validation on the main-based PR tree: 1,701 tests, eight examples, packed consumers, offline acceptance, generated roundtrip and 15 time/RSS cases pass. Correct the scope fixture and rerun its benchmark/release gates.
The approved integration order is findings, #140, #141, #142, #143. Parent merges preserve existing branch history. Final integration checks require each parent to be an ancestor, correct PR bases, focused diffs and a passing combined tree.
