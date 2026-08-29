# Plan 016: Stage and release 2.0.0 from the reviewed stack

> **Executor instructions**: Follow this plan step by step. Run each
> verification command and confirm the expected result. Stop if a STOP
> condition occurs. Do not update `plans/README.md`; the coordinating reviewer
> maintains the index.
>
> **Drift check (run first)**:
> `git diff --stat b87972a..HEAD -- package.json package-lock.json CHANGELOG.md docs/pr-51-acceptance-ledger.md docs/pr-51-layers.md docs/pr-51-validation-report.md docs/pr-51-stack.json docs/release-governance-live.json`
> Plans 006–015 must change these paths before this plan starts. Compare the
> current files with the required dependency contracts below. Stop if a
> dependency is incomplete or the live state is not recorded at its current head.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: `plans/006-freeze-and-restack-pr51.md`, `plans/007-rebuild-path-state-semantics.md`, `plans/008-fix-bindings-scopes-and-closures.md`, `plans/009-rebuild-stateful-rule-lifecycles.md`, `plans/010-authoritative-fluent-sdk-registry.md`, `plans/011-fix-now-id-and-fluent-directives.md`, `plans/012-fix-context-profiles-and-rule-contracts.md`, `plans/013-narrow-public-api-and-fix-user-assets.md`, `plans/014-make-tests-evidence-and-compatibility-honest.md`, `plans/015-prove-release-governance-and-provenance.md`
- **Category**: migration, dx
- **Planned at**: commit `b87972a`, 2026-08-20

## Why this matters

A local test or mock cannot prove npm OpenID Connect (OIDC), registry visibility,
provenance identity, or GitHub release permissions.
Release 2.0.0 only from the fully merged real pull request stack.
Prove one current release candidate first, then tag and verify the exact stable commit.
Close #58 and #76 only after all live evidence matches.

## Current state

At the planned commit, the package already claims the stable version:

```json
package.json:2-3
"name": "oxc-plugin-servicenow",
"version": "2.0.0",
```

The lockfile repeats that root version. `src/constants.ts` reads the package version,
so neither a release candidate nor a stable version bump requires a `src/**` edit.

The changelog also has a stable heading before the required defects are fixed:

```text
CHANGELOG.md:3-5
## Unreleased

## 2.0.0 — 2026-08-20
```

The current report correctly leaves stable live proof pending:

```text
docs/pr-51-validation-report.md:43-50
## Intentionally deferred live gates
...
2. **Pending:** an approved protected `v2.0.0` tag must prove live npm OIDC
publication, exact registry integrity/provenance/import visibility, and
idempotent GitHub release creation.
```

The current ledger also keeps the live gates open:

```text
docs/pr-51-acceptance-ledger.md:91-103
| 85 | ... Tag ancestry and exact artifact ... | Pending | ... |
...
| Live OIDC publication ... | Live-pending |
| Live registry provenance/import ... | Live-pending |
| Live GitHub release ... | Live-pending |
```

`docs/release.md:94-98` defines the correct phase boundary. Merge readiness is
in-repository. Release readiness starts after merge and requires the protected
tag, real host matrix, OIDC, registry verification, and GitHub release.

At the planned commit, issues #58 and #76 are open. Issue #58 requires exact
published bytes, trusted publishing, provenance, public imports, and a GitHub
release after registry verification. Issue #76 closes only after the exact
reviewed tarball publishes through the protected path.

Plan 015 must replace the current unsafe live state before this plan runs:

- the tag creator and environment reviewer are distinct
- the environment permits only selected `v*` tag deployments
- tag creation is restricted to a controlled actor
- tag deletion and movement have no bypass
- provenance signature and exact identity are verified
- GitHub release creation verifies the existing tag and exact commit
- one immutable `2.0.0-rc.N` has published to `next` and passed a same-tag rerun

