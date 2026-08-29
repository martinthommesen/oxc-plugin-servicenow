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

## Autofixes are out of scope until a rule ships one (MNT-001)

The plugin reports diagnostics only. The unused fix machinery was removed;
reintroduce it from history together with the test obligations listed in
`CONTRIBUTING.md` if a semantics-preserving rewrite ever qualifies.
