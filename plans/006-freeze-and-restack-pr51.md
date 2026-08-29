# Plan 006: Freeze PR #51 and create the real remediation stack

> **Executor instructions**: Follow this plan step by step. Run each
> verification command and confirm the expected result. Stop if a STOP
> condition occurs. Do not update `plans/README.md`; the coordinating reviewer
> maintains the index.
>
> **Drift check (run first)**:
> `git diff --stat b87972a..HEAD -- PR51-REMEDIATION-GOAL.md docs/pr-51-acceptance-ledger.md docs/pr-51-layers.md docs/pr-51-validation-report.md`
> If an in-scope file changed, compare the excerpts below with the current file.
> Treat a mismatch as a STOP condition.

## Status

- **Status**: DONE
- **Completed at**: commit `308f01b1fa39b8053a1e046cd1fe29cc78100f3f`, 2026-08-20
- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: none; plans 001–005 are complete but do not prove the reviewed current head
- **Category**: dx, docs
- **Planned at**: commit `b87972a`, 2026-08-20

## Why this matters

PR #51 is still one large implementation and release-automation pull request.
A layer document does not create separate review, merge, or rollback boundaries.
The ledger also marks current, reproducible defects as `Verified`.
Freeze the old work, restore truthful status, and deliver remediation through real dependent pull requests.

## Current state

The governing contract requires actual pull requests and isolates privileged release work:

```text
PR51-REMEDIATION-GOAL.md:11-12
2. Restack in dependency order. Do not combine privileged release workflow
changes with rule/analysis implementation. ... do not claim issue #75 is
complete until separate PRs exist.

PR51-REMEDIATION-GOAL.md:26-36
Create these separately reviewable layers, each green on its own and based on
its predecessor: ...
7. Privileged release automation only
...
PR #51 should become a tracking/restack PR or be superseded with links to the stack.
```

The current layer document asserts a boundary that GitHub does not provide:

```text
docs/pr-51-layers.md:3
PR #51 remains the tracking pull request until the layered commits below are reviewed.
```

At the planned commit, `gh pr view 51` reports:

- Head branch: `mlammesen/phase1-trustworthy-context-c08e`
- Head commit: `b87972a8336d6cf6209801395cad82f72b827436`
- Base branch: `main`
- State: open and not draft
- The body claims issues #52–#57 and #59–#75 are closed with evidence.
- The validation section still names old commit `8b650ab` and 611 tests.

The current report records different, older evidence:

```text
docs/pr-51-validation-report.md:20-31
- `npm ci` followed by `npm run validate` from a detached clean worktree — pass.
- `npm test` — pass (656 tests).
...
- GitHub Actions PR CI run `32355160103` at governance commit `10e359d` passed ...
```

That evidence is not current-head proof after a restack or rebase.

The ledger defines `Verified` as atomic proof, but current code contradicts many rows:

```text
docs/pr-51-acceptance-ledger.md:3-6
Each row is intentionally atomic ... Statuses are `Pending`, `Verified`, or
`Live-pending` ...

| # | Layer | Source | Acceptance criterion | Status | Regression/proof | Commit | Validation |
```

Examples include these false claims:

- Rows 18–20 claim correct `try`, abrupt, and `switch` semantics.
- Rows 49 and 51 claim project-barrel resolution and packed re-export tests.
- Row 44 claims `addQuery(42)` is not valid filter evidence.
- Row 65 claims each evidence date has a reproducible verification process.
- Row 102 claims readiness phases are no longer circular.

The current gate wording is circular:

```text
docs/pr-51-layers.md:3
Do not merge or publish 2.0.0 while release-blocking issues from #52–#76 remain open.
```

Issues #58 and #76 require post-merge protected-tag evidence. They cannot close before merge.
`PR51-REMEDIATION-GOAL.md:322-323` instead requires separate merge and release phases.