Do not use the planned-commit governance capture as proof for this plan.
Query live controls again.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Install | `npm ci` | exit 0 |
| Full local gate | `npm run validate` | exit 0 |
| Full packed matrix | `npm run release:check -- --consumer-all` | exit 0 on the current runtime; hosted real-runtime jobs are still required |
| Focused release tests | `node scripts/run-tests.mjs tests/release` | all pass |
| Live governance | `npm run release:governance -- --live` | exit 0 and no drift |
| Diff hygiene | `git diff --check` | exit 0 |
| Registry metadata | `npm view oxc-plugin-servicenow@VERSION version dist.integrity dist.attestations --json` | exact version and complete metadata |
| Dist-tags | `npm view oxc-plugin-servicenow dist-tags --json` | `next` for the candidate; `latest` for stable only |
| GitHub release | `gh release view TAG --json url,tagName,isPrerelease,targetCommitish,assets` | exact tag and asset metadata |

Use the protected GitHub workflow for publication.
Never run `npm publish` from a checkout or local tarball.

## Suggested executor toolkit

Use the `gh-stack` skill and `gh stack view --json` to inspect the replacement stack.
Use `gh stack sync --remote origin` for an authorized stack sync.
Never use an interactive stack view or submit command.
Do not use `gh pr merge` for a stack-managed pull request.

## Scope

**In scope**:

- `package.json`
- `package-lock.json`
- `CHANGELOG.md`
- `docs/pr-51-acceptance-ledger.md`
- `docs/pr-51-layers.md`
- `docs/pr-51-validation-report.md`
- `docs/pr-51-stack.json`
- `docs/release-governance-live.json`
- a release-candidate metadata pull request only if plan 015 proof is stale
- a stable `2.0.0` metadata pull request
- a post-release evidence-only pull request
- protected tag and release workflow operations
- npm and GitHub read-only verification
- issues #58, #75, and #76 comments and final states
- pull request #51 tracking body and final close-without-merge action

**Out of scope**:

- `src/**`, `tests/**`, examples, generated rule pages, or analysis changes
- `.github/workflows/release.yml`
- `scripts/verify-published-package.mjs`, `scripts/create-github-release.mjs`, or any release helper
- GitHub environment, ruleset, or npm trusted-publisher design changes
- a manual npm publication, local tag push by an uncontrolled actor, or long-lived token
- merging PR #51
- Plans 001–015 and `plans/README.md`

Release automation stays isolated from analysis changes.
If this plan needs an automation or behavior fix, return to its owning pull request.
Then repeat the release-candidate proof before stable release.

## Git workflow

Plans 007–015 must merge bottom-up through their real dependent pull requests.
PR #51 remains a tracking-only draft and never becomes a roll-up merge.
After a predecessor merges, its child rebases onto `main`, retargets to `main`,
and proves its focused three-dot diff again.
Plan 015 is the last implementation pull request.

Use separate release metadata pull requests:

- If required: `pr51-remediation/016-rc-N`, based on current protected `main`
- Stable prep: `pr51-remediation/016-stable-2.0.0`, based on post-candidate `main`
- Evidence: `pr51-remediation/016-release-evidence`, based on post-release `main`

Each metadata pull request can change only the in-scope metadata or evidence files.
Use conventional commit messages such as `release: stage 2.0.0` and
`docs: record 2.0.0 release evidence`.
Do not push, merge, tag, approve, publish, close issues, or close PR #51 without explicit maintainer authorization.

## Steps

### Step 1: Prove the implementation stack is complete

Read `docs/pr-51-stack.json` and run `gh stack view --json`.
Query every plans 007–015 pull request.
For each pull request, record:

- URL and state
- original base/head and final merge commit
- focused changed paths
- current-head and merge-commit workflow runs
- acceptance-ledger rows
- rollback boundary

Require every implementation pull request to be merged bottom-up.
Require plan 015 to be the last implementation merge.
Require no analysis path in its focused diff.
Require PR #51 to be draft, tracking-only, and unmerged.

Check every issue #52–#75 criterion against the current ledger.
A closed issue does not substitute for current proof.
Only stable live criteria in #58/#76 can remain open.
Keep #75 open until the final stack consumes reviewed foundations.

**Verify**:

