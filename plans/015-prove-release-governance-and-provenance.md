# Plan 015: Prove release governance and exact provenance

> **Executor instructions**: Follow this plan step by step. Run each
> verification command and confirm the expected result. Stop if a STOP
> condition occurs. Do not update `plans/README.md`; the coordinating reviewer
> maintains the index.
>
> **Drift check (run first)**:
> `git diff --stat b87972a..HEAD -- .github/workflows/release.yml package.json package-lock.json CHANGELOG.md scripts/check-trusted-publishing-npm.mjs scripts/check-trusted-publishing-npm.d.mts scripts/publish-release-package.mjs scripts/publish-release-package.d.mts scripts/verify-published-package.mjs scripts/verify-published-package.d.mts scripts/create-github-release.mjs scripts/create-github-release.d.mts scripts/release-governance.json tests/release docs/release.md docs/release-governance-live.json docs/pr-51-acceptance-ledger.md docs/pr-51-validation-report.md docs/pr-51-stack.json`
> If an in-scope file changed, compare the excerpts below with the current file.
> Treat a mismatch as a STOP condition.

## Status

- **Status**: IN PROGRESS — implemented in PR #85; merge pending.
- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: `plans/006-freeze-and-restack-pr51.md`, `plans/007-rebuild-path-state-semantics.md`, `plans/008-fix-bindings-scopes-and-closures.md`, `plans/009-rebuild-stateful-rule-lifecycles.md`, `plans/010-authoritative-fluent-sdk-registry.md`, `plans/011-fix-now-id-and-fluent-directives.md`, `plans/012-fix-context-profiles-and-rule-contracts.md`, `plans/013-narrow-public-api-and-fix-user-assets.md`, `plans/014-make-tests-evidence-and-compatibility-honest.md`
- **Category**: security, migration, tests
- **Planned at**: commit `b87972a`, 2026-08-20

## Why this matters

The release workflow has good job isolation, but its live governance can deadlock.
Any writer can also reserve an immutable release tag at the wrong commit.
Registry verification accepts attestation presence without proving its signature or identity.
Fix these controls in an isolated release pull request, then prove them with a real prerelease.

## Current state

The current workflow triggers for every `v*` tag and gates only the publish job:

```yaml
.github/workflows/release.yml:6-8
on:
  push:
    tags: ["v*"]

.github/workflows/release.yml:105-110
publish:
  needs: [validate, consumer]
  runs-on: ubuntu-latest
  environment: release
  permissions:
    id-token: write
```

The captured environment cannot approve a tag created by its only reviewer:

```json
docs/release-governance-live.json:60-65
"releaseEnvironment": {
  "name": "release",
  "canAdminsBypass": false,
  "requiredReviewer": "martinthommesen",
  "preventSelfReview": true,
  "protectedBranches": true
}
```

The current tag ruleset prevents deletion and movement but not creation:

```json
docs/release-governance-live.json:42-58
"tagRuleset": {
  "conditions": { "ref_name": { "include": ["refs/tags/v**"] } },
  "rules": ["deletion", "non_fast_forward"],
  "currentUserCanBypass": "never"
}
```

A writer can create `v2.0.0` at the wrong commit. The immutable rules then prevent recovery.
Use two rulesets. Keep a no-bypass immutability ruleset for deletion and updates.
Add a creation-only ruleset whose sole bypass actor is the controlled tag actor.
This prevents the creation bypass from also bypassing immutability.

The desired governance declaration is too weak:

```json
scripts/release-governance.json:15-21
"protectedTags": ["v*"],
"environment": {
  "name": "release",
  "requiredReviewers": true
}
```

The registry verifier accepts only the presence of an attestation-shaped value:

```js
scripts/verify-published-package.mjs:11-15
export function hasProvenanceAttestation(view) {
  const attestations = view?.dist?.attestations;
  if (!attestations || typeof attestations !== "object") return false;
  if (typeof attestations.url === "string" && /^https:\/\//.test(attestations.url)) return true;
  return Boolean(attestations.provenance && typeof attestations.provenance === "object");
}
```

