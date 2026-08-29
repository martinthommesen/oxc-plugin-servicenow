# Recorded decisions

Product decisions that need a future trigger, so they do not silently lapse.
Each entry names its FINDINGS.md record, the decision, and the review point.

## Thin presets stay exported through 2.x (FEAT-001)

`configs.security` and `configs.securityRules` carry one rule;
`configs.policy` and `configs.policyRules` carry two. They stay exported for
the whole 2.x line because removing named exports is a breaking change.

Decision: reassess at the 3.0 boundary with npm dependents data.

- If no external consumer imports the four names, remove them in 3.0 and
  document the rule identifiers in the README instead. The catalog `security`
  and `policy` placements stay either way.
- If the `security` or `policy` category grows to roughly five rules first,
  keep the presets: they earn their surface at that size.

## The 1.x settings compatibility layer stays through 2.x (FEAT-002)

`scriptType`, `ecmaLatest`, and the `@sn-es-latest` pragma remain supported
with deprecation messages, as `src/types.ts` promises ("for one major-release
cycle"). Four of the five cross-field conflict checks in
`src/settings/validate.ts` exist only for this layer.

Decision: retire the layer in 3.0, after one full 2.x cycle with the
deprecation messages visible at lint time.

- Before removal, check npm download and dependents data for remaining 1.x
  usage. If usage is material, keep `scriptType` and `ecmaLatest` and retire
  only `@sn-es-latest`, which is a repository convention rather than
  ServiceNow metadata. If usage cannot be measured, retire only
  `@sn-es-latest`.
- Removal is loud: unknown settings keys throw with a message that names the
  replacement (`surfaces`, `javascriptMode`).

## `validate-gliderecord-calls` is removed in 3.0 (REM-001)

Announced in the changelog and in the generated rule page. The alias stays
available and `off` throughout 2.x. `require-query-before-next` is the
replacement (README migration step 4).

## The provenance lifecycle fields are removed in 3.0 (API-002)

`AnalysisProvenance.queryState`, `windowed`, `sysparmName`, and `aggregates`
on the `oxc-plugin-servicenow/analysis` export are never computed: every
value stays at its initial default whatever the source does. The real
lifecycle facts live in the per-domain analyzers behind the rules. The four
fields are annotated `@deprecated`, and a contract test pins their constant
values so a future implementation change is visible.

Decision: remove the four fields in 3.0.

- Before removal, run the same npm dependents check the other 3.0 records
  share. If a consumer that reads the fields is found, implement them from
  the domain analyzers instead of removing them, and reassess severity.
- Consumers that need lifecycle facts should use the rules that compute
  them (`require-query-before-next` and the windowing, aggregate, and
  GlideAjax rules).

## The PR #51 acceptance-ledger apparatus retires when the remediation merges (REM-002)

The acceptance ledger (`scripts/pr51-acceptance.json`,
`scripts/verify-acceptance-ledger.mjs`, the generated
`docs/pr-51-acceptance-ledger.md` and `docs/pr-51-validation-report.md`,
`PR51-REMEDIATION-GOAL.md`, `FINDINGS-REMEDIATION.md`, `plans/`, the
`acceptance:check` and `acceptance:capture` scripts, and their CI steps)
tracks one pull request's acceptance criteria. It is about 18,000 lines of
one-off remediation tracking wired into required validation, and it must
not outlive the remediation it tracks.

Decision: retire the apparatus when the PR #51 remediation line merges into
`main`.

Trigger and conditions:

- The PR #51 line is merged into `main`.
- The remaining pending and live-pending criteria are satisfied or
  explicitly abandoned here.
- The same commit archives `PR51-REMEDIATION-GOAL.md`,
  `FINDINGS-REMEDIATION.md`, the generated ledger documents, and `plans/`
  under a tag or a `history/` directory so the evidence stays retrievable.
- After removal, `npm run validate` still chains every durable gate, and
  `workflow:check` and `check-script-paths.mjs` pass with no dangling
  references.

The durable gates (lint, format, typecheck, tests, docs regeneration,
evidence, manifest, workflow, compat, benchmark, release artifact) are not
part of the apparatus and stay required.

## Autofixes are out of scope until a rule ships one (MNT-001)

The plugin reports diagnostics only. The unused fix machinery was removed;
reintroduce it from history together with the test obligations listed in
`CONTRIBUTING.md` if a semantics-preserving rewrite ever qualifies.