```bash
gh pr view 51 --json isDraft,state,title,headRefOid,body
gh issue view 58 --json state,url
gh issue view 75 --json state,url
gh issue view 76 --json state,url
```

Expected: PR #51 is open draft and marked do-not-merge; all three issues are open;
the body links every merged replacement pull request.

### Step 2: Freeze and validate current protected main

Fetch and prune `origin`.
Set `INTEGRATION_SHA=$(git rev-parse origin/main)`.
Create a new detached worktree or clean checkout at that exact commit.
Do not validate in a reused working directory.
Record Node, npm, operating system, architecture, and zero initial status output.

Run the complete local matrix:

```bash
npm ci
npm run typecheck
npm run build
npm test
npm run docs:check
npm run manifest:check
npm run bench
npm run release:check -- --consumer-all
npm run validate
git diff --check
test -z "$(git status --porcelain)"
```

Expected: every command exits 0 and the detached checkout remains clean.

Require protected-branch CI at `INTEGRATION_SHA`.
Require all tests, docs, manifest, workflow, benchmark, artifact, and generated
compatibility cells. The real Node 20/22/24/26/current jobs must each run in their named runtime.
Do not accept a run from a pull request head, merge preview, or older SHA.

If `origin/main` moves, discard this snapshot and repeat the step.

### Step 3: Revalidate the plan 015 prerelease proof

Read the exact prerelease version, tag, `RC_SHA`, workflow runs, and rerun from
the plan 015 evidence. Query GitHub and npm again.
Run the exact provenance verifier with expected package, version, repository,
workflow, environment, tag ref, and `RC_SHA`.
Download the immutable GitHub prerelease asset if the local inspected tarball is unavailable.

Require:

- `RC_SHA` contains all plans 007–015 merge commits
- the protected tag resolves to `RC_SHA`
- both workflow attempts used `RC_SHA`
- `next` points to the candidate and `latest` did not move
- registry integrity equals the inspected and GitHub asset bytes
- clean `--ignore-scripts` install and all public imports/declarations pass
- Sigstore subject, digest, repository, workflow, environment, ref, and commit match
- the same-tag rerun reused identical registry bytes and GitHub asset

Compare package-affecting paths from `RC_SHA` to `INTEGRATION_SHA`:

```bash
git diff --exit-code RC_SHA..INTEGRATION_SHA -- \
  package.json package-lock.json CHANGELOG.md src tests examples \
  .github/workflows scripts
```

Expected: exit 0 if the plan 015 candidate is still current.
Changes only to excluded evidence documents do not invalidate package bytes.
Any package, test, workflow, helper, or governance change requires step 4.
The candidate proves the complete implementation and release path.
It does not prove byte identity for stable 2.0.0 because the stable version and
changelog metadata must change and both files ship in the package.

### Step 4: Publish a new candidate only when the proof is stale

Skip this step only when step 3 proves the existing candidate contains the complete integrated release inputs.
Record the skip with exact tree and commit evidence.

If step 3 detects relevant changes, select a new unused `2.0.0-rc.N`.
Open `pr51-remediation/016-rc-N` from current protected `main`.
Run:

```bash
npm version 2.0.0-rc.N --no-git-tag-version
```

Update the exact changelog heading to `## 2.0.0-rc.N — 2026-08-20`.
Change no other file unless current release notes need a factual correction.
Run step 2 in a clean checkout of the candidate head and its merge commit.

After protected merge, freeze the new `RC_SHA`.
Re-run live governance.
The controlled actor creates `v2.0.0-rc.N` at `RC_SHA`.
The distinct reviewer approves the environment.
Require `next`, exact bytes, exact provenance identity, public imports, GitHub
prerelease, and a same-tag rerun as specified in plan 015.

**Verify**:

```bash
npm view oxc-plugin-servicenow@2.0.0-rc.N version dist.integrity dist.attestations --json
npm view oxc-plugin-servicenow dist-tags --json
gh release view v2.0.0-rc.N --json url,tagName,isPrerelease,targetCommitish,assets
```

Expected: the new exact candidate is on `next`; `latest` is unchanged; the
release is a prerelease; the remote tag and both workflow attempts use `RC_SHA`.