The current file assignment is also ambiguous. `docs/pr-51-layers.md:27` assigns
`src/catalog.ts` to layer 1. Its table at line 79 assigns the same file to layer 5.
Resolve all such conflicts before creating the stack.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Inspect PR | `gh pr view 51 --json number,state,isDraft,headRepositoryOwner,headRefName,headRefOid,baseRefName,url,title,body` | JSON for PR #51; no mutation |
| Inspect issues | `gh issue view 75 --json state,url && gh issue view 58 --json state,url && gh issue view 76 --json state,url` | issue #75 is reopened during this plan; #58 and #76 stay open |
| Install | `npm ci` | exit 0 |
| Focused docs | `npm run docs:check` | exit 0 and no generated drift |
| Current-main validation | `npm run typecheck && npm run build && npm test && npm run docs:check` | every command exits 0 |
| Diff hygiene | `git diff --check` | exit 0 |

Use only npm commands from `package.json`. Do not run a formatter over the repository.

## Suggested executor toolkit

Use the `gh-stack` skill and GitHub's `gh stack` extension.
Run every stack command non-interactively.
Install the extension if `gh extension list` does not show `github/gh-stack`:

```bash
gh extension install github/gh-stack
gh extension list
git config rerere.enabled true
git config remote.pushDefault origin
```

Record the installed `github/gh-stack` version and confirm its help supports
multi-branch `init`, `submit --auto`, and `view --json` before changing refs.
Always use `gh stack submit --auto` and `gh stack view --json`.
Never run interactive `gh stack view` or `gh stack submit` without `--auto`.

## Scope

**In scope**:

- `PR51-REMEDIATION-GOAL.md`
- `docs/pr-51-acceptance-ledger.md`
- `docs/pr-51-layers.md`
- `docs/pr-51-validation-report.md`
- `docs/pr-51-stack.json` (create a machine-readable stack and path-ownership manifest)
- Git refs for the frozen archive and remediation branches
- Byte-for-byte relocation of archived files and hunks onto their owning branches
- Pull request #51 metadata and the new draft pull requests
- Issue #75 status and comments

**Out of scope**:

- Any source, test, generated-page, compatibility, benchmark, workflow, or helper content change
- Any behavioral fix from plans 007–015
- Any npm publication, release tag, GitHub release, or closure of #58/#76
- Plans 001–005 and `plans/README.md`

Do not change release automation while you change tracking or analysis documentation.

## Git workflow

Obtain explicit maintainer approval before any push, issue mutation, or pull request mutation.
First preserve the full current PR #51 head on remote branch `archive/pr51-b87972a`.
After the replacement pull requests exist, rebuild the PR #51 head from current `main`
with only the truth-restoration documents. Update the remote head once with an explicit
SHA-bound `--force-with-lease`. Convert PR #51 to draft and mark it
`TRACKING — DO NOT MERGE`. Never call the monolithic three-dot diff tracking-only.

Use this serial implementation stack. Each pull request targets the preceding branch:

| Plan | Head branch | Base branch | Required diff boundary |
| --- | --- | --- | --- |
| 007 | `pr51-remediation/007-path-state` | `main` | path-state evaluator plus minimum archived analysis dependency baseline |
| 008 | `pr51-remediation/008-bindings-scopes` | `pr51-remediation/007-path-state` | bindings, scopes, closures, and cache |
| 009 | `pr51-remediation/009-stateful-rule-lifecycles` | `pr51-remediation/008-bindings-scopes` | stateful rule lifecycles |
| 010 | `pr51-remediation/010-fluent-sdk-registry` | `pr51-remediation/009-stateful-rule-lifecycles` | Fluent SDK authority and re-exports |
| 011 | `pr51-remediation/011-now-id-directives` | `pr51-remediation/010-fluent-sdk-registry` | `Now.ID` and Fluent directives |
| 012 | `pr51-remediation/012-context-profiles-contracts` | `pr51-remediation/011-now-id-directives` | context, profiles, and rule contracts |
| 013 | `pr51-remediation/013-public-api-assets` | `pr51-remediation/012-context-profiles-contracts` | public API, docs, and user assets |
| 014 | `pr51-remediation/014-tests-evidence-compat` | `pr51-remediation/013-public-api-assets` | tests, evidence, compatibility, and benchmarks |
| 015 | `pr51-remediation/015-release-governance` | `pr51-remediation/014-tests-evidence-compat` | privileged release automation only |