This check does not verify Sigstore, the package digest, the repository, the workflow,
the environment, the tag ref, or `GITHUB_SHA`.

The GitHub release helper can create a missing tag at the wrong commit:

```js
scripts/create-github-release.mjs:131-141
if (action === "create") {
  gh([
    "release",
    "create",
    tag,
    tarball,
    "--title",
    `v${version}`,
    "--notes",
    `Published oxc-plugin-servicenow ${version} from the inspected tarball.`,
  ], { inherit: true });
}
```

It does not use `--verify-tag` and does not compare the remote tag commit with `GITHUB_SHA`.

The publish step also treats every npm failure as potentially ambiguous:

```yaml
.github/workflows/release.yml:132-142
- id: publish
  continue-on-error: true
  run: npm publish "./${{ needs.validate.outputs.tarball }}" --ignore-scripts --provenance --access public

registry-verify:
  if: ${{ always() && needs.validate.result == 'success' && needs.consumer.result == 'success' && needs.publish.result != 'cancelled' }}
```

A permanent authentication or configuration failure must not become registry-lag polling.

The tested npm checker and the privileged workflow contain separate implementations:

```js
scripts/check-trusted-publishing-npm.mjs:4-20
export const TRUSTED_PUBLISHING_NPM_VERSION = "11.5.1";
...
export function assertTrustedPublishingNpm(output, expected = TRUSTED_PUBLISHING_NPM_VERSION) {
```

```yaml
.github/workflows/release.yml:120-131
- name: Verify executable npm for trusted publishing
  ...
  run: |
    actual="$(npm --version)"
    node --input-type=module -e ' ... duplicate parser and comparison ... '
```

Finally, retry handling is inconsistent:

```js
scripts/verify-published-package.mjs:69-74
if (!isTransientRegistryError(error)) throw error;
...

scripts/verify-published-package.mjs:97-107
try {
  ...
} catch (error) {
  lastError = error;
  ... // every error is retried
}
```

Authentication, malformed JSON, wrong identity, and integrity mismatches must fail immediately.
Only publication lag and transient transport failures can retry.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Install | `npm ci` | exit 0 |
| Release tests | `node scripts/run-tests.mjs tests/release` | all release tests pass |
| Workflow pins | `npm run workflow:check` | exit 0 |
| Matrix contract | `npm run compat:check` | exit 0 |
| Full validation | `npm run validate` | exit 0 |
| Desired/live governance | `npm run release:governance -- --live` | exit 0 and secret-free JSON summary with no drift |
| Diff hygiene | `git diff --check` | exit 0 |

Use the plan 014 matrix command:
`node scripts/check-compat-matrix.mjs --github-matrix`.
It must emit exactly one compact object such as
`{"include":[{"cell":"min-hosts","node":"20.19.0"}]}` with no banner.
Each row contains only `cell` and `node` and comes from `scripts/compat-matrix.json`.
Do not copy its cells into `release.yml`. If this contract is absent, STOP.

## Suggested executor toolkit

Use the `gh-stack` skill and only non-interactive commands such as
`gh stack view --json` and `gh stack sync --remote origin`.

Read these references before implementing the cryptographic verifier:

- npm provenance and trusted-publishing documentation
- Sigstore JavaScript verification API documentation
- GitHub environment deployment branch and tag policy documentation
- GitHub repository rulesets REST API documentation

Use the maintained Sigstore JavaScript library. Do not implement Fulcio, Rekor,
certificate-chain, or DSSE verification yourself.

## Scope

**In scope**:

- `.github/workflows/release.yml`
- `package.json` and `package-lock.json`
- `CHANGELOG.md` only for the prerelease version and release notes
- `scripts/check-trusted-publishing-npm.mjs` and `.d.mts`
- `scripts/publish-release-package.mjs` and `.d.mts` (create)
- `scripts/verify-published-package.mjs` and `.d.mts`
- `scripts/create-github-release.mjs` and `.d.mts`
- `scripts/check-release-governance.mjs` and `.d.mts` (create)
- `scripts/release-governance.json`
- `tests/release/**` and deterministic non-secret release fixtures
- `docs/release.md`
- `docs/release-governance-live.json`
- `docs/pr-51-acceptance-ledger.md`
- `docs/pr-51-validation-report.md`
- Live GitHub environment and tag-ruleset configuration
- Live npm trusted-publisher inspection
- One unique public `2.0.0-rc.N` proof on npm dist-tag `next`

