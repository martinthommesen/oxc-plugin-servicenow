Fifty rules ship in 3.0.0 across three families and ten profiles. This file describes registration, rule shape, and reference documentation.

Per-rule semantics, applicability, options, false positives and negatives, and evidence live in `docs/rules/*.md`. Those pages are generated from the catalog, so they cannot drift from the implementation. Do not restate their content here.

## The catalog is the registry

`ruleCatalog` in [[src/catalog.ts#ruleCatalog]] assembles one descriptor per rule from `src/catalog/<rule>.ts`. It is the single registration point for the whole package.

`src/rules/index.ts` builds the rule record from `ruleImplementations`, a projection derived from the full catalog. `src/configs/maps.ts` reads the separate `rulePlacements` projection.

The file's comment states the rule: add an implementation file and one descriptor module in `src/catalog/`, never an export in the registry. Shared assembly lives in `src/catalog/entry.ts` with types in `src/catalog/types.ts`. `RuleName` is inferred from the catalog array, so an unregistered rule does not typecheck.

The catalog also drives the profile maps in `src/configs/maps.ts`, `docs/rules/*.md`, the rule tables in the README, and the checked-in example configs.

## Three catalog axes

The catalog distinguishes three concepts that the README tables present together. They are declared in [[src/catalog.ts#ruleCatalog]].

| Concept | Type | Meaning |
| --- | --- | --- |
| `family` | `RuleFamily` | `"classic" \| "fluent" \| "engine"`, used for documentation groups |
| `placements` | `RulePlacement[]` | `{ profile, severity }` pairs, one per profile |
| `severity` | `"error" \| "warn"` | The rule's own default |

The old single `preset` field was removed. The README's legacy label is derived from the first placement.

Family `classic` groups rules about classic scripts; it is not the same concept as classic authoring in [[domain#Authoring: classic or Fluent]]. Never shorten either to "classic rule": write "classic-family rule" for the documentation group and "classic-authored file" for the script kind.

A rule can appear in several placements with different severities. `RuleProfile` covers ten profiles: `recommended`, `strict`, `classic-es5`, `es2021`, `client`, `acl`, `business-rule`, `fluent`, `policy`, `security`.

`strictRules` is `recommendedRules` spread with the `strict` placements, so every recommended rule is also in strict.

## The rule shape

Every rule is built with `defineRule` (from `@oxlint/plugins`) and implements `createOnce`, which runs once per file rather than once per node.

A rule returns visitors from `createOnce`, and every visitor calls `beginRuleFile` from [[src/rules/helpers.ts#beginRuleFile]] before doing anything else. A representative minimal rule is `src/rules/no-gs-now.ts`.

The calls stay inside the visitors on purpose: oxlint throws when a rule touches `context.sourceCode` during `createOnce` itself, so hoisting the call to the top of `createOnce` breaks the real host even though the unit harness tolerates it. Do not merge the per-visitor calls.

The shape exists for three reasons. `createOnce` computes per-file work once. A `before()` hook returning `false` lets the host skip a file entirely, which is the cheapest possible outcome for a rule that does not apply. And whole-file concerns need a `Program` visitor, which cannot be expressed as a per-node visitor.

The `before()` hook is where applicability is decided, using the predicates in [[context#How rules consume the context]]. Returning `false` is how a rule declines a file; it is part of the rule contract, and the test harness distinguishes it from finding nothing — see [[invariants#Declining is not the same as passing]].

## Options come from one descriptor

The five rules that take options declare them once, in `src/options/descriptors.ts`, as an `OptionField` list.

`schemaFromDescriptor`, `parseRuleOptions`, and `optionDocsFromDescriptor` in `src/options/descriptor.ts` derive the host JSON schema, the runtime parse, and the generated option documentation from that one source. A rule cannot hand-write its schema or parse `context.options` directly. Adding an option means adding a field to the descriptor.

## Applicability metadata

Each descriptor carries an applicability block built by `classic(...)`, `engine(...)`, or `fluent(...)` in `src/catalog-metadata.ts`.

These produce the *documented* applicability — surfaces, JavaScript modes, scopes, releases, and `minimumSurfaceConfidence` — which the generated rule pages render.

The documented applicability and the runtime predicates in [[context]] must agree, but they are separate artifacts: the metadata is what users read, the predicates are what runs. `Minimum surface confidence` on a rule page is where the two meet. `scripts/lib/catalog-gates.mjs`, run from the catalog check, asserts the agreement structurally: a rule whose entry restricts surfaces or modes must call the corresponding gate helper, so removing a gate fails the check (FINDINGS.md COR-015).

## Evidence

Each rule's evidence records carry a URL or test path, a claim, a `verifiedBy` kind, a date, and a per-rule verification id.

`docs/rules/*.md` renders them, and `scripts/check-catalog-docs.mjs` enforces roughly forty invariants over them — release-review completeness, against-placeholder URLs, date sanity, and the requirement that an `error`-severity recommended rule cite both normative external evidence and an automated in-repo proof. See [[invariants#Evidence resolves to a passing test]].

## Related

Contributor material and the subsystems the catalog gates.

- [[context]] — the applicability predicates `before()` calls.
- [[invariants]] — what the repository's gates enforce about the catalog.
- `docs/rule-authoring.md` — the contributor procedure and the required test matrix.
- `docs/non-goals.md` — rule ideas that were considered and rejected.
