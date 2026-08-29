# Plan 010: Make the Fluent SDK registry authoritative and project-aware

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Do not improvise. The dispatcher maintains `plans/README.md`; do not
> edit it.
>
> **Dependency gate (run before the drift check)**: Confirm that
> `plans/006-freeze-and-restack-pr51.md`,
> `plans/008-fix-bindings-scopes-and-closures.md`, and
> `plans/009-rebuild-stateful-rule-lifecycles.md` are complete. Plan 009 is a
> stack-topology dependency even where plan 010 only consumes plan 008 APIs.
>
> **Drift check (run first)**:
> `git diff --stat b87972a..HEAD -- package.json package-lock.json .github/workflows/fluent-sdk-drift.yml src/fluent/manifest.ts src/fluent/registry.ts src/fluent/declaration-snapshots.ts src/fluent/index.ts src/analysis/fluent-project.ts src/analysis/fluent-imports.ts src/analysis/file-analysis.ts src/rules/fluent-proper-imports.ts src/settings/releases.ts src/settings/validate.ts src/types.ts src/catalog-metadata.ts scripts/audit-fluent-sdk.mjs scripts/check-fluent-manifest.mjs scripts/compat-matrix.json scripts/generate-compatibility-docs.mjs tests/fixtures/fluent-sdk-declarations.json tests/fixtures/fluent-sdk-boundaries.json tests/fixtures/fluent-manifest-current.json tests/fluent-manifest.test.ts tests/rules/fluent-identity.test.ts tests/integration/packed-consumer.test.ts docs/fluent-sdk.md docs/compatibility.md docs/rules/fluent-proper-imports.md docs/rules/no-complex-fluent-logic.md docs/rules/no-duplicate-fluent-id.md docs/rules/no-now-id-as-reference.md docs/rules/prefer-now-include.md docs/rules/require-fluent-id.md docs/rules/fluent-directives.md docs/rules/fluent-naming-convention.md README.md CHANGELOG.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding. A mismatch
> is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: `plans/006-freeze-and-restack-pr51.md`, `plans/008-fix-bindings-scopes-and-closures.md`, `plans/009-rebuild-stateful-rule-lifecycles.md` (stack topology)
- **Category**: bug
- **Planned at**: commit `b87972a`, 2026-08-20

## Why this matters

The plugin currently synthesizes SDK manifests from a hand-written API list and
five exact version labels. It accepts neither the real published patch set nor
all intervening versions. The check does not download declarations, verify
registry integrity, prove module ownership, or prove absence.

Factory identity also stops at the current file. Project barrels therefore lose
SDK provenance. Mutable namespace aliases can retain provenance after a write,
which creates false diagnostics. This plan makes reviewed npm declarations the
source of truth, keeps platform releases separate from SDK versions, and adds
real packed-project tests for direct imports, aliases, namespaces, and barrels.

## Current state

### Registry and evidence

- `src/fluent/registry.ts:4-14` hard-codes five points and defaults to `4.11.0`:

  ```ts
  export const CURRENT_FLUENT_SDK_VERSION = "4.11.0";
  export const LEGACY_FLUENT_SDK_VERSION = "3.0.0";
  export const SDK_4_1_FLUENT_SDK_VERSION = "4.1.0";
  export const SDK_4_8_FLUENT_SDK_VERSION = "4.8.0";
  export const SDK_4_10_FLUENT_SDK_VERSION = "4.10.0";

  export const SUPPORTED_FLUENT_SDK_VERSIONS = [
    LEGACY_FLUENT_SDK_VERSION,
    SDK_4_1_FLUENT_SDK_VERSION,
    SDK_4_8_FLUENT_SDK_VERSION,
    SDK_4_10_FLUENT_SDK_VERSION,
    CURRENT_FLUENT_SDK_VERSION,
  ] as const;
  ```

- `src/fluent/registry.ts:36-48` uses a small introduction table. It assumes all
  other exports exist for all selected versions:

  ```ts
  const INTRODUCED: Readonly<Record<string, string>> = {
    AliasTemplate: "4.8.0",
    CatalogItemRecordProducer: "4.8.0",
    SPMenu: "4.8.0",
    ScheduledScript: "4.8.0",
    UiAction: "4.8.0",
    UiPage: "4.8.0",
    StateModel: "4.10.0",
  };
  ```

- `tests/fixtures/fluent-sdk-boundaries.json:1-6` calls itself an npm audit, but
  it stores no tarball URL, integrity, declaration path, complete export set,
  or absence set:

  ```json
  {
    "source": "@servicenow/sdk-core package exports (npm declaration audit)",
    "versions": {
      "3.0.0": {
        "package": "@servicenow/sdk-core@3.0.0",
        "present": [
  ```

- `scripts/check-fluent-manifest.mjs:101-110` only checks the fixture's selected
  positive names and ID policies. A developer can change the fixture and
  manifest together. Unsupported extras remain invisible.

- Live npm metadata was inspected on 2026-08-20. Both `@servicenow/sdk` and
  `@servicenow/sdk-core` then listed `4.11.0` as `latest`, published on
  2026-08-19. Both also list `4.10.1`. Do not claim that `4.11.0` is currently
  unpublished. Treat this as an observation that the executor must recheck.
  The observed integrity values were:

  - `@servicenow/sdk@4.10.1`:
    `sha512-ebmfymepmOjeRt3c0/gl6uqHx993Qyv//JPorS3SObrFWkEr+qtN2orsBBwq++Ejs16rZegF2WCYarnwmm00Lg==`
  - `@servicenow/sdk-core@4.10.1`:
    `sha512-m+HoqUqp+PmfOxptYQEW7ywMO0FX3KfAfReBq5oZERaF0+m0OC64KFqxbETtZFyA4/doolzo4hkwGVu5mOTTtQ==`
  - `@servicenow/sdk@4.11.0`:
    `sha512-ct+vgI/tdTXWng0XrDBDPPXVuXuU80iCQeFb90ZYaaCVmXho/6i4eKm/HOS7mQCT/Ty7tgErrL+lULQBNHltnA==`
  - `@servicenow/sdk-core@4.11.0`:
    `sha512-0yUXUd1VcJV+BC6nQsVkJ1UNW3r3Yx1/fGyCs/9uMtLQqj0sBoM/F1mK3QUcnVBetF9PVcVzf9tShKvhyiSq+A==`

- In both inspected SDK packages, `package.json` exports `./core` from
  `./src/core/index.ts`. The SDK package pins the same exact `sdk-core` patch.
  The `4.10.1` core barrel re-exports namespaces such as `db`, `ui`, `alias`,
  `app`, `rest`, and `state-model`. The `4.11.0` barrel additionally re-exports
  `graphql`. Audit the SDK-facing `@servicenow/sdk/core` barrel and its exact
  `@servicenow/sdk-core` dependency. Do not treat a filename in `sdk-core` as a
  public SDK factory unless the SDK barrel exports it.

### Factory provenance

- `src/analysis/fluent-imports.ts:191-205` accepts only the direct owning module
  and explicitly rejects cross-file re-exports:

  ```ts
  const candidate = resolveFluentCandidate(callee, ancestors, bindings, imports, manifest);
  if (!candidate) return null;
  const { capability, origin } = candidate;
  // A recognized symbol from another module is still a candidate for the
  // import-policy rule, but it is not an authoritative factory for semantic
  // rules. Cross-file re-exports are intentionally out of scope here.
  if (capability.module === "unknown" || origin.sourceModule !== capability.module) return null;
  return capability;
  ```

- `src/analysis/fluent-imports.ts:181-185` applies its mutable-alias stability
  check only when the complete callee is an identifier. After this code, the
  plugin incorrectly reports `require-fluent-id` on the local factory:

  ```ts
  import * as sdk from "@servicenow/sdk/core";
  let alias = sdk;
  alias = { BusinessRule(config: object) { return config; } };
  alias.BusinessRule({ name: "local" });
  ```

- `tests/rules/fluent-identity.test.ts` covers direct and namespace imports in
  one source string. It has no real multi-file project test.

### Release vocabulary

- `src/settings/releases.ts:6-8` accepts only `"zurich"`.
- `src/types.ts` describes `release` as a ServiceNow release and
  `fluentSdkVersion` as a separate SDK selector. Preserve that distinction.
- `src/fluent/manifest.ts:99-102` currently combines the labels in one comment:

  ```ts
  /**
   * Default manifest for current official Fluent documentation (Australia / Zurich SDK samples).
   */
  ```

  Platform source releases and npm SDK versions are independent dimensions.
  Never infer an SDK version from `release`, or a platform release from
  `fluentSdkVersion`.

### Repository conventions

- Use Node 20.19.0 or later.
- `npm test` delegates to `scripts/run-tests.mjs`. Do not use a quoted glob.
- `npm run validate` is the complete local gate.
- Generated rule pages and generated compatibility text must be changed through
  their source data and `npm run docs`, not by hand.
- Add an Unreleased changelog note for user-visible settings or diagnostics.
- Import paths in TypeScript source include `.js`.
- Recent commits use Conventional Commit subjects, for example
  `docs: record bootstrap artifact digest`.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Install | `npm ci` | exit 0 |
| Inspect published versions | `npm view @servicenow/sdk versions time dist-tags --json --registry=https://registry.npmjs.org` | exit 0; valid JSON |
| Inspect core versions | `npm view @servicenow/sdk-core versions time dist-tags --json --registry=https://registry.npmjs.org` | exit 0; valid JSON |
| Update reviewed declarations | `npm run manifest:update -- --all` | exit 0; only the generated declaration snapshot changes |
| Offline manifest gate | `npm run manifest:check` | exit 0; snapshot, registry, ownership, ranges, and absence checks pass |
| Network drift gate | `npm run manifest:drift` | exit 0 when npm metadata and declaration tarballs match the reviewed snapshot |
| Focused tests | `npm run test:fluent` | all Fluent registry, identity, and packed-project tests pass |
| Generate docs | `npm run docs` | exit 0 |
| Full validation | `npm run validate` | exit 0 |

## Scope

**In scope** (the only files you may modify):

- `package.json`
- `package-lock.json`
- `.github/workflows/fluent-sdk-drift.yml` (create only if the stack policy in Plan 006 permits this non-privileged workflow)
- `src/fluent/manifest.ts`
- `src/fluent/registry.ts`
- `src/fluent/declaration-snapshots.ts` (create; generated)
- `src/fluent/index.ts`
- `src/analysis/fluent-project.ts` (create)
- `src/analysis/fluent-imports.ts`
- `src/analysis/file-analysis.ts`
- `src/rules/fluent-proper-imports.ts`
- `src/settings/releases.ts`
- `src/settings/validate.ts`
- `src/types.ts`
- `src/catalog-metadata.ts`
- `scripts/audit-fluent-sdk.mjs` (create)
- `scripts/check-fluent-manifest.mjs`
- `scripts/compat-matrix.json`
- `scripts/generate-compatibility-docs.mjs`
- `tests/fixtures/fluent-sdk-declarations.json` (create; generated audit detail)
- `tests/fixtures/fluent-sdk-boundaries.json` (delete after replacement)
- `tests/fixtures/fluent-manifest-current.json`
- `tests/fluent-manifest.test.ts`
- `tests/rules/fluent-identity.test.ts`
- `tests/integration/packed-consumer.test.ts`
- `docs/fluent-sdk.md` (create)
- `docs/compatibility.md` (generated)
- `docs/rules/fluent-proper-imports.md` (generated)
- `docs/rules/fluent-directives.md` (generated)
- `docs/rules/fluent-naming-convention.md` (generated)
- `docs/rules/no-complex-fluent-logic.md` (generated)
- `docs/rules/no-duplicate-fluent-id.md` (generated)
- `docs/rules/no-now-id-as-reference.md` (generated)
- `docs/rules/prefer-now-include.md` (generated)
- `docs/rules/require-fluent-id.md` (generated)
- `README.md` (generated sections only)
- `CHANGELOG.md`

**Out of scope** (do not touch):

- `plans/README.md` and every other plan.
- `docs/pr-51-stack.json` and plan 006 tracking documents. Read and validate
  them during preflight, but do not edit them.
- GlideRecord, JavaScript-engine, rule-placement, directive-placement, Now.ID,
  release-publication, benchmark, and compatibility-host implementation.
- `.github/workflows/release.yml`, `scripts/check-release-artifact.mjs`,
  `scripts/verify-published-package.mjs`, `scripts/create-github-release.mjs`,
  `tests/release/`, `docs/release.md`, and release-governance JSON. These are
  privileged release-layer files owned by another stack layer.
- Adding new Fluent APIs based only on examples or documentation prose.
- Cross-package or TypeScript path-alias resolution. This plan follows only
  relative project barrels and the published `@servicenow/sdk/core` barrel.
- Cross-file duplicate `$id` validation. The project resolver establishes
  import provenance only.
- Automatically updating the reviewed snapshot on a schedule. Scheduled CI
  reports drift; a reviewed pull request updates the snapshot.

## Git workflow

Plan 006 creates the branch and nonempty draft pull request before this work
starts. Do not create or rename a branch or pull request.

1. Read plan 010's record in `docs/pr-51-stack.json`. It must name
   `pr51-remediation/010-fluent-sdk-registry` as the head branch. Read its
   expected base branch, reconstruction commit, owned paths or hunks, and
   rollback rule. The manifest must not contain a mutable current head SHA.
2. Run the read-only ownership validator documented beside that manifest.
   Confirm that every in-scope file or hunk belongs to plan 010. A newly
   created path must also have explicit plan-010 ownership.
3. Run `git fetch --prune origin` and `gh stack view --json`. Find the existing
   plan-010 stack entry and pull request. Its head and base branch names must
   match the manifest.
4. Run
   `gh pr view <PR-number> --json body,isDraft,state,url,headRefName,baseRefName,headRefOid,statusCheckRollup`.
   Read the full base and head SHAs and check-run URL recorded in the PR body.
   Run `gh run list --branch <head-branch> --commit <body-head-SHA> --json headSha,status,conclusion,url`.
   Require the live remote head, `headRefOid`, the body head SHA, and the current
   check-run `headSha` to agree. Require the remote base head to equal the body
   base SHA. Require the pull request to be open and draft.
5. Check out the existing remote head branch. Run `git branch --show-current`,
   `git rev-parse HEAD`, and
   `git merge-base --is-ancestor <reconstruction-commit> HEAD`. Expected: the
   manifest head branch, the verified live remote head, and exit 0.

STOP on any missing record, ownership mismatch, topology mismatch, PR-body
mismatch, remote-ref mismatch, or check-run mismatch. Do not repair the stack,
PR body, or manifest here. Commit after each green logical step within the
existing Fluent-layer branch. Use Conventional Commit subjects such as
`fix: audit Fluent SDK declarations` and `test: cover Fluent project barrels`.
Do not push or mutate the pull request unless the operator requests it and plan
006 permits it.

## Steps

### Step 1: Add a reproducible npm declaration auditor

Create `scripts/audit-fluent-sdk.mjs`. Add these `package.json` commands:

```json
{
  "manifest:update": "tsx scripts/audit-fluent-sdk.mjs --update",
  "manifest:drift": "tsx scripts/audit-fluent-sdk.mjs --registry",
  "test:fluent": "node scripts/run-tests.mjs tests/fluent-manifest.test.ts tests/rules/fluent-identity.test.ts tests/integration/packed-consumer.test.ts"
}
```

Keep `manifest:check` offline and deterministic. `npm run validate` must not
need registry access.

The auditor must:

1. Fetch JSON metadata directly from `https://registry.npmjs.org` through its
   HTTPS API. Do not use a configured mirror, and never read or print npm credentials.
2. Enumerate every published stable `@servicenow/sdk` version from `3.0.0`
   through the reviewed default, including every patch and every intervening
   minor. At the observed registry state this includes `3.0.1`-`3.0.3`,
   `4.0.1`, `4.0.2`, `4.1.1`, `4.8.1`, `4.9.0`-`4.9.2`, and `4.10.1`; do not
   reduce support to the old five boundary labels.
3. Require the same exact version of `@servicenow/sdk-core` to be published and
   pinned by the SDK package. Reject a missing or mismatched pair.
4. Download each tarball to a temporary directory. Verify its bytes against
   npm `dist.integrity` before extraction. Reject redirects outside HTTPS,
   unsafe tar paths, symlinks that escape extraction, duplicate paths, missing
   `package.json`, and a package name/version mismatch.
5. Read the SDK package's `exports["./core"]`, then parse that target and all
   transitively re-exported declaration/source barrels in the paired core
   package. Use `oxc-parser` rather than regular expressions. Move
   `oxc-parser` from `devDependencies` to `dependencies` because the packed
   plugin will also use it for project barrels.
6. Produce a normalized, sorted inventory of public named exports and their
   owning public module. Record both presence and absence for the complete set
   of Fluent factory names known to the plugin. Record alias ownership and
   namespace exports. An API is authoritative only when it is reachable from
   the SDK-facing `@servicenow/sdk/core` barrel.
7. Record the SDK and core package names, exact versions, publication times,
   tarball URLs, npm integrity values, resolved declaration entry paths,
   normalized declaration inventory hashes, positive capability set, negative
   capability set, and ID-policy evidence path.
8. Generate `src/fluent/declaration-snapshots.ts` for runtime use and
   `tests/fixtures/fluent-sdk-declarations.json` for review detail. Make output
   byte-stable. `--update` writes; default/check mode compares without writing;
   `--registry` downloads current data and reports new versions or changed
   bytes without changing files.

Do not silently make npm `latest` the default. The generated registry must have
one explicit `default: true` reviewed entry. `4.11.0` may remain that entry only
if the recheck proves both packages are published, the exact dependency pair
matches, and both declaration snapshots pass. If that is not true, STOP rather
than falling back or preserving the label.

**Verify**:

```bash
npm ci
npm view @servicenow/sdk versions time dist-tags --json --registry=https://registry.npmjs.org >/tmp/servicenow-sdk-metadata.json
npm view @servicenow/sdk-core versions time dist-tags --json --registry=https://registry.npmjs.org >/tmp/servicenow-sdk-core-metadata.json
npm run manifest:update -- --all
npm run manifest:check
npm run manifest:drift
```

Expected: every command exits 0. The two `/tmp` files contain valid JSON. The
snapshot includes `4.10.1`; it includes `4.11.0` only after its observed
integrities are independently reproduced. A second
`npm run manifest:update -- --all` produces no diff.

### Step 2: Select exact published patches from audited capability ranges

Replace `INTRODUCED`-based synthesis in `src/fluent/registry.ts` with registry
entries generated from the audited declaration inventories. The public setting
remains an exact semver. Every published stable patch in the reviewed support
window must resolve. Do not accept an arbitrary version merely because it falls
inside a numeric interval.

Represent equal adjacent inventories as reviewed ranges for documentation and
maintenance, but retain the exact published-version allowlist at runtime. A
patch such as `4.10.1` must select its audited inventory. An unpublished value
such as a future patch must fail closed even when it lies between range bounds.
Use a real semver dependency only if required; do not extend the existing
home-grown tuple parser to prereleases or ranges.

Build each `FluentSdkManifest` from the audited positive and negative sets:

- Ownership is the SDK-facing public module, normally
  `@servicenow/sdk/core`, not an internal `sdk-core` path.
- A missing export is absent, not a known factory.
- A symbol exported by another SDK module is not owned by `core`.
- Unknown ID policy remains `unknown` and suppresses semantic ID diagnostics.
- Additions, removals, renames, and ownership changes appear as explicit
  transitions between audited exact versions.

Keep `DEFAULT_FLUENT_MANIFEST` only as shared directive/manual policy data, not
as the superset from which historical factory sets are inferred. Rename
`CURRENT_FLUENT_SDK_VERSION` if necessary to `DEFAULT_FLUENT_SDK_VERSION` so its
meaning is "reviewed default", not "whatever npm latest is". Preserve a
compatibility export only if public API review shows it is already released.

Update `src/fluent/index.ts`, `tests/fluent-manifest.test.ts`,
`tests/fixtures/fluent-manifest-current.json`, and
`scripts/check-fluent-manifest.mjs`. The offline checker must assert:

- every supported exact version has verified SDK and core integrity;
- the default is one supported audited version;
- complete present and absent sets are disjoint and cover the capability
  universe;
- ownership matches public barrel reachability;
- every transition has declarations on both sides;
- every documented range expands to exact published versions;
- `4.10.1` resolves;
- unsupported and unpublished versions fail closed;
- generated files match their source fixture.

Delete `tests/fixtures/fluent-sdk-boundaries.json` after the stronger fixture is
active.

**Verify**: `npm run manifest:check && npm run test:fluent` -> exit 0. Tests
prove exact patches, an intervening minor, `4.10.1`, the reviewed default,
unsupported versions, positive ownership, negative ownership, export presence,
and export absence.

### Step 3: Separate Australia and Zurich source-release policy from SDK policy

Add `"australia"` and retain `"zurich"` in
`SUPPORTED_SERVICENOW_RELEASES`. In `src/fluent/manifest.ts`, model platform
release evidence separately from npm declaration evidence. Use distinct names,
types, and documentation fields, such as `serviceNowReleases` and
`sdkVersions`. Do not use one generic `version` field for both meanings.

Apply this policy in `src/settings/validate.ts` and the Fluent manifest resolver:

- `settings.servicenow.release` selects ServiceNow source/documentation
  capability policy only.
- `settings.servicenow.fluentSdkVersion` selects an exact audited npm SDK
  declaration set only.
- Neither setting supplies a default for the other.
- With no `release`, declaration-backed SDK ownership still works, but a rule
  must not claim release-specific availability.
- With a release, use only capabilities proven for that release. A capability
  whose release availability is not proven remains unknown and semantic rules
  stay silent.
- When both settings exist, intersect the independent evidence. Do not assume a
  numeric SDK-to-release mapping.

Record authoritative, release-specific ServiceNow URLs for Australia and
Zurich in `docs/fluent-sdk.md`. Do not reuse a moving unversioned URL as proof
for both. If an official source cannot prove a release-specific capability,
mark it unknown rather than copying the other release.

Update the setting comments in `src/types.ts`, the generated compatibility
source in `scripts/compat-matrix.json` and
`scripts/generate-compatibility-docs.mjs`, `src/catalog-metadata.ts`, and the
Unreleased changelog. Run `npm run docs`; do not hand-edit generated tables.

**Verify**: `npm run test:fluent && npm run docs:check` -> exit 0. Tests cover
Australia alone, Zurich alone, each with an SDK version, SDK-only selection,
release-only selection, invalid release names, and invalid SDK patches. A test
must prove that changing `release` never changes the selected SDK version.

### Step 4: Make mutable aliases temporal, including namespace aliases

Refactor `src/analysis/fluent-imports.ts` so factory provenance is a value at a
program point, not a declaration-wide Boolean. Track this small lattice for each
lexical binding:

- one proven SDK named export;
- one proven SDK namespace;
- proven non-SDK/local;
- unknown after conflicting path joins or unsupported writes.

Initialization and simple `=` assignment update the value after the right-hand
side evaluates. Branches retain provenance only when all reachable paths agree.
Loops, closures, destructuring, compound assignments, updates, escape, or a
write that cannot be proved produce unknown. Preserve lexical binding IDs and
shadowing. Do not infer by spelling.

Apply the same program-point check to identifiers and to the receiver of a
member call. Cover at least:

- `let BR = BusinessRule; BR(...)` before and after local reassignment;
- local value first, SDK factory later;
- `let ns = sdk; ns.BusinessRule(...)` before and after reassignment;
- namespace alias chains;
- conditional same-origin and conflicting-origin assignments;
- nested shadowed aliases;
- comments, strings, object keys, and unrelated local members.

If this requires a reusable path-state service, keep the Fluent origin lattice
inside the new project/factory analysis. Do not weaken unrelated protocol
analysis or add another spelling-based whole-file scan.

**Verify**: `npm run test:fluent` -> exit 0. The reproduced reassigned namespace
case has no Fluent semantic diagnostic after the reassignment, while its call
before reassignment still receives `require-fluent-id`.

### Step 5: Resolve relative project barrels conservatively

Create `src/analysis/fluent-project.ts` and connect it through
`src/analysis/file-analysis.ts`, `src/analysis/fluent-imports.ts`, and
`src/rules/fluent-proper-imports.ts`. Parse local modules with the runtime
`oxc-parser` dependency.

The resolver must start from the real current filename supplied by the host and
follow only relative specifiers. Support these forms through multiple barrels:

```ts
export { BusinessRule } from "@servicenow/sdk/core";
export { BusinessRule as BR } from "@servicenow/sdk/core";
export * from "@servicenow/sdk/core";
export * as core from "@servicenow/sdk/core";
import { BusinessRule } from "@servicenow/sdk/core";
export { BusinessRule };
```

Resolve exact files, supported JS/TS extensions, and `index` files in a fixed,
documented order. Reject ambiguous candidates. Track exported-name identity and
namespace identity through every edge. Detect cycles. Bound recursion and file
size. Cache only by canonical path plus content/mtime identity so edits cannot
reuse stale facts. Never follow bare packages other than the authoritative SDK
module, `node_modules`, symlinks outside the project root, `tsconfig` aliases,
or dynamic imports. A missing file, parse error, ambiguous star export,
conflicting re-export, or unsupported syntax produces unknown and suppresses
semantic diagnostics.

A project barrel proven to re-export a core factory is authoritative for
semantic rules. `fluent-proper-imports` must not report `wrongModule` for it.
A barrel that exports a local same-named function or re-exports the name from a
different package remains non-authoritative.

Keep the normal single-file fast path free of filesystem reads when it imports
`@servicenow/sdk/core` directly. Do not claim cross-file support when the host
provides a virtual or missing filename; stay conservative.

**Verify**: `npm run typecheck && npm run test:fluent` -> exit 0. Unit tests
cover direct, renamed, star, namespace, chained, cyclic, ambiguous, missing,
local, wrong-package, parse-error, traversal, and symlink-escape cases.

### Step 6: Prove the packed plugin in real multi-file consumer projects

Extend `tests/integration/packed-consumer.test.ts`. In its temporary packed
consumer, write at least these files:

```text
src/sdk.ts                 direct named and namespace re-exports
src/domain/index.ts        second project barrel
src/rules/missing.now.ts   imports through the second barrel; missing $id
src/rules/local.now.ts     imports a local same-named factory; no SDK diagnostic
src/rules/namespace.now.ts imports a namespace re-export; missing $id
```

Install the exact packed plugin tarball. Run real Oxlint and real ESLint over the
project, not the internal `applyRules` helper. Assert exact filenames, rule IDs,
and counts. Prove:

- the two-hop named barrel gets `require-fluent-id` and no
  `fluent-proper-imports/wrongModule`;
- the namespace barrel gets the same semantic treatment;
- the local same-named export stays silent;
- direct imports still work;
- an unsupported SDK setting is a configuration error;
- the consumer can import any newly public registry types/values from the
  package root after packing.

Keep temporary project cleanup in `finally`. Do not replace the existing typed
`.now.ts` and `.now.tsx` packed coverage.

**Verify**: `npm run build && npm run test:fluent` -> exit 0. The output reports
all packed-consumer tests passing under both hosts.

### Step 7: Add a scheduled upstream drift check and finish validation

If Plan 006 permits a new non-privileged workflow in the Fluent layer, create
`.github/workflows/fluent-sdk-drift.yml` with:

- `schedule` once per week and `workflow_dispatch`;
- read-only `contents` permission;
- pinned checkout and setup-node action SHAs already approved in `ci.yml`;
- Node 24 and `npm ci`;
- `npm run manifest:drift`;
- no npm token, no repository write, no automatic snapshot commit, and no
  untrusted script from downloaded SDK packages.

The drift command must fail with a concise report when:

- npm publishes a new stable SDK version;
- a dist-tag changes away from the reviewed default;
- recorded metadata or integrity differs;
- the exact SDK/core pairing changes;
- public core exports are added, removed, renamed, or move ownership;
- ID-policy declarations change.

If Plan 006 does not permit this workflow in the Fluent layer, STOP and report
instead of moving the check into the privileged release workflow.

A dist-tag move is a review signal only. It must not change local runtime
behavior. Document the maintenance procedure in `docs/fluent-sdk.md`: inspect
the diff, verify official Australia/Zurich evidence independently, run
`npm run manifest:update -- --all`, review presence and absence changes, run
all gates, and merge the generated snapshot through a normal pull request.

Update `CHANGELOG.md`, run generation, and run the full gate.

**Verify**:

```bash
npm run workflow:check
npm run manifest:check
npm run manifest:drift
npm run docs:check
npm run validate
```

Expected: every command exits 0. `git status --short` lists only in-scope files.
The workflow has no write permission and no secret reference.

## Test plan

Add these test groups:

- `tests/fluent-manifest.test.ts`
  - exact supported published version enumeration;
  - patch and intervening-minor selection, including `4.10.1`;
  - reviewed default selection without consulting `latest` at runtime;
  - SDK/core exact-version and integrity pairing;
  - complete positive and negative capability partition;
  - ownership changes, additions, removals, and unknown ID policy;
  - Australia/Zurich independence from SDK selection;
  - unsupported, unpublished, prerelease, malformed, and future versions.
- `tests/rules/fluent-identity.test.ts`
  - temporal named aliases in both reassignment directions;
  - temporal namespace aliases before and after reassignment;
  - same and conflicting path joins;
  - namespace alias chains and shadowing;
  - present, absent, wrong-owner, and unknown factories.
- `tests/integration/packed-consumer.test.ts`
  - two-hop named barrel in real Oxlint and ESLint;
  - namespace barrel in both hosts;
  - local and wrong-package negative controls;
  - exact packed public exports.
- `scripts/audit-fluent-sdk.mjs` behavior through
  `tests/fluent-manifest.test.ts`
  - corrupt integrity;
  - mismatched package name/version;
  - unsafe tar path/symlink;
  - SDK/core version mismatch;
  - declaration parse failure;
  - deterministic generation;
  - network drift detected without file writes.

Use existing `tests/rules/fluent-identity.test.ts` as the single-file identity
pattern. Use `tests/integration/packed-consumer.test.ts:42-181` for temporary
packed consumers and real-host JSON parsing.

## Done criteria

All conditions must hold:

- [ ] `npm run manifest:check` exits 0 without network access.
- [ ] `npm run manifest:drift` exits 0 against the then-current npm registry.
- [ ] Every supported exact SDK version has paired SDK/core integrity and a
      declaration inventory.
- [ ] The registry supports actual published patches, including `4.10.1`, and
      rejects unpublished patches.
- [ ] The default is one explicitly reviewed published version. It never follows
      npm `latest` at runtime.
- [ ] Presence, absence, ownership, and ID-policy changes are machine-checked.
- [ ] Australia and Zurich source-release policy is independent from Fluent SDK
      version selection.
- [ ] Named and namespace mutable aliases are correct at each call program point.
- [ ] Two-hop named and namespace project barrels pass real packed Oxlint and
      ESLint consumer tests.
- [ ] Local, ambiguous, missing, and wrong-package barrels stay conservative.
- [ ] Weekly drift CI is read-only and uses no secret.
- [ ] `npm run docs:check` exits 0.
- [ ] `npm run validate` exits 0.
- [ ] `git status --short` contains no file outside Scope.
- [ ] `plans/README.md` is unchanged.

## STOP conditions

Stop and report. Do not improvise if:

- The plan-010 manifest topology or ownership is missing or mismatched. Also
  stop if the live remote head, PR body head/base SHAs, PR topology/state, or
  current check-run head disagree. Never add a mutable head SHA to the manifest.
- Current npm metadata differs from the 2026-08-20 observation before the first
  reviewed snapshot is generated.
- `4.11.0` is absent, its SDK/core package pairing differs, or either observed
  integrity cannot be reproduced. Do not claim it is unpublished and do not
  silently keep or replace the default.
- npm metadata lists a stable version in the support window whose tarball is
  missing, malformed, mutable, or paired with a different core version.
- The public `@servicenow/sdk/core` barrel cannot be resolved deterministically
  from published package declarations.
- Australia or Zurich release-specific capability evidence cannot be found.
  Marking unknown is allowed; copying evidence between releases is not.
- Project-barrel support would require executing project code, package lifecycle
  scripts, `tsconfig` plugins, or arbitrary package resolvers.
- Real Oxlint and ESLint disagree on the required named or namespace barrel
  behavior after two reasonable fixes.
- The resolver needs to follow outside the project root or cannot reject an
  ambiguous/cyclic graph conservatively.
- A verification fails twice after a reasonable fix.
- The work requires a file outside Scope.

## Maintenance notes

- The committed snapshot is reviewed data, not a mirror of npm `latest`.
  Scheduled drift must fail until a pull request updates it.
- Review both additions and removals. A new SDK export must not automatically
  become an ID-enforced factory.
- Keep SDK package integrity and core dependency integrity together. The public
  import is `@servicenow/sdk/core`, while implementation declarations can come
  from the exact paired `@servicenow/sdk-core` package.
- Keep platform source releases and SDK versions distinct in types, generated
  docs, tests, and diagnostic wording.
- Scrutinize filesystem boundaries, symlink handling, cache invalidation,
  ambiguous star exports, and parser failures in the project resolver.
- Do not broaden the resolver to package aliases or cross-file `$id` analysis
  without a separate design and threat review.