**Out of scope**:

- `src/**`, rule tests, generated rule pages, analysis documentation, and examples
- CI analysis, compatibility, or benchmark implementation owned by plan 014
- Any stable `v2.0.0` tag, stable npm publication, or stable GitHub release
- Any `NPM_TOKEN` or other long-lived publication credential
- Closure of issues #58 or #76
- Plans 001–014 and `plans/README.md`
- `docs/pr-51-stack.json`; read its static topology, ownership, reconstruction,
  and rollback data, but store live and final pull request evidence elsewhere

The stack-managed plan 015 pull request contains only privileged release automation,
release tests, and governance. The release-candidate metadata and post-run evidence
use separate follow-up pull requests. Do not repair analysis in any of them.

## Git workflow

Use the existing branch `pr51-remediation/015-release-governance` that plan 006 reconstructed.
Its initial base is `pr51-remediation/014-tests-evidence-compat`.
Read `docs/pr-51-stack.json` and run `gh stack view --json` before editing.
Stop if its remote topology or owned diff differs from the manifest.
Compare the live remote head with the full SHA in the PR body and current check run.
Do not expect a mutable head SHA in the manifest.
Do not create a second branch or pull request.
After plan 014 merges, use the authorized stack sync to move plan 015 onto protected `main`.
Then rerun all current-head evidence.

The pull request body must show its exact base and head commits.
It must also show `git diff --name-only <base>...<head>`.
Reject the pull request if that diff contains `src/**` or rule implementation.
Use conventional commits such as `release: verify exact provenance identity`.
Do not tag until this isolated pull request merges to protected `main`.

## Steps

### Step 1: Establish red release and governance tests

Extend `tests/release/artifact.test.ts` and `tests/release/layer7.test.ts`.
Add focused tests for the new governance checker, tag resolver, provenance verifier,
retry classification, prerelease dist-tag selection, and exact workflow boundaries.

The initial tests must fail for the current reasons:

- the environment policy does not select tag type `v*`
- one reviewer can also be the deployment initiator
- release-tag creation is unrestricted
- the captured main ruleset treats CodeQL as informational although the governance evidence presents it as a required merge gate
- attestation presence passes without cryptographic or identity proof
- a missing tag can be created by `gh release create`
- the workflow duplicates the npm version parser
- `waitForView` retries a permanent error
- a prerelease can publish without explicit `next`

Use fake `gh`, npm, HTTP, clock, and Sigstore boundaries.
Do not use text presence as the only workflow test.

**Verify**: `node scripts/run-tests.mjs tests/release`

Expected before implementation: the new tests fail for the listed reasons.
Expected after later steps: all release tests pass.

### Step 2: Make desired governance exact and executable

Expand `scripts/release-governance.json` with this information:

- repository owner/name and workflow path
- environment name `release`
- selected deployment policy with no branches and tag type/pattern `v*`
- `preventSelfReview: true` and `canAdminsBypass: false`
- one or more independent reviewer stable IDs
- a controlled tag-creation actor stable ID and actor type
- a no-bypass tag immutability ruleset for `deletion` and `non_fast_forward`
- a separate tag creation ruleset for `creation`
- only the controlled actor bypass on the creation ruleset
- exact npm publisher repository, workflow filename, environment, and tag-ref policy
- the protected `main` ruleset's required status checks, including an explicit decision for CodeQL: require its stable check name or label CodeQL informational in every governance document

Create `scripts/check-release-governance.mjs` with injectable command and HTTP boundaries.
Add the matching `.d.mts` declarations.
Add package script `release:governance`.
The checker must compare desired and live values, not only test for their presence.
Its output must omit access tokens, request headers, cookies, and environment contents.

