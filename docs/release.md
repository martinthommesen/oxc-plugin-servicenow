# Release process

This document defines the release process for `2.0.0` and later. npm published the stable `2.0.0` package on 2026-08-27. New work remains under `Unreleased` until its release is ready.

## Merge readiness and release readiness

Merge readiness uses repository-local checks:

```bash
npm run validate
```

This command does not publish, create a tag, or prove live governance. It cleans and inspects a package artifact, runs the packed consumer, and checks the implementation, tests, docs, manifest, benchmark, and workflows.

A release is one command and one merge. `npm run release:prepare -- <version>` sets the `package.json` and `package-lock.json` version and moves the `Unreleased` notes under the exact dated release heading; it refuses an empty `Unreleased` section, a repeated version, or a version that is not exact SemVer. Open a pull request with those edits. Merging it to protected `main` does the rest:

1. `Create release tag` runs when the push changes `package.json` or `CHANGELOG.md`. It reads the version from `package.json`, exits when `v<version>` already exists, checks the changelog heading, confirms `main` still equals the pushed commit, and lets the `Release Sentinel SN` app create the tag.
2. The tag push starts `.github/workflows/release.yml`, which validates, publishes through the `release` environment, verifies the registry package and provenance, and creates the GitHub release.

The `release` environment has no required reviewers, so nothing waits for a person. `scripts/release-governance.json` records that unattended policy; the governance audit rejects a live environment that gains reviewers, a self-review setting, or administrator bypass. The remaining controls are pull-request-only `main` with required status checks, app-only tag creation, tag immutability, and the artifact identity checks in the release workflow.

A second merge to `main` before the release workflow's tip check runs makes that check fail. The check runs immediately after checkout and before dependency installation. Protected release tags are immutable and must not be moved, so that version number cannot be reused; release the next version.

The manual `Create release tag` dispatch remains as a retry for the same version, for example when the tag job failed before creating the tag. It performs the same checks.

Treat each incomplete step as `Live-pending`. Do not describe a green local check as live release proof.

## Release identity

The protected-tag workflow requires all release identities to agree:

- `package.json` and `package-lock.json` version
- changelog version
- `v<version>` tag
- tarball filename and packed package metadata
- npm package metadata and registry bytes
- provenance subject
- GitHub release title and asset

The release heading must be the first version heading after `## Unreleased`:

```text
## 2.0.0 — 2026-08-21
```

The date must be a real, non-future UTC calendar date in `YYYY-MM-DD` format. Keep future notes under `Unreleased` until the implementation and version are ready. Stable versions publish under `latest`. Prerelease versions publish under `next`.

The artifact gate rejects a `package.json` version that is not exact SemVer. Workflow outputs enter shell commands only through quoted environment variables.

## Exact artifact check

Run:

```bash
npm run release:check
```

The check performs these actions:

1. Deletes `dist` and builds it again.
2. Runs `npm pack --json --ignore-scripts`.
3. Inspects the exact tarball that later jobs use.
4. Rejects path traversal, links, executable files, unexpected root outputs, source, tests, workflows, scripts, plans, docs, secrets, and source maps.
5. Verifies every package export and declaration target.
6. Preserves normalized package metadata. Each file record contains its path, size, mode, link value, and SHA-256 digest. The package record contains the tarball SHA-1, SHA-256, SHA-512 integrity, size, unpacked size, and entry count.

The build does not ship JavaScript or declaration source maps because their source files are not in the package. This policy prevents dangling maps.

Run the same packed-consumer path used by `npm run validate`:

```bash
npm run release:check -- --consumer
```

The default consumer runs the `localSmokeCell` dependency set under the current host Node and npm. `--consumer-all` runs every dependency set under that same host. The release gate and CI pass the expected tarball SHA-256 before the consumer installs or imports the package. Neither mode proves that one process ran under multiple Node versions. CI provides the authoritative five-cell runtime matrix from `scripts/compat-matrix.json`.

## Workflow boundaries

`.github/workflows/release.yml` keeps each privilege at one boundary:

