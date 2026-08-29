# FINDINGS.md remediation ledger

Disposition of every active record in `FINDINGS.md` (super-review of
2026-08-29). One commit per record on `pr51-remediation/layer6`; the commit
subject carries the record ID.

## Verification state

- Full suite: 807/807 (including the networked consumer test).
- The release provenance verifier validates the real published 2.0.0
  attestation end to end (real Fulcio certificate, public Sigstore trust
  root, all nine required OIDs including the environment and the ID-enriched
  subject).
- Hermetic `npm test`: 805/805, about 21 s; no network access points remain in the default suite (the consumer install moved to `test:consumer`).
- Clean `git archive HEAD` checkout passes `lint:check`, `format:check`,
  `typecheck`, and `typecheck:fixtures`.
- `docs:check`, `evidence:check`, `manifest:check`, `workflow:check`,
  `compat:check`, `release:check`: all pass.
- Governance audit returns `ok: true` against live GitHub state
  (npm trust read still needs an npm login).
- Acceptance capture records the exact clean commit with a reproducible
  digest.

## Dispositions

| ID | Disposition | Commit | Note |
| --- | --- | --- | --- |
| OPS-001 | Fixed | 9b7cb73 | Configs tracked; `check-script-paths.mjs` guards recurrence. |
| OPS-002 | Fixed | faf4855 | One wrong check name corrected; producibility test added. Live ruleset read 2026-08-29: already reconciled, no admin edit needed. |
| OPS-003 | Fixed | ddab1b1 | Whole tree committed and pushed. |
| OPS-004 | Fixed | decbb29 | `npm test` hermetic; consumer test is its own script and CI/release job with `--ignore-scripts`. |
| OPS-005 | Fixed | faf4855 | Real principals from live state: tag actor `release-sentinel-sn` (Integration 4671202), reviewer `martinthommesen` (User 267603464). Checker's reviewer normalization fixed. Audit passes live. |
| OPS-006 | Fixed | f3ae736 + follow-up | Two failure modes. (1) The consumer probe asserted the removed `PACKAGE_VERSION` root export; fixed and contract-tested (this was latent, not the v2.0.0 incident). (2) The actual v2.0.0 incident: the OID policy compared raw bytes against DER-encoded Fulcio v2 extension values and expected a plain subject in extension 1.24 where Fulcio embeds the ID-enriched `repo:owner@id/name@id:environment:env` form. Fixed with DER-encoded policy values and the enriched subject; the mock fixture now uses real Fulcio encoding, and the fix is proven end to end against the live npm 2.0.0 attestation with the public Sigstore trust root. |
| OPS-007 | Fixed | 37df16a | Nightly CI schedule plus scheduled `manifest-drift` job; offline `manifest:check` was already required. |
| TST-001 | Fixed | fbb823c | Fixture clock tracks wall time; 16/16. |
| TST-002 | Fixed | c757085 | Preset source vendored; digest asserted from bytes. |
| COR-001 | Fixed | 04339da | Directory heuristics bounded to `context.cwd`; decoy-path tests both directions. |
| COR-002 | Fixed | ecbf201 | 32-hex suppression for every digest-like name; binding-name stack. |
| COR-003 | Fixed | 9586dff | Constant-condition pruning (the one reproducible symptom); the other three symptom classes probed correct and pinned by tests. |
| COR-004 | Fixed | daa0424 | Shared `isSynchronousIife` predicate; both rule families inherit loop context through IIFEs. |
| COR-005 | Fixed | 598d39f | Live rules already keyed by binding/object identity (verified and pinned); the dead display-name correlator deleted. |
| COR-006 | Fixed | 9b2d3ad | Alias resolution follows execution order; nested-function writes and function-scoped uses are conservatively uncertain. |
| API-001 | Fixed | d812370 | `analyzeProvenance` honors its AST argument; host scope skipped for foreign trees. |
| REL-001 | Fixed | 8ab7dc4 | Prerelease split at the first hyphen only. |
| REL-002 | Fixed | 11763c1 | 120 s per-operation timeouts (npm children, import probe, attestation fetch) and `timeout-minutes` on every job. |
| PER-001 | Fixed | 8bbf4fb | 939 KB declaration -> 162 bytes; 200 KB per-declaration budget enforced. |
| MNT-001 | Fixed | e523f2d | Dead autofix harness deleted; catalog metadata retained as host-facing truth; decision recorded. |
| MNT-002 | Fixed | 6891266 | `src/version.ts` generated at build time; no load-time filesystem read. |
| MNT-003 | Fixed | 376d37d | Prototype-free lookup tables; negative tests for `Object.prototype` names. |
| DOC-001 | Fixed | 28abfb3 | Ledger outputs excluded from the digest scope; digest reproducible. |
| DOC-002 | Fixed | 92f58d1 | Zurich URLs; release-segment assertion in the evidence tests. |
| IMP-001 | Fixed | d314dea | Non-`@` `uses:` references fail; YAML-parsed pin assertions added. |
| IMP-002 | Fixed | 382820e | Bounded npm range `>=11.5.1 <12`; publish job on pipeline Node. |
| FEAT-001 | Decision recorded | 1d7044b | Thin presets stay through 2.x; 3.0 review trigger in `docs/decisions.md`. |
| FEAT-002 | Decision recorded | 1d7044b | 1.x settings layer retires in 3.0 per `docs/decisions.md`; dependents check before removal. |
| REM-001 | Decision recorded | 1d7044b | Removal in 3.0 announced in changelog, rule page, and README. |
| POS-001..004 | Preserved | — | No change to the protected patterns; COR-003/COR-006 fixes only narrow wrong evidence, unknown still means silent. |

## Outstanding external actions

1. Merging into `main`: this branch shares its base with the pre-2.0 history
   while `origin/main` gained 39 commits (PRs #102-#120) and shipped 2.0.0.
   Reconciling the two lines is a maintainer decision outside this
   remediation.
2. `npm trust list` in the governance audit needs an npm login; the GitHub
   half of the audit passes against live state.
3. Add the new CI `consumer` job to the required status checks of ruleset
   21081867. This is recommended, not optional: the required `test` check no
   longer covers the packed-consumer path after the hermetic split, so
   enforcement is weaker until `consumer` is required. The producibility test
   accepts whatever list is chosen.
