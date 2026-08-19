# Write a ServiceNow lint rule

This guide is for contributors who add or change a rule in `oxc-plugin-servicenow`.

## Required workflow

1. Implement the visitor in `src/rules/<name>.ts` with `defineRule` and `createOnce`.
2. Add one catalog descriptor in `src/catalog.ts`. Import the implementation in that descriptor. The rule registry and preset maps are derived from the catalog.
3. Add tests that cover the matrix below. Use exact diagnostic counts and `messageId` values.
4. Run `npm run docs` so generated rule pages, README tables, and recommended oxlintrc copies update.
5. Run `npm run validate`.

Do not edit `docs/rules/*.md`, README rule tables, or recommended `.oxlintrc.json` copies by hand. `npm run docs` owns those files.

## Analysis rules

- Resolve platform globals and constructors through provenance helpers. Do not match `gs`, `Promise`, or `GlideRecord` by name alone.
- Track simple aliases. Invalidate the binding after reassignment or escape to a helper, object, array, or nested function.
- When provenance, JavaScript mode, surface, schema, or control flow is unknown, stay silent.
- Support `obj.prop` and `obj["prop"]`. Stay silent for computed names that are not static strings.
- Stateful API protocols must use path-sensitive analysis. Branch disagreement becomes unknown and suppresses the diagnostic.
- Put mode-specific engine bans in `classic-es5` or `es2021`, not in `recommended`, unless ServiceNow documents the feature as disallowed in every instance mode.
- Choose severity from confidence and false-positive risk. Heuristics start as `strict/warn`. Privilege-sensitive APIs start in `security`.
- Add an autofix only when the rewrite preserves semantics. Otherwise use a diagnostic or a suggestion.

## Evidence

Every ServiceNow-specific claim needs an authoritative link in the catalog description or `evidence` field. Do not invent Fluent APIs. Add them to `src/fluent/manifest.ts` with an evidence URL.

If the detection needs schema, types, or a project index, label the work as research. Do not fake those capabilities with heuristics.

## Test matrix

Cover at least:

- direct usage
- simple alias
- reassignment
- shadowed global or constructor
- static and unknown computed members
- nested scopes
- relevant control-flow branches
- valid near-misses
- context or runtime skips (client, server, Fluent, unknown mode)

Stateful rules also need early return, loop, helper escape, and multiple-instance cases.

Use `assertInvalid` with a `messageId` and `assertValid` for silence. Do not weaken tests to make an implementation pass.

## Preset selection

| Placement | Use when |
| --- | --- |
| `recommended` / `error` | High-confidence defect. Silence when context is unknown. |
| `recommended` / `warn` | High-confidence but intentional exceptions exist. |
| `strict` / `warn` | Useful heuristic. Do not promote to error only because `strict` is selected. |
| `classic-es5` / `es2021` | Mode-specific engine support. |
| `policy` | Organizational style. |
| `security` | Review-sensitive privileged APIs. |

## Autofix safety

A fix must be semantically preserving, syntax-valid, idempotent, and comment-safe. If any of those is uncertain, ship a diagnostic only.

## Related policy

Read [Non-goals and rejected rule ideas](non-goals.md) before you propose a rule.
