# Release provenance

This page describes how 2.0.0 and later releases publish the exact inspected package.

## Required heading

`CHANGELOG.md` must contain an exact release heading before a tag can publish:

```text
## 2.0.0 — 2026-08-20
```

The date uses `YYYY-MM-DD`. A mention of the version anywhere else is not enough. `npm run release:check` and the release validate job both use `scripts/check-release-artifact.mjs` for this check.

## Local artifact check

Run the same inspect path that the release workflow uses:

```bash
npm run build
npm run release:check
```

`release:check` does the following:

1. Confirms the changelog heading for the `package.json` version.
2. Runs `npm pack --ignore-scripts` so `prepack` does not rebuild after inspection.
3. Rejects a tarball that is missing public exports or that includes `src/`, `tests/`, `.github/`, `scripts/`, `plans/`, or `docs/`.
4. Prints the tarball path, SHA-256 digest, and npm `sha512` integrity.

To run packed-consumer tests on that same file:

```bash
npm run release:check -- --consumer
```

To run every compatibility cell on that same file:

```bash
npm run release:check -- --consumer-all
```

Do not run `npm publish` from a working tree. The release workflow publishes the inspected tarball filename with `--ignore-scripts`.

## Tag ancestry

The `v*` tag commit must be an ancestor of `origin/main`. The validate job fetches `main` and runs `git merge-base --is-ancestor $GITHUB_SHA origin/main`.

Protect `main` and the `release` GitHub Environment so a random tag cannot publish.

## Artifact identity

1. The validate job builds once and runs `scripts/check-release-artifact.mjs`.
2. That script inspects one tarball and records its path.
3. The consumer job installs and tests that same file with `scripts/compat-consumer.mjs --all --tarball`.
4. The publish job downloads the same artifact and runs `npm publish <filename>.tgz --ignore-scripts --provenance --access public`.
5. Lifecycle scripts do not rebuild the package after inspection.

## Trusted publishing

The publish job:

- uses the protected `release` environment
- grants `id-token: write` only in that job
- installs npm 11.5.1 or later
- does not set `NPM_TOKEN`

Configure npm trusted publishing for this repository and the `Release` workflow.

## Post-publish verification

After `npm publish`, the publish job runs `scripts/verify-published-package.mjs --tarball <filename>.tgz`. That script:

1. Waits for `npm view <name>@<version>` to return the published record.
2. Requires a tarball URL and provenance attestations.
3. Compares `dist.integrity` to the SHA-512 digest of the inspected tarball.
4. Installs the registry package in a temporary consumer and imports `.`, `./oxfmt`, and `oxfmt.recommended.json`.

The job creates a GitHub release only after those checks pass.

## Failure and retry

| Failure | Recovery |
| --- | --- |
| Validate or consumer fails | Fix the commit, retag after the new commit is on `main`. Do not publish a previous tarball. |
| `npm publish` fails after a network error | Retry the publish job only. The tarball artifact is immutable. |
| Registry verification fails | Do not create a GitHub release. Inspect the registry package and republish only if npm accepted no artifact. |
| GitHub release create fails after a successful publish | Create the GitHub release manually from the same tarball. Do not publish again. |
