# Release provenance

This page describes how 2.0.0 and later releases publish the exact inspected package.

## Required heading

`CHANGELOG.md` must contain an exact release heading before a tag can publish:

```text
## 2.0.0 — 2026-08-20
```

The date uses `YYYY-MM-DD`. A mention of the version anywhere else is not enough.

## Tag ancestry

The `v*` tag commit must be an ancestor of `origin/main`. The validate job fetches `main` and runs `git merge-base --is-ancestor $GITHUB_SHA origin/main`.

Protect `main` and the `release` GitHub Environment so a random tag cannot publish.

## Artifact identity

1. The validate job builds once and runs `npm pack --ignore-scripts`.
2. That job inspects the tarball file list.
3. The consumer job installs and tests that same file.
4. The publish job downloads the same artifact and runs `npm publish <filename>.tgz`.
5. Lifecycle scripts do not rebuild the package after inspection.

## Trusted publishing

The publish job:

- uses the protected `release` environment
- grants `id-token: write` only in that job
- installs npm 11.5.1 or later
- does not set `NPM_TOKEN`

Configure npm trusted publishing for this repository and the `Release` workflow.

## Failure and retry

| Failure | Recovery |
| --- | --- |
| Validate or consumer fails | Fix the commit, retag after the new commit is on `main`. Do not publish a previous tarball. |
| `npm publish` fails after a network error | Retry the publish job only. The tarball artifact is immutable. |
| Registry verification fails | Do not create a GitHub release. Inspect the registry package and republish only if npm accepted no artifact. |
| GitHub release create fails after a successful publish | Create the GitHub release manually from the same tarball. Do not publish again. |

A GitHub release is created only after registry verification succeeds.