### Step 5: Prepare the stable metadata pull request

Confirm package version `2.0.0` and tag `v2.0.0` do not exist remotely.
A protected existing tag at another commit is unrecoverable. STOP rather than move or delete it.

Create `pr51-remediation/016-stable-2.0.0` from current protected `main`.
This exact three-file stable metadata delta is the only allowed change after the
current candidate without another candidate. It is reviewed and validated as stable
input; it is not claimed to be byte-identical to the candidate.
Run:

```bash
npm version 2.0.0 --no-git-tag-version
```

Change the changelog heading to exact `## 2.0.0 — 2026-08-20`.
Review each release-note claim against current executable evidence.
Remove or correct any historical claim that the remediation invalidated.
Do not change source, tests, workflow, helpers, or governance.

**Verify**:

```bash
git diff --name-only origin/main...HEAD
node -p "require('./package.json').version"
node -p "require('./package-lock.json').packages[''].version"
rg -n '^## 2\.0\.0 — 2026-08-20$' CHANGELOG.md
```

Expected: the diff contains only `package.json`, `package-lock.json`, and
`CHANGELOG.md`; both versions print `2.0.0`; the heading occurs exactly once.

### Step 6: Validate and merge the stable metadata commit

Repeat the complete clean-checkout commands from step 2 at the stable pull request head.
Require all hosted pull request checks at that exact head.
Merge through protected `main` after approval.
Set `STABLE_SHA` to the resulting protected `main` commit.

Repeat the complete clean-checkout commands again at `STABLE_SHA`.
Require protected-branch CI at `STABLE_SHA`.
Confirm `STABLE_SHA` contains every plans 007–015 merge and the stable metadata commit.
Confirm `origin/main` still equals `STABLE_SHA`.

**Verify**:

```bash
test "$(git rev-parse origin/main)" = "$STABLE_SHA"
git merge-base --is-ancestor "$RC_SHA" "$STABLE_SHA"
npm run validate
git diff --check
test -z "$(git status --porcelain)"
```

Expected: every command exits 0; current protected main is the validated stable commit.

### Step 7: Recheck live governance and stable tag absence

Run the live governance checker at `STABLE_SHA`.
Query the environment, both tag rulesets, repository action policy, and npm trusted publisher.
Do not trust only `docs/release-governance-live.json`.

Confirm all of these facts:

- only selected `v*` tags can deploy to `release`
- the controlled tag actor is distinct from all eligible reviewers
- self-review prevention is enabled
- administrator environment bypass is disabled
- normal writers cannot create release tags
- the controlled actor can bypass only the creation ruleset
- no actor can bypass release-tag deletion or movement rules
- npm trust matches repository, workflow filename, and environment
- no `NPM_TOKEN` or other long-lived publishing credential path exists
- npm version `2.0.0` and Git tag `v2.0.0` are absent

**Verify**:

```bash
npm run release:governance -- --live
npm view oxc-plugin-servicenow@2.0.0 version --json
gh api repos/martinthommesen/oxc-plugin-servicenow/git/ref/tags/v2.0.0
```

Expected: governance exits 0. The two absence queries return documented not-found results.
Any found version or tag triggers a STOP condition unless it is an exact reviewed retry.

### Step 8: Create and approve the stable protected tag

This step is irreversible. Obtain explicit maintainer approval for `STABLE_SHA`.
The controlled release actor creates `v2.0.0` at exactly `STABLE_SHA`.
A normal writer must not create it.
Do not create the tag locally with a maintainer credential.
Do not move or delete it after creation.

Resolve lightweight or annotated tag objects to their final commit.
Require that commit to equal `STABLE_SHA` before approving publication.
Then let the independent reviewer approve the `release` environment.
The tag initiator must not approve the deployment.

**Verify**: use the same remote tag-resolution command and helper tests from plan 015.

Expected: one protected `v2.0.0` ref resolves to `STABLE_SHA`; the workflow run head is also `STABLE_SHA`.

### Step 9: Require the complete stable workflow

