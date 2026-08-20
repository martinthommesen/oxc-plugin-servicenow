# Release provenance

This page describes how 2.0.0 and later releases publish the exact inspected package. The workflow is intentionally split into read-only validation, an artifact-only trusted-publishing job, registry verification, and GitHub-release jobs.

## Required heading

`CHANGELOG.md` must contain an exact release heading before a tag can publish:

```text
## 2.0.0 — 2026-08-20
```

The date uses a valid `YYYY-MM-DD` calendar date. A mention of the version anywhere else is not enough. `npm run release:check` and the release validate job use `scripts/check-release-artifact.mjs` for this check.

## Local artifact check

Run the same inspect path that the release workflow uses:

```bash
npm run build
npm run release:check
```

`release:check` does the following:

1. Rebuilds current `src/` into ignored `dist/` before packing (unless an explicit tarball is supplied).
2. Confirms the changelog heading for the `package.json` version.
3. Runs `npm pack --ignore-scripts`; the parser accepts both legacy array and npm-12 package-keyed JSON output.
4. Rejects a tarball that is missing public exports or declarations, or that includes `src/`, `tests/`, `.github/`, `scripts/`, `plans/`, or `docs/`.
5. Prints the tarball path, SHA-256 digest, and npm `sha512` integrity.

To run packed-consumer tests on that same file:

```bash
npm run release:check -- --consumer
```

To run every compatibility cell on that same file locally (the current Node process cannot substitute for another cell's runtime):

```bash
npm run release:check -- --consumer-all
```

Do not run `npm publish` from a working tree. The release workflow publishes the immutable inspected tarball filename with `--ignore-scripts`.

## Tag ancestry and protected release controls

The `v*` tag commit must be an ancestor of `origin/main`. The validate job fetches `main` and runs `git merge-base --is-ancestor "$GITHUB_SHA" origin/main`, and requires `v<package.json.version>` to equal the tag.

Protect `main` and the `release` GitHub Environment so a random tag cannot publish. The `release` environment must require a reviewer, and npm trusted publishing must be configured for this exact repository/workflow pair. No long-lived `NPM_TOKEN` is used.

## Workflow isolation and exact artifact

1. **validate** checks out the tag with read-only `contents`, builds once, runs all gates, inspects one tarball, and uploads it as `release-tarball`.
2. **consumer** is a required matrix (`min-hosts` on Node 20.19.0, `node20-current` on Node 20, `node22-latest` on Node 22, and `eslint9-current` on declared `current`). Every cell installs and tests the exact uploaded tarball, not source `dist/`.
3. **publish** is the only job with `id-token: write`. It receives only the uploaded tarball, uses Node 24.5.0 (which bundles the pinned npm 11.5.1), verifies the executable `npm --version`, and runs `npm publish <tarball> --ignore-scripts --provenance --access public`. It does not check out source, install dependencies, import the package, or run registry checks.
4. **registry-verify** has no OIDC permission. It installs with `--ignore-scripts`, resolves every package export/declaration, imports the registry package through bare public specifiers, and compares `dist.integrity`, provenance, and version to the inspected tarball.
5. **github-release** has only minimum `contents: write`, runs after registry verification, and invokes `scripts/create-github-release.mjs` to create or idempotently verify the release asset.

A matrix result is a required input to publish; a skipped or failed cell cannot be hidden by running `--all` under one host runtime.

## Trusted publishing npm pin

The release runtime is pinned to Node `24.5.0`, whose bundled executable npm is `11.5.1`. The workflow executes `npm --version` and requires the exact `11.5.1` value; it never reads `process.versions.npm` and never installs npm in the OIDC job. `scripts/check-trusted-publishing-npm.mjs` provides the same parser/check as an executable local helper.

## Retry safety

A publish request can be accepted by npm even when the client receives a network error, and a release rerun can encounter an already-existing version. The publish step is allowed to report an ambiguous failure so the separate no-OIDC registry job can decide safely:

- If the registry does not list the version or integrity/provenance differs, the workflow fails; do not publish another artifact.
- If the registry lists the exact inspected `sha512` integrity and provenance, verification succeeds and no second publish is attempted.
- `scripts/create-github-release.mjs` treats an existing release as a retry: it compares the named asset bytes (or GitHub's SHA-256 digest), uploads only a missing asset, and fails on a mismatch. It never overwrites a mismatched asset.
- If GitHub release creation fails after a successful registry check, rerun the release job or invoke the helper with the same immutable tarball; do not republish.

## Captured GitHub governance

The repository controls were applied and captured on 2026-08-20 in [`docs/release-governance-live.json`](./release-governance-live.json): active `main` pull-request/status-check ruleset `21081867`, active protected `v**` tag ruleset `21081873`, a non-bypassable reviewer-gated `release` environment, and repository-level SHA-pinning enforcement. The npm trusted publisher remains pending because this host is not authenticated to npm; the desired repository/workflow/environment/tag restriction is in `scripts/release-governance.json`.

## Explicitly-live gates

Local tests use deterministic metadata, fake command boundaries, and the current packed artifact. They do **not** prove external OIDC trust, registry availability/provenance, or GitHub permissions. Keep these gates pending until an approved real tag completes them:

1. Confirm the protected `release` environment requires a reviewer.
2. Confirm npm trusted publishing is configured for this repository and the `Release` workflow, with no `NPM_TOKEN` secret.
3. Tag `v2.0.0` on a commit already on protected `main`.
4. Confirm all validate and real Node matrix jobs pass on that tag.
5. Approve the publish job in the `release` environment.
6. Confirm registry verification sees the exact tarball integrity and provenance, and imports all public exports.
7. Confirm the GitHub release exists with the inspected `oxc-plugin-servicenow-2.0.0.tgz` asset.

Only after those live checks should maintainers close #58 and #76's release criteria.


## Merge readiness versus release readiness

**Merge readiness** is entirely in-repository: the typecheck, test, real-host compatibility cells, benchmark, documentation, manifest, artifact, and workflow-pin checks are green and the workflow permissions are reviewable. It does not require a tag or a live publication.

**Release readiness** starts only after merge: an approved protected `v*` tag must pass the real Node 20/22/24/26 matrix, trusted-publishing OIDC, registry integrity/provenance/import verification, and idempotent GitHub release creation. These are intentionally live gates and remain pending until a maintainer runs them.

The desired GitHub ruleset and npm publisher restrictions are recorded in `scripts/release-governance.json`. A maintainer should apply and capture them before the first release:

```bash
gh api repos/:owner/:repo/branches/main/protection
gh api repos/:owner/:repo/rulesets
gh api repos/:owner/:repo/environments/release
npm profile get
```

The repository/workflow/environment/tag restriction must match that file exactly; no tag-only live proof is required to merge the implementation.