Fail on extra reviewers, extra bypass actors, branch deployment policies, missing
creation rules, bypass on the immutability ruleset, or publisher identity drift.

**Verify**:

```bash
node scripts/run-tests.mjs tests/release
node scripts/check-release-governance.mjs --fixture tests/fixtures/release-governance/valid.json
```

Expected: all tests pass; the valid fixture emits `ok: true`.
Each one-field negative fixture must exit nonzero.

### Step 3: Remove the reviewer deadlock and restrict tag deployments

Before changing live controls, identify these three principals:

1. a controlled GitHub App or release actor that creates tags
2. an independent human or team that approves the `release` environment
3. an administrator who can recover a bad governance update

The tag actor and every eligible approver must be distinct principals.
Do not store private keys, tokens, webhook secrets, or credentials in the repository.
Record only public login/name, stable numeric ID, and actor type.

Create a reviewed tag-creation runbook for that principal.
Prefer a dedicated GitHub App installation with only the repository permission
needed to create Git refs. Mint its installation credential outside the repository
for one approved operation. Never store its private key or token in the repository.
The runbook must:

1. authenticate and verify the actor login and stable ID
2. accept an approved full commit SHA and exact SemVer tag
3. re-read protected `main`, version, changelog, and tag absence
4. submit one `POST /repos/{owner}/{repo}/git/refs` request as the controlled actor
5. resolve the created tag back to the exact commit
6. capture GitHub audit evidence without credentials
7. abort that version permanently if the immutable tag targets the wrong commit

Do not give a maintainer the actor bypass as a shortcut.
If the controlled principal cannot execute this runbook, STOP before changing rulesets.

Update the `release` environment to use selected deployment policies.
Allow only tags of type `tag` matching `v*`.
Allow no branch deployment policy.
Keep self-review prevention enabled and administrator bypass disabled.
Configure the independent reviewer or team.

Apply and verify this environment policy before changing tag rulesets.
Use reviewed JSON request files and `gh api --input`; do not build mutation JSON in a shell string.

**Verify**: `npm run release:governance -- --live`

Expected: environment identity, reviewers, self-review, administrator bypass, and
tag-only deployment policy exactly match `scripts/release-governance.json`.

### Step 4: Restrict release-tag creation without weakening immutability

Keep or replace the existing `refs/tags/v**` immutability ruleset.
It must contain `deletion` and `non_fast_forward` and no bypass actors.

Create a second active ruleset over the same release-tag pattern.
It must contain only the `creation` restriction.
Give only the controlled tag actor an `always` bypass on this creation ruleset.
Do not give the actor a bypass on the immutability ruleset.
Apply both parts as one reviewed maintenance window.

Do not create a disposable `v*` tag. It would be intentionally undeletable.
A non-`v*` tag would not prove these rules.
Use API comparison and deterministic fixtures before merge.
Use the approved real release-candidate tag in step 11 as the first live creation test.
After that creation, API checks must prove that normal writers cannot create release
tags and no principal can move or delete the candidate tag.

**Verify**: `npm run release:governance -- --live`

Expected before the candidate: two active release-tag rulesets match the declaration;
only the creation ruleset has the exact actor bypass; the immutability ruleset has no bypass.
Expected after the candidate: the audit record shows the controlled actor created it,
and the immutable ref still resolves to the approved commit.

### Step 5: Reuse the trusted npm checker in the artifact-only job

Remove the inline JavaScript parser from `.github/workflows/release.yml`.
During `validate`, create an inspected `release-publish-input` artifact that contains only:

- the exact consumer-tested `.tgz`
- `scripts/check-trusted-publishing-npm.mjs`
- `scripts/publish-release-package.mjs`
- a manifest with all filenames and SHA-256 digests

Reject extra files and digest mismatches before upload.
The publish job must have no checkout and no install.
It downloads only `release-publish-input`, verifies the manifest, and runs the
single checker through the reviewed publish helper before `npm publish`.

