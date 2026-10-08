---
lat:
  require-code-mention: true
---

Test specifications for the properties in [[invariants]]. Each leaf names what it verifies and the test that verifies it; `lat check` fails when a leaf loses its backlink.

`ruleTester` binds a suite's rule, context and expected diagnostic once; explicit overrides replace defaults. Skip assertions and active-negative assertions keep distinct contracts.

Unit rules run through the harness in `tests/helpers/rule-tester.ts`, which parses with `oxc-parser` and applies selected rules in process. Integration rules run the real `oxlint` binary and a real ESLint `Linter`, and are the only proof of production behavior.

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

### Parser failures cannot prove semantic silence

Recovered ASTs with parser errors and fatal or unclassified ESLint messages are rejected before checking rule diagnostics. Invalid input cannot satisfy either a presence or an absence expectation.

Guarded early-return fixtures use valid function bodies; TypeScript-only fixtures select a TypeScript filename.

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

### Settings cache identity preserves structural boundaries

Mutating a reused raw settings object into delimiter-containing invalid input must throw exactly as fresh validation does. Typed structural fingerprints distinguish nested arrays, objects and scalar text, including cycles.

### Inherited settings remain equivalent to fresh validation

Inherited fields and effective array slots participate in cache identity. Prototype and Proxy changes revalidate; own values win, actual holes stay distinct, unknown own keys fail, and getters add no fingerprint reads.

### Public contexts reject writes at every frozen level

Strict consumer compilation rejects top-level context writes, nested source-confidence writes and query-method replacement. The declared context matches its existing deeply frozen runtime value.

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

