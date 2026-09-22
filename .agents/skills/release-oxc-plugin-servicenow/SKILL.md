---
name: release-oxc-plugin-servicenow
description: Cuts a full oxc-plugin-servicenow release end to end - picks or confirms the version, prepares the version and changelog, opens and merges the release pull request, then watches the tag and publish runs and verifies npm and the GitHub release. Use this whenever the user asks to release, publish, ship, cut, or tag a version of this plugin, bump the version for release, "get 3.1.0 out", or asks what is blocking a release, even if they do not say "release" explicitly.
license: MIT
compatibility: Requires Node.js 24, npm, git, network access, and an authenticated `gh` CLI with push and merge rights on martinthommesen/oxc-plugin-servicenow. Run from the repository root.
---

# Release oxc-plugin-servicenow

A release here is one command and one merge. `npm run release:prepare -- <version>` edits the version and changelog; merging that edit to `main` tags the commit through the Release Sentinel app, and the tag push runs `release.yml`, which validates, publishes to npm through trusted publishing, verifies the registry bytes and provenance, and creates the GitHub release. No approval waits anywhere after the merge, so merging the release pull request is the publish action. Treat it with that weight: confirm the version once, then proceed.

`docs/release.md` is the authoritative description of the pipeline. `CONTRIBUTING.md` has the short form. Read them if anything below seems out of date; they win.

## 1. Check the preconditions

Run these before touching anything. Each one prevents a failure that would otherwise waste an immutable version number.

```bash
git status --porcelain            # must be empty
git fetch origin && git switch main && git pull --ff-only origin main
gh auth status
gh pr list --state open --search "chore(release)" --json number,title
GH_TOKEN="$(gh auth token)" node scripts/check-release-governance.mjs
```

Stop and report if:

- the working tree is dirty or `main` cannot fast-forward;
- an open release pull request already exists (finish or close that one first);
- the governance audit prints `"ok": false` for anything other than `npm trusted-publisher identity`, which is always Live-pending. A reviewer or self-review drift means the GitHub `release` environment still requires a person, and the merge would stall. Tell the user which setting to change; do not change repository settings yourself.

Then read the `## Unreleased` section of `CHANGELOG.md`. If it is empty, there is nothing to release. Say so and stop. The prepare command refuses an empty section anyway.

## 2. Choose the version

Use the version the user gave. If they gave none, infer it from the Unreleased notes using the repository's Conventional Commits and SemVer conventions:

| Unreleased contains                                   | Bump  |
| ----------------------------------------------------- | ----- |
| a `### Removed` heading, or a note that says breaking | major |
| a `### Added` heading                                 | minor |
| only fixes, changes, docs                             | patch |

State the version and the one-line reason, for example "3.1.0: Unreleased has an Added section and no removals", and proceed unless the user objects. The current version is in `package.json`. Ask instead of inferring when the notes suggest a prerelease, when the bump would skip a level, or when the user's request contradicts the notes.

## 3. Prepare the release branch

```bash
git switch -c chore/release-<version>
npm run release:prepare -- <version>
git diff --stat                   # package.json, package-lock.json, CHANGELOG.md
```

The command sets both version fields and moves the Unreleased notes under `## <version> — <today>`. If it refuses, its message names the reason; fix that on the branch and rerun. Do not edit those three files by hand afterwards.

Run the full local gate before pushing. It takes several minutes and is the same set of checks the pull request must pass, so a failure here costs less than a failure on the pull request:

```bash
npm run validate
```

If it fails, the release is not ready. Report the failing check to the user. Do not change the version to get around a failure, and do not retry the command hoping for a different outcome.

Commit and push with a Conventional Commits message, and open the pull request with the same title:

```bash
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore(release): <version>"
git push -u origin chore/release-<version>
gh pr create --base main --title "chore(release): <version>" --body "$(cat <<'BODY'
Release <version>. Merging tags v<version> and publishes to npm.

## Notes

<the notes block from CHANGELOG.md for this version>
BODY
)"
```

## 4. Merge

Enable auto-merge so the merge happens the moment every required check passes, then wait for it:

```bash
gh pr merge <number> --squash --auto --delete-branch
gh pr checks <number> --watch
gh pr view <number> --json state,mergedAt
```

`main` allows squash and rebase merges only. If a required check fails, read its log with `gh run view <run-id> --log-failed`, fix the cause on the branch, push, and let auto-merge pick it up. If the fix is unrelated to the release, tell the user; it belongs in its own pull request first.

Do not merge anything else into `main` until step 5 shows the release validating. The release workflow requires the tag to equal the `main` tip, and a second merge in that window leaves the version unusable.

## 5. Watch the automation

Two workflows run after the merge. Poll them; each usually finishes within a few minutes.

```bash
gh run list --workflow "Create release tag" --branch main --limit 1 --json status,conclusion,databaseId
git ls-remote --tags origin "v<version>"
gh run list --workflow Release --limit 1 --json status,conclusion,databaseId,headBranch
gh run watch <release-run-id> --exit-status
```

Outcomes and what to do:

- **Tag job failed before creating the tag** (for example `main is <sha>; expected <sha>` because another push landed): run `gh workflow run "Create release tag" --ref main` and watch again. The script is idempotent.
- **Release `validate` failed on the main-tip check**: the tag exists and cannot move, so this version is unusable. Report it and offer to release the next patch version.
- **Release failed after the `publish` job succeeded**: the package is on npm. Run `gh workflow run "Recover GitHub release" --ref main -f version=<version>` and watch it. Never republish.
- **Release failed in `validate`, `consumer`, or `publish` before anything was published**: read the failed log, report the cause, and stop. Fixing it is code work for a separate pull request, followed by the next version.

## 6. Verify and report

```bash
npm view oxc-plugin-servicenow@<version> version dist.integrity
gh release view v<version> --json tagName,targetCommitish,assets
```

Then report in this shape:

```
Released oxc-plugin-servicenow <version>.

- Pull request: <url>, merged <time>
- Tag v<version> at <sha>
- Release run: <url>, all jobs green
- npm: <version> published, integrity <sha512...>
- GitHub release: <url>, asset <tarball name>
```

If any line cannot be confirmed, say which one and why. A release with an unverified line is not done.

## What not to do

- Do not create or move a `v*` tag yourself. Only the Release Sentinel app may create one, and the rulesets make tags immutable.
- Do not run `npm publish`. Publication happens only from the workflow through trusted publishing.
- Do not edit repository or environment settings. Report drift and let the user change them.
- Do not batch unrelated changes into the release pull request. Its diff is exactly the three prepared files.