Keep `TRUSTED_PUBLISHING_NPM_VERSION` authoritative in the helper.
Do not repeat `11.5.1`, its parser, or its error logic in workflow YAML.
Update workflow tests to execute the actual helper artifact with a fake npm binary.

Also replace the hard-coded release consumer cells with:

```bash
node scripts/check-compat-matrix.mjs --github-matrix
```

Write its single-line stdout to a checked-out read-only job output named `compat_matrix`.
Use `strategy.matrix: ${{ fromJSON(needs.validate.outputs.compat_matrix) }}` in `consumer`.
The emitted objects must include only `cell` and `node`.
Host/parser versions remain inside the selected cell and `compat-consumer` asserts them.

**Verify**:

```bash
node scripts/run-tests.mjs tests/release
npm run workflow:check
npm run compat:check
```

Expected: all commands exit 0; tests prove the publish job has no checkout/install,
executes the one helper, and consumes the generated matrix.

### Step 6: Require the existing tag and exact commit for GitHub releases

Add required argument `--expected-commit` to `scripts/create-github-release.mjs`.
Require a 40-character hexadecimal commit.
Resolve the remote tag with the GitHub API before every create, upload, or reuse.
Recursively dereference annotated tag objects with a cycle and depth guard.
Require the final object type to be `commit` and its commit to equal the expected value.

Add `--verify-tag` to `gh release create`.
Do not use `--target` as a substitute because that flag can create a missing tag.
Pass `--expected-commit "$GITHUB_SHA"` from the workflow.
Mark prerelease versions with `--prerelease` and stable versions without it.

Add tests for lightweight and annotated tags, missing tags, wrong targets,
malformed targets, cycles, excessive depth, existing releases, and concurrent retries.
Assert no release create or upload command runs before commit verification.

**Verify**: `node scripts/run-tests.mjs tests/release`

Expected: all cases pass; the fake command log includes `--verify-tag` and the
expected commit check before any write.

### Step 7: Verify Sigstore and exact npm provenance identity

Add the official maintained Sigstore JavaScript package as an exact dev dependency.
Document the selection and its Node engine support in the pull request.
Do not import npm's private transitive modules.

Replace `hasProvenanceAttestation` with an asynchronous exact verifier.
Fetch only the canonical npm attestation endpoint returned for the exact package/version.
Reject redirects to another origin or package/version.
Use the Sigstore library to verify the bundle signature, certificate chain,
transparency material, and DSSE payload.

Decode and validate exactly one SLSA provenance statement. Require:

- in-toto Statement v1
- predicate type `https://slsa.dev/provenance/v1`
- subject `pkg:npm/oxc-plugin-servicenow@VERSION`
- subject SHA-512 equal to the inspected tarball digest
- build type `https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1`
- repository `https://github.com/martinthommesen/oxc-plugin-servicenow`
- workflow path `.github/workflows/release.yml`
- ref `refs/tags/vVERSION`
- resolved Git commit equal to the expected 40-character commit
- Fulcio issuer `https://token.actions.githubusercontent.com`
- certificate workflow identity for the same repository, workflow, and tag ref
- environment-bound OIDC subject for `release`

Pass expected repository, workflow, environment, ref, version, package name,
tarball integrity, and commit as explicit workflow arguments.
Never infer expected identity from the downloaded statement.
Return a structured summary with the verified fields and bundle digest.
Do not return raw certificates, tokens, or all workflow environment variables.

Run cryptographic tests with deterministic signed fixtures and a test trust root.
Add one negative mutation for each required identity field and for the signature.
If standard npm provenance does not expose a required environment-bound claim,
STOP. Do not silently replace exact proof with attestation presence.

**Verify**: `node scripts/run-tests.mjs tests/release`

Expected: the valid deterministic bundle passes; every signature, subject,
digest, repository, workflow, environment, ref, and commit mutation fails.

### Step 8: Make publication and registry retries bounded and typed

Create `scripts/publish-release-package.mjs` with injectable npm execution.
Add a read-only `publication-state` job before the OIDC job.
It checks whether the exact version is absent or already exists.
If absent, the protected publish job runs the helper.
If present on a rerun, skip `npm publish` and send the immutable artifact to exact registry verification.
A pre-existing version is never accepted before integrity and provenance verification.

