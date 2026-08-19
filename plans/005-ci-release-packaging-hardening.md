# Plan 005: Harden CI, packaging metadata, and the release path

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c987eee..HEAD -- .github package.json package-lock.json tests/plugin.test.ts CHANGELOG.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. (Plan 001 also edits `package.json`
> scripts and `ci.yml` — expected drift; reconcile, don't revert it.)

> **Status: DONE.** Landed on `advisor/improve-batch-001-005` at `f982ed2`. Do not execute. "Current state" below is a snapshot of `c987eee` before landing.

## Status

- **Priority**: P2
- **Effort**: M (many small mechanical items)
- **Risk**: LOW
- **Depends on**: none (001 first is convenient — it touches the same two files)
- **Category**: security / dx
- **Planned at**: commit `c987eee`, 2026-08-19

## Why this matters

This package injects code into other teams' lint pipelines, so its own supply chain is part of its product. Today: the CI workflow has no `permissions:` block (it inherits whatever the repo default is — potentially write-scoped) while running PR-controlled code (`npm ci`, tests, and a docs script that dynamically imports `src/catalog.ts` from the PR branch), with `actions/checkout` persisting a token into `.git/config` and actions pinned only to mutable `@v4` tags. Publishing is entirely manual from a maintainer's machine with no provenance; `npm pack` from a fresh clone silently produces a tarball with **no `dist/`** (dist is gitignored and only `prepublishOnly` builds — there is no `prepack`). The version reported by the plugin (`src/constants.ts` `PACKAGE_VERSION`) is hand-duplicated from `package.json` with no check, guaranteed to skew on a future release. And the metadata advertises impossible compatibility: peer `oxlint >=1.0.0` (the JS-plugin API the code requires shipped ~79 minors later), `engines: node >=18.18.0` (EOL; never tested — CI runs 20/22, and dev-dep `oxc-parser` requires `^20.19.0 || >=22.12.0`), and the `./oxfmt` export has no `default` condition, so consumers hitting the `default` resolution path get an opaque `ERR_PACKAGE_PATH_NOT_EXPORTED`.

## Current state

- `.github/workflows/ci.yml` (complete file today):

  ```yaml
  name: CI
  on:
    push:
      branches: [main]
    pull_request:
  jobs:
    test:
      runs-on: ubuntu-latest
      strategy:
        matrix:
          node: [20, 22]
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with:
            node-version: ${{ matrix.node }}
            cache: npm
        - run: npm ci
        - run: npm run typecheck
        - run: npm test
        - run: npm run docs:check
        - run: npm run build
  ```

  No `permissions:`, no `persist-credentials: false`, mutable `@v4` tags. `.github/` contains nothing else (no dependabot config, no release workflow).

- `package.json` relevant excerpts:

  ```json
  "engines": { "node": ">=18.18.0" },
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js", "default": "./dist/index.js" },
    "./oxfmt": { "types": "./dist/oxfmt/index.d.ts", "import": "./dist/oxfmt/index.js" },
    "./oxfmt.recommended.json": "./oxfmt.recommended.json",
    "./package.json": "./package.json"
  },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "clean": "rm -rf dist",
    "prepublishOnly": "npm run clean && npm run build && npm test",
    ...
  },
  "peerDependencies": { "eslint": ">=9.0.0", "oxfmt": ">=0.16.0", "oxlint": ">=1.0.0" },
  "dependencies": { "@oxlint/plugins": "^1.79.0" }
  ```

  No `prepack`, no `publishConfig`. `files` is `["dist", "oxfmt.recommended.json", "README.md", "LICENSE", "CHANGELOG.md"]`.

- `src/constants.ts:6` — `export const PACKAGE_VERSION = "1.1.0";` consumed at `src/index.ts:54` (`plugin.meta.version`). `tests/plugin.test.ts` asserts other meta but never version equality.
- `dist/` is gitignored (`.gitignore` lists `dist`); confirmed untracked (`git ls-files dist` → empty).
- Test conventions: node:test, strict assert — see `tests/plugin.test.ts`.

## Commands you will need

| Purpose   | Command                    | Expected on success |
|-----------|----------------------------|---------------------|
| Typecheck | `npm run typecheck`        | exit 0              |
| Tests     | `npm test`                 | all pass            |
| Build     | `npm run build`            | exit 0              |
| Pack check| `npm pack --dry-run`       | listing includes `dist/index.js` |
| Workflow lint (if available) | `actionlint .github/workflows/*.yml` | no errors (skip if actionlint not installed) |

## Scope

**In scope** (the only files you should modify/create):
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml` (create)
- `.github/dependabot.yml` (create)
- `package.json` (engines, peerDependencies.oxlint, exports."./oxfmt", `prepack` script)
- `package-lock.json` (only if npm rewrites it)
- `tests/plugin.test.ts` (version-equality test)
- `CHANGELOG.md` (entry for engines/peer changes)

**Out of scope** (do NOT touch):
- `src/**` except nothing — `PACKAGE_VERSION` itself stays a constant; the test pins it.
- npm account settings, tokens, or publishing anything. The release workflow is added **disabled-by-default** in the sense that it only triggers on version tags the maintainer pushes; you must not create tags.
- `README.md` — install instructions do not change here.

## Git workflow

- Use the `git`/`gh` wrappers on `PATH` (machine identity + signing enforced).
- Branch: `advisor/005-ci-release-packaging-hardening`.
- Commit per step. Do NOT push, tag, or open a PR unless instructed.

## Steps

### Step 1: Scope CI token and stop persisting credentials

In `ci.yml`, add at the workflow top level (below `name:`):

```yaml
permissions:
  contents: read
```

and change the checkout step to:

```yaml
      - uses: actions/checkout@v4
        with:
          persist-credentials: false
```

**Verify**: `grep -n '^permissions:' .github/workflows/ci.yml` → 1 match; `grep -n 'persist-credentials: false' .github/workflows/ci.yml` → 1 match. If `actionlint` or `yq` is on PATH, run it on the file and expect exit 0.

### Step 2: Pin actions to commit SHAs

Replace each `@v4` with the full 40-character SHA of the current v4 release, keeping a version comment. Resolve SHAs with:

```bash
gh api repos/actions/checkout/git/ref/tags/v4 --jq .object.sha
gh api repos/actions/setup-node/git/ref/tags/v4 --jq .object.sha
```

Note: if the tag object is an annotated tag, the returned SHA is the tag object, not the commit — dereference with `gh api repos/actions/checkout/git/tags/<sha> --jq .object.sha`. Result form:

```yaml
      - uses: actions/checkout@<40-hex-sha> # v4
```

**Verify**: `grep -c '@[0-9a-f]\{40\}' .github/workflows/ci.yml` → 2.

### Step 3: Add Dependabot

Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    groups:
      oxc:
        patterns:
          - "@oxlint/*"
          - "oxc-parser"
          - "oxlint"
          - "oxfmt"
      dev-toolchain:
        patterns:
          - "typescript"
          - "tsx"
          - "@types/*"
          - "eslint"
```

(The oxc group exists because those packages must move together against an alpha API.)

**Verify**: file exists; YAML well-formed.

### Step 4: Fix packaging metadata

In `package.json`:

1. `"engines": { "node": ">=20.19.0" }` (matches oxc-parser's floor and Node's `require(esm)` support; Node 18 is EOL and was never tested).
2. `"peerDependencies"`: change `"oxlint": ">=1.0.0"` to `"oxlint": ">=1.79.0 <2"`. Leave `eslint`/`oxfmt` ranges as-is.
3. `"./oxfmt"` export: add `"default": "./dist/oxfmt/index.js"` after `"import"`.
4. Add script: `"prepack": "npm run clean && npm run build"`.

Add a CHANGELOG entry under a new "Unreleased" heading noting the engines floor raise and the oxlint peer-range correction (both consumer-visible).

**Verify**: `npm install` (refreshes lock) → exit 0; `npm pack --dry-run 2>&1 | grep dist/index.js` → present (prepack built dist); `node -e "console.log(Object.keys(require('./package.json').exports['./oxfmt']))"` → includes `default`.

### Step 5: Pin the version constant with a test

In `tests/plugin.test.ts`, add:

```ts
import { readFileSync } from "node:fs";
// inside an existing or new describe block:
it("PACKAGE_VERSION matches package.json", () => {
  const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(PACKAGE_VERSION, manifest.version);
});
```

Import `PACKAGE_VERSION` from `../src/constants.js` (check the file's existing imports and match style).

**Verify**: `npm test` → passes; temporarily changing the constant makes it fail (revert).

### Step 6: Add the release workflow

Create `.github/workflows/release.yml`:

```yaml
name: Release
on:
  push:
    tags: ["v*"]
permissions:
  contents: read
  id-token: write
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<same-sha-as-ci> # v4
        with:
          persist-credentials: false
      - uses: actions/setup-node@<same-sha-as-ci> # v4
        with:
          node-version: 22
          cache: npm
          registry-url: https://registry.npmjs.org
      - run: npm ci
      - run: npm run typecheck
      - run: npm run build
      - run: npm test
      - run: npm run docs:check
      - name: Verify tag matches package version
        run: |
          test "v$(node -p "require('./package.json').version")" = "$GITHUB_REF_NAME"
      - run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Use the same pinned SHAs as `ci.yml`. Do not create any tag or secret. Add a comment at the top of the file: `# Requires an NPM_TOKEN repo secret (or npm trusted publishing configured for this repo/workflow).`

**Verify**: file exists, SHAs match `ci.yml` (`grep -o '@[0-9a-f]\{40\}' .github/workflows/*.yml | sort -u` → 2 unique SHAs).

## Test plan

- Step 5's version-equality test is the only new automated test.
- Step 4's pack verification is command-level (`npm pack --dry-run` listing).
- Everything else is configuration verified by the greps in each step; final CI proof comes from the first PR run.

## Done criteria

Machine-checkable. ALL must hold:

- [x] `npm run typecheck` and `npm test` exit 0 (includes the new version test)
- [x] `grep -n "permissions:" .github/workflows/ci.yml` → 1 match; `grep -n "persist-credentials: false" .github/workflows/ci.yml` → 1 match
- [x] `grep -c '@[0-9a-f]\{40\}' .github/workflows/ci.yml` → 2; same pattern in `release.yml` → 2
- [x] `.github/dependabot.yml` and `.github/workflows/release.yml` exist
- [x] `node -p "require('./package.json').engines.node"` → `>=20.19.0`
- [x] `node -p "require('./package.json').peerDependencies.oxlint"` → `>=1.79.0 <2`
- [x] `rm -rf dist && npm pack --dry-run 2>&1 | grep -q dist/index.js && echo OK` → OK
- [x] No files outside the in-scope list modified (`git status`)
- [x] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `gh api` cannot resolve the action tag SHAs (no network / auth) — do not guess SHAs; report and leave the tags as `@v4` with a TODO comment.
- `npm pack --dry-run` does not run `prepack` in the installed npm version (older npm ran `prepack` only on real pack) — verify with `npm --version`; if the dry-run skips it, verify with a real `npm pack` and delete the tarball afterward.
- Raising `engines` causes `npm install`/`npm ci` failures in the local environment (Node too old) — report the local Node version instead of loosening the range.
- The maintainer's npm publishing model is unknown to you and the workflow choice (token vs trusted publishing) matters — the file as specified supports both; do NOT attempt any publish.

## Maintenance notes

- Raising `engines.node` and narrowing the oxlint peer range are consumer-visible; ship in a minor at least, with the CHANGELOG entry from step 4.
- Dependabot's oxc group + plan 001's integration tests together form the upgrade safety net: a weekly PR bumps the oxc stack and the real-host suite catches contract breaks.
- Reviewers should scrutinize the release workflow's tag-vs-version guard and confirm the npm account has 2FA + (ideally) trusted publishing before the first tagged release.
- Deferred: `npm pack` content assertion as a CI step (a `test:dist` smoke test importing every export subpath from the built output) — backlog item "dist smoke test".