This linear order adds a review order where some domains could be parallel.
It provides one unambiguous base, rollback boundary, and three-dot diff per pull request.
After each predecessor merges, rebase and retarget only its immediate child to `main`.
Re-run all evidence at the resulting head and merge commit.

Use conventional commit messages. Examples in the repository include
`docs: record bootstrap artifact digest` and `release: record npm workflow filename semantics`.
Do not merge, tag, or publish unless the operator separately authorizes that action.

## Steps

### Step 1: Freeze the reviewed state

Fetch `origin` and record these full values:

- `origin/main` commit
- PR #51 head commit and branch
- `git merge-base origin/main <PR_HEAD>`
- `git diff --name-status origin/main...<PR_HEAD>`
- PR #51 body, state, and current check rollup

Create remote branch `archive/pr51-b87972a` at the exact planned head.
Use an ordinary branch, not a `v*` tag.
With explicit approval, run:

```bash
git push origin b87972a8336d6cf6209801395cad82f72b827436:refs/heads/archive/pr51-b87972a
```

Confirm the remote ref resolves to the same full commit before any other mutation.

**Verify**:

```bash
test "$(git ls-remote origin refs/heads/archive/pr51-b87972a | cut -f1)" = "b87972a8336d6cf6209801395cad82f72b827436"
```

Expected: exit 0.

### Step 2: Create an exhaustive ownership manifest

Create `docs/pr-51-stack.json` with these top-level fields:

- `mergeBase`, `archivedHead`, and `trackingPullRequest`
- one object for plans 007–015 with plan file, branch, expected base branch, reconstruction commit, ownership, and rollback rule
- one `paths` entry for every path from `git diff --name-only <mergeBase>...<archivedHead>`
- either one whole-file owner or an explicit nonoverlapping hunk-level `split`
- exactly one owning plan for every archived file or hunk

Do not store a branch's mutable current head in its own branch or an ancestor branch.
That creates a self-referential commit and rebasing cycle.
Store live PR URL, base SHA, head SHA, check runs, and status in the PR body and
PR #51 tracking body. Query GitHub for current values. Plan 016 records final,
immutable merge commits in the post-release evidence commit.

Update `docs/pr-51-layers.md` to describe the nine real pull request boundaries.
Keep the seven domain-layer names as grouping labels only.
Resolve the conflicting `src/catalog.ts` ownership.
Assign shared tests and generated output to the highest pull request they prove.
Never assign `.github/workflows/release.yml`, release helpers, or release governance outside plan 015.

Add a small validation command to the document. It must compare the archived
three-dot path list with the manifest and reject missing or duplicate owners.
Use a read-only Node command; do not add a process script in this plan.

**Verify**: run the documented manifest command.

Expected: every archived file or split hunk has exactly one owner; no unknown plan number occurs.

### Step 3: Invalidate contradicted completion claims

With explicit maintainer approval, reopen issue #75 and add a truth-restoration comment.
The comment must link the current review, state that ordered commits were not separate
pull requests, and keep the issue open until the real stack is complete.
Use these authorized non-interactive commands after confirming the issue is closed:

```bash
gh issue reopen 75
gh issue comment 75 --body-file ISSUE_75_COMMENT_FILE
```

The temporary comment file must contain no credentials and must not enter the repository.

Rebuild the ledger as one table. Move rows 87–104 before the gate sections.
Remove generic proof such as `implementation checkpoint and targeted regression suite`.
A verified row must include all of these values:

- a test or other executable proof that directly tests the criterion
- a specific commit reachable from the owning pull request head
- the exact command and environment used at that commit
- a current result linked to the same full head or merge commit

Set these existing rows to `Pending` now:

`2, 9, 14–20, 27, 29, 37, 38, 42–45, 49, 51, 52, 57, 58, 65, 68, 71, 74, 83, 85, 101–103`.

