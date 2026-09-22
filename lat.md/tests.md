---
lat:
  require-code-mention: true
---

Test specifications for the properties in [[invariants]]. Each leaf names what it verifies and the test that verifies it; `lat check` fails when a leaf loses its backlink.

Unit rules run through the harness in `tests/helpers/rule-tester.ts`, which parses with `oxc-parser` and applies selected rules in process. Integration rules run the real `oxlint` binary and a real ESLint `Linter`, and are the only proof of production behavior — see `plans/001-real-host-integration-tests.md`.

## Silence on unknown facts

The plugin reports only from evidence it has. These specs cover the three ways that shows up: a declined file, an unresolved release, and an unproven binding.

### A declined file is not a passing file

`assertValidActive` proves the rule's gate admitted the file, and `assertSkipped` proves it declined. Asserting only "no diagnostics" would pass for a rule that silently stopped applying.

Every gate-sensitive case under `tests/rules` uses one of the two outcome-aware helpers: a deliberate skip (a client rule on a server filename, a Fluent file under a classic rule, an unknown mode) asserts `assertSkipped`, and a semantic negative asserts `assertValidActive`. Plain `assertValid` is reserved for cases whose contract is only "no diagnostics" (FINDINGS.md TST-004). Engine rules that must decline every non-server execution context use `assertDeclinesNonServerSurfaces`, which asserts the client, Fluent, and UI Action skips together.

### Surface classification holds under real hosts

The context fixtures drive filename, directory, and mutated-globals evidence through real oxlint and ESLint. Each case asserts an exact rule id, message id, and full message text.

### Release-dependent facts stay unknown

The same construct is tested with `release: "zurich"`, with `release: "australia"`, and with no release. The omitted case must not inherit either release's answer.

### Identity decisions follow the binding matrix

`BINDING_MATRIX_CASES` in `tests/helpers/binding-matrix.ts` drives each rule with direct use, alias, reassignment, shadowing, and computed member access, asserting the exact message id and source range.

## The catalog

`ruleCatalog` is the single registry, and its evidence must be checkable. These specs hold the registry closed and the evidence honest.

### The catalog is the only registry

No competing rule metadata, placement, or option registry may exist. Every catalogued rule must export an implementation and implement `createOnce`, and every structured limitation case must be executed.

### Every evidence record resolves

Each rule's evidence entries carry a unique verification id and must resolve to a release-pinned official URL citing a supported release or to an existing non-empty in-repo proof file.

### The export surface is exactly the supported API

The package exports named `servicenow`, `PACKAGE_VERSION` matches `package.json`, every catalogued rule is present, and every rule's documentation URL is pinned to the release tag rather than a branch.

### Declared applicability implies an implemented gate

Every rule whose catalog entry restricts surfaces or modes must call the corresponding gate helper in its implementation, so removing a gate fails the catalog check (FINDINGS.md COR-015).

### Gate agreement counts only executable calls

The gate collector parses the rule module and counts only `CallExpression` callees, so a helper named in a comment or a string literal cannot satisfy a declared restriction (FINDINGS.md TST-005).

### Client-surface gates name a client surface

A client-surface declaration whose only `appliesOnSurface` call names a non-client surface such as `"server"` must fail the agreement check (FINDINGS.md TST-005).

### A declared confidence floor is gated

A rule whose catalog entry claims a `minimumSurfaceConfidence` stronger than the `inferred` default must pass that exact value to every surface gate it calls; weakening the gate argument fails the agreement check.

### Rule files import analysis through the barrel

A rule module that imports `../analysis/<module>.js` for anything other than `internal.js` fails the agreement check, so the analysis barrel stays the only entry point rules can reach (docs/decisions.md MNT-006).

### Every rule map has a flat counterpart

Each preset rule map must have a `configs.flat` entry carrying the same rules object with the plugin attached, so the ESLint flat presets cannot drift from the oxlint maps (FINDINGS.md FEAT-003).

## State and settings

State can outlive its file in two places, and must not. Both were the subject of real defects.

### Rule state does not leak across files

One rule instance processed across several files must not carry bindings or counters from an earlier file. This is the FINDINGS.md COR-011 regression guard.

### Validated settings are deeply frozen