1. `validate` uses read-only source access. It verifies the exact tag, exact `origin/main` tip, changelog, tests, and artifact.
2. `consumer` runs every compatibility cell against the uploaded tarball.
3. `publication-state` reads current registry state.
4. `publish` receives only the reviewed publish-input artifact. It has only `id-token: write`, does not check out source, and does not install dependencies.
5. `registry-verify` has no ID-token permission. It verifies the exact registry bytes, exports, declarations, and Sigstore provenance identity.
6. `github-release` has only `contents: write`. It creates or verifies one release and one exact asset.

The publish input includes the tarball, normalized npm-pack manifest, and reviewed publish helpers. No later job rebuilds the package.

## Trusted publishing and retries

The publish job uses Node `24.16.0` and requires its executable npm version to satisfy `>=11.5.1 <12`. It publishes with `--ignore-scripts --provenance`. It does not use `NPM_TOKEN`.

The workflow models these outcomes:

- accepted publication
- an existing version that needs identity verification
- an ambiguous transport result that needs registry verification
- a permanent failure

Registry retries are bounded. They use structured npm status codes and retry only transient transport errors, publication lag, HTTP 429, and HTTP 5xx. Every install attempt uses a new temporary consumer. Authentication, configuration, schema, identity, integrity, and provenance errors fail immediately.

Provenance verification requires the expected package, version, tarball digest, repository, workflow, commit, tag, GitHub Actions builder, release environment, and OIDC subject. Registry integrity and provenance are separate checks.

Fulcio encodes GitHub workflow certificate extensions as DER UTF8String values. The verifier decodes these values before comparison. The expected OIDC subject includes the immutable GitHub owner and repository IDs.

GitHub release retries compare the exact tag, target commit, title, draft state, prerelease state, changelog-derived notes, asset name, and asset bytes. The helper never overwrites a conflicting asset.

## Recover a missing GitHub release

Use `Recover GitHub release` only when npm publication succeeded but a later verification or GitHub release step failed. Do not republish the version. Do not delete or move its protected tag.

1. Fix the failed verifier through the normal pull request process.
2. Run `Recover GitHub release` from `main`.
3. Enter the exact published version.
4. Review the verification job.
5. Verify the GitHub release notes and tarball asset.

The recovery workflow fetches the immutable tag and registry package. It verifies the registry bytes, installed exports, declarations, provenance, workflow identity, commit, and tag. It then reuses the normal GitHub release helper and permission boundary. It cannot publish to npm or create a tag.

## Governance status

`scripts/release-governance.json` is the desired policy. `docs/release-governance-status.json` is a point-in-time capture, not permanent live proof.

The `Release Sentinel SN` GitHub App is the only principal that can create `v*` tags. The `release` environment has no required reviewers, blocks administrator bypass, and accepts only `v*` tag deployments. `docs/release-governance-status.json` predates the unattended policy and still lists a reviewer; rerun the audit after the environment changes and replace that capture.

Use the read-only manual workflow `Governance audit` to compare current GitHub controls with the desired policy. You can run the same checker locally:

```bash
node scripts/check-release-governance.mjs
```

The npm trusted-publisher read API requires an authenticated npm publishing session. The automated audit marks that identity `Live-pending`. Verify it manually before release:

```bash
npm trust list oxc-plugin-servicenow --json
```

Check that it names this repository, `release.yml`, and the `release` environment. The GitHub audit checks the main ruleset contexts, tag creation and immutability, the empty reviewer list, the absence of a self-review setting, administrator bypass, and tag-only deployment policy.

Do not change repository or environment settings without explicit approval.

## Live release evidence

A stable protected-tag run must still prove all of these items:

1. The tag is the exact protected `main` tip.
2. All validate and compatibility jobs pass.
3. The `release` environment deployment ran from the `v*` tag without a reviewer.
4. npm accepts or already contains the exact inspected bytes.
5. Registry integrity and Sigstore provenance identity pass.
6. Every public export and declaration works from the registry package.
7. The GitHub release contains the exact changelog notes and tarball asset.

Until an authorized release completes these checks, their disposition is `Live-pending`.