Also add atomic `Pending` rows for requirements that the ledger omitted:

- issue #57 unknown-surface gating for `validate-gliderecord-calls`
- issue #69 one executor capability registry
- issue #70 typed ESLint composition at the declared minimum and current versions
- issue #72 real-host canonical `Now` shadow, alias, and reassignment cases
- issue #74 one complete shared analysis pass and public cache API
- issue #64 positive binding/control-flow matrices for each stateful consumer
- issue #66 current benchmark-result artifact retention
- issue #75 actual dependent pull requests and isolated rollback boundaries
- issue #58 exact cryptographic provenance identity and exact tag target

Change each matching `[x]` in `PR51-REMEDIATION-GOAL.md` to `[ ]`.
Do not erase historical evidence. Label it `Historical at <SHA>; contradicted at b87972a`.
Keep live publication, registry, and GitHub release rows `Live-pending`.
Do not close #58 or #76.

**Verify**:

```bash
node --input-type=module <<'NODE'
import { readFileSync } from 'node:fs';
const text = readFileSync('docs/pr-51-acceptance-ledger.md', 'utf8');
for (const id of [2,9,14,15,16,17,18,19,20,27,29,37,38,42,43,44,45,49,51,52,57,58,65,68,71,74,83,85,101,102,103]) {
  const row = text.split('\n').find((line) => line.startsWith(`| ${id} |`));
  if (!row || !row.includes('| Pending |')) throw new Error(`row ${id} is not Pending`);
}
if ((text.match(/^\| 87 \|/gm) ?? []).length !== 1) throw new Error('ledger row structure is invalid');
NODE
```

Expected: exit 0.

### Step 4: Define merge and release gates without a cycle

Replace wording that blocks merge on post-merge evidence.
Use these exact meanings throughout the goal, ledger, layers, and report:

- **Pending**: no current proof exists at the owning pull request head.
- **Verified-at-head**: focused proof passed at the exact recorded head.
- **Merge-ready**: all in-repository gates and governance checks passed at the current merge commit.
- **Live-pending**: only a protected post-merge tag, registry, or GitHub action can supply the proof.
- **Release-verified**: the stable protected-tag run supplied exact live evidence.

Define the merge gate as current code and configuration on the exact pull request
head or merge commit. Require applicable clean-checkout tests, real hosts,
artifact checks, review, and executable governance checks. Do not require a stable tag.

Define the release gate as post-merge work on protected `main`. Require the
controlled protected tag, approved OpenID Connect (OIDC) publication, registry
integrity and provenance identity, public imports, and the GitHub release.

Change `docs/pr-51-validation-report.md` from a final report to a historical
snapshot. Add a current-head status section with explicit blockers and no copied pass counts.

**Verify**:

```bash
rg -n "Merge-ready|Live-pending|Release-verified|post-merge" \
  PR51-REMEDIATION-GOAL.md docs/pr-51-{acceptance-ledger,layers,validation-report}.md
```

Expected: each readiness term appears with one consistent definition; no text requires stable publication before merge.

### Step 5: Create the actual dependent pull requests

