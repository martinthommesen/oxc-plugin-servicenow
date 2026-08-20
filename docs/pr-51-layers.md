# PR #51 review groupings and readiness gates

PR #51 is a tracking pull request and must not merge as a roll-up. The seven domain layers below are historical grouping labels. Ordered commits and labels are not separate pull requests, review boundaries, or rollback boundaries. Issue #75 remains **Pending** until actual dependent pull requests provide those boundaries.

Readiness terms have these meanings:

- **Pending**: no current proof exists at the owning pull request head.
- **Verified-at-head**: focused proof passed at the exact recorded head.
- **Merge-ready**: all in-repository gates and governance checks passed at the current merge commit.
- **Live-pending**: only a protected post-merge tag, registry, or GitHub action can supply the proof.
- **Release-verified**: the stable protected-tag run supplied exact live evidence.

## Merge gate

Evaluate current code and configuration at the exact pull request head or merge commit. Require applicable clean-checkout tests, real Oxlint and ESLint hosts, inspected-artifact checks, review, and executable governance checks. A pull request can become **Merge-ready** without a stable tag.

## Release gate

Start release verification only after the reviewed stack merges to protected `main`. Require a controlled protected tag, approved OpenID Connect (OIDC) publication, registry integrity and exact provenance identity, public imports, and the GitHub release. These results remain **Live-pending** until the stable protected-tag run supplies them. Only then is the release **Release-verified**.

## Actual pull request stack

Plans 007–015 use these review and rollback boundaries. Each reconstruction commit is an immutable archived slice. Its archive ref does not change when a live branch rebases.

| Plan | Head branch | Base branch | Reconstruction commit |
| --- | --- | --- | --- |
| 007 | `pr51-remediation/007-path-state` | `main` | `ab3a8956cd7206cd5d91188cd9c0ad09e3d0fb2c` |
| 008 | `pr51-remediation/008-bindings-scopes` | `pr51-remediation/007-path-state` | `c93bce33629e115a81c5cdad2f54634c89dd3994` |
| 009 | `pr51-remediation/009-stateful-rule-lifecycles` | `pr51-remediation/008-bindings-scopes` | `7ff60b0db984fb300ada186d2ae0682de824f9e6` |
| 010 | `pr51-remediation/010-fluent-sdk-registry` | `pr51-remediation/009-stateful-rule-lifecycles` | `1e32744c3358eeb3b32aa2c3e2dd7d18da586646` |
| 011 | `pr51-remediation/011-now-id-directives` | `pr51-remediation/010-fluent-sdk-registry` | `c31ed1946db26088b88940cbedf1925119676ef7` |
| 012 | `pr51-remediation/012-context-profiles-contracts` | `pr51-remediation/011-now-id-directives` | `0eb37f1a5450c574dd787872c4cd0873aead58ac` |
| 013 | `pr51-remediation/013-public-api-assets` | `pr51-remediation/012-context-profiles-contracts` | `8e8ec7e3d6b46b179216c7fca72b4cd90d3dbbaa` |
| 014 | `pr51-remediation/014-tests-evidence-compat` | `pr51-remediation/013-public-api-assets` | `91bfcdebfac8a99287d7ab9e703023e3f9660bba` |
| 015 | `pr51-remediation/015-release-governance` | `pr51-remediation/014-tests-evidence-compat` | `893f6c13e3636c9d354cf01518b0f40a66e7c5bd` |

`docs/pr-51-stack.json` assigns all 368 archived paths to one whole-file owner or one explicit nonoverlapping split. Four paths have split reconstruction ownership: `.github/workflows/ci.yml`, `package.json`, `package-lock.json`, and `scripts/action-pins.json`.

A dependency baseline can appear below the plan that owns its later semantic remediation. The manifest records the original reconstruction commit, not a mutable live head. Live pull request URLs, base and head commits, states, and check runs belong in pull request bodies and the PR #51 tracking body.

## Validate the ownership manifest

To validate the archived path set, reconstruction slices, immutable refs, and privileged-file isolation, run:

```bash
node --input-type=module <<'NODE'
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
const manifest = JSON.parse(readFileSync("docs/pr-51-stack.json", "utf8"));
const sorted = (values) => [...values].sort();
const equal = (left, right) => JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));
const fail = (message) => { throw new Error(message); };
const owners = (entry) => entry.ownership === "split"
  ? entry.splits.map((split) => split.ownerPlan)
  : [entry.ownerPlan];

const archived = git("diff", "--name-only", `${manifest.mergeBase}...${manifest.archivedHead}`)
  .trim().split("\n").filter(Boolean);
const recorded = manifest.paths.map(({ path }) => path);
if (new Set(recorded).size !== recorded.length) fail("duplicate path ownership");
if (!equal(archived, recorded)) fail("manifest path set differs from archived three-dot diff");

const validPlans = new Set(manifest.plans.map(({ plan }) => plan));
if (!equal(validPlans, [7, 8, 9, 10, 11, 12, 13, 14, 15])) fail("invalid plan set");
for (const entry of manifest.paths) {
  const entryOwners = owners(entry);
  if (!entryOwners.length || new Set(entryOwners).size !== entryOwners.length) fail(`invalid owners for ${entry.path}`);
  if (entryOwners.some((owner) => !validPlans.has(owner))) fail(`unknown owner for ${entry.path}`);
  const archivedBlob = git("rev-parse", `${manifest.archivedHead}:${entry.path}`).trim();
  if (archivedBlob !== entry.archivedBlob) fail(`archived blob mismatch for ${entry.path}`);
  if (entry.ownership === "whole-file") {
    const plan = manifest.plans.find((candidate) => candidate.plan === entry.ownerPlan);
    const result = git("rev-parse", `${plan.reconstructionCommit}:${entry.path}`).trim();
    if (result !== entry.archivedBlob) fail(`whole-file result mismatch for ${entry.path}`);
  } else {
    if (entry.splits.length < 2) fail(`split has fewer than two owners: ${entry.path}`);
    for (const split of entry.splits) {
      const plan = manifest.plans.find((candidate) => candidate.plan === split.ownerPlan);
      const patch = git("diff", "--binary", plan.reconstructionParent, plan.reconstructionCommit, "--", entry.path);
      const digest = createHash("sha256").update(patch).digest("hex");
      if (digest !== split.patchSha256) fail(`split digest mismatch for ${entry.path} Plan ${split.ownerPlan}`);
      const result = git("rev-parse", `${plan.reconstructionCommit}:${entry.path}`).trim();
      if (result !== split.resultBlob) fail(`split result mismatch for ${entry.path} Plan ${split.ownerPlan}`);
    }
    if (entry.splits.at(-1).resultBlob !== entry.archivedBlob) fail(`split does not reconstruct archived blob: ${entry.path}`);
  }
}

for (const plan of manifest.plans) {
  const remote = git("ls-remote", "origin", plan.reconstructionRef).trim().split(/\s+/)[0];
  if (remote !== plan.reconstructionCommit) fail(`archive ref mismatch for Plan ${plan.plan}`);
  const actual = git("diff", "--name-only", plan.reconstructionParent, plan.reconstructionCommit)
    .trim().split("\n").filter(Boolean);
  const expected = manifest.paths.filter((entry) => owners(entry).includes(plan.plan)).map(({ path }) => path);
  if (!equal(actual, expected)) fail(`reconstruction path mismatch for Plan ${plan.plan}`);
  const patch = git("diff", "--binary", plan.reconstructionParent, plan.reconstructionCommit);
  const digest = createHash("sha256").update(patch).digest("hex");
  if (digest !== plan.reconstructionPatchSha256) fail(`reconstruction digest mismatch for Plan ${plan.plan}`);
}

const archivedPatch = git("diff", "--binary", `${manifest.mergeBase}...${manifest.archivedHead}`);
if (createHash("sha256").update(archivedPatch).digest("hex") !== manifest.archivedPatchSha256) {
  fail("archived patch digest mismatch");
}

const privileged = /^(\.github\/workflows\/release\.yml|scripts\/(check-release-artifact|check-trusted-publishing-npm|create-github-release|verify-published-package)\.|scripts\/release-governance\.json|tests\/release\/|docs\/release\.md$|docs\/release-governance-live\.json$)/;
for (const entry of manifest.paths.filter(({ path }) => privileged.test(path))) {
  if (owners(entry).some((owner) => owner !== 15)) fail(`privileged path outside Plan 015: ${entry.path}`);
}

const forbidden = new Set(["currentHead", "headSha", "pullRequestUrl", "statusCheckRollup", "checkRuns"]);
const walk = (value) => {
  if (Array.isArray(value)) return value.forEach(walk);
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (forbidden.has(key)) fail(`mutable field in manifest: ${key}`);
    walk(child);
  }
};
walk(manifest);
console.log(`validated ${recorded.length} archived paths across ${manifest.plans.length} reconstruction commits`);
NODE
```

Expected output: `validated 368 archived paths across 9 reconstruction commits`.

## Historical dependency graph