Remove broad `continue-on-error` behavior from the publish step.
The helper must parse npm's structured result where available.
Return `published` for success and `ambiguous` only for typed transport failures.
Fail the job immediately for authentication, authorization, configuration,
provenance generation, version policy, malformed output, or other permanent errors.
Export a small `verify_registry` job output.
Run `registry-verify` only for `published`, `ambiguous`, or `verify-existing`.
A race that reports an existing version can proceed only to exact no-OIDC verification.
Never label a permanent publish failure as registry lag.

Use one `retryBounded` primitive for metadata, attestations, install, and import visibility.
Accept an explicit `shouldRetry` predicate.
Use exponential backoff, a hard deadline, and an attempt limit.
Respect `Retry-After` when the registry supplies it.
Use an injectable clock and sleep function in tests.

Retry only these cases:

- DNS, connection reset, connection timeout, or temporary transport failure
- HTTP 404 during known publication lag
- HTTP 429
- HTTP 502, 503, or 504
- metadata or the attestation endpoint is not yet complete
- a registry install cannot yet find the newly published exact version

Fail on the first attempt for:

- HTTP 401 or 403 authentication/configuration errors
- malformed JSON or an unexpected response schema
- wrong version or package name
- integrity or subject-digest mismatch
- Sigstore, repository, workflow, environment, ref, or commit mismatch
- export, declaration, or import content mismatch after installation

Create a fresh consumer directory for each install attempt.
Preserve the final typed error and attempt count in the summary.
Do not classify arbitrary output with a broad `404` message regex when status or exit codes exist.

**Verify**: `node scripts/run-tests.mjs tests/release`

Expected: fake-clock transient cases recover within bounds; each permanent case
fails after one attempt; timeout tests perform no sleep beyond the deadline.

### Step 9: Add safe prerelease policy

Derive release type from the exact package version.
Publish stable versions with npm dist-tag `latest`.
Publish prerelease versions only with npm dist-tag `next`.
Pass the tag explicitly to `npm publish` in both cases.
Create a GitHub prerelease for prerelease versions.
Do not let a prerelease move `latest`.

Update `docs/release.md` with:

- controlled tag actor and independent approval roles
- tag-only environment policy
- the two-ruleset creation and immutability model
- exact attestation identity fields
- immediate versus retryable failures
- prerelease `next` and stable `latest` behavior
- safe rerun behavior for an existing exact version and release asset

Keep merge readiness in-repository.
Keep stable release readiness live and post-merge.

**Verify**:

```bash
node scripts/run-tests.mjs tests/release
npm run docs:check
```

Expected: tests cover stable and prerelease command arguments; documentation checks exit 0.

### Step 10: Validate the isolated automation before release prep

Run all checks at the exact automation-only plan 015 head in a clean checkout.
Record local results and hosted pull request run URLs against that full head.
Require all plan 014 generated compatibility cells.
Reject any skipped required job.
Do not add prerelease metadata to this head. Step 11 uses a separate pull request.

**Verify**:

```bash
npm ci
npm run workflow:check
npm run compat:check
node scripts/run-tests.mjs tests/release
npm run validate
git diff --check
test -z "$(git status --porcelain)"
```

Expected: every command exits 0; the worktree stays clean.

Review the three-dot diff again. It must contain no `src/**`, release-candidate
version change, changelog release heading change, or rule implementation.
Merge this automation-only pull request through the protected stack after approval.
Record its merge commit in the plan 015 pull request body, the PR #51 tracking body, and the later evidence document. Do not add it to `docs/pr-51-stack.json`.

### Step 11: Publish and rerun one real prerelease proof

This step is irreversible. Obtain explicit maintainer approval first.
Select an unused version `2.0.0-rc.N`.
If the chosen version or tag exists, STOP and select a new reviewed value.
Do not delete or move an existing release tag.