Reconstruct the archived PR #51 diff on the nine branches according to the manifest.
Start plan 007 from the recorded `origin/main` commit.
Apply only its owned binary diff from `<mergeBase>` to `archive/pr51-b87972a`.
Commit that exact slice before any remediation work.
Start every later branch from its declared predecessor and apply only its owned slice.
For a whole-file owner, use the archived binary diff so additions, modes, and deletions survive.
For a mixed file, apply only the manifest-recorded hunks and verify their archived content.
Before committing a slice, compute its import and build dependency closure.
Every imported new module, package entry, build input, and test harness must exist in the
same branch or a lower branch. Put the minimum byte-for-byte archived baseline in the
lowest first consumer, even when a later plan owns its behavioral remediation.
For example, the plan 007 baseline must include the archived binding, member, and
provenance modules that `path-state.ts` imports. Plan 008 still owns their new fixes.
Record these dependency-only baseline paths separately in the manifest and PR body.
Run typecheck and build on every reconstructed branch before opening its pull request.
If the dependency closure destroys a focused boundary, STOP and propose an adjacent
boundary merge instead of opening a broken pull request.
Record each reconstruction commit in the manifest.
Assign the tracking documents and `docs/pr-51-stack.json` to plan 014.
Apply the truth-restoration patch from steps 2–4 to that branch after its archived slice.
The plan 014 pull request must therefore carry the honest ledger into protected `main`.
Later plans can update only their own evidence rows.
Split mixed commits and mixed files; do not blindly replay old checkpoint commits.
Keep each intermediate branch buildable and testable.
Before plan 007 starts, all nine branches and nonempty draft pull requests must exist.
Each plan preflight must stop if its branch topology or owned diff does not match
the manifest. It must compare the live remote head with the PR body and GitHub check
runs, not with a self-referential manifest field.

After all branch reconstruction commits exist, adopt the exact chain with:

```bash
gh stack init --base main \
  pr51-remediation/007-path-state \
  pr51-remediation/008-bindings-scopes \
  pr51-remediation/009-stateful-rule-lifecycles \
  pr51-remediation/010-fluent-sdk-registry \
  pr51-remediation/011-now-id-directives \
  pr51-remediation/012-context-profiles-contracts \
  pr51-remediation/013-public-api-assets \
  pr51-remediation/014-tests-evidence-compat \
  pr51-remediation/015-release-governance
gh stack submit --auto --remote origin
gh stack view --json
```

`gh stack submit --auto` creates draft pull requests by default.
Do not pass `--open` in this plan.
Open a draft pull request only when its branch has a real, nonempty focused diff.
Do not create empty placeholder pull requests.
Each pull request body must include:

- plan file and acceptance-ledger row IDs
- base branch, base full SHA, head branch, and head full SHA
- parent pull request URL and all required predecessors
- in-scope and excluded paths
- exact current-head commands, run URLs, and results
- rollback boundary
- `git diff --name-status <base>...<head>` evidence
- a statement that evidence becomes stale after any rebase or head change

If GitHub access is unavailable, push the branches and record exact `gh pr create`
commands. Leave issue #75 open and STOP. Branches alone do not satisfy issue #75.

**Verify**: read PR numbers from `gh stack view --json`, then run for each:

```bash
gh pr view PR_NUMBER --json isDraft,baseRefName,headRefName,headRefOid,state,url
```

Expected: nine open draft pull requests with the exact serial bases.
Each live head equals the full SHA in that PR body and its current check run.

### Step 6: Make PR #51 tracking-only

After the archive and real draft pull requests exist, create a temporary tracking
branch from the current protected `origin/main`. Apply the same truth-restoration
content assigned to plan 014, but keep the histories separate. Commit only
`PR51-REMEDIATION-GOAL.md` and `docs/pr-51-*.md` tracking files.
Do not replay implementation fixes there.

Fetch the PR head again and require it still equals the archived expected commit.
With explicit maintainer approval, update the existing PR head branch once:

```bash
git push \
  --force-with-lease=refs/heads/mlammesen/phase1-trustworthy-context-c08e:b87972a8336d6cf6209801395cad82f72b827436 \
  origin TRACKING_COMMIT:refs/heads/mlammesen/phase1-trustworthy-context-c08e
```

Replace `TRACKING_COMMIT` with the reviewed full commit.
If the branch name or expected head changed, STOP and regenerate the approved command.
Update the PR title and body. Convert it to draft.

The body must:

- start with `TRACKING — DO NOT MERGE`
- link the archive branch and plans 007–015 pull requests
- show each base/head full SHA and status
- remove the stale closure and validation claims
- state that child pull requests merge bottom-up
- state that PR #51 never merges as a roll-up
- keep #58, #75, and #76 open
- separate merge readiness from release readiness
- identify the exact current tracking head after the truth commit

The archive branch preserves the replaced implementation history.
After the one approved force-with-lease, freeze the tracking head.
Make future status changes in the PR body and child pull requests, not with implementation commits.