Observe the protected tag workflow without changing it.
Require this exact order:

1. read-only validation and package inspection pass
2. every generated real-Node consumer job tests the one uploaded tarball
3. the environment-approved artifact-only job publishes that tarball to `latest` with OIDC
4. the no-OIDC job verifies registry bytes, imports, declarations, Sigstore, and exact identity
5. the GitHub release job verifies the existing tag and commit, then creates or reuses the exact asset

A skipped required job is a failure.
An old successful run is not evidence.
Do not rerun publication blindly after an ambiguous result.
Use the immutable tag and artifact. Let the no-OIDC verifier decide whether exact
registry bytes already exist. Fail on any mismatch.

**Verify**: record the workflow run URL, attempt, `headSha`, conclusion, and every job conclusion.

Expected: all required jobs succeed at `STABLE_SHA` in the required dependency order.

### Step 10: Verify registry, imports, provenance, and the GitHub release

Record the inspected artifact filename, SHA-256, and npm integrity from the workflow.
Download the registry tarball and GitHub release asset to separate clean directories.
Compare their exact bytes and digests with the inspected artifact.

In a new temporary package, install only `oxc-plugin-servicenow@2.0.0` with
`--ignore-scripts --no-audit --no-fund`.
Resolve every declaration and export.
Import these public specifiers without a checkout-relative fallback:

- `oxc-plugin-servicenow`
- `oxc-plugin-servicenow/oxfmt`
- `oxc-plugin-servicenow/oxfmt.recommended.json`
- `oxc-plugin-servicenow/package.json`

Run the exact provenance verifier with expected:

- package `oxc-plugin-servicenow@2.0.0`
- repository `martinthommesen/oxc-plugin-servicenow`
- workflow `.github/workflows/release.yml`
- environment `release`
- ref `refs/tags/v2.0.0`
- commit `STABLE_SHA`
- inspected tarball SHA-512 subject digest

Query npm dist-tags and the GitHub release.
Require `latest` to equal `2.0.0`.
Require the GitHub release to be stable, not draft or prerelease.
Require its tag to resolve to `STABLE_SHA` and its asset digest to match.

**Verify**:

```bash
npm view oxc-plugin-servicenow@2.0.0 version dist.integrity dist.tarball dist.attestations --json
npm view oxc-plugin-servicenow dist-tags --json
gh release view v2.0.0 --json url,tagName,isDraft,isPrerelease,targetCommitish,assets
```

Expected: exact stable metadata, `latest: 2.0.0`, complete verified attestation,
a non-draft stable GitHub release, exact commit, and exact asset bytes.

### Step 11: Record evidence and close the remediation program

Create `pr51-remediation/016-release-evidence` from post-release protected `main`.
Change only the in-scope evidence documents.
Record:

- plans 007–015 pull request URLs and merge commits
- stable metadata pull request and `STABLE_SHA`
- all current-head local and hosted commands, environments, run URLs, and results
- candidate and stable tags, workflow runs, and attempts
- artifact SHA-256 and npm integrity
- registry version, dist-tag, import/declaration results, and package URL
- structured provenance identity fields and bundle digest
- GitHub release URL, resolved tag commit, and asset digest
- remaining intentionally deferred items, if any, with owner and blocker

Promote a ledger row only when its exact criterion has exact evidence.
Change the stable tag/exact artifact row and all three live gate rows to `Release-verified`.
Check the matching goal checkbox only after the evidence is in the document.
Do not reuse `Verified` for live proof.

Merge the evidence pull request through protected `main`.
Then comment on issue #58 with evidence for each acceptance criterion and close it.
Comment on issue #75 with the real pull request stack and rollback boundaries and close it.
Only after both close and every #76 criterion has evidence, comment on and close #76.

Update PR #51's body with final links and status.
Close PR #51 without merging it.
State that the replacement stack, not PR #51, supplied the release.

**Verify**:

```bash
gh issue view 58 --json state,url
gh issue view 75 --json state,url
gh issue view 76 --json state,url
gh pr view 51 --json state,mergedAt,body,url
```

