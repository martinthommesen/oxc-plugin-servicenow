The instance executes classic scripts on Rhino, and what that engine supports depends on both the JavaScript mode and the ServiceNow release. This file describes the capability matrix behind the 19 `engine` family rules.

Client scripts execute in the browser and Fluent files are not instance-executed, so this matrix is a server-runtime contract. `shouldDiagnoseFeature` in [[src/engine/features.ts#shouldDiagnoseFeature]] enforces that scope.

## The matrix

`ENGINE_FEATURES` in [[src/engine/features.ts#ENGINE_FEATURES]] maps each `EngineFeatureId` to an `EngineFeature`: a title and one `EngineFeatureRelease` per release, each holding a `support` value for all three JavaScript modes.

`FeatureSupport` has three values, and the third is the one rule messages depend on:

| Value | Meaning |
| --- | --- |
| `supported` | The mode allows the feature |
| `unsupported` | The feature is absent, so using it fails |
| `disallowed` | The feature exists but is forbidden in that mode |

The distinction matters because a rule's message differs. "Not supported" describes something that will not work; "disallowed" describes something that works and is not permitted. `README.md` explains the same distinction for users.

Lowercase `supported`, `unsupported`, and `disallowed` are plugin `FeatureSupport` values. Capitalized "Supported" and "Not Supported" quote ServiceNow's official capability table. Never mix the two casings for one claim.

## Where the cells come from

Each cell carries a `supportBasis`, one of `official-table`, `official-release-update`, or `es5-compatibility-policy`. The third value records an inference, not a citation.

ServiceNow's official capability table publishes only ES2021 and ES5-Standards columns; there is no Compatibility-mode column. The plugin applies each ES5 cell to Compatibility mode and records that it inferred the value rather than read it. Rows ServiceNow documents as applying to all modes are built by `australiaAllModesUpdateFeature` and do not use the inference — see `src/engine/features.ts`.

`ENGINE_FEATURE_EVIDENCE` pins the source URL, the official release label, the official page date (`2026-03-12` for Australia), and the package review date per release. The release label is a checkable fact: the Australia URL is unversioned, so the label is what proves the page read is the right one.

An `officialUpdatedAt` of `null` means the URL path carries the release name instead, as the Zurich pages do, so there is no separate page date to pin.

## Resolution is conservative

`featureSupport` in [[src/engine/features.ts#featureSupport]] returns `"unknown"` when the mode is unknown, and with no release it answers only where every release agrees.

Release-dependent facts therefore stay unknown until `settings.servicenow.release` names one. `isFeatureAllowed` is the boolean form. Neither function guesses.

## When an engine rule runs

`shouldDiagnoseFeature` answers whether a mode-specific rule applies to a file. It declines:

- Fluent files, which are never instance-executed.
- Mixed UI Actions, whose halves run in different runtimes.
- Files whose *known* surfaces are not server-capable. A known client-only file must not inherit server engine restrictions. The test is `ctx.surfaces.size > 0 && !isServerInstanceContext(ctx)`, so a file with no surface evidence still runs — deliberately weaker than `isServerInstanceContext` alone, which would silence every unclassified instance script.
- Files with an unknown JavaScript mode, unless the feature is unavailable in every mode for every admissible release — that case runs under `appliesToInstanceScripts`, which accepts an instance script with any known dimension.

Otherwise the rule runs only when every admissible release documents the feature as unavailable in the file's mode.

## The Australia update ledger

ServiceNow publishes a per-release table of Rhino engine changes, and the ledger mirrors it row for row.

`AUSTRALIA_ENGINE_UPDATES` in `src/engine/australia-updates.ts` is that ledger. Each row carries the upstream Rhino pull requests, the mode, whether the change is a feature or a fix, and a disposition.

The three dispositions differ in what they claim:

| Disposition | Claim |
| --- | --- |
| `diagnostic` | Modeled, and enforced by named rules |
| `metadata-only` | Modeled, with no diagnostic by design |
| `pending` | Unfinished work, recorded so it is not mistaken for support |

`pending` marks rows that have been read and not yet modeled; the ledger says so rather than implying a rule exists. At the 2.0.0 snapshot the table is 19 rows: 10 diagnostic, 1 metadata-only, 8 pending, and the generated ledger states "Audit complete: no".

The one metadata-only row is Rhino #1860 on `Function.prototype.call`/`apply` `thisArg`. Its rationale is recorded in `src/engine/australia-updates.ts`: the legacy behavior depends on strictness and on whether Rhino takes the interpreted or compiled path, which source analysis cannot select reliably. Modeling it would mean guessing.

Separately, [[src/release-reviews.ts#AUSTRALIA_RULE_REVIEWS]] gives all 50 rules a release review — `reviewed` with bases, `invariant` with a rationale, or `not-applicable` on the Fluent SDK axis. Zurich is the legacy baseline and passes everything.

## The ledger's own vocabulary

Two of the ledger's fields are named like the rest of this file's axes but are not them.

`AustraliaEngineUpdateMode` is `"all" | "es5" | "es2021"`. It is the column of ServiceNow's published table, not a JavaScript mode: there is no `compatibility` member because the `es5` rows reach Compatibility through the `es5-compatibility-policy` inference described above.

`AustraliaEngineUpdateType` is `"feature" | "fix"` and says whether the upstream Rhino change adds behavior or corrects it. It is unrelated to a row's `featureIds`, which name the plugin's `EngineFeatureId` entries that model the row.

## Where this is documented

The full row ledger is generated into `docs/australia-engine-updates.md`, and `tests/australia-engine-updates.test.ts` plus `tests/engine-features.test.ts` pin the row and pull-request inventory. A row cannot be added or dropped silently.

## Related

The axes this matrix is indexed by, and the gates over it.

- [[domain#JavaScript modes]], [[domain#Releases]] — the axes.
- [[rules]] — how an engine rule reaches `shouldDiagnoseFeature`.
- [[invariants#Release reviews are complete]] — the gate over `AUSTRALIA_RULE_REVIEWS`.
