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

### Every rule map has a flat counterpart

Each preset rule map must have a `configs.flat` entry carrying the same rules object with the plugin attached, so the ESLint flat presets cannot drift from the oxlint maps (FINDINGS.md FEAT-003).

## State and settings

Two places where state outlives its file and must not. Both were the subject of real defects.

### Rule state does not leak across files

One rule instance processed across several files must not carry bindings or counters from an earlier file. This is the FINDINGS.md COR-011 regression guard.

### Validated settings are deeply frozen

Freezing must survive cyclic objects, and the shared empty default must never be mutable or shared between two contexts. Keys, defaults, parsing, freezing, and fingerprints all derive from one descriptor.

## Context evidence

A file's surface may come from its name or from its directory, and the two must not conflict. These specs fix the order.

### Filename classification is deterministic

Filename and directory evidence must resolve in a fixed order: UI Actions before client heuristics, specific subtypes over generic server directories, project-bounded directory evidence, and a refusal to guess when evidence conflicts.

### Surface vocabulary has one authored home

The client set and the server-only set must partition all eight surfaces. `ui-action` must remain in both the client-capable and server-capable sets because its execution side varies.

## Analysis behavior

The shared analysis layer carries scaling invariants alongside its facts.

### Alias resolution scales linearly

Quadrupling aliases and call sites must stay well below quadratic time, proving alias resolution queries the per-file write index instead of re-walking the program (FINDINGS.md PER-005).

## Scripts and tooling

The repository's own tooling carries invariants separate from the plugin's behavior.

### Scripts are checked JavaScript with no separate declarations

JSDoc-typed `scripts/*.mjs` is the single source of truth: `tsconfig.scripts.json` runs `checkJs` in the validate chain and no `scripts/*.d.mts` may exist (FINDINGS.md MNT-005).

### Generated artifacts share one manifest

The documentation generators, the catalog checker, and `docs:check` must use one path list. README marker replacement must reject unregistered section names.

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

## Fluent manifest

The SDK model's two trust boundaries: the reviewed API inventory, and the published artifact it was read from.

### The manifest matches the pinned fixture

The reviewed manifest must match `tests/fixtures/fluent-manifest-current.json`, carry evidence on every API and directive, require `$id` where the SDK requires it, and reject deleted lifecycle fields.

### The SDK tarball trust boundary holds

The audit script must accept only the exact npm registry artifact URL, cap declared, streamed, and decompressed byte counts, verify the pinned SHA-512 digest, and reject unsafe, duplicate, or linked tar entries.