```
1 Context, settings, catalog
        ↓
2 Binding, object identity, provenance, control flow
        ↓
3 Stateful classic rules
        ↓
4 Fluent version and binding identity
        ↓
5 Generated documentation and evidence
        ↓
6 Packed compatibility and real benchmarks
        ↓
7 Release provenance (privileged workflows only)
```

Each grouping names its expected tests and contracts. It does not prove that a separate pull request exists. Later work consumes earlier contracts and must not reintroduce name-keyed analysis.

## Layer 1 — Context, settings, and catalog foundation

**Owns:** `src/settings/`, `src/context/`, `src/catalog.ts`, `src/options/`, `src/types.ts`, filename classification, `ServiceNowSettingsError`.

**Contract:** Unknown context stays unknown. Contradictory settings throw. Shared defaults are deeply immutable. Rule options parse from one descriptor.

**Rollback:** Revert settings/context/catalog commits. Do not keep rules that depend on the new settings object.

## Layer 2 — Lexical binding, object identity, provenance, and control flow

**Owns:** `src/analysis/file-analysis.ts`, `src/analysis/path-state.ts`, `src/analysis/bindings.ts`, `src/analysis/provenance.ts`.

**Contract:** Binding identity is not object identity. Joins intersect must-facts and union risk. Abrupt completion does not flow into later statements. Analysis runs once per source file.

**Rollback:** Revert analysis commits and any later rule that calls `analyzePathBindings`.

## Layer 3 — Stateful classic rules

**Owns:** query-before-next, GlideAggregate, bulk filters, GlideAjax params, setNoCount epochs, query-in-loop, GlideRecord manifest.

**Tests:** `tests/rules/stateful-lifecycle.test.ts` and host fixtures under `tests/integration/profiles/`.

## Layer 4 — Fluent version manifests and binding-aware Fluent rules

**Owns:** `src/fluent/registry.ts`, `src/analysis/fluent-imports.ts`, `src/analysis/now-id.ts`, Fluent rules.

**Tests:** `tests/rules/fluent-identity.test.ts`, typed packed-consumer Fluent lint.

## Layer 5 — Generated documentation and evidence

**Owns:** `src/catalog-metadata.ts`, `scripts/generate-rule-docs.mjs`, `scripts/check-catalog-docs.mjs`, `docs/rules/`.

**Contract:** Generated pages stay in the same change as their descriptors.

## Layer 6 — Packed compatibility matrix and real benchmarks

**Owns:** `scripts/compat-matrix.json`, `scripts/compat-consumer.mjs`, `scripts/benchmark.mjs`, `docs/compatibility.md`, `docs/performance-baseline.json`, CI `compat` and `bench` jobs.

**Does not own:** npm publish permissions.

## Layer 7 — Release provenance

**Owns:** `.github/workflows/release.yml`, `scripts/check-release-artifact.mjs`, `scripts/verify-published-package.mjs`, `docs/release.md`, `tests/release/`.

**Contract:** Validation is read-only. One inspected tarball is the consumer-test input and the `npm publish` argument. Tag ancestry is verified from `main`. Publish uses OIDC trusted publishing and `--ignore-scripts`. Review this layer separately from rule and analysis changes.

## File assignment

| Path prefix | Layer |
| --- | --- |
| `src/settings/`, `src/options/`, `src/context/`, `src/types.ts` | 1 |
| `src/analysis/` | 2 |
| `src/rules/` classic stateful + `src/glide/` | 3 |
| `src/fluent/`, Fluent rules, `src/analysis/now-id.ts`, `src/analysis/fluent-imports.ts` | 4 |
| `src/catalog.ts`, `src/catalog-metadata.ts`, `docs/rules/`, `scripts/generate-rule-docs.mjs`, `scripts/check-catalog-docs.mjs` | 5 |
| `scripts/compat-*.mjs`, `scripts/compat-matrix.json`, `scripts/benchmark.mjs`, `tests/integration/packed-consumer.test.ts`, `tests/perf/` | 6 |
| `.github/workflows/release.yml`, `scripts/check-release-artifact.mjs`, `scripts/verify-published-package.mjs`, `docs/release.md`, `tests/release/` | 7 |

Shared tests that span layers stay with the highest layer they prove.

## Required rollback boundaries

These desired boundaries remain **Pending** until actual dependent pull requests implement them:

- A correctness defect in layer 2 invalidates layers 3–6 until the foundation is fixed.
- A documentation-only defect stays in layer 5.
- A release-workflow defect stays in layer 7 and must not ship with unreviewed analysis changes.