Freezing must survive cyclic objects, and the shared empty default must never be mutable or shared between two contexts. Keys, defaults, parsing, freezing, and fingerprints all derive from one descriptor.

## Context evidence

A file's surface may come from its name or from its directory, and the two must not conflict. These specs fix the order.

### Filename classification is deterministic

Filename and directory evidence must resolve in a fixed order: UI Actions before client heuristics, specific subtypes over generic server directories, project-bounded directory evidence, and a refusal to guess when evidence conflicts.

### Explicit server naming survives for UI Actions

`approve.server.ui-action.js` and a UI Action under a project-relative `server/` directory resolve to both `ui-action` and `server` at `filename` confidence; explicit `settings.surfaces` still wins and bare UI Actions stay bare (FINDINGS.md COR-017).

### Engine rules run on server-named UI Actions

A mode-gated engine rule such as `no-promise` must report on `approve.server.ui-action.js` in ES5 mode and stay silent on a bare `approve.ui-action.js`; the real-host context fixtures carry the same case (FINDINGS.md COR-017).

### Surface vocabulary has one authored home

The client set and the server-only set must partition all eight surfaces. `ui-action` must remain in both the client-capable and server-capable sets because its execution side varies.

## Analysis behavior

The shared analysis layer carries scaling invariants alongside its facts. Adversarial rule fixtures also pin bounded guard, reference, sibling, mutation-alias, and platform-call analysis.

### Alias resolution scales linearly

Quadrupling aliases and call sites must stay well below quadratic time, proving alias resolution queries the per-file write index instead of re-walking the program (FINDINGS.md PER-005).

### Counter analysis scales linearly

Quadrupling counted cursor loops with post-loop counter writes must stay well below quadratic time while `pathBudgetExhausted` stays false, so an exhausted run can never pass as scaling evidence (FINDINGS.md PER-005).

The measured growth is about n^1.5 against a 9x budget for 4x input, so the guard proves sub-quadratic rather than strictly linear scaling.

### Nested cursor loops stay linear

Deeply nested `do`/`while` cursor loops must complete without exponential re-traversal, proving the cursor walkers memoize each (node, cursor-state) pair instead of revisiting a body once per mode (FINDINGS.md PER-002).

### The path budget grows with the program

An ordinary script must be analyzed completely: the budget scales with program size, so a longer file keeps producing findings instead of silently dropping them once a fixed work budget is spent (FINDINGS.md PER-003).

### Constant logical operands select the reachable branch

A query in the necessarily evaluated operand of a constant `&&`, `||`, or `??` counts as definite, a call in the skipped operand is never reported, and an unknown or interpolated operand keeps the join (FINDINGS.md COR-003).

### Alias writes resolve identically on every offset shape

A range-only host must resolve a rebound Fluent alias exactly like an offset host in both write directions, and a host with no offsets must suppress the alias fact rather than choose the first initializer (FINDINGS.md COR-007).

### Initialized var redeclarations are alias writes

`var T = A; var T = B;` resolves to `B` in both directions, a bare `var T;` changes nothing, and conditional or function-boundary redeclarations stay uncertain (FINDINGS.md COR-009).

## Scripts and tooling

The repository's own tooling carries invariants separate from the plugin's behavior.

### Scripts are checked JavaScript with no separate declarations

JSDoc-typed `scripts/*.mjs` is the single source of truth: `tsconfig.scripts.json` runs `checkJs` in the validate chain and no `scripts/*.d.mts` may exist (FINDINGS.md MNT-005).

### Benchmark output records the measured source state

A benchmark summary carries `sourceState`, and a dirty worktree lists the differing `dirtyFiles`, so a clean checkout and a modified one at the same HEAD produce distinguishable metadata (FINDINGS.md DX-001).

### Benchmark outputs never mark their own run dirty

The run's output path and the reviewed baseline path are excluded from the porcelain scan, and untracked files count only under source, script, test, and manifest paths (FINDINGS.md DX-001).

### Source state is required for new runs and tolerated in old baselines

`validateBenchmarkSummary` rejects a newly written summary without `sourceState` and accepts the reviewed baseline that predates the field, so older readers keep working (FINDINGS.md DX-001).

### Cleanup rejects symlinked artifact paths

