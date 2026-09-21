# Recorded decisions

Product decisions that need a future trigger, so they do not silently lapse.
Each entry names its FINDINGS.md record, the decision, and the review point.

## Thin presets stay exported through 2.x (FEAT-001)

When this record was opened, `configs.security` and `configs.securityRules`
carried one rule and `configs.policy` and `configs.policyRules` carried two.
They stay exported for
the whole 2.x line because removing named exports is a breaking change.

Decision: reassess at the 3.0 boundary with npm dependents data.

- If no external consumer imports the four names, remove them in 3.0 and
  document the rule identifiers in the README instead. The catalog `security`
  and `policy` placements stay either way.
- If the `security` or `policy` category grows to roughly five rules first,
  keep the presets: the category is large enough to justify a named export.

Outcome at the 3.0 boundary (2026-09-19): kept. No-usage cannot be proven
— dependents are unmeasurable (see FEAT-002) — and the categories hold two
(`security`) and three (`policy`) rules, below the keep threshold in the
other direction. Neither removal nor growth condition fired, so the thin
presets stay exported through 3.x and this record re-opens at 4.0.

## The 1.x settings compatibility layer stays through 2.x (FEAT-002)

`scriptType`, `ecmaLatest`, and the `@sn-es-latest` pragma remain supported
with deprecation messages, as `src/types.ts` promises ("for one major-release
cycle"). Five of the six cross-field conflict checks live in
`src/settings/legacy.ts` and run through the call at
`src/settings/validate.ts:275`; the sixth, Fluent authoring against instance
surfaces, is current (FINDINGS.md DOC-004).

Decision: retire the layer in 3.0, after one full 2.x cycle with the
deprecation recorded in the type-level `@deprecated` markers and the
validator's conflict messages. No message is emitted at lint time: the
plugin deliberately performs no output of its own, so the migration signal
is the documentation and the types, not a runtime warning
(FINDINGS.md DOC-004).

- Before removal, check npm download and dependents data for remaining 1.x
  usage. If usage is material, keep `scriptType` and `ecmaLatest` and retire
  only `@sn-es-latest`, which is a repository convention rather than
  ServiceNow metadata. If usage cannot be measured, retire only
  `@sn-es-latest`.
- Removal is loud: unknown settings keys throw with a message that names the
  replacement (`surfaces`, `javascriptMode`).

Evidence captured 2026-08-29: the npm downloads API reports 194 downloads
for the last week; the npm dependents page rejects unauthenticated reads,
so dependents cannot be measured from this environment. Per the threshold
above ("cannot be measured"), the concrete 3.0 action is: retire only
`@sn-es-latest`, keep `scriptType` and `ecmaLatest`. Re-run the check at
the 3.0 boundary; a measured no-usage result upgrades the action to
retiring all three. FEAT-001, REM-001, and API-002 share this dependents
check and re-run it at the same boundary.

Outcome at the 3.0 boundary (2026-09-19): usage is still unmeasurable —
the npm downloads API and the npms.io mirror both return 404 for this
package — so only `@sn-es-latest` is retired. The pragma no longer maps
to `es2021`: pragma-only files now resolve `unknown` mode, the
deprecation is gone, and a context test pins the retirement.
`scriptType` and `ecmaLatest` stay with their deprecations. The 3.0
migration guide names `settings.servicenow.javascriptMode` as the
replacement.

## `validate-gliderecord-calls` is removed in 3.0 (REM-001)

Removed in 3.0 as recorded: the rule file, catalog entry, release-review
row, generated rule page, and dedicated tests are gone. The alias stays
available and `off` throughout 2.x. `require-query-before-next` is the
replacement for cursor sequencing (README migration step 4); the
`unusedReturn` half of the alias has no surviving rule and is an explicit
documented drop in the 3.0 migration guide. The 1.1 migration table keeps its
special-case row pointing at the replacement, pinned by the configs test.

## The provenance lifecycle fields are removed in 3.0 (API-002)

`AnalysisProvenance.queryState`, `windowed`, `sysparmName`, and `aggregates`
on the `oxc-plugin-servicenow/analysis` export are never computed: every
value stays at its initial default whatever the source does. The real
lifecycle facts live in the per-domain analyzers behind the rules. The four
fields are annotated `@deprecated`, and a contract test pins their constant
values so a future implementation change is visible.

Decision: remove the four fields in 3.0.

Removed in 3.0 as recorded, with the `QueryState` type: the fields are gone
from `Provenance` and the `AnalysisProvenance` projection, the constant-value
contract test now pins their absence at runtime and in the type fixture, and
the 3.0 migration guide names the replacement rules.

- Before removal, run the same npm dependents check the other 3.0 records
  share. If a consumer that reads the fields is found, implement them from
  the domain analyzers instead of removing them, and reassess severity.
  (At the 3.0 boundary no consumer could be enumerated — the npm downloads
  API and the npms.io mirror both return 404 for this package — so no
  reading consumer was found and removal proceeded.)
- Consumers that need lifecycle facts should use the rules that compute
  them (`require-query-before-next` and the windowing, aggregate, and
  GlideAjax rules).

## The PR #51 acceptance-ledger apparatus retires when the remediation merges (REM-002)

The acceptance ledger (`scripts/pr51-acceptance.json`,
`scripts/verify-acceptance-ledger.mjs`, the generated
`docs/pr-51-acceptance-ledger.md` and `docs/pr-51-validation-report.md`,
`PR51-REMEDIATION-GOAL.md`, `FINDINGS-REMEDIATION.md`, and the
`acceptance:check` script with its CI steps)
tracks one pull request's acceptance criteria. It is thousands of lines of
one-off remediation tracking wired into required validation, and it must
not outlive the remediation it tracks.

Decision: retire the apparatus when the PR #51 remediation line merges into
`main`.

Trigger and conditions:

- The PR #51 line is merged into `main`.
- The remaining pending and live-pending criteria are satisfied or
  explicitly abandoned here.
- The same commit archives `PR51-REMEDIATION-GOAL.md`,
  `FINDINGS-REMEDIATION.md`, `scripts/pr51-acceptance.json`, and the
  generated ledger documents under a tag or a `history/` directory so the
  evidence stays retrievable.
- After removal, `npm run validate` still chains every durable gate, and
  `workflow:check` and `check-script-paths.mjs` pass with no dangling
  references.

The durable gates (lint, format, typecheck, tests, docs regeneration,
evidence, manifest, workflow, compat, benchmark, release artifact) are not
part of the apparatus and stay required.

Status on 2026-09-21: the conditions do not hold, so the apparatus stays.
PR #51 is closed without merging (it was a tracking-only pull request), and
its recorded head `b87972a` is not an ancestor of `main`, so the merge
condition is unmet as written. The ledger still carries 18 pending and 30
live-pending criteria, all of which require a live GitHub, npm, tag, or
review-thread audit or an explicit approval that cannot be given from a
local checkout. `PR51-REMEDIATION-GOAL.md` is not at the repository root;
its archived copy is on the `archive/pr51-b87972a` remote branch, which is
the retrievable location the archive condition refers to. Retirement
proceeds once a maintainer records the merge outcome and disposes of the
remaining criteria here.

## The sys_id allowlist is lowercase-only while detection is not (COR-018)

sys_id detection in `src/utils/sysid.ts` is case-insensitive: `SYS_ID` carries
the `i` flag, so `no-hardcoded-sysid` finds an uppercase or mixed-case literal.
The `settings.servicenow.allowedSysIds` validator is not: it rejects anything
that is not 32 lowercase hexadecimal characters with a
`ServiceNowSettingsError` reading "expected a 32-character lowercase
hexadecimal sys_id".

The rule itself lowercases both the configured ids and each detected id before
comparing, so the asymmetry never changes which literals are suppressed. It
bites only a user who pastes an uppercase id into settings: that configuration
throws instead of being normalized.

Decision: keep the lowercase-only allowlist through 3.x. One canonical casing
keeps the allowlist a set, which is what makes the membership test exact and
the settings fingerprint stable.

Review point: revisit if a user report shows the validation error being
mistaken for a rule defect, or if another setting gains case-insensitive
values — at that point one normalization policy should cover all of them.

## Rule files import analysis only through the barrel (MNT-006)

`src/analysis/internal.ts` is the single entry point a rule file may import
from. A rule that reaches past it can call an analysis function that builds its
own state instead of reading the cached `FileAnalysis`, which both costs a
second pass and can disagree with the facts every other rule sees.

The convention was previously prose in `lat.md/analysis.md`, and 14 rule files
had drifted off it.

Decision: enforce it. `assertAnalysisImportsUseBarrel` in
`scripts/lib/catalog-gates.mjs` fails the catalog check when a rule module, or
the delegate factory it inherits its gate from, imports `../analysis/<module>.js`
for any module other than `internal`. `tests/catalog-gates.test.ts` covers the
negative case.

Review point: if a rule genuinely needs a symbol the barrel does not export,
the answer is to export it from the barrel, not to widen the check. Revisit
only if the barrel grows large enough that a second, narrower boundary is
worth defining.

## Autofixes are out of scope until a rule ships one (MNT-001)

The plugin reports diagnostics only. The unused fix machinery was removed;
reintroduce it from history together with the test obligations listed in
`CONTRIBUTING.md` if a semantics-preserving rewrite ever qualifies.
