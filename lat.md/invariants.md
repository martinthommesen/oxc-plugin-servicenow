These are the properties the repository's own gates enforce. Each names the mechanism that would fail if the property broke, so a change that violates one fails loudly rather than drifting.

[[tests]] carries the test specifications for the same properties, each bound to a test.

## Silence on unknown facts

When provenance, mode, surface, schema, or control flow is unknown, the plugin stays silent.

The interfaces enforce this decision. `appliesOnSurface` requires membership and per-dimension confidence. `trustedExpression` rejects invalid or escaped identity. `featureSupport` returns `unknown` on release disagreement. Path analysis reports exhaustion as a value, and callers return no partial findings.

`docs/non-goals.md` records the rule proposals rejected for lacking exactly this kind of evidence.

## Declining is not the same as passing

A rule that returns `false` from `before()` has declined the file. A rule whose visitors ran and reported nothing has passed. These are different outcomes and the test harness distinguishes them.

`RuleFileState` from [[src/rules/helpers.ts#beginRuleFile]] and the `onRuleSkipped` hook in `tests/helpers/apply-rules.ts` make the distinction observable; `tests/helpers/rule-tester.ts` exposes it as `assertValidActive` (ran, found nothing) versus `assertSkipped` (declined). A test that only asserted "no diagnostics" would pass for a rule that silently stopped applying to everything.

## Per-file state is reset in `before()`

A rule built with `createOnce` receives one instance per file but is not guaranteed a fresh instance per file. Any state accumulated in the closure must be reset in `before()`.

This was a real defect (FINDINGS.md COR-011). `tests/rules/multi-file-lifecycle.test.ts` now guards it.

## One catalog descriptor per rule

A rule exists only if it has a descriptor module in `src/catalog/` assembled into `ruleCatalog` in [[src/catalog.ts#ruleCatalog]]. Its narrow projections supply runtime registration and configuration.

Generated pages, README tables, and example configs derive from the same array.

There is no hand-maintained profile map or export list. `RuleName` is inferred from the array, so a rule with an implementation file but no descriptor does not typecheck.

## Version and documentation URLs are coupled

`PACKAGE_VERSION` in [[src/version.ts]] is generated from `package.json` by `scripts/generate-version.mjs` at prebuild.

`PACKAGE_GIT_REF` and `DOCS_BASE_URL` in `src/constants.ts` derive from it, and `ruleDocsUrl` builds each rule's documentation URL from that base. So every rule's `docs.url` points at an immutable tag for the released version, not at a moving branch. `tests/plugin.test.ts` pins the coupling.

## Generated files round-trip

`npm run docs` regenerates the checked-in documentation and configuration artifacts.

`scripts/lib/generated-artifacts.mjs` owns the checked path list and the marked-section replacement function. `npm run docs:check` regenerates, runs catalog checks, then calls the dedicated round-trip script for every listed path.

Editing generated output or changing its source without regeneration fails the check. The list includes `src/version.ts`, which prebuild regenerates before the status check.

## Evidence resolves to a passing test

Every evidence record in `src/catalog-metadata.ts` carries a verification id, and every id must resolve to exactly one passing test.

`npm run evidence:check` runs `tests/catalog-evidence.test.ts` with a unique temporary report directory, removes that directory, and atomically replaces `artifacts/doc-evidence.json`, binding each id to its test. An `error`-severity rule in a recommended profile must cite normative external evidence *and* an automated in-repo proof — `scripts/check-catalog-docs.mjs` enforces the pair. This is what makes the generated rule pages auditable rather than decorative.

## Release reviews are complete

Every rule has an entry in `AUSTRALIA_RULE_REVIEWS` in [[src/release-reviews.ts#AUSTRALIA_RULE_REVIEWS]]: `reviewed` with a basis, `invariant` with a rationale, or `not-applicable` on the Fluent SDK axis.

`serviceNowReleasesForRule` computes advertised release support. `scripts/check-catalog-docs.mjs` rejects a Fluent rule that claims an instance release.

The engine rows are pinned separately: `tests/australia-engine-updates.test.ts` and `tests/engine-features.test.ts` fix the row and pull-request inventory, so a `pending` disposition cannot quietly become an implied support claim.

## The release and SDK axes never mix

A rule versioned by the Fluent SDK must not claim an instance release, and a rule versioned by instance release must not claim an SDK range. The catalog encodes both and the checker verifies neither is stated for the wrong family. See [[domain#Two independent version axes]].

## Settings are validated, frozen, and memoized

`validateServiceNowSettings` in [[src/settings/validate.ts#validateServiceNowSettings]] throws `ServiceNowSettingsError` on unknown keys, wrong types, and cross-field conflicts, then deep-freezes the result.

[[src/settings/legacy.ts#LEGACY_DESCRIPTOR_FIELDS]] owns the deprecated `scriptType` and `ecmaLatest` fields, their conflicts, translations, and pragma behavior. The main descriptor spreads those fields in without changing output order or behavior.

Freezing covers cyclic objects, and the shared empty default is never mutable. Keys, defaults, parsing, freezing, and fingerprints derive from the descriptor set. `tests/settings-freeze.test.ts` guards it.

## Scripts and their declarations agree

When a `scripts/**/*.mjs` module has a declaration file, `tests/scripts-declaration-parity.test.ts` recursively finds the pair and requires both files to export the same value names in both directions (FINDINGS.md MNT-005).

TypeScript imports of script helpers use sibling declaration files. CLI-only scripts do not require declarations. `scripts/check-script-paths.mjs` separately requires every script under `scripts/` to be tracked in Git.

## Test reports are isolated and queried consistently

Each test run writes to its own report path when concurrent execution could occur, and report consumers share one exact-proof definition.

`scripts/lib/test-report.mjs` indexes `file::fullName`, requires one clean pass, and counts outcomes. The acceptance verifier allocates a unique temporary report directory per run and removes it afterward.

[withAcceptanceLock](../scripts/lib/acceptance-lock.mjs#withAcceptanceLock) serializes the complete acceptance run for one repository root. It publishes a completed owner record and uses a fixed reclamation claim because the test suite rebuilds the shared `dist` tree.

Hard-link publication assumes the temporary and final paths share a local filesystem on one host. Unsupported hard links fail without a fallback.

PID liveness treats only `ESRCH` as proof that an owner is absent. A live or unverifiable PID, a missing owner record, and a malformed owner record remain protected.

The claim file is never reclaimed by age. If its process dies, later runs time out until an operator verifies that no claimant remains and removes the claim.

`tests/acceptance-ledger.test.ts` verifies fresh, stale, abandoned-claim, and publication races across separate Node processes. Direct `npm test` and `npm run build` calls remain outside this lock.

## The plugin emits no output of its own

The plugin produces diagnostics and nothing else. It does not write to stdout or stderr, and it does not emit deprecation warnings at lint time.

A deprecated setting is signalled through the type-level `@deprecated` markers, the validator's conflict messages, and the documentation. `docs/decisions.md` records the consequence for the 1.x settings layer: the migration signal is documentation, not a runtime warning.

## Related

The specifications for these invariants, and the subsystems the catalog gates cover.

- [[tests]] — test specs for each invariant.
- [[rules]], [[engine]], [[fluent]] — the subsystems gated here.