Verifier cleanup must reject a symbolic link in the artifact root or selected run path and leave the linked target unchanged.

### Cloud tooling dependencies are locked

The Cloud Agent installs Bun at the exact version and integrity recorded in its committed npm lockfile before exposing the binary to the unprivileged user.

### Generated artifacts share one manifest

The documentation generators, the catalog checker, and `docs:check` must use one path list. README marker replacement must reject unregistered section names.

Both README formatter-guide links must use the generated repository reference, whose URL tracks the package release tag rather than a hand-written version.

### Test report queries use one clean-pass rule

A proof passes only when its `file::fullName` key occurs once and the outcome is a clean pass.

A clean pass has status `passed` without skip or todo. Summary counts use the same definition. Concurrent acceptance runs use different report paths and serialize their full build-and-test phase.

### Acceptance runs serialize across processes

Two acceptance verifiers started as separate Node processes must not overlap while they rebuild the shared `dist` tree; the child-process test proves the lock serializes them.

### Stale reclamation keeps one owner

Two processes that observe the same dead owner must not delete a replacement lock; the inter-process test holds one reclamation claim while the other waits.

### Publication does not expose an ownerless lock

A publisher paused before final publication must leave no visible lock, and it must not enter the protected operation after another process acquires the lock.

### Abandoned reclamation claims fail closed

If a process dies while holding a reclamation claim, a later verifier must time out without deleting the claim or the lock.

### Evidence captures use private reports and atomic artifacts

Evidence tests use unique temporary report directories, remove them after capture, and leave a complete JSON artifact after replacement.

## Release governance

Claims made about a release must be reconstructible from the repository, not asserted in prose.

### Every acceptance criterion maps to one proof

Each atomic requirement in the PR #51 acceptance ledger must map to exactly one proof entry bound to a content hash, with no missing, duplicate, changed, or orphaned mappings. Concurrent verifier runs must use different temporary report paths.

### Hosted jobs run every static gate

The CI `test` job and the release `validate` job must both invoke `typecheck`, `typecheck:fixtures`, and `typecheck:scripts`, so a script-body type error cannot pass hosted validation while failing the local chain (FINDINGS.md TST-006).

### The migration guide quotes the declared peer ranges

`docs/migration-3.0.md` must state the exact `oxlint` and `oxfmt` peer ranges from `package.json`, use an install example inside them, and link the compatibility table (FINDINGS.md DOC-006).

### Foreign package execution is isolated from release inputs

Registry-installed package code runs only after the release tarball is immutable and cannot provide an artifact to the npm publish or GitHub release jobs.

### Merging a version tags it exactly once

The tag script creates one tag at the exact `main` commit, defaults the version to `package.json`, and returns an existing tag without a push.

It refuses a version the changelog does not name before touching `main`.

### The tag workflow runs only through the controlled actor

The workflow runs on a push to `main` that changes `package.json` or `CHANGELOG.md`, with a read-only token, no dependency install, and the app token scoped to this repository.

### One command prepares a release pull request

`releaseChangelog` moves the `Unreleased` notes under a dated version heading, leaves `Unreleased` empty, and the result passes the release changelog check.

It refuses an empty `Unreleased` section, a heading the changelog already has, and a changelog without `Unreleased`. The repository changelog prepares cleanly for a hypothetical next version. `prepareRelease` sets the same version in `package.json` and both lockfile entries and rejects a repeated or non-SemVer version.

### The unattended release environment is audited as such

The authoritative policy names no environment reviewers, and the audit holds the live environment to that shape.

The audit accepts a live environment with no protection rules and reports drift when the live environment gains reviewers or a self-review setting.

## Fluent manifest

The SDK model has two trust boundaries: the reviewed API inventory, and the published artifact it was read from.

### The manifest matches the pinned fixture

The reviewed manifest must match `tests/fixtures/fluent-manifest-current.json`, carry evidence on every API and directive, require `$id` where the SDK requires it, and reject deleted lifecycle fields.

### The SDK tarball trust boundary holds

The audit script must accept only the exact npm registry artifact URL, cap declared, streamed, and decompressed byte counts, verify the pinned SHA-512 digest, and reject unsafe, duplicate, or linked tar entries.