**Verify**:

```bash
gh pr view 51 --json isDraft,title,headRefOid,body,state
```

Expected: `isDraft` is `true`; the title and body say `TRACKING — DO NOT MERGE`;
all nine pull requests are linked; no old pass count or old validation SHA remains.
Also run `git diff --name-only origin/main...TRACKING_COMMIT`.
Expected: only the approved goal and `docs/pr-51-*` tracking files appear; no
implementation, test, workflow, helper, package, or release metadata path appears.

### Step 7: Validate the documentation-only changes

Run all repository checks available in `package.json` at the protected-main base from a clean checkout of the truth commit. That package does not define a `validate` script, so run its typecheck, build, test, and documentation gates explicitly.
Record the full commit and environment in the historical report.
Do not promote any remediation row based only on these documentation checks.

**Verify**:

```bash
npm ci
npm run typecheck
npm run build
npm test
npm run docs:check
git diff --check
test -z "$(git status --porcelain)"
```

Expected: every command exits 0 and the checkout remains clean.

## Test plan

This plan changes process evidence, not rule behavior.
Add executable checks to the documented manifest procedure for these cases:

- every archived changed path has exactly one owner
- duplicate ownership fails
- a missing path fails
- plan 015 owns every privileged release path
- plans 007–014 own no privileged release path
- each pull request base equals its predecessor branch
- each PR body's recorded head equals the current remote head and check run
- a ledger proof commit must be reachable from its recorded pull request head
- historical evidence from another SHA cannot produce `Verified-at-head`

Use `tests/release/layer7.test.ts` only as a style reference for Node assertions.
Do not modify tests in this process-only plan.

## Done criteria

All criteria must hold:

- [x] Remote branch `archive/pr51-b87972a` resolves to full commit `b87972a8336d6cf6209801395cad82f72b827436`.
- [x] `docs/pr-51-stack.json` owns every archived file or split hunk exactly once.
- [x] Ledger rows listed in step 3 are `Pending` and omitted issue criteria have atomic rows.
- [x] The four tracking documents use the same non-circular status meanings.
- [x] Nine real draft pull requests exist with the exact serial bases.
- [x] Plan 015 is the only pull request with privileged release automation.
- [x] PR #51 is draft; its three-dot diff contains only approved tracking documents; it is explicitly never merged.
- [x] Issue #75 is open until the complete real stack satisfies its acceptance criteria.
- [x] Issues #58 and #76 remain open and live evidence remains pending.
- [x] `npm run typecheck`, `npm run build`, `npm test`, `npm run docs:check`, and `git diff --check` exit 0 at the exact tracking truth commit.
- [x] No files outside the in-scope list changed in the truth-restoration commit.

## STOP conditions

Stop and report if:

- The reviewed head is not `b87972a8336d6cf6209801395cad82f72b827436` before the archive exists.
- The archive branch does not exist remotely at the exact commit.
- The one PR #51 force-with-lease lacks explicit approval, a remote archive, the exact expected old SHA, or write access to the head repository.
- A changed path or mixed hunk has no agreed owner.
- A reconstructed branch cannot typecheck/build with a focused dependency closure.
- A pull request mixes privileged release work with analysis, rule, test, or compatibility work.
- GitHub cannot create the separate pull requests. Record commands, keep #75 open, and stop.
- A ledger row lacks direct current-head proof or a current review contradicts it.
- A policy requires stable publication before implementation can merge.
- Anyone proposes a release tag or npm publication from a pull request branch.
- A validation command fails twice after one reasonable documentation correction.

## Maintenance notes

Treat `docs/pr-51-stack.json` as static evidence, not as a substitute for GitHub state.
Never add mutable head, pull request, status, or check-run data to the manifest.
After every rebase, update the pull request body and rerun current-head checks.
Review each three-dot diff after a parent merge and before retargeting the child.
Keep PR #51 frozen as an audit trail.
Close it without merging only after plan 016 records the stable release and closes #58/#76.