Nested loops sharing one cursor avoid repeated traversal through `(node, cursor-state)` memoization. Distinct cursor subsets instead obey [[tests#Analysis behavior#Independent retention work is bounded]] and can explicitly exhaust.

### The path budget grows with the program

An ordinary script must be analyzed completely: the budget scales with program size, so a longer file keeps producing findings instead of silently dropping them once a fixed work budget is spent (FINDINGS.md PER-003).

### Constant logical operands select the reachable branch

A query in the necessarily evaluated operand of a constant `&&`, `||`, or `??` counts as definite, a call in the skipped operand is never reported, and an unknown or interpolated operand keeps the join (FINDINGS.md COR-003).

### Alias writes resolve identically on every offset shape

A range-only host must resolve a rebound Fluent alias exactly like an offset host in both write directions, and a host with no offsets must suppress the alias fact rather than choose the first initializer (FINDINGS.md COR-007).

### Initialized var redeclarations are alias writes

`var T = A; var T = B;` resolves to `B` in both directions, a bare `var T;` changes nothing, and conditional or function-boundary redeclarations stay uncertain (FINDINGS.md COR-009).

### Regex features respect lexical boundaries

Lookbehind-like characters inside classes or escaped literals produce no compatibility diagnostic. Actual assertions after those forms remain diagnosed in literals and stable RegExp constructor calls.

### Template tokens require known boundaries

Each static run after a dynamic interpolation is inspected for delimited sys_ids. Unknown text cannot supply a token boundary or join separated fragments; known interpolation joins and digest-owner exceptions remain intact.

### Availability proofs respect condition effect order

Later condition writes and authoritative mutators invalidate earlier constructor or static-method availability checks. A trailing recheck restores proof across if, loop, conditional and preceding-exit guards.

### Availability proofs ignore unreachable suffix effects

Constant branches and false-loop bodies or updates do not invalidate an earlier availability check. Evaluated or unknown suffix writes still invalidate the proof before invocation.

### Alternative payload work consumes the path budget

Distinct aggregate alternatives charge clone, join, equality and enumeration work. Exhaustion discards the complete findings set; repeating equivalent tuples avoids distinct-state growth.

### Independent retention work is bounded

Distinct nested cursor states cannot multiply retention traversal indefinitely. A deterministic work cap records exhaustion, suppresses all partial findings and preserves ordinary retention diagnostics.

### Constant loop entries respect runtime reachability

False while and for conditions execute header effects but skip bodies. A false do-while test permits exactly one body execution, preserving cursor facts and unreachable-call suppression.

### Callable identities follow their execution paths

Mutable helper identities are cloned and joined with path state. Conditional reassignments cannot become definite, and inspecting uncalled bodies cannot change the enclosing callable binding.

### Callable alternatives retain branch state correlations

A query performed before a no-op helper stays paired with that helper. Querying helpers retain the unopened branch they repair. Both branch orders and helper aliases prove every actual path queries without budget exhaustion.

Conditional expression results retain their selected callable through outer assignments and aliases. Argument-created alternatives receive parameter bindings and call effects before joining; unopened controls continue to report.

### Callable correlations remain bounded

Independent helper choices exhaust deterministic work and suppress earlier findings. Replacing one helper repeatedly compacts equivalent callable states, preserving ordinary diagnostics without exhaustion.

### Known-node scope construction and lookup scale together

Quadrupling function and block scopes keeps scope construction plus ancestor-free identifier resolution below quadratic growth. Every identifier must retain a binding, so early termination cannot satisfy the scaling check.

### Constant expressions retain the selected alias

Constant conditional and logical expressions preserve the selected value's identity while ignoring unreachable writes. Unknown choices continue to join conservatively.

### Fluent alias writes preserve execution order and invalidate unknown values

Pending RHS uses retain the pre-write factory; completed pattern and loop-head writes invalidate it, including var targets. Earlier uses, lexical shadows, function uncertainty and host offset shapes stay consistent.

### Fluent properties require effective value proof

ID and table-name checks scan properties backward, suppressing uncertain spreads and computed keys while preserving trailing explicit properties and exact missing/raw diagnostics.

### Fluent directives attach to brace-free branches

Previous-line directives attach symmetrically to consequent and alternate statements, including mixed and nested branches. Blank-line placement and actual block tails still report.

### Deep Fluent alias chains are stack safe

A 6000-binding Fluent alias chain resolves without native recursion. Initializers retain their lexical scope across caller shadows, cycles stay unknown, and namespace module/member authority remains intact on source and real hosts.

### Known AST nodes retain lexical scope ownership

Known nodes resolve through their indexed lexical scope even when callers supply unrelated ancestors or hosts omit offsets. Foreign nodes retain conservative offset-based containment and root fallback.

## Integration

Real lint hosts must agree on conservative fact boundaries and applicability, with parser and process success established before semantic filtering.

### Correctness proofs agree across lint hosts

ESLint and Oxlint agree on dynamic template boundaries, lexical regex features and condition-ordered availability, including unreachable suffix writes. Each case checks exact diagnostics with host failures rejected.

### Mixed UI Action gates remain rule-specific

Explicit client/server UI Actions still run query, aggregate, getReference and GlideAjax checks while engine rules suppress mixed regions. Generated common applicability must preserve this distinction.

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

Both README formatter-guide links, the compatibility link, and the Australia engine-update ledger link must use generated repository references, whose URLs track the package release tag rather than a hand-written version.

### Test report queries use one clean-pass rule

A proof passes only when its `file::fullName` key occurs once and the outcome is a clean pass.

A clean pass has status `passed` without skip or todo. Summary counts use the same definition.

### Evidence captures use private reports and atomic artifacts

Evidence tests use unique temporary report directories, remove them after capture, and leave a complete JSON artifact after replacement.

### Compatibility reports reject raw host failures

Malformed JSON, parser/plugin-load diagnostics, nonstandard exit statuses, signals, spawn errors and timeouts fail compatibility validation before diagnostic filtering, even if stdout contains plausible JSON.

## Release governance

Claims made about a release must be reconstructible from the repository, not asserted in prose.

### Recoverable registry failures retain bounded retries

Native aborts/timeouts, Undici socket and connection/header/body timeouts, response-read transport failures and HTTP/npm 500 errors recover within bounded attempts. Malformed JSON and identity or integrity failures remain permanent.

### Hosted jobs run every static gate

The CI `test` job and the release `validate` job must both invoke `typecheck`, `typecheck:fixtures`, and `typecheck:scripts`, so a script-body type error cannot pass hosted validation while failing the local chain (FINDINGS.md TST-006).

### The migration guide quotes the declared peer ranges

`docs/migration-3.0.md` must state the exact `oxlint` and `oxfmt` peer ranges from `package.json`, use an install example inside them, and link the compatibility table (FINDINGS.md DOC-006).

### Strict consumers distinguish omitted settings from undefined

A strict consumer compiles omitted settings and mutable context projections through emitted package exports. It rejects explicit undefined optional settings and writes through both public context entry points.

### Foreign package execution is isolated from release inputs

Registry-installed package code runs only after the release tarball is immutable and cannot provide an artifact to the npm publish or GitHub release jobs.

### Merging a version tags it exactly once

The tag script creates one tag at the exact `main` commit, defaults the version to `package.json`, and returns an existing tag without a push.

It refuses a version the changelog does not name before touching `main`.

### The tag workflow runs only through the controlled actor

The workflow runs on a push to `main` that changes `package.json` or `CHANGELOG.md`, with a read-only token, no dependency install, and the app token scoped to this repository.

### One command prepares a release pull request

`releaseChangelog` moves the `Unreleased` notes under a dated version heading, leaves `Unreleased` empty, and the result passes the release changelog check.

It refuses an empty `Unreleased` section, a heading the changelog already has, and a changelog without `Unreleased`. Isolated fixtures cover consecutive releases after new notes are added, so the tests also pass when the repository's `Unreleased` section is empty after preparation. `prepareRelease` sets the same version in `package.json` and both lockfile entries and rejects a repeated or non-SemVer version.

### The unattended release environment is audited as such

The authoritative policy names no environment reviewers, and the audit holds the live environment to that shape.

The audit accepts a live environment with no protection rules and reports drift when the live environment gains reviewers or a self-review setting.

## Fluent manifest

The SDK model has two trust boundaries: the reviewed API inventory, and the published artifact it was read from.

### The manifest matches the pinned fixture

The reviewed manifest must match `tests/fixtures/fluent-manifest-current.json`, carry evidence on every API and directive, require `$id` where the SDK requires it, and reject deleted lifecycle fields.

### The SDK tarball trust boundary holds

The audit script must accept only the exact npm registry artifact URL, cap declared, streamed, and decompressed byte counts, verify the pinned SHA-512 digest, and reject unsafe, duplicate, or linked tar entries.

### Shared declaration evidence expands without loss

The canonical fixture round-trips every reviewed version, keeps expanded versions independent and rejects missing references or unsupported schemas.