Before merging, query every plan 007–015 pull request. Require each pull request to be non-draft, independently approved at its current full head, and green for every required check. Require the live head and check-run SHA to match its PR-body evidence. Then merge the complete reviewed stack with the repository's existing merge-commit policy:

```bash
PLAN_015_PR=$(gh pr view pr51-remediation/015-release-governance --json number --jq .number)
gh stack view --json
gh stack merge "$PLAN_015_PR" --yes --merge
```

Do not use `gh pr merge` for a stack-managed pull request. If branch protection places the stack in a merge queue, wait for every layer and verify bottom-to-top order. Stop if any layer is skipped, rebased without renewed evidence, or fails to merge. Record each final merge commit in the corresponding PR body and PR #51 tracking body.

After the automation-only stack merges, create separate branch
`pr51-remediation/015-rc-proof-N` from current protected `main`.
Open a metadata-only pull request:

1. Run `npm version 2.0.0-rc.N --no-git-tag-version`.
2. Change the changelog heading to exact `## 2.0.0-rc.N — 2026-08-20`.
3. Confirm the diff contains only `package.json`, `package-lock.json`, and `CHANGELOG.md`.
4. Repeat all step 10 commands and hosted checks at the metadata head.

Review and merge this metadata pull request only through protected `main`.
After it merges, record `RC_SHA` and require current `origin/main` to equal it.
Confirm `RC_SHA` contains every plans 007–015 implementation merge.
Capture the full pre-release npm dist-tag object as `DIST_TAGS_BEFORE`.
Run the live governance checker again.
The controlled actor creates protected tag `v2.0.0-rc.N` at `RC_SHA`.
The distinct reviewer approves the `release` environment.

Require this job order and result:

1. validation and every generated real-Node consumer cell pass
2. the artifact-only OIDC job publishes the exact tarball to `next`
3. the no-OIDC verifier proves integrity, imports, Sigstore, and exact identity
4. the GitHub release job proves the existing tag commit and creates a prerelease

Then rerun the same immutable tag workflow once.
Approve the environment again if GitHub requires it.
The rerun must accept only the existing version with identical registry identity and bytes.
It must also reuse the matching GitHub asset without overwrite.

After the rerun passes, create branch `pr51-remediation/015-rc-evidence`
from current protected `main`. Open an evidence-only pull request.
Update only the in-scope tracking, validation, ledger, stack, and live-governance documents.
`RC_SHA` remains the immutable tag target and becomes an ancestor of the later
evidence commit; do not rewrite it to the evidence commit.

Record these non-secret values in that evidence pull request:

- workflow run and attempt URLs
- full `RC_SHA`, tag, and version
- controlled actor and independent approval identities
- artifact filename, SHA-256, and npm integrity
- npm dist-tag and registry package URL
- verified provenance identity summary and bundle digest
- GitHub prerelease URL, resolved tag commit, and asset digest

Merge the evidence-only pull request through protected `main` after review.
Record its commit separately as `RC_EVIDENCE_SHA`.
Leave the prerelease immutable as evidence.
Do not tag or publish `v2.0.0`.
Keep issues #58 and #76 open because their stable-release criteria remain live-pending.

**Verify**:

```bash
npm view oxc-plugin-servicenow@2.0.0-rc.N version dist.integrity dist.attestations --json
npm view oxc-plugin-servicenow dist-tags --json
gh release view v2.0.0-rc.N --json url,tagName,isPrerelease,targetCommitish,assets
```

Expected: the exact version exists; `next` points to it; the post-run `latest`
value equals `DIST_TAGS_BEFORE.latest`; the release is a prerelease; the verified
remote tag resolves to `RC_SHA`.
The workflow verifier must report every exact identity field as matched.

## Test plan

Add or extend release tests for these cases:

- desired governance matches exactly and each one-field drift fails
- tag deployment policy permits `v*` tags and no branches
- tag actor and approver are distinct
- creation and immutability rulesets have different bypass policies
- lightweight and annotated tag resolution reaches the exact expected commit
- missing and wrong tags prevent all GitHub release writes
- `gh release create` always uses `--verify-tag`
- the publish job runs the single npm checker from inspected input
- release workflow matrix equals the plan 014 emitted matrix, including Node values
- cryptographic provenance validates the exact subject and workflow identity
- each signature or identity mutation fails
- permanent publish failures stop before registry polling
- an absent version publishes; an existing version skips publish and verifies exact bytes
- typed ambiguous transport failures proceed only to exact registry verification
- transient registry lag retries and permanent errors fail immediately
- each install retry uses a new directory
- prerelease uses `next` and `--prerelease`; stable uses `latest`
- an identical existing registry version and GitHub asset are reusable
- any byte, integrity, identity, tag, commit, or asset mismatch fails closed

Model test structure on `tests/release/layer7.test.ts`.
Keep live APIs out of unit tests.
The real prerelease run is a separate required test and cannot be replaced by mocks.

## Done criteria

All criteria must hold:

- [ ] The stack-managed plan 015 pull request is automation-only, final in the implementation stack, and contains no `src/**` or RC metadata change.
- [ ] A separate metadata-only pull request stages the candidate.
- [ ] A separate evidence-only pull request records the immutable live results.
- [ ] `release` permits only selected `v*` tag deployments.
- [ ] The tag actor and environment approver are distinct.
- [ ] A creation ruleset restricts new `v*` tags to the controlled actor.
- [ ] A no-bypass immutability ruleset prevents release-tag deletion or movement.
- [ ] `npm run release:governance -- --live` reports no drift.
- [ ] The protected `main` ruleset and governance documents agree whether CodeQL is required or informational.
- [ ] The publish job has no checkout/install and executes the single trusted npm checker.
- [ ] `release.yml` consumes plan 014's generated `cell` and `node` matrix.
- [ ] GitHub release creation requires `--verify-tag` and the exact expected commit.
- [ ] Sigstore, subject digest, repository, workflow, environment, ref, and commit are verified.
- [ ] Permanent publish failures stop; only typed ambiguity or exact existing versions reach registry verification.
- [ ] Retryable and permanent registry failures have executable tests and distinct behavior.
- [ ] A unique `2.0.0-rc.N` published through OIDC to `next` from protected `main`.
- [ ] The same tag rerun reused identical registry and GitHub assets safely.
- [ ] `latest` did not move and no stable `v2.0.0` tag exists.
- [ ] `npm run validate`, focused release tests, and governance checks pass at the exact recorded head.
- [ ] #58 and #76 remain open and their stable live rows remain `Live-pending`.

## STOP conditions

Stop and report if:

- Any plans 006–014 pull request is not merged or its current-head proof is stale.
- The plan 015 diff contains analysis, rules, or unrelated compatibility implementation.
- No controlled tag actor, independent reviewer, or recovery administrator exists.
- The tag initiator can be the only eligible reviewer.
- The environment permits branch deployments or does not explicitly permit `v*` tags.
- Tag creation remains open to writers or the creation actor can bypass immutability.
- npm trust does not match the exact repository, workflow filename, environment, and tag policy.
- Standard npm provenance does not expose enough signed identity to prove the required fields.
- A dependency would require hand-written cryptographic verification.
- A permanent error is retried or a transient retry has no hard bound.
- The prerelease version or tag already exists unexpectedly.
- Any tag resolves to the wrong commit; never move or delete it to recover.
- Registry bytes, integrity, signature, identity, imports, or GitHub asset differ.
- `latest` would move to a prerelease.
- A stable tag, publication, release, or closure of #58/#76 is proposed in this plan.
- A check fails twice after one reasonable release-only correction.

## Maintenance notes

Review changes to the Sigstore dependency and trust root as security-sensitive updates.
Do not auto-merge them.
Keep the tag creation and immutability rulesets separate.
A new workflow path, environment, repository transfer, or package rename changes the expected provenance identity.
Treat that change as a new governance migration with a new live prerelease proof.
Never copy old run URLs, digests, or attestations after a rebase or release input change.
Plan 016 can reuse this prerelease only if no package-affecting code, workflow, or governance change lands afterward.