Expected: issues #58, #75, and #76 are closed; PR #51 is closed with
`mergedAt: null`; its body links the real stack and stable evidence.

## Test plan

This plan does not add product tests.
It runs and records these existing or plan 015 checks:

- clean `npm run validate` at integration, candidate if needed, stable PR head, and `STABLE_SHA`
- all generated hosted compatibility cells at the same exact commit
- live governance with selected tag policy and split creation/immutability rulesets
- plan 015 release-helper tests
- a real candidate on `next`, including the same-tag rerun
- stable registry install with `--ignore-scripts`
- all public exports and declarations from the registry package
- exact cryptographic provenance identity
- exact remote tag commit
- exact GitHub release asset bytes
- issue and tracking pull request final states

Do not create a new candidate when the plan 015 candidate remains current.
Do create and prove a new candidate after any other package-affecting, workflow,
helper, test, or governance change. The reviewed stable-only version/lock/changelog
delta in step 5 is the explicit exception and receives full stable validation.

## Done criteria

All criteria must hold:

- [ ] Plans 007–015 merged through real focused pull requests in dependency order.
- [ ] PR #51 was never merged and is closed as a tracking record.
- [ ] Full local and hosted validation passed at `STABLE_SHA`.
- [ ] A current complete candidate published to `next` before the stable tag.
- [ ] Live governance had no drift at stable tag creation.
- [ ] The controlled actor created `v2.0.0` at exactly `STABLE_SHA`.
- [ ] A distinct reviewer approved the `release` environment.
- [ ] The exact inspected tarball passed every real consumer job and was the npm publish input.
- [ ] Registry integrity and downloaded bytes equal the inspected tarball.
- [ ] Clean registry install, public imports, exports, and declarations pass.
- [ ] Sigstore and exact repository/workflow/environment/ref/commit identity pass.
- [ ] npm `latest` points to `2.0.0`.
- [ ] The stable GitHub release tag and asset match `STABLE_SHA` and the inspected tarball.
- [ ] Ledger stable/live criteria are `Release-verified` with exact evidence.
- [ ] #58 closed before #76; #75 and #76 also closed with linked evidence.
- [ ] The post-release evidence pull request contains no source or automation change.

## STOP conditions

Stop and report if:

- Any plans 006–015 dependency is incomplete, stale, unmerged, or not independently reviewable.
- PR #51 is still proposed as a merge vehicle.
- Plan 015 mixes analysis with release automation or lacks a valid live candidate proof.
- Any current-head local or hosted gate fails, skips, or runs at another SHA.
- `origin/main` moves after a validation freeze.
- A package-affecting change other than step 5's exact stable version/lock/changelog delta lands after the current candidate without a new candidate proof.
- Stable prep requires any `src/**`, test, workflow, helper, or governance change.
- Live governance allows tag reservation, branch deployment, tag movement, self-review deadlock, or publisher identity drift.
- No distinct tag actor and reviewer exist.
- Version `2.0.0` or tag `v2.0.0` already exists unexpectedly.
- A release tag resolves to another commit. Never delete or move it to recover.
- An ambiguous publication does not resolve to the exact inspected registry bytes and identity.
- Any artifact digest, integrity, signature, identity, import, declaration, tag, or GitHub asset differs.
- A prerelease would move `latest`, or stable does not set `latest` to `2.0.0`.
- Any release automation fix becomes necessary. Return to an isolated plan 015 follow-up and repeat candidate proof.
- Any acceptance criterion lacks direct evidence. Keep its issue and ledger row open.
- A check fails twice after one reasonable metadata-only correction.

## Maintenance notes

The stable tag and published version are immutable. Never move, delete, or overwrite them.
The post-release evidence commit is newer than the release tag and is not part of package 2.0.0.
Future releases must repeat exact-head validation, a current candidate when release inputs change,
full validation of the expected stable metadata delta, controlled tag creation,
independent approval, exact provenance identity, and registry/GitHub byte comparison.
A repository transfer, workflow rename, environment rename, or package rename invalidates the stored provenance identity.
