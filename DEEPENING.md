# Deepening candidates

An architecture review of this repository, produced by `improve-codebase-architecture`.

Vocabulary is fixed by the codebase-design skill: **module**, **interface**, **implementation**,
**depth**, **seam**, **adapter**, **leverage**, **locality**. Depth means leverage at the interface —
a small interface over a large implementation. The deletion test is applied to every candidate: if
deleting a module makes complexity vanish it was a pass-through; if complexity reappears across N
callers it was earning its keep.

`CONTEXT.md` and `docs/adr/` do not exist in this repository. `docs/decisions.md` is the ADR
equivalent and `docs/non-goals.md` holds rejected rule scope. `lat.md/` is the domain model; its
invariants are treated as binding.

**Method.** Twelve survey agents covered disjoint slices; each produced friction points and
candidates. Every candidate then faced an adversarial verifier instructed to default to refuted.
Fifty-four candidates survived, six were refuted, and a completeness critic proposed the last twelve of those fifty-four.
Every quantitative claim in this document was then re-measured against the working tree by the
author. Where a survey figure and a measurement disagreed, the measurement is used and the
discrepancy is recorded.

## Contents

- [Verification status](#verification-status)
- [Implementation outcomes](#implementation-outcomes)
  - [Final validation](#final-validation)
- [Correction: the REM-002 finding was wrong](#correction-the-rem-002-finding-was-wrong)
- [Measurements that contradict earlier drafts](#measurements-that-contradict-earlier-drafts)
- [A. The finder seam](#a-the-finder-seam)
- [B. Identity and the analysis layer](#b-identity-and-the-analysis-layer)
- [C. Rules and the catalog](#c-rules-and-the-catalog)
- [D. The versioned knowledge bases](#d-the-versioned-knowledge-bases)
- [E. Repository-level seams](#e-repository-level-seams)
- [F. Additions from the adversarial pass](#f-additions-from-the-adversarial-pass)
- [R. Refuted candidates](#r-refuted-candidates)
- [Ordering](#ordering)
- [Top recommendation](#top-recommendation)

## Verification status

54 candidates survived verification; 6 were refuted and are recorded under
[Refuted candidates](#r-refuted-candidates) so they are not re-proposed.

| Candidate | Badge | Verdict |
| --- | --- | --- |
| D1 Project the shipped snapshot to the two facts `registry.ts` reads | Strong | CONFIRMED |
| F1 Make `GlideCapabilityView` the only home for role membership | Cleanup | CONFIRMED |
| A2 Return budget exhaustion as a value | Worth exploring | CONFIRMED |
| A6 Give the Glide capability manifest per-receiver-kind roles | Worth exploring | CONFIRMED |
| B4 Give the execution-boundary rule one implementation | Worth exploring | CONFIRMED |
| E1 One script CLI adapter | Worth exploring | CONFIRMED |
| A1 Finder harness owns dedupe, authority and exhaustion | Worth exploring | PLAUSIBLE |
| A3 Interpreter domain constructors | Worth exploring | PLAUSIBLE |
| A4 Typed reason from each finder | Worth exploring | PLAUSIBLE |
| A5 Fuse the GlideRecord cursor passes | Worth exploring | PLAUSIBLE |
| A7 One cursor traversal for both walkers | Worth exploring | PLAUSIBLE |
| A8 Fold do/while completion into the interpreter | Speculative | PLAUSIBLE |
| B1 Named shape for the file-analysis cache key | Worth exploring | PLAUSIBLE |
| B5 Merge the two const resolvers | Worth exploring | PLAUSIBLE |
| B6 Derive the published provenance type | Speculative | PLAUSIBLE |
| C1 Split the catalog array per rule | Worth exploring | PLAUSIBLE |
| C2 Split the release-review ledger out of `catalog-metadata.ts` | Worth exploring | PLAUSIBLE |
| C3 Concentrate the rule visitor protocol | Worth exploring | PLAUSIBLE |
| C4 Derive the harness filename from catalog applicability | Worth exploring | PLAUSIBLE |
| C5 Settings parameter for the matrix case constructors | Worth exploring | PLAUSIBLE |
| C6 One home for each rule's description | Worth exploring | PLAUSIBLE |
| C7 Collapse the finding types and narrow the barrel | Worth exploring | PLAUSIBLE |
| C8 Derive the availability gate from catalog applicability | Speculative | PLAUSIBLE |
| C10 Delete `preset` | Worth exploring | PLAUSIBLE |
| C11 Separate runtime and documentation projections | Worth exploring | PLAUSIBLE |
| C12 Make `entry()` derive instead of validate | Speculative | PLAUSIBLE |
| C13 Move the fixture corpus into fixture files | Worth exploring | PLAUSIBLE |
| D2 Build each manifest lazily | Worth exploring | PLAUSIBLE |
| D3 Give `typos` and `lifecycle` one home | Worth exploring | PLAUSIBLE |
| D4 Replace the snapshot record with a declaration index | Worth exploring | PLAUSIBLE |
| D6 `idPolicy` vocabulary narrower than `idRequirement` | Worth exploring | PLAUSIBLE |
| D7 Collapse the fixture and the snapshot | Speculative | PLAUSIBLE |
| E2 Export the catalog invariants as a module | Worth exploring | PLAUSIBLE |
| E4 One generated-artifact list | Worth exploring | PLAUSIBLE |
| E5 `compat-consumer` uses the host-verifier seam | Worth exploring | PLAUSIBLE |
| E6 One result interface for `run-tests.mjs` | Worth exploring | PLAUSIBLE |
| E7 Collapse the tarball-production seam | Speculative | PLAUSIBLE |
| E8 One temporary-project builder for the integration tier | Worth exploring | PLAUSIBLE |
| E9 `assertInvalid` asserts ranges | Worth exploring | PLAUSIBLE |
| E10 Examples assert against the rule's message template | Worth exploring | PLAUSIBLE |
| E11 Split the phase-named test files | Speculative | PLAUSIBLE |
| E12 One home for the eight-surface vocabulary | Worth exploring | PLAUSIBLE |
| E13 Separate the release-update tables from the capability tables | Worth exploring | PLAUSIBLE |
| F2 Context resolution confidence algebra | Worth exploring | PLAUSIBLE |
| F3 Isolate the 1.x settings layer | Worth exploring | PLAUSIBLE |
| F4 Rule-side silence gate behind one accessor | Worth exploring | PLAUSIBLE |
| F5 Fold the provenance conjunct into the platform-identity proof | Worth exploring | PLAUSIBLE |
| F6 Callers stop writing guard cache keys | Worth exploring | PLAUSIBLE |
| F7 Gate README's three unmarked fact blocks | Worth exploring | PLAUSIBLE |
| F8 One home for the GlideRecord-like constructor set | Worth exploring | PLAUSIBLE |
| F9 `constants.ts` dead exports | Worth exploring | PLAUSIBLE |
| F10 Browser mutation index built only where asked | Speculative | PLAUSIBLE |
| F11 Finding registry as an interface | Speculative | PLAUSIBLE |
| F12 Stable-callable classification is one query | Worth exploring | PLAUSIBLE |
| R1 Move the Now.ID hooks into `now-id.ts` | — | REFUTED |
| R2 Collapse `public.ts` into one publishing adapter | — | REFUTED |
| R3 Widen `unsupportedConstructorRule` into a family factory | — | REFUTED |
| R4 One consensus resolution for every knowledge base | — | REFUTED |
| R5 One evidence registry keyed by id | — | REFUTED |
| R6 REM-002 retirement gate | — | REFUTED |

## Implementation outcomes

This table records the result of the implementation campaign completed on 2026-09-13. The review verdicts above describe whether a proposal deserved investigation. They do not imply that the proposal was implemented.

The planning journal called R3 `C9` and R6 `E3`. Those labels refer to the same two refuted candidates and are not additional candidates.

| Candidate | Outcome | Reason |
| --- | --- | --- |
| D1 | Implemented and repaired | The shipped declaration snapshot now contains only id policies and discovered declaration facts. Full declaration evidence remains in the fixture. The deterministic TypeScript serializer and its regression test ensure the offline projection reproduces the generated source exactly. |
| F1 | Implemented, with the badge corrected | The nine flat role-set exports had no production consumers. They were deleted as dead duplicate views, and tests now read `GlideCapabilityView`. This was cleanup rather than a Strong deepening. |
| A2 | Implemented | `analyzePathBindings` returns `complete` or `exhausted`. Every caller returns no findings or clears provenance after exhaustion, so no callback can omit the silence rule. |
| A6 | Implemented | `GlideCapabilityView.byKind` now contains evidenced GlideRecord and GlideAggregate role sets. Scoped and global documentation is pinned for Zurich and Australia, and aggregate executor and cursor checks no longer use string literals. |
| B4 | Implemented | `FileBindings` exposes exact scope and execution-boundary queries. Callers no longer access or walk `ScopeTree`, and the unused `isLocalName` method was removed. |
| E1 | Not implemented | A shared `fail(kind, message)` would drop `retryable` metadata and the typed `error.kind` control flow used by release scripts. Sharing only root and argument helpers would leave one adapter and little deleted code. |
| A1 | Not implemented | Dedupe keys differ by finder. Some use node identity, while aggregate, GlideAjax, and ACL findings need message or kind-and-method keys. One node-keyed reporter would remove valid findings. |
| A3 | Not implemented | The proposed domain constructors do not fit the alternative-set domains, and the plan cited a nonexistent `findGlideRecordBySource` symbol. The existing domain-specific merge and equality rules remain explicit. |
| A4 | Not implemented | Typed reasons would be unused without C3 and C7. The two multi-message finders already preserve distinct message identities, so an intermediate reason interface would add translation code without deleting reporting logic. |
| A5 | Not implemented | The plan relied on nonexistent symbols and did not specify compatible merge semantics for the five cursor domains. Fusing them could change conservative joins and exhaustion behavior. |
| A7 | Not implemented | The two cursor walkers carry different state and memo keys: node mode in one and cursor-id sets in the other. Extracting their small common traversal would leave both policies exposed through a larger interface. |
| A8 | Not implemented | The path interpreter does not retain the per-loop fact this proposal needs. Adding a second loop-completion channel would increase state and still lack an answer when the loop reaches the work budget. |
| B1 | Implemented | One lookup now owns host and explicit-AST cache stores. A structured identity names all seven semantic inputs, and the host-AST shortcut remains exact. |
| B5 | Implemented | The two const resolvers now wrap one alias walk with explicit `possible` and `dominating` time policies. Cycle and rejected-alias behavior remain different where required. |
| B6 | Implemented | `AnalysisProvenance` is derived from `Provenance` with a narrowed public kind. The emitted declaration retains all deprecated members and their source docblocks. |
| C1 | Not implemented | Moving 51 descriptor literals would redistribute hundreds of lines without reducing the catalog interface. The verified plan also omitted the shared `ES5` fixture and proposed an input type that could not retain literal rule names. |
| C2 | Implemented | Release review types, tables, and queries now live in `src/release-reviews.ts`. Catalog metadata retains applicability and evidence-record construction. |
| C3 | Not implemented | Rule `Program` visitors have heterogeneous finder arguments, gates, and reports. The proposed reporter would either drop `defineRule` metadata or expose adapters for each shape, producing a shallow module. |
| C4 | Not implemented | Direct measurement contradicted the corrected derivation. All six client-placement rules also have a recommended placement, but only five use a client default; placements cannot derive the existing test filename without another exception list. |
| C5 | Implemented | Binding-matrix constructors accept settings directly. Range anchors must be unique, with an explicit surrounding anchor for the one repeated identifier. All message and range evidence remains. |
| C6 | Not implemented | Fifty of 51 catalog summaries intentionally differ from rule diagnostic descriptions. Replacing either set would rewrite generated documentation and discard the distinction between a rule summary and a diagnostic explanation. |
| C7 | Not implemented | The 11 finding types do not share one useful shape. Method-less findings and findings with message, tuple, kind, or alias-origin data would require optional fields and intersections that make callers learn every variant. |
| C8 | Not implemented | Published applicability stores rendered prose and cannot express the feature and confidence gates used by rules. Reading private structured metadata would bypass the catalog interface. |
| C10 | Implemented | The 51 legacy `preset` values and `RulePreset` were deleted. Documentation derives the legacy label from the first placement, and recommended evidence checks read placements directly. |
| C11 | Implemented | `ruleImplementations` and `rulePlacements` are derived projections used by the runtime registry and config maps. The full catalog remains the only authored registry and still owns duplicate checks. |
| C12 | Not implemented | `entry()` already derives the supported fields. Nesting examples and limitations would rewrite all 51 descriptors while adding no new derivation or smaller caller interface. |
| C13 | Not implemented | The plan counted 221 examples but the catalog has 233, including 12 helper-built limitation cases. Extracting them also needs per-case settings, type, id, description, filename, and classification constraints, so the interface is not smaller. |
| D2 | Implemented with the verified correction | Manifests build on first use and are memoized. Unsupported versions are checked before construction and still throw `ServiceNowSettingsError`, preserving the three pinned proofs. |
| D3 | Implemented in its viable form | Typos now have one authored home in `DEFAULT_FLUENT_MANIFEST`; 27 derived fixture copies were removed. Lifecycle remains independent fixture evidence because deriving it from the runtime manifest would be self-comparison. |
| D4 | Implemented and repaired | `declaration-index.ts` owns the four joins used by the registry. Two unused speculative queries were removed, and the module is not part of the public Fluent entry point. |
| D6 | Implemented and completed | Named functions now own both id-requirement precedence and the first deprecated-version decision. The declaration policy vocabulary remains narrower than `FluentIdRequirement`. |
| D7 | Not implemented | The full fixture is evidence and is used by `compat-consumer.mjs` as an independent oracle. Collapsing it into the shipped projection would remove declaration paths, hashes, absence checks, and the compatibility cross-check. |
| E2 | Not implemented | Extracting private predicates from one catalog checker would create a one-adapter seam. The proposal did not provide a smaller input than the checker’s catalog, release registry, file reader, and generated-state dependencies. |
| E4 | Implemented | `GENERATED_ARTIFACT_PATHS` is used by the catalog checker and `docs:check`; both README generators share `replaceMarkedSection`. Two consecutive documentation runs produce the same diff digest. |
| E5 | Implemented | The compatibility consumer now uses `runHostProcess`, `parseOxlintStdout`, and `pluginRuleIds` for all four Oxlint runs while retaining its cell-specific assertions. |
| E6 | Implemented | `indexOutcomes`, `exactProof`, and `outcomeSummary` define one report interface for evidence and acceptance consumers. Unit tests cover missing, duplicate, failed, skipped, todo, and clean outcomes. |
| E7 | Implemented | Local compatibility and release checks now call the same exported `packTarball`. The `--tarball` early return remains in the compatibility consumer, and declaration parity covers the new export. |
| E8 | Implemented with a narrower interface | `createTemporaryProject` owns one-file project setup and cleanup; `eslintFlatConfig` requires each caller’s files and settings. The two-file context contract remains separate. |
| E9 | Implemented without weakening evidence | `assertInvalid` can assert a four-field range. The binding matrix uses it and still asserts the independently authored full message string. |
| E10 | Not implemented | The matrix does not carry interpolation data. Deriving expected text from the rule template would either fail on placeholders or make a template change update both sides, weakening the pinned host contract. |
| E11 | Blocked | PR #51 has not merged. Seven acceptance proofs, generated ledger rows, and catalog evidence still name `tests/rules/phase3.test.ts`; renaming or splitting it would break exact proof identity. |
| E12 | Implemented with the verified correction | `src/surfaces.ts` is the authored eight-surface vocabulary. UI Action remains in both client-capable and server-capable sets, and profile-specific single-surface settings were not widened. |
| E13 | Not implemented | Fluent evidence records have no date, so the proposed citation-and-date validator cannot cover both knowledge bases. Moving the Australia table under `scripts/` or JSON would also remove current TypeScript checking. |
| F2 | Implemented | `ServiceNowScriptContext.confidenceAtLeast` compares a named dimension with the shared ordering. `appliesOnSurface` uses it, while all existing rule predicate names remain unchanged. |
| F3 | Implemented in the viable file-level form | `src/settings/legacy.ts` owns deprecated descriptors, conflicts, translations, and pragma behavior. The fields remain in validated settings until the recorded 3.0 removal condition is met. |
| F4 | Implemented with rule-specific exceptions | `ProvenanceQuery.trustedExpression` owns the invalid-and-escaped check. Rules use it where both flags mean silence; rules with different policy, such as escaped security-bypass access, retain their narrower checks. |
| F5 | Not implemented | Platform authority is a per-file mutation question, while provenance trust is a per-expression value question. Combining them would add provenance inputs to every authority call and duplicate `trustedExpression`. |
| F6 | Not implemented | The claimed caller-written cache-key obligation does not exist. The keys are internal to `unsupported-constructor-rule.ts`, and deriving them without predicate identity could reuse an unsound guard index. |
| F7 | Not implemented | The proposed Preset and Settings checks compare tables that already match and supplied no negative-fixture interface. The filename table is a prose summary and cannot be checked by set equality against filename patterns. |
| F8 | Implemented | `GLIDE_RECORD_CONSTRUCTORS` now has one authored home in platform method authority. Both rules derive their constructor lists from it. |
| F9 | Implemented | Twelve verified unused exports were removed from `src/constants.ts`. None was reachable through a package export; live constants and public package metadata remain. |
| F10 | Not implemented because the behavior already exists | `createMutationQuery` already delays `buildIndex` and its AST walk until the first query method call. Another lazy layer would save only one closure allocation and add interface code. |
| F11 | Not implemented | Moving the historical finding registry into `src/` would ship review data. Rewriting 32 retired citations requires judgment, and several replacement ids are themselves retired, so an automated one-hop gate would be wrong. |
| F12 | Implemented and repaired | `resolveStableCallable` serves the invocation index and both rules with explicit possible-value or dominating-value policy. Immediate body execution is a separate caller policy, so cursor expansion rejects generators without changing stable generator mapper or callback classification. Single-call-site and work-budget policy remain local to `analyzeStableInvocations`. |
| R1 | Refuted, no change | The Now.ID hooks configure the one cached path-analysis pass. Moving them would split one domain without a second adapter. |
| R2 | Refuted, no change | The published provenance module intentionally narrows internal kinds and behavior. Collapsing it would violate the public contract. |
| R3 | Refuted, no change | Widening `unsupportedConstructorRule` would require rule-specific reporting parameters and produce a larger interface than the three existing callers. The planning journal labels this item C9. |
| R4 | Refuted, no change | Fluent, Glide, and engine version knowledge have different consensus rules. Only their admissible-version input is shared. |
| R5 | Refuted, no change | Glide and Fluent evidence records have incompatible cardinality and fields. One union registry would expose all variants to every caller. |
| R6 | Refuted, no change | PR #51 has not merged, so REM-002 has not fired and the acceptance apparatus remains required. The planning journal labels this item E3. |

### Follow-up (2026-09-19)

Two candidates recorded above as not implemented were later landed in variant form. The verdicts and reasons in the table describe the 2026-09-13 campaign and are left unchanged.

- C1 landed as commit 328ed61: the 50 descriptors moved to `src/catalog/<rule>.ts` with shared assembly in `entry.ts`. The authored registry array in `src/catalog.ts` was retained, so this is not the proposed next-to-implementation layout.
- C4 landed partially as commit ffb4fdf: the test harness derives Fluent defaults from the catalog family field instead of name-prefix matching. Full placement-to-filename derivation remains open under the recorded exception-list objection.

### Follow-up (2026-09-21)

A later pass landed the following. As above, the verdicts in the 2026-09-13 table are left unchanged.

- A1 is now partially applied. `dedupePathFindings` is used by every finder, and `collectPathFindings` owns both the findings array and the exhaustion tail. The per-finder dedupe key stays a finder argument, which is the part the original objection was about.
- D3 left a dead fallback: `manifestForVersion` spreads `DEFAULT_FLUENT_MANIFEST`, so `typos` is version-invariant and the `?? FLUENT_DIRECTIVE_TYPOS[name]` operand in `fluent-directives.ts` was unreachable. Both the fallback and the `FLUENT_DIRECTIVE_TYPOS` constant are removed.
- R4's residual landed: the admissible-release input is shared, which is the one part the refutation agreed was common.
- E12 still has one authored home (`src/surfaces.ts`) and two import spellings, because `src/catalog-metadata.ts` re-exports the three surface sets so descriptors can write `metadata.SERVER_SURFACES`. Kept: the re-export is a namespace convenience, not a second home.
- `src/configs/recommended.ts` and `src/configs/strict.ts` were folded into `src/configs/profiles.ts`, which now holds all ten profile objects.
- Adjacent to C3 and C7: `beginRuleFile` now returns the `FileAnalysis` itself rather than a three-field façade, and `src/analysis/internal.ts` is an enforced boundary — `scripts/lib/catalog-gates.mjs` fails a rule that imports any other analysis module (docs/decisions.md MNT-006).

### Final validation

Validation was run on the uncommitted campaign tree on 2026-09-13.

| Command | Result |
| --- | --- |
| `lat check` | Passed. |
| `npm run typecheck` | Passed. |
| `npm run typecheck:fixtures` | Passed. |
| `npm run lint:check` | Passed. |
| `npm run format:check` | Passed. |
| `npm test` | Passed: 1,479 tests in 186 suites, with no failures, skips, or todo tests; all 27 Fluent manifests passed afterward. The pre-campaign baseline was 1,452 tests. |
| `npm run verify:examples -- --all` | Passed: doctor completed and 17 real oxlint and oxfmt attempts passed. Evidence is in `artifacts/verify-oxc-plugin-servicenow/run-1789322964293/`. |
| `npm run evidence:check` | Passed: 197 evidence records, 95 automated proofs. |
| `npm run acceptance:check` | Passed: 1,481 outcomes passed. The ledger remains incomplete at its pre-existing state of 450 verified, 53 pending, and 30 live-pending criteria. |
| `npm run compat:check` | Passed for five exact compatibility cells. |
| `npm run release:check -- --consumer` | Passed: one 273-file tarball was inspected and installed in the node24-host consumer cell. |
| `npm run bench` | Passed; the small-to-large recommended scale was 2.83x. |
| `npm run docs` three times | Passed. The third run kept the tracked-output diff digest at `40e21fce9415349ebdfa8073b9da7502151a6f90ca5ac333dd34135e96c0a73d`. |
| `npm run workflow:check` | Expected dirty-tree failure. The action-pin half passed; the script-path half rejects eight new untracked script files until they are added to Git. The campaign did not alter the index. |
| `npm run docs:check` | Expected dirty-tree failure. Generation and catalog checks passed; the final status check rejects only the intentional C10 changes in `README.md` and `docs/rules/no-unsupported-static-methods.md` until they are committed. |
| `npm run manifest:drift` | Pre-existing external-data failure. npm has a stable `@servicenow/sdk` above the reviewed `4.11.0`, so the ceiling assertion stops before auditing snapshots. |

#### Follow-up acceptance concurrency check

The acceptance verifier serializes the complete run for one repository root with a completed owner record published by a same-filesystem hard link. The temporary file sits beside the lock under the local `tmpdir()` path. Unsupported hard links fail without a fallback, and PID liveness is proven only by `ESRCH` on the same host and PID namespace. Direct `npm test`, `npm run build`, and other build commands remain outside this lock.

A recorded dead owner can be reclaimed only after the verifier rereads the same owner token and filesystem fingerprint. A live or unverifiable owner, an ownerless or malformed lock, and an abandoned reclamation claim block until the bounded timeout. Claims are never reclaimed by age. A single `npm run acceptance:check` run passed with 1,481 of 1,481 tests. Two concurrent runs also passed with 1,481 of 1,481 tests each. The focused lock tests cover serialization, failure recovery, stale replacement protection, publication interleaving, and abandoned-claim timeout. `E11` remains blocked because PR #51 still pins `tests/rules/phase3.test.ts`.

## Correction: the REM-002 finding was wrong

An earlier draft of this review claimed `docs/decisions.md` REM-002's trigger had partially fired,
on the evidence that `PR51-REMEDIATION-GOAL.md` is not present in the tree. The file is absent, but
the cause was inferred from absence alone. Verified directly:

```
$ git cat-file -e main:PR51-REMEDIATION-GOAL.md
fatal: path 'PR51-REMEDIATION-GOAL.md' does not exist in 'main'

$ git log main --oneline --name-status -- PR51-REMEDIATION-GOAL.md
(no output)
```

The file has never existed on `main` in any of its 77 commits. The commits that introduced it are on
`archive/pr51-*` and `pr51-remediation/*` branches that are not ancestors of `main`. PR #51 is not in
main's merged set (`#1 #47–#50 #77–#85 #87–#128`). REM-002's trigger — "the PR #51 line is merged
into `main`" — has not fired. The apparatus is green and `npm run acceptance:check` is a correct
required gate.

The same unchecked inference had also produced a claim that the verifier's `ACCEPTANCE_GOAL_SHA256`
can never match. That claim is unverified and is withdrawn.

This is recorded rather than silently dropped because it is the failure mode the review exists to
catch: a real observation (a missing file) used to support a conclusion it cannot support.

## Measurements that contradict earlier drafts

| Claim in an earlier draft | Measurement | Reality |
| --- | --- | --- |
| 51.1% of rule lines are in the `meta` block | rules 5,203 lines; `meta: { … }` 556 lines | **10.7%** |
| `no-gliderecord-query-in-acl.ts` | the file is `no-gliderecord-query-acl.ts` | filename wrong |
| `ACCEPTANCE_GOAL_SHA256` can never match | not verified | withdrawn |

The remaining quantities in this document were each produced by a command run against the working
tree. The commands are quoted inline where the number carries an argument.

---

## A. The finder seam

Nine finder modules in `src/analysis/` each answer a different lifecycle question about a proven
GlideRecord. Eight are `onCall` hooks over `analyzePathBindings`; `glide-query-in-loop.ts` carries its
own traversal. All nine re-derive the same three obligations.

Measured:

```
grep -rln "collapse every finding in the file" src/          -> 6
grep -rn "const reported = new Set<ESTree.Node>()" src/      -> 4
grep -rn "onBudgetExceeded" src/ (excluding path-state.ts)   -> 10
grep -rn "findings.length = 0" src/                          -> 7
grep -rn "cloneData: (data) => ({ ...data })" src/ | wc -l   -> 8
```

### A1. Move the finder seam up so one harness owns dedupe, authority and exhaustion — Worth exploring

**Files:** `src/analysis/path-state.ts`, `glide-windowing.ts`, `glide-query-lifecycle.ts`,
`query-before-next.ts`, `glide-bulk-filter.ts`, `glideaggregate.ts`, `glide-setnocount.ts`,
`glideajax-params.ts`, `acl-query.ts`

**Problem.** Each finder repeats three bookkeeping obligations the interpreter does not own: a
node-keyed dedupe structure, a gate that rejects non-authoritative receivers, and an
`onBudgetExceeded` that empties findings. The dedupe concept already has two homes —
`dedupePathFindings` (`path-state.ts:70-86`), used by 3 of 9, and hand-rolled copies in 6.
Exhaustion is enforced in 10 callbacks with two different materialisation orderings:
`glide-setnocount.ts:155` clears `finalized` because findings are materialised from it at `:160`;
the other nine clear `findings`.

**Solution.** Raise the seam from `findings.push(...)` inside each `onCall` to a harness that takes a
domain descriptor: the record kinds it tracks, the state functions it genuinely varies, and an
`onCall` body that receives an already-authority-checked, already-deduplicated report callback. The
harness owns result collection, the node-identity key, the authority gate, and clearing everything on
budget exhaustion.

**Benefits.** *Leverage:* one implementation of the silence-on-exhaustion invariant and one correct
dedupe key pay back across nine finders; a tenth inherits both instead of re-deriving the COR-016 host
quirk from a comment. *Locality:* a dedupe or exhaustion bug is fixed in one module, and the two
materialisation orderings converge. *Testability:* the harness is testable once with a stub domain, so
each finder's test asserts only its transition.

```

BEFORE                              AFTER
finder ─┐                           finder ─┐ (onCall + state fns only)
finder ─┼─ dedupe (hand)            finder ─┼──────────┐
finder ─┼─ authority gate           finder ─┘          ▼
finder ─┼─ onBudgetExceeded                    ┌──────────────────┐
finder ─┘                                      │  finder harness  │
  9× three obligations                         │  dedupe · gate   │
                                               │  exhaustion      │
                                               └──────────────────┘
                                                    1×

```

**Reframing from the verify pass.** The corrected framing concedes the ten `onBudgetExceeded` bodies
do not disappear as a group: the exhaustion half becomes typed (see A2) and the dedupe and authority
halves concentrate. That is why the badge is Worth exploring rather than Strong.

**Risk.** The nine domains do not share a state model — `glideaggregate.ts` and `glide-setnocount.ts`
key alternatives by JSON content and carry sets, while windowing/lifecycle/query-before-next carry one
or two booleans. Forcing a common state type would be worse than the duplication. The harness must
take the state functions as the descriptor, not normalise them.

### A2. Return budget exhaustion as a value instead of calling a callback — Worth exploring

**Files:** `src/analysis/path-state.ts`, plus the ten adapters

**Problem.** `lat.md` states the invariant as "a rule never reports from a truncated analysis." The
interpreter signals exhaustion through an optional callback (`path-state.ts:139`, `:1630`) and leaves
enforcement to every adapter. An adapter that omits it reports from a truncated traversal and nothing
in the type system notices.

**Solution.** `analyzePathBindings` returns a tagged result — complete, or exhausted — and each finder
forwards that tag alongside its findings. The runner from A1 discards findings on exhausted. Adapters
delete their `onBudgetExceeded` bodies.

**Benefits.** *Locality:* one place enforces silence-on-unknown, so the eleventh adapter cannot forget
it. *Leverage:* removal of an optional-hook trap. *Testability:* `tests/analysis/path-state.test.ts:111-115`
currently proves exhaustion by supplying a hand-written callback and asserting the cleared result; a
typed return value is directly assertable without a domain harness.

**Reframing from the verify pass.** The ten callback bodies do not all vanish; the change moves a
boolean one seam across `path-state.ts`'s own interface.

**Risk.** The signal is a thrown `Symbol` unwound at `:1627`; the catch block must produce the tagged
value, and it must not be reachable by an adapter that wants partial data. No production
adapter sets `maxWork`, so the new field is exercised by tests only unless a real caller sets it.

### A3. Give the interpreter domain constructors so an adapter supplies only what it varies — Worth exploring

**Files:** `src/analysis/path-state.ts`, plus ten adapters

**Problem.** `PathAnalysisOptions<T>` (`path-state.ts:107-140`) forces every adapter to implement six
members. Measured across the ten adapters:

```
emptyData 10/10   cloneData 10/10   mergeData 10/10
equalsData 10/10  onCall 10/10      onBudgetExceeded 10/10
mergeDistinctData 3   onRef 3   onValue 2   onExit 1
retainUnboundRecords 2   analyzeUncalledFunctions 1
stopAtAwait 1   maxWork 0
```

`glide-windowing.ts` spends 19 of its 63 lines on hook boilerplate around one `windowed: boolean`.
The may-join versus must-join decision — the only semantically interesting part of `mergeData` — is
re-derived per adapter with no shared vocabulary, and bottom-is-the-join-identity is a semilattice law
`mergeRecords` silently depends on.

**Solution.** Ship domain constructors alongside `analyzePathBindings`: a flat may-join domain for a
record of booleans, a three-valued domain, a string-set domain, an alternative-set domain. Each
supplies bottom, clone, join and equality, and guarantees the lattice laws. The adapter keeps `onCall`
plus optional `onRef`/`onValue`/`onExit`.

**Benefits.** *Leverage:* a new cursor fact costs one callback instead of six methods plus hand-written
join rules. *Locality:* bottom-is-identity and idempotent-join become one module's obligation instead
of a property each adapter must preserve by hand — the latent bug in the alternative-set domains.
*Testability:* domain constructors are unit-testable against the lattice laws directly.

**Reframing from the verify pass.** The corrected scope is two constructors covering clone and
equality duplication across nine finders. With only those two shapes the seam is close to the
one-adapter hypothetical the skill warns about, which is why this is not Strong.

**Risk.** The rich alternative-set domains (`glideaggregate.ts:18-71`, `glide-setnocount.ts:20-70`)
may not fit a generic constructor and must stay hand-written. A wrong default — a may-join where a
must-join was wanted — silently weakens an analysis rather than failing.

### A4. Return a typed reason from each finder instead of the rule's message id — Worth exploring

**Files:** `src/analysis/glideaggregate.ts:13`, `glideajax-params.ts:13`, seven other finders,
`src/rules/validate-glideaggregate-calls.ts:35`, `require-glideajax-sysparm-name.ts`

**Problem.** Two finders carry the rules' message identifiers in their published finding type; the
other seven emit no reason at all, so their rules hardcode one `messageId` in the report call. Eleven
`*Finding` interfaces exist, all `{node: CallExpression, name: string, ...}`. There is no consistent
answer to "what is wrong here," and the analysis layer cannot change its vocabulary without touching
rule strings.

**Solution.** One reason field naming the semantic condition — an unregistered aggregate, a missing
sysparm name, an unfiltered bulk operation — carrying its data. The rule maps reason to its own
message. The analysis layer stops naming diagnostics.

**Benefits.** *Leverage:* a uniform finding shape is what makes one shared reporter possible at all.
*Locality:* renaming a diagnostic touches the rule; adding a condition touches the finder.
*Testability:* analysis tests assert reasons, not rule message strings.

**Risk.** Exported from `internal.ts` (`glideaggregate.ts:51`, `glideajax-params.ts:49`), though
`internal.ts` is the plugin-internal barrel rather than the `oxc-plugin-servicenow/analysis` entry.
`docs/decisions.md` API-002 covers a different export, so there is no conflict.

### A5. Fold the five GlideRecord cursor domains into one interpreter pass — Worth exploring

**Files:** `query-before-next.ts`, `glide-query-lifecycle.ts`, `glide-windowing.ts`,
`glide-bulk-filter.ts`, `glide-setnocount.ts`, `platform-method-authority.ts`

**Problem.** Five adapters each start a full traversal of the same program to track five scalar
aspects of the same GlideRecord. All five declare `kinds: ["GlideRecord"]`; all five open `onCall` with
the same guard, consult the same authority function and the same manifest sets. Their domains are
disjoint slices of one record: unopened; opened/pending; windowed; filtered; count-skipped.

**Solution.** One `cursorFacts` pass per file whose abstract value is a single cursor record holding
all fields. Each rule keeps its module as a thin projection, so reporting logic and message ids are
unchanged. The authority guard moves inside the pass, next to the only code that knows what an
authoritative GlideRecord method is.

**Benefits.** *Leverage:* a file with all five rules enabled pays one traversal instead of five, and
each traversal re-runs two indexing walks. *Locality:* the shared precondition is stated once, so a
fix cannot land in one adapter and miss four. *Testability:* one fixture exercises cursor semantics for
five rules.

**Risk.** The adapters do not configure the interpreter identically — `acl-query.ts` sets
`analyzeUncalledFunctions: false`, `stopAtAwait: true`, `retainUnboundRecords: false` while the five
cursor adapters take defaults. ACL must be excluded from the family, and the merged record's per-facet
joins must preserve the existing merge semantics.

### A6. Widen the Glide capability manifest to per-receiver-kind roles — Worth exploring

**Files:** `src/glide/manifest.ts:110`, `:318-339`, `glide-query-in-loop.ts:53,81-83`,
`acl-query.ts:77-86`, `glideaggregate.ts:141`, `glide-setnocount.ts:135`

**Problem.** The manifest resolves method facts per scope and release and derives nine named role
sets, but only for GlideRecord. GlideAggregate's executor, its cursor advancer, and `current`'s
executor are string literals in four analysis modules. There is no GlideAggregate kind in the role
enum, so finders open-code `property === "query"`. Four independent guesses about the same platform
fact, none carrying evidence, none reachable by a rule that wants to vary by release or scope.

**Solution.** Extend the manifest inventory to carry capabilities per receiver kind, and expose a
resolution answering whether a property is an executor, a cursor advancer or a filter for a kind,
scope and release. `GLIDE_RECORD_EVIDENCE` (`manifest.ts:35-51`) carries over so a GlideAggregate fact
becomes a citation too.

**Benefits.** *Leverage:* one resolution serves four finders plus any future kind. *Locality:* the
fact "GlideAggregate.query is its executor" lives in one evidenced table, not four conditionals.
*Testability:* `tests/glide/manifest.test.ts` already exists, so the fact moves from an untested
conditional into a tested table.

**Risk.** The GlideAggregate role inventory has to come from documentation. The manifest's value rests
on its evidence discipline — adding entries without evidence URLs dilutes it. Mechanical and landable
kind-by-kind.

**Sequencing.** Land F1 first. Both edit the same role-derivation code in `manifest.ts`, and
consolidating the flat sets first means the per-kind axis is added once instead of twice.

### A7. Extract one cursor traversal used by both the loop finder and the collection rule — Worth exploring

**Files:** `src/analysis/glide-query-in-loop.ts:164-250`,
`src/rules/no-glideelement-in-collection.ts:206-287`, `src/analysis/cursor-condition.ts`

**Problem.** Two ~85-line traversals walk the program tracking cursor state, re-implementing the same
while/do-while/for re-entry rules and the same memo. One uses a numeric depth and a bitmask memo; the
other cursor-id sets and a string-keyed memo. A fix to do/while re-entry
(`glide-query-in-loop.ts:208-213` versus `no-glideelement-in-collection.ts:242-251`) must be made twice
and verified twice.

**Solution.** One module yields each node with its cursor state, parameterised by the cursor-identity
test and the memo key. The loop finder supplies "inside any cursor advancement" and gets a boolean;
the collection rule supplies "which cursor object ids are live" and gets a set.

**Benefits.** *Leverage:* one traversal, two consumers, and a third consumer gets it free.
*Locality:* the exponential-traversal fix and do/while re-entry semantics live once. *Testability:*
`tests/rules/cursor-loop-scaling.test.ts` already asserts both walkers at nesting depth 24; after
extraction it exercises one implementation through two callers instead of asserting two
implementations agree.

**Reframing from the verify pass.** The corrected problem states the duplication is narrower and the
divergence wider than first claimed: the memo shapes differ (two-bit node/mode versus numeric depth),
so a shared traversal may cost more interface than it returns.

**Risk.** The parameterisation must include the memo-key derivation, which is the subtle part.

### A8. Fold the do/while completion analysis into the interpreter's own completion model — Speculative

**Files:** `src/analysis/cursor-condition.ts:48-85`, `src/analysis/path-state.ts:1238-1377`

**Problem.** `cursor-condition.ts` hand-derives whether a statement's completion reaches a do/while
test, by recursively interpreting break, return, throw, continue, block and if. The interpreter
computes the same completions with `ownsLoopCompletion` at `:1273-1274` and the break/continue
consumption at `:1322-1331`. Two completion models that must agree.

**Solution.** Expose the completion question from the interpreter as a fact a domain can read — whether
a loop's test is reached on any surviving path — recorded where the loop case already computes it.

**Benefits.** *Locality:* one completion model, so a fix to break/continue or throw handling cannot land
in the interpreter and miss the caller. *Leverage:* both consumers of `cursor-condition` get an
authoritative answer. *Testability:* completion facts are assertable from one interpreter fixture.

**Risk.** The interpreter consumes completions as it walks and discards them. Surfacing a per-loop fact
needs a new hook whose shape is not clear, and both consumers need the answer at a point the
interpreter may not reach.

---

## B. Identity and the analysis layer

### B1. Put cache identity behind one store with a structured key — Worth exploring

**Files:** `src/analysis/file-analysis.ts:317-329`, `:335-373`

**Problem.** Identity is spread across three functions: `analysisCacheKey` builds the string,
`getFileAnalysis` owns the per-source bucket, `getFileAnalysisForAst` owns the second bucket. The
seven inputs are positional in a JSON array, so adding one means editing the builder and hoping no two
entries collide when one contains the separator. The AST-keyed bucket exists only to serve one public
overload that no production caller uses. `ANALYSIS_RESOLVER_VERSION` sits next to the builder, not
next to the key it invalidates.

**Solution.** One internal module owns identity: a single lookup taking the context and an optional
explicit tree, deriving the identity, returning either the cached record or a freshly built one. The
identity becomes a structured value with named fields. The resolver-version constant moves next to the
key so the two cannot drift.

**Benefits.** *Leverage:* every future fact that must participate in identity is added once.
*Locality:* the rule for "what makes two analyses the same" lives in one file. *Testability:* hit, miss
and cross-source isolation become assertable directly — today the cache is only tested through
`getAnalysisPassCount` (`tests/analysis/foundation.test.ts:37-61`), which is a proxy for the cache
rather than the cache.

**Risk.** `lat.md/analysis.md` documents the key as mixing seven named things; all seven must keep
contributing or a second host with different settings could read a stale record. The AST overload is
reachable from the published surface, so folding it away would be a public behaviour change.

### B4. Move execution-boundary lookup onto `ScopeTree` and stop exposing the tree — Worth exploring

**Files:** `src/analysis/bindings.ts:360`, `members.ts`, `binding-writes.ts`, `empty-array-bindings.ts`

**Problem.** `FileBindings` exposes `tree: ScopeTree`, so callers re-implement a scope-walking
invariant with four copies of the scope-kind list. A change to what counts as an execution boundary
must be made in five places and nothing forces them to agree. `isLocalName` has no callers.

**Solution.** Add the boundary question to the module that owns scopes: a method returning the nearest
module/function/static-block ancestor of a node, and one answering whether two nodes share an execution
boundary. Drop `tree` from `FileBindings`. Delete `isLocalName`.

**Benefits.** *Leverage:* one implementation serves the write index, the const resolvers, the
empty-array query and path-state. *Locality:* the boundary definition changes once. *Testability:* the
boundary walk becomes a directly testable function on a parsed program instead of being verified
incidentally through rule output.

**Reframing from the verify pass.** Do this in two steps. Serve the two remaining consumers first —
`path-state.ts:484` uses `bindings.tree.scopeById` and `fluent-imports.ts:181` reads
`bindings.tree.root?.block`. Only drop `tree` once a scope-id-based boundary query exists.

**Risk.** Unifying on the ancestor-stack form may force `members.ts:11`'s caller
(`executionBoundaryForScope`) to keep its scope-based path, so the module may need both entry points
and the collapse is partial.

### B5. Reduce the two const resolvers to one alias walk with an explicit temporal policy — Worth exploring

**Files:** `src/analysis/members.ts:34`, `:66`

**Problem.** The same alias-walking loop exists twice. `resolveDominatingConstValue` is
`resolveConstValue` plus three guard clauses, and the two must be edited together. The choice between
them is a policy — "possible anywhere in the file" versus "guaranteed at this point" — that the names
only imply.

**Solution.** One walk taking the policy as a parameter; the two exported names stay as thin wrappers
so the 74 existing call sites do not change.

**Benefits.** *Leverage:* the 13 dominating callers and the 61 possible-value callers share one
implementation, so a fix to alias following — a new wrapper node type, a new pattern form — lands for
both. *Locality:* the temporal check stops being a parallel body that can silently drift.
*Testability:* the policy becomes an argument a test can set, so "does following stop at a
closure-mutated alias" is one call with one flag instead of a comparison between two functions.

**Risk.** The two functions differ in what they return on a rejected alias: `resolveConstValue`
returns `null` on a cycle, `resolveDominatingConstValue` returns the identifier. Merging must preserve
that.

### B6. Publish one provenance shape and derive the narrow view — Speculative

**Files:** `src/analysis/provenance.ts`, `public.ts`, `file-analysis.ts`

**Problem.** The four deprecated lifecycle fields are declared twice with duplicated docblocks and set
to constants on every record through `emptyProvenance`. A field addition or removal is a two-file edit
and the contract test pins values nobody reads.

**Solution.** Declare `Provenance` once; derive the public type by an explicit mapped form that omits
the internal-only members and re-types `kind`, so the deprecated four flow through by construction.

**Benefits.** *Leverage:* the public type is generated from the internal one, so the two cannot
disagree about which fields exist. *Locality:* the deprecation docblocks live at one declaration.
*Testability:* the type-level test and the runtime test stop depending on a hand-maintained mirror.

**Risk.** The derived type must reproduce the exact read-only and optional shape that
`tests/types/readonly.test-d.ts` asserts. Payoff is modest — the four fields are removed in 3.0 under
`docs/decisions.md` API-002.

---

## C. Rules and the catalog

### C1. Split the catalog array into one descriptor per rule next to its implementation — Worth exploring

**Files:** `src/catalog.ts` (4,545 lines, 51 entries, 30 of the last 77 commits), `src/rules/*.ts`,
`src/rules/index.ts`, `src/configs/maps.ts`

**Problem.** The catalog fuses six concepts into one 28-field record: registry membership, placement
severities, evidence ledger, applicability documentation, example fixtures, and limitation cases.
`entry()` derives 12 fields from roughly 16 authored ones, and four derived registries must stay
consistent with it. Adding a rule means editing a 4,545-line file to hand-type the name, the
implementation import, the docs URL and the descriptor lookup — while the rule file already owns
`ruleDocsUrl("no-gs-now")` (`src/rules/no-gs-now.ts:15`) and its own messages. 45 of the 51 entries are
imported at the top of the catalog file.

**Solution.** Move each descriptor next to its implementation. The rule file already carries its own
slug for its docs URL, so its identity already lives there. Extend it to own `deployments`,
`evidence`, `applicability`, `examples`, `limitations`. `ruleCatalog` becomes a derived ordered
concatenation — the same mechanism `src/options/index.ts:17-23` already uses to collect five
descriptors instead of re-declaring them. `RuleName` still infers from the concatenated array, so an
unregistered rule still fails to typecheck.

**Benefits.** *Leverage:* a rule author reads one file, not a 4,545-line array plus their own rule.
*Locality:* placement, evidence, applicability and fixtures stop sharing one edit site — the single
most-edited file in the repository stops being the likeliest merge-conflict site. *Testability:* each descriptor
typechecks alone, so a malformed entry fails at its own definition rather than at the join.

**Reframing from the verify pass.** Scope this to the descriptor literal, not the derived fields. The
authored input is only about 83 lines per rule and `ruleCatalog` remains an explicit 51-element tuple,
so as originally stated it redistributes files rather than deepening an interface.

**Risk.** 51 entries move; `tests/catalog.test.ts` whole-array assertions need rework;
`scripts/generate-rule-docs.mjs:8` and `scripts/check-catalog-docs.mjs:8` import `src/catalog.ts` by
path, so the joined export must keep its current shape.

### C2. Split the release-review ledger out of `catalog-metadata.ts` — Worth exploring

**Files:** `src/catalog-metadata.ts:137`, `:212`, `:262-297`, `src/catalog.ts:232,249`,
`scripts/check-catalog-docs.mjs:259-269`, `tests/catalog.test.ts:81-84`

**Problem.** Release-review facts live in a parallel keyed registry, so 51 reviews and 51 descriptors
are two hand-synced lists asserted equal by a test. `serviceNowReleasesForRule` and
`releaseEvidenceForRule` are one-line delegations whose only caller is the `entry()` chain; the
registry's only other reader, the checker, re-derives the same projection itself.

**Solution.** The verify pass reversed the original proposal. Splitting the ledger out of
`catalog-metadata.ts` into its own module is the better move than folding it back into the rule
descriptors, because the ledger's rows are keyed by rule but read by the checker and the docs
generator, not by the rule at runtime.

**Benefits.** *Locality:* one home for release-review facts, separate from the applicability metadata
that shares the file. *Leverage:* the checker and `entry()` read one projection instead of two
derivations.

**Risk.** 51 markers; the shared per-release evidence block keyed by basis must survive, and
`scripts/verify-doc-evidence.mjs:99-107` reads the projection.

### C3. Concentrate the rule visitor protocol behind one declarative reporter — Worth exploring

**Files:** `src/rules/helpers.ts` (24 lines), 23 rule files of 35-58 lines each

**Problem.** Measured: 104 `beginRuleFile(context)` call sites in 49 files; `no-typed-arrays.ts` calls
it five times. Ten rules share a byte-identical `before()` body (`isServerInstanceContext`), eight
share `isFluentContext`. Twenty-three files have a `Program` visitor whose entire body is one
`for (const finding of ...) context.report(...)`. The rule author must know the
`beginRuleFile`-before-every-visitor convention and reproduce the report shape; a mistake in either is
a silent per-rule bug, not a compile error.

**Solution.** One module in `src/rules/` takes a rule's declarative finding source — its gate
predicate, its analysis helper, its message map and its data projection — and returns the `createOnce`
object. Rules with extra visitors — `no-gs-now`, `no-typed-arrays`, `fluent-directives` — keep
`defineRule` and opt in where it fits.

**Benefits.** *Leverage:* one reporter implementation serves 15-23 call sites; the `beginRuleFile`
convention is stated once instead of 104 times. *Locality:* a change to how findings become
diagnostics — dedupe, message data projection — lands in one file rather than 23. *Testability:* the
harness already runs rules by name through the registry, so the shared reporter is exercised by every
existing rule test.

**Risk.** The three gate families — classic surface, fluent, engine feature — shape `before()`
differently, so the declaration must express all three or the wrapper is shallow for some.
`no-promise.ts:38,52` and `no-proxy.ts:38,52` each need two helpers in one `Program`.

### C4. Derive the harness filename from the rule's catalog applicability — Worth exploring

**Files:** `tests/helpers/rule-tester.ts:14-35`, `src/catalog-metadata.ts:48,57`, `src/catalog.ts`

**Problem.** `defaultFilename` restates surface knowledge the catalog already encodes: a
hand-maintained five-name `CLIENT_RULES` set plus five `startsWith` heuristics standing in for
`applicability.authoring === "fluent" || surfaces includes "fluent"`. A new fluent or client rule that
does not match the prefixes silently gets a server filename, its `before()` gate declines every file,
and `assertValid` absorbs that as "no diagnostics." Nothing in the harness reads the catalog entry.

**Solution.** `defaultFilename` looks up the catalog entry and maps `applicability.surfaces` to a
representative filename: a fluent entry gets `file.now.ts`, a client-only entry `test.client.js`, a
server entry `src/server/test.js`. The `CLIENT_RULES` set and the five `startsWith` calls go away.

**Benefits.** *Leverage:* one derivation replaces a set plus five predicates, and the answer updates
when a rule is added to the catalog rather than when someone remembers to edit the harness.
*Locality:* the surface-to-filename mapping lives where surfaces are declared. *Testability:* a
table-driven check over the catalog can assert every rule gets a filename its applicability admits —
today 33 of 49 importers override the default anyway, so the silent-decline hazard is real for the
remaining 16.

**Risk.** The catalog's `applicability.surfaces` is wider than the three filenames the harness needs
(ui-action, acl, business-rule, script-include, scheduled-script, fix-script all occur), so the
mapping needs a documented choice for the ambiguous ones.

### C5. Give the case table a settings field instead of 11 spread literals — Worth exploring

**Files:** `tests/helpers/binding-matrix.ts` (332 lines)

**Problem.** 11 of the 24 cases are written as `{ ...report(...), settings: {...} as const }`,
repeating the message argument verbatim so the spread has something to override. `location()` at `:16`
uses `code.lastIndexOf(source)`, so a case whose source string occurs twice reports the wrong span with
no error. 11 of the 24 cases carry full diagnostic message strings duplicated verbatim from the rule
`meta.messages`.

**Solution.** Add an optional settings parameter to `report()` and `silent()`; delete the 11 spread
forms. Change `location()` to assert the source occurs exactly once.

**Benefits.** *Leverage:* two constructors grow one parameter and 11 hand-written spread blocks
disappear. *Locality:* settings sit next to the code and expectation they describe. *Testability:* the
range assertions become trustworthy — today only 11 of the 24 cases assert ranges and `lastIndexOf`
silently picks one.

**Reframing from the verify pass.** This is test ergonomics, not interface depth. Worth doing, worth
noting as such.

**Risk.** Low. The stricter `location()` could surface a case that currently passes for the wrong
reason, which is the point.

### C6. Give each rule's description one home — Worth exploring

**Files:** `src/catalog.ts`, `src/rules/no-async-await.ts:11-14`, `fluent-directives.ts:163-165`,
`src/rules/no-gliderecord-query-acl.ts`, `scripts/check-catalog-docs.mjs`

**Problem.** A rule's summary sentence is written in the rule file's `meta.docs.description` and again
in the catalog. Four are verbatim duplicates. `no-async-await.ts:11-14` reads "Disallow async/await in
Compatibility and ES5 ServiceNow scripts. ES2021 instance scripts support async functions." while its
catalog entry reads "async/await is not implemented in Compatibility and ES5 Standards mode." Nothing
compares the two. The catalog is also roughly 89 lines of descriptor per rule, with 221 inline code
literals and 101 limitation-case blocks.

**Solution.** The rule file is the single home for the runtime-facing summary and messages; the
catalog keeps what it uniquely owns — placements, family, presets, applicability, evidence, examples.
`entry()` at `:223` already wraps the implementation with `withCatalogRecommendation`, so extend that
wrapper to carry the documentation fields and add a check that the two cannot drift.

**Benefits.** *Leverage:* the contributor procedure in `docs/rule-authoring.md` stops requiring the
same sentence twice. *Locality:* a description edit lands in one place. *Testability:* a
catalog-versus-meta consistency check turns a currently silent drift into a failing gate.

**Risk.** `lat.md/rules.md` states the catalog is the single registration point and that no competing
metadata registry may exist. This does not move registration or placement — it removes a duplicated
prose field — but a reviewer could read it that way, so the change must be described precisely.

### C7. Collapse the finding types and narrow the barrel — Worth exploring

**Files:** `src/analysis/internal.ts` (81 lines, 42 exports), eleven `*Finding` interfaces,
`src/rules/helpers.ts`

**Problem.** Eleven structurally identical finding interfaces are declared and exported one at a time,
re-exported through a 42-name barrel, and consumed by 23 rules that are all the same three-field
projection. The barrel also lets rule-local helpers be typed as
`ReturnType<typeof beginRuleFile>["analysis"]` — 23 occurrences in 8 files — so a rule's parameter type
is defined in terms of a rules-layer function. Separately, 38 rules import only from `internal.ts`
while 43 rule files import analysis modules directly, bypassing it.

**Solution.** Declare one shared `LocatedFinding` in analysis and have the per-rule helpers return it,
keeping rule-specific extras as an intersection. Re-type helper parameters to a named analysis type.
Narrow the barrel to re-export domain modules' public surface rather than 42 hand-listed names.

**Benefits.** *Leverage:* the report loop's data projection becomes uniform, which is what C3 needs.
*Locality:* the shape of a finding is declared once. *Testability:* one type makes the harness's
expectation of `{node, name, method}` explicit.

**Risk.** Collapsing the types loses per-finder semantic naming; `AclQueryFinding` adds `kind`, so the
shared type needs room for extensions. Narrowing the barrel is churn across 38 import statements with
no behaviour change.

### C8. Derive the availability gate from catalog applicability — Speculative

**Files:** 49 rule files' `before()`, `src/catalog.ts`, `src/catalog-metadata.ts:342,356,364`

**Problem.** Every rule restates its applicability as runtime code: ten rules
`if (!isServerInstanceContext(script)) return false;`, eight `if (!isFluentContext(script)) return false;`,
seventeen test `shouldDiagnoseFeature` against feature ids. The catalog separately declares the same
applicability as documentation metadata. `lat.md/rules.md` says the two must agree but they are
separate artifacts and nothing enforces it.

**Solution.** Declare the gate once on the catalog entry and have the shared reporter from C3 compile
`before()` from it. A rule needing a finer gate keeps a hand-written `before()` and opts out.

**Benefits.** *Leverage:* a predicate repeated in 18+ files becomes one derivation. *Locality:*
surface/feature applicability is declared once and consumed by both the runtime gate and the generated
pages. *Testability:* the integration context tests can pin the metadata instead of the code.

**Risk.** `lat.md/rules.md` explicitly frames documented applicability and runtime predicates as
separate artifacts that must agree. Deriving one from the other changes that stated design and must be
reflected in `lat.md`. The three gate kinds have different arities — surface string, feature id,
feature id list.

### C10. Delete `preset`, deriving the legacy label from placements — Worth exploring

**Files:** `src/catalog.ts`, `scripts/generate-rule-docs.mjs:35-38`

**Problem.** `preset` (`"recommended" | "strict" | "classic-es5" | "es2021" | false`) is a legacy
single placement retained alongside `placements`. 50 of 51 entries have `preset` equal to their first
legacy placement, which the generator already computes. The one exception, `no-unsupported-static-methods`
(`preset: "es2021"` with placements `[classic-es5, es2021]`), is exactly the ambiguity the legacy field
hides. The generator's `presetLabel` falls back to `placements[0]?.profile ?? "off"`, so two code paths
produce one displayed value.

**Solution.** Remove `preset` from `RuleCatalogEntry` and from all 51 entries. The generator selects the
legacy placement from `placements` directly.

**Benefits.** *Leverage:* one canonical placement list. *Locality:* a placement change is one edit and
the docs table cannot disagree with the config map. *Testability:* `tests/catalog.test.ts:86-95`'s
release matrix stops leaning on a legacy field. The deletion test passes cleanly — the two doc
consumers already compute the value from `placements`.

**Risk.** Low. One behavioural decision: which legacy label `no-unsupported-static-methods` shows.

### C11. Give the runtime and documentation halves separate projections — Worth exploring

**Files:** `src/catalog.ts`, `src/rules/index.ts:11`, `src/configs/maps.ts:7-9`,
`src/configs/profiles.ts` (at review time still split as `recommended.ts` and `strict.ts`)

**Problem.** The runtime side reads two fields — `name` and `implementation` for the registry, `ruleId`
and `placements` for the config map — but both sites load all 28 because `ruleCatalog` is the only
export. The shallowest modules in the slice are thin wrappers over that array: `recommended.ts` (9 lines),
`strict.ts` (9 lines), `options/index.ts` (31 lines of re-export).

**Solution.** Introduce two projections at the seam where the two consumers diverge: the registry
projection and the config projection. Both derive from the full record, so no second registry appears.

**Benefits.** *Leverage:* a runtime caller learns two fields, not 28. *Locality:* a documentation-only
change cannot break rule loading. *Testability:* the derived-projection tests narrow to the projection
they check.

**Risk.** The risk is adding a fourth shallow wrapper if the projections are not what callers
use.

### C12. Make `entry()` derive instead of validate — Speculative

**Files:** `src/catalog.ts:174-193`, `:257`, `:276`, `scripts/check-catalog-docs.mjs:218-341`,
`tests/catalog.test.ts:37-66`

**Problem.** `RuleCatalogInput` omits 13 of 28 fields and `entry()` derives all 13. Four of those
derivations — evidence re-keying, `fixKind`, the limitation partition, limitations prose — are
re-implemented in the checker and a third time in the catalog test. `lastVerified` has two
implementations.

**Solution.** Replace the wide `RuleCatalogEntry` with an authored type carrying only the authored
fields plus nested `examples` and `limitations` groups; `entry()` returns the derived type. The
checkers read rather than re-derive.

**Benefits.** *Leverage:* callers of the derived record get fields that cannot disagree with their
sources. *Locality:* one derivation site instead of three. *Testability:* the contract test compares
authored input to derived output instead of re-implementing the derivation.

**Risk.** The `...rest` spread at `:257` currently lets any authored field through unexamined;
narrowing the type surfaces entries that pass fields they should not.

### C13. Move the executable fixture corpus into fixture files — Worth exploring

**Files:** `src/catalog.ts`, `tests/catalog.test.ts:161-167`, `tests/catalog-evidence.test.ts:51-64`

**Problem.** The fixture corpus is inline source triples — 102 code strings occupying 322 lines, about
94 distinct statements across 305 distinct backtick strings, 23 of them exact duplicates. The case
format cannot express "this example is deliberately declined," so `tests/catalog.test.ts:161-167`
contains a hand-written escape hatch, and `catalog-evidence.test.ts:51-64` repeats the whole lint loop
to re-prove diagnostics.

**Solution.** Turn the fixture corpus into files the rule and the tests both load. A fixture's
`filename` plus one violation is representable as a directory under `tests/fixtures/<rule>/`. The
catalog entry keeps only path and assertion kind — `reports` or `declines` — and the false-positive /
false-negative partition that `entry()` derives at `:265-273` becomes metadata on the file.

**Benefits.** *Leverage:* one fixture file serves the catalog test, the per-rule test, and local
debugging. *Locality:* the rule's review material sits beside the rule. *Testability:* the
"deliberately declined" case becomes an attribute of the file instead of a hand-written test escape
hatch.

**Risk.** Fixture filenames are load-bearing — `.br.js`, `.acl.js`, `.client.js`, `.server.js` drive
surface classification in `src/context/filename.ts` — so the move must preserve them exactly.

---

## D. The versioned knowledge bases

### D1. Ship only the fields the runtime reads; move declaration evidence to the fixture — Strong

**Files:** `scripts/audit-fluent-sdk.mjs:505-518`, `src/fluent/declaration-snapshots.ts` (21,927 lines),
`src/fluent/snapshot-types.ts`, `src/fluent/registry.ts:244,283`

**Problem.** `runtimeSnapshot` already exists as a projection seam but keeps five fields where the
runtime reads two. The only reads from shipped code are `declaration.idPolicy` (`registry.ts:244`) and
`declaration.module` (`registry.ts:283`). Measured from the built dist:

```
capabilities            345,796 bytes
discoveredCapabilities  222,319
lifecycle                74,288
typos                    11,367
absent                    4,546
                       ─────────
total                   658,316
earlier estimate         21,256  (withdrawn: omitted required discovered facts)
```

The original generated source was 21,927 lines and 828,665 bytes. The implemented projection is 3,902 lines and 101,060 bytes, an 87.8% byte reduction.

**Solution.** Tighten the projection to the fields shipped code reads: per version a name-to-`idPolicy`
map, the discovered-name set, and the introduction version. The declaration hashes, paths, `absent`,
`typos` and `lifecycle` stay in the JSON fixture, which is a repository artifact, not a package input.

**Benefits.** *Leverage:* the shipped interface matches the shipped contract, so a reader of
`registry.ts` and a reader of the generated file see the same fact set. *Locality:* the runtime/script
split becomes a single list at `audit-fluent-sdk.mjs:505-518` instead of an unenforced convention
spread over three files. *Testability:* the projection is one pure function of the audited object,
directly assertable, and `tests/integration/packed-consumer.test.ts` can assert tarball size.

**Risk.** The declaration hashes and `declarationPath` are the drift evidence — `lat.md/fluent.md`
calls the snapshot "the drift evidence." They must be relocated, not deleted;
`scripts/check-fluent-manifest.mjs:221-231` already deep-equals them. Migration cost is one
regeneration of both artifacts.

### D2. Build each version's manifest lazily behind `resolveFluentManifest` — Worth exploring

**Files:** `src/fluent/registry.ts:302`, `src/settings/index.ts:12`, `src/settings/validate.ts:290`

**Problem.** `registry.ts:302` builds all 27 manifests with `Object.fromEntries` at module load, and
`src/settings/index.ts:12` calls `validateServiceNowSettings(undefined)` at module load, whose
`fluentSdkVersion` parser calls `resolveFluentManifest` (`validate.ts:290`). The built `dist/index.js`
import graph — 120 modules — statically includes `dist/settings/index.js` and reaches
`dist/fluent/declaration-snapshots.js` through `dist/fluent/registry.js`. Importing the plugin
materialises 1,408 api objects and parses the snapshot for the default-settings case.

**Solution.** Memoise on demand: `resolveFluentManifest` builds a version's manifest on first request
and caches it, so importing the plugin for a project that never configures `fluentSdkVersion` builds
one manifest instead of 27. `fluentManifests()` (`registry.ts:327`) still builds all 27 for the check
script.

**Benefits.** *Leverage:* every plugin load builds one manifest instead of 27, without a caller change,
because the seam already exists. *Locality:* the caching condition lives in one function instead of a
top-level literal. *Testability:* unchanged; the same seam is exercised.

**Risk.** Low. The only observable difference is timing of failures: `registry.ts:233` throws a plain
`Error` at module load for a missing snapshot; lazily it throws at first resolve.
`resolveFluentManifest` already throws `ServiceNowSettingsError` at the same seam, so the error path
converges.

### D3. Give `typos` and `lifecycle` one home — Worth exploring

**Files:** `src/fluent/manifest.ts:169`, `scripts/audit-fluent-sdk.mjs:498`,
`src/fluent/declaration-snapshots.ts`, `scripts/check-fluent-manifest.mjs:234-252`

**Problem.** `typos` is copied into all 27 snapshot versions by `typos: DEFAULT_FLUENT_MANIFEST.typos`
(`audit-fluent-sdk.mjs:498`); measured, all 27 copies are byte-identical, 11,367 bytes. The check at
`check-fluent-manifest.mjs:234` asserts equality with the same manifest map the generator copied from,
so it cannot fail. Lifecycle exists three times for a single API: `manifest.ts:169`'s
`introduced: "4.10.0"`, the snapshot's `lifecycle` block (74,288 bytes), and the fixture's — asserted
equal by `:235-252`.

**Solution.** Stop copying `typos` into the snapshot; the runtime and check read
`DEFAULT_FLUENT_MANIFEST.typos` directly, which `src/constants.ts:64` already does for the
directive-typo path. Derive `lifecycle` from the capabilities and the fixture's evidence records at
check time instead of storing a third copy.

**Benefits.** *Locality:* one edit point for a typo map and for an introduction version instead of
two-to-four. *Leverage:* the check stops being a tautology and starts testing the manifest against its
own evidence. *Testability:* `tests/fluent-manifest.test.ts:85-104` currently reaches into
`FLUENT_DECLARATION_SNAPSHOTS["4.10.0"]?.lifecycle.StateModel` to get fixture data; with one home that
lookup becomes the manifest itself.

**Risk.** `lat.md/fluent.md` describes these blocks as part of the snapshot's purpose, so it must be
updated in the same change.

### D4. Replace the raw snapshot record with a shared declaration index — Worth exploring

**Files:** `src/fluent/declaration-snapshots.ts`, `src/fluent/registry.ts:225-300`,
`src/fluent/snapshot-types.ts:16`

**Problem.** `DeclarationSnapshot` and `FLUENT_DECLARATION_SNAPSHOTS: Readonly<Record<string,
DeclarationSnapshot>>` hand the caller a raw data shape, so `registry.ts` carries 70 lines of join
logic that reach into `.capabilities[api.name].idPolicy`, iterate
`Object.entries(snapshot.discoveredCapabilities)`, and re-derive introduction by scanning every version.
That version scan is duplicated in `scripts/audit-fluent-sdk.mjs:50` and
`scripts/check-fluent-manifest.mjs:261`. The interface exposes the raw record, so every consumer re-implements
the join.

**Solution.** The verify pass corrected the original proposal: the index should be a shared helper over
the existing record, not functions emitted into the generated module. `audit-fluent-sdk.mjs:525` emits
the module by string concatenation, so putting logic in the generated source is a heavier generator
change than the payoff justifies. A helper module — a policy lookup keyed by (version, name), a
discovered-in-version predicate, and an introduction lookup — leaves the generated artifact alone.

**Benefits.** *Leverage:* three callers each currently re-do a join; one implementation pays back
across all three. *Locality:* the version scan moves behind one function. *Testability:*
`introducedIn("AliasTemplate") === "4.8.0"` is directly assertable without constructing a snapshot
record.

**Risk.** `snapshot-types.ts` exists specifically to avoid a 939 KB declaration file (its comment cites
FINDINGS.md PER-001), so the helper must not widen what the generated module exposes.

### D6. Tighten `idPolicy`'s vocabulary so the silent override disappears — Worth exploring

**Files:** `src/fluent/snapshot-types.ts:13`, `src/fluent/manifest.ts:15`, `src/fluent/registry.ts:269`

**Problem.** `DeclarationCapability.idPolicy` is typed `"required" | "deprecated" | "unknown"` while
`FluentIdRequirement` has five values including `"forbidden"` and `"optional"`. Measured across all 27
versions, the only `idPolicy` values that occur are required, unknown and deprecated. `registry.ts:269`
then does `idRequirement: declaredPolicy === "unknown" ? api.idRequirement : declaredPolicy`, so
`Table`'s manual `forbidden` (`manifest.ts:172`) and every `column(...)` `forbidden` (`manifest.ts:95`)
survive only because the snapshot happens never to say `forbidden`. A caller reading `registry.ts` must
know an unstated invariant: the declaration is authoritative for id policy except where it cannot
express a value.

**Solution.** Either widen the snapshot's type to the five values and emit them, or state the
precedence explicitly as a named function so the override is visible rather than implicit in a ternary.

**Benefits.** *Locality:* the precedence rule lives in one named place. *Testability:* a test can
assert that no declaration contradicts a manual requirement — today the contradiction would silently
lose.

**Risk.** Low. If declarations never emit `forbidden` or `optional`, the change to make is naming the
precedence, not widening the type.

### D7. Collapse the declarations fixture and the runtime snapshot to one artifact — Speculative

**Files:** `tests/fixtures/fluent-sdk-declarations.json` (940 KB),
`src/fluent/declaration-snapshots.ts`, `scripts/check-fluent-manifest.mjs:221-231`

**Problem.** Two checked-in files hold the same five fields. The fixture carries eleven fields per
version; the snapshot carries five, and the check asserts `runtime.capabilities` deepEquals
`detail.capabilities`, `runtime.discoveredCapabilities` deepEquals `detail.discoveredCapabilities`, and
`runtime.absent` deepEquals `detail.absent`. Both are written from one in-memory object by
`audit-fluent-sdk.mjs:561-566`, so drift is already impossible via the generator — the deep-equal is
testing a distinction that exists only because the data is serialised twice.

**Solution.** Keep one artifact per concern: if D1 ships the runtime projection as generated code, the
fixture can shed `capabilities`/`discoveredCapabilities`/`absent` and keep only the review evidence —
integrity, `exportInventorySha256`, `unresolvedBareExports`, `unreviewedRequiredFactories`, paths.

**Benefits.** *Locality:* the same declaration fact stops existing in two files a reviewer must diff by
eye. *Leverage:* a 30-line cross-file deep-equal block is replaced by assertions against one source.
*Testability:* a declaration change is one diff, not two, in the round-trip check.

**Risk.** `scripts/compat-consumer.mjs:12` reads the fixture; dropping fields means updating that
consumer. `lat.md/fluent.md:33` says the fixture "holds the source data," which is inaccurate either
way.

---

## E. Repository-level seams

### E1. Extract one script CLI adapter and put every `.mjs` behind it — Worth exploring

**Files:** 27 `.mjs` in `scripts/` (7,465 lines)

**Problem.** There is no interface for a `scripts/` program. Measured:

```
fileURLToPath(import.meta.url) root derivations   20
pathToFileURL(process.argv[1]) guards             12
function fail  (three signatures)                  8
function argValue  (two signatures)                7
sha256 helpers                                     6
scripts printing usage                             1 of 27
```

The interface a maintainer must learn to add a gate is "read three other scripts and copy their
boilerplate, then remember which `fail` signature this one uses." `compat-consumer.mjs`'s `argValue`
takes `(name, fallback)` and reads `process.argv`; the other six take `(argv, name)`.

**Solution.** One module owns the CLI seam: repository root, the invoked-directly guard, argument
parsing, exit-code discipline, and one `fail` carrying a machine-readable kind. Each script keeps its
own behaviour and hands the adapter a run function. Keep `main()` and the existing declarations in
place.

**Benefits.** *Leverage:* one adapter pays back across 27 call sites. *Locality:* a change to how a
gate reports failure is edited in one module, not eight. *Testability:* argument parsing and exit-code
mapping become pure functions with a single test surface instead of being reachable only by spawning a
process.

**Risk.** The scripts run inside CI gates that must keep exact exit codes and stdout contracts — several
print JSON that workflows parse with `node -e`. The adapter must preserve stdout-versus-stderr
discipline exactly; a banner leaking into stdout silently breaks the workflow that parses it.

### E2. Export the catalog invariants as a module with one invariant per function — Worth exploring

**Files:** `scripts/check-catalog-docs.mjs` (371 lines), `tests/release/layer7.test.ts`

**Problem.** The checker enforces roughly forty invariants with 41 `fail()` sites and
`grep -c "^export"` returns 0. Its interface is the whole process, so the interface is as large as the
implementation: you cannot exercise "a fluent rule must not claim an instance release" without running
every other check first, and you cannot write a fixture that fails exactly one. The pure predicates
(`isValidIsoDate` at `:25`, `tableColumnCount` at `:45`) are the only separable parts and they are
private. It also re-derives `serviceNowReleasesForRule` and `fixKind` that `src/` already exports.

**Solution.** Turn the file into a module exporting a list of named invariants, each taking the catalog
and a file reader and returning errors. The CLI becomes a thin loop over that list. Keep the stateful
`git status --porcelain` round-trip check in the CLI.

**Benefits.** *Leverage:* one invariant implementation is exercised by the CLI and directly by tests.
*Locality:* a new catalog rule is a new listed invariant, not a new `fail()` call spliced into a
371-line flow. *Testability:* each of the roughly 15 groups gets a negative fixture, so a regression
points at the invariant that broke instead of "catalog check failed."

**Risk.** The checker runs as top-level code with four dynamic imports resolved relative to root;
extraction means threading those in. The porcelain check is genuinely stateful and should stay put.

### E4. Make the generated-artifact set one list — Worth exploring

**Files:** `package.json:79`, `scripts/check-catalog-docs.mjs:353-361`,
`scripts/generate-rule-docs.mjs:27,294`

**Problem.** "Which files are generated and must round-trip" is stated three times in two syntaxes and
the copies already disagree. `docs:check` diffs a named list including
`docs/australia-engine-updates.md` and four `.oxlintrc.json` files. The checker runs its own porcelain
status across a different set that omits `docs/australia-engine-updates.md` and broadens two entries to
whole directories. `lat.md/invariants.md:39-43` states the property a third time in prose. The
generators each carry their own copy of the marked-section replacement.

**Solution.** One module holds the generated-artifact manifest — paths, which generator owns each, and
the marked-section replacement — and `docs:check`, the checker and each generator read it.

**Benefits.** *Leverage:* one manifest drives three consumers; a path added once is checked everywhere.
*Locality:* the replacement helper used by two generators becomes one implementation.
*Testability:* the manifest is a data value a test can assert covers every generator output — today the
divergence between the two path sets is invisible to the suite.

**Risk.** Ordering: `docs:check` runs the generators before the diff, so the manifest must be readable
without running anything. The checker's porcelain set is deliberately broader than the diff's named
files, so reconciling them changes what the checker asserts.

### E5. Let `compat-consumer` use the host-verifier seam instead of four inline oxlint blocks — Worth exploring

**Files:** `scripts/compat-consumer.mjs`, `scripts/lib/host-verifier.mjs`, `scripts/verify-examples.mjs`

**Problem.** `lib/host-verifier.mjs` is the layer's real host seam — 16 exports including
`runHostProcess` (`:6`), `parseOxlintStdout` (`:35`), `classifyOxlintProof` (`:123`), and the
`HOST_FAULT_CODES` set that distinguishes a host fault from a rule finding. `verify-examples.mjs` uses
it 8 times. `compat-consumer.mjs` imports it 0 times and repeats one seven-step
oxlint-invoke-and-parse block four times (`:225-248`, `:359-380`, `:409-430`, `:477-499`), each with
its own try/execFileSync/catch `error.stdout`/JSON.parse/fail sequence. One adapter means a hypothetical
seam; this is the second adapter and it is not plugged in.

**Solution.** `compat-consumer` calls the host-verifier seam for every oxlint invocation, so the
invoke-and-classify step exists once and both consumers agree on what a host fault is. The seam stays
where it already is and gains its second adapter.

**Benefits.** *Leverage:* one host-run and one classify implementation pays back across
`verify-examples` and `compat-consumer` — the two-adapter condition that makes the seam real.
*Locality:* a fix to the `execFileSync` nonzero-exit handling, where `error.stdout` is load-bearing, is
fixed once. *Testability:* host outcomes become values tests can construct, rather than only
observable by installing a consumer tree.

**Risk.** The four blocks differ in what they do with the codes afterwards — one checks two specific
rules, one compares against fluent evidence capabilities, one against `javascriptMode`, one against
release cases — so only the invoke-and-classify step is shared, not the assertions. That is the right
share.

### E6. Give `run-tests.mjs` one result interface instead of two consumers re-indexing its JSON — Worth exploring

**Files:** `scripts/run-tests.mjs`, `scripts/test-json-reporter.mjs`,
`scripts/verify-doc-evidence.mjs:40-44,84`, `scripts/verify-acceptance-ledger.mjs:382-395`

**Problem.** Two consumers each build the identical `` `${test.file}::${test.fullName}` `` Map and
implement the same "exactly one match, status passed, not skipped or todo" predicate. That predicate is
exactly where a false "verified" could hide.

**Solution.** One module owns "ask the runner for outcomes and answer questions about them."

**Benefits.** *Leverage:* the pass/skip/todo predicate is written once. *Locality:* the reporter's shape
and the lookups that depend on it change together. *Testability:* the index and the lookup are pure
over a report object, so they can be tested with a hand-built report instead of by spawning
`node:test`.

**Risk.** R6's apparatus is not retiring — PR #51 has not merged — so both consumers remain live and
the duplication stays at two copies. Sequence this on its own merits.

### E7. Collapse the tarball-production seam so local and release inspect the same bytes — Speculative

**Files:** `scripts/check-release-artifact.mjs:356`, `scripts/compat-consumer.mjs:29`,
`scripts/create-github-release.mjs`, `scripts/verify-published-package.mjs`

**Problem.** "Build and pack exactly one tarball" has two implementations that disagree on the build
path. `check-release-artifact.mjs:356` does `ensureBuiltDist()` then
`npm pack --json --ignore-scripts --pack-destination=`, while `compat-consumer.mjs:29` shells
`npm run clean` and `npm run build` directly and packs into its own destination.
`check-release-artifact.mjs` is otherwise a deep module — 16 exports, publish-input construction at
`:284`, manifest normalization at `:237`, verified by `tests/release/artifact.test.ts` and
`layer7.test.ts` — so the tarball seam belongs there.

**Solution.** `compat-consumer` obtains its tarball from `packTarball`, passing its own destination when
the cell wants a fresh pack.

**Benefits.** *Leverage:* the pack implementation already pays back across `release.yml`,
`create-github-release` and `create-release-tag`; `compat-consumer` becomes one more caller of the same
seam instead of a parallel implementation. *Locality:* a fix to the build sequence — such as the
`ensureBuiltDist` banner-to-stderr handling at `:342-354`, added because callers parse stdout as JSON —
applies to local compat too.

**Risk.** `compat-consumer` can be invoked against a pre-built tarball (`--tarball`) or build one, and
deliberately packs in an isolated temp dir so cells do not collide. It also runs without the release
modules' heavier imports, so pulling in `check-release-artifact`'s module graph costs something.

### E8. Extract one temporary-project builder for the integration tier — Worth exploring

**Files:** `tests/integration/binding-host-contracts.test.ts:21-59`, `context-contracts.test.ts`,
`release-contracts.test.ts`, `packed-consumer.test.ts`, `tests/integration/helpers.ts`

**Problem.** Four integration tests independently build a temporary project: `mkdtempSync` into
`tmpdir`, write the source, write an `.oxlintrc.json` with a `jsPlugins` entry naming `dist/index.js`,
then run oxlint and a flat-config ESLint `Linter` over the same code. `binding-host-contracts.test.ts`
does it for each of 24 cases; `packed-consumer.test.ts` calls `writeFileSync` 14 times. The knowledge
that oxlint needs `jsPlugins: [{ name: "servicenow", specifier: <abs path to dist/index.js> }]` and
ESLint needs a flat config with `files: ["**/*.{js,ts,tsx}"]` is repeated in each.

**Solution.** One builder in `tests/integration/helpers.ts` takes source text, a filename and settings,
returns both a runnable oxlint config path and an ESLint flat-config array, and cleans up. Tests that
need something unusual — the packed consumer installing from a tarball — keep their own setup.

**Benefits.** *Leverage:* one implementation of the two-host config shape serves four call sites and 71
integration tests. *Locality:* when the plugin host contract changes, one file changes.
*Testability:* the builder can itself assert what it produced, so a malformed config fails with a named
error instead of an empty diagnostics list that reads as silence.

**Risk.** The four tests differ in ways that matter: `packed-consumer.test.ts` installs a tarball and
runs a real consumer; `release-contracts.test.ts` builds configs from a contract table.
Over-generalising could hide those differences. Keep the builder to the
`mkdtemp` + `jsPlugins` + ESLint-config core.

### E9. Make `assertInvalid` the single place a range can be asserted — Worth exploring

**Files:** `tests/helpers/rule-tester.ts`, `tests/rules/binding-matrix.test.ts:25-29`,
`tests/rules/fluent.test.ts:377,391-394`

**Problem.** `assertInvalid` returns `LintMessage[]` but 0 of 1,119 call sites consume it, while the
two places that assert a reported range bypass the harness entirely — reading `messages[0].line`
directly and pulling `line`/`column`/`endLine`/`endColumn` out of a raw `lint()` result. The range is
the fact the binding matrix exists to pin, and it is reachable only by not using the assertion.

**Solution.** Add a range expectation to the expectation object so a caller can assert start and end
the way it asserts `messageId`. Move the two bypassing call sites onto it.

**Benefits.** *Leverage:* range assertions become a documented capability of the one assertion helper
rather than a hand-written deep-equal in two files. *Locality:* the span-failure diagnostic moves into
`rule-tester.ts` where the message formatting for the other assertions already lives. *Testability:* a
suite-wide option to check ranges becomes expressible; today it is not, and only 11 of 1,022 `it`s check
a span.

**Risk.** Low. `fluent.test.ts` matches an array of messages index-by-index, so that case may need the
return value kept.

### E10. Move example text out of tests and assert against the rule's own message template — Worth exploring

**Files:** `tests/helpers/binding-matrix.ts:271,304`, `tests/rules/no-hardcoded-sysid.test.ts`,
`glide-and-engine.test.ts`, `src/catalog.ts:1304`

**Problem.** The full diagnostic string for a rule appears verbatim in `binding-matrix.ts` (11 report
cases), as an `includes` substring in 13 rule test files, and as `description` prose in the catalog —
already drifted in wording. The matrix entry for `no-client-gliderecord` at `:271` says "Client
GlideRecord is not supported in scoped applications. Query through a Script include with GlideAjax or
a Scripted REST API." while `catalog.ts:1304` says "Query on the server with GlideAjax or a Scripted
REST API." `rule-tester.ts:147-154` already resolves the template from `meta.messages`; the tests
bypass that path by passing a literal.

**Solution.** The case table carries a `messageId` — it already has one — and drops the `message`
string. Cases guarding a data-interpolated template keep an explicit expected string, because
interpolation is the behaviour under test.

**Benefits.** *Leverage:* one message per rule, in the rule. *Locality:* rewording a diagnostic stops
requiring edits in tests, catalog prose and generated docs. *Testability:* a template regression fails
once at the rule instead of passing in tests and drifting in docs.

**Risk.** The `interpolate()` path in `apply-rules.ts:43-45` substitutes data at report time, so any
test asserting a rendered string checks interpolation, not the template. Those cases must keep explicit
strings.

### E11. Split the phase-named test files along rule lines — Speculative

**Files:** `tests/rules/phase3.test.ts` (1,328 lines), `glide-and-engine.test.ts` (1,225),
`tests/release/layer7.test.ts` (1,229), `stateful-lifecycle.test.ts` (717) versus
`stateful-lifecycles.test.ts` (19)

**Problem.** Measured: 28 of the 51 rule implementations have no same-named file under `tests/rules/`.
Coverage sits in plan-named files. `phase3.test.ts` holds 8 describes and 77 `it`s across seven rules,
most of which have or should have rule-named files. `glide-and-engine.test.ts` puts 31 `it`s under one
describe named "engine extras" spanning `no-packages-calls`, `no-weak-references`, typed arrays and
DataView, and is the most-edited test file at 14 commits. The `stateful-lifecycle`/`stateful-lifecycles`
pair differs by one letter and their contents differ too.

**Solution.** Move each describe into the rule's own file — several already exist, such as
`no-at-method.test.ts`, `no-proxy.test.ts`, `no-client-gliderecord.test.ts`. Merge the 19-line
singleton. Split `layer7.test.ts` by the subsystem the 12 scripts belong to and rename off the layer
number.

**Benefits.** *Leverage:* a maintainer reading a failing rule test finds it under the rule name,
matching the 74 describes that already are. *Locality:* the three rules that currently have two homes —
`no-at-method`, `no-proxy`, `no-unsupported-syntax` each have a dedicated file and a block inside
`glide-and-engine.test.ts` — get one.

**ADR conflict.** `scripts/pr51-acceptance.json:3795,3825,3855` name `tests/rules/phase3.test.ts` as the
proof file for three criteria, and `docs/pr-51-acceptance-ledger.md:140-177` cites these files by line.
`docs/decisions.md` REM-002 retires that apparatus when the PR #51 line merges. PR #51 has not
merged, so this is blocked. A rename now fails `acceptance:check` and breaks the evidence URLs
recorded in `docs/rules/*.md`.

### E12. Give the eight-surface vocabulary one home — Worth exploring

**Files:** `src/types.ts:19-28`, `src/settings/validate.ts:36-45`, `src/catalog-metadata.ts:38-47`,
`src/index.ts:112-114`, `src/context/filename.ts:61-75`

**Problem.** The eight execution surfaces are authored at least twice as constant lists and once as a
union: `SURFACES` in `validate.ts:36-45` is exactly the eight members of `CLASSIC_SURFACES` in
`catalog-metadata.ts:38-47`, with `SERVER_SURFACES` and `CLIENT_SURFACES` as further partitions.
`src/index.ts` additionally bakes surfaces into eight flat-config objects. A new surface must be added
in the union, the validation set, the catalog partition and each flat config that should include it.
`src/context/filename.ts:61-75` holds eight separate glob constants for the same vocabulary.

**Solution.** Derive the validation set from the declared surface list and assert the catalog
partitions cover it exactly, so a new surface either appears everywhere or fails a check.

**Benefits.** *Locality:* one declared list; the other spellings are derived or checked. *Leverage:* a
fourth partition consumer gets the vocabulary free. *Testability:* "every surface has a filename glob"
and "the partitions are exhaustive and disjoint" become assertions instead of conventions.

**Risk.** `SCRIPT_KINDS` (`src/types.ts:168-178`) is a different, deprecated vocabulary — it
belongs to the retiring 1.x `scriptType` settings layer under `docs/decisions.md` FEAT-002 — and must
not be merged into it.

### E13. Separate the release-update document tables from the capability tables — Worth exploring

**Files:** `src/engine/australia-updates.ts` (287 lines), `src/engine/features.ts` (447),
`src/fluent/evidence.ts` (38), `src/fluent/lifecycle.ts` (21)

**Problem.** Four modules hold evidence records — URLs plus provenance per version — in four shapes.
`engine/features.ts` carries `ENGINE_FEATURE_EVIDENCE`; `engine/australia-updates.ts` carries
`AUSTRALIA_ENGINE_UPDATE_EVIDENCE` plus a roughly 250-line disposition table read only by a doc
generator (`scripts/generate-australia-engine-docs.mjs:7`); `fluent/evidence.ts` and
`fluent/lifecycle.ts` are 59 lines between them. The citation discipline, treated as load-bearing in
`lat.md`, has no shared shape and no shared validator.

**Solution.** One small evidenced-fact type with a URL and a version, plus one validator asserting
every fact in every knowledge base carries a citation and a date. The Australia disposition table,
which no runtime reads, moves to a data file the generator owns.

**Benefits.** *Locality:* the citation requirement is checked once. *Leverage:* a new knowledge base
cannot ship uncited facts. *Testability:* the validator is a pure function over the union of tables.

**Risk.** The four shapes encode different things — a feature may be supported, unsupported
or unknown per mode; a disposition is `covered`, `not-applicable` or `pending` with an owner. The
shared part is the citation, not the payload; forcing more would be a worse shape.

---

## F. Additions from the adversarial pass

These additions arrived from the workflow's other survey slices and the completeness critic. They are not
duplicates of A–E and several rank above the middle of the list.

### F1. Make `GlideCapabilityView` the only home for role membership; delete the nine flat sets — Cleanup

**Files:** `src/glide/index.ts:1-16`, `src/glide/manifest.ts:297`, `src/analysis/query-before-next.ts`,
`src/analysis/acl-query.ts`, `src/rules/no-system-query-bypass.ts`,
`src/rules/no-glideelement-in-collection.ts`

**Problem.** `manifest.ts` publishes nine module-level role sets and derives the same nine onto
`GlideCapabilityView` (`manifest.ts:352-372`). Two homes for one fact. Both exist:

```
GLIDE_FILTER_METHODS      GLIDE_QUERY_MODIFIERS      GLIDE_SYSTEM_BYPASS_METHODS
GLIDE_QUERY_EXECUTORS     GLIDE_RESULT_CONSUMERS     GLIDE_CURSOR_ADVANCERS
GLIDE_BULK_METHODS        GLIDE_VALUE_EXTRACTORS     GLIDE_KNOWN_METHODS
```

all re-exported from the 16-line barrel `src/glide/index.ts:1-16`.

**Solution.** Delete the flat sets. Callers hold the view, which they already have via `analysis.glide`.
The view is already scope-and-release aware, so a caller that used the flat set was silently opting out
of the versioned dimension.

**Benefits.** Eight module-level exports disappear, and role membership has one derivation site. `tests/glide/manifest.test.ts` was the only consumer of the flat sets, so it now tests the resolved view.

**Deletion test.** Deleting the sets required changes only in tests. Production already used `analysis.glide`, so this candidate removes dead duplicate exports rather than deepening a production interface.

**Risk.** Test churn in one file. Land this before A6 — both edit the same role-derivation code, and
consolidating first means the per-kind axis is added once instead of twice.

### F2. Give context resolution one input record and one confidence-carrying result type — Worth exploring

**Files:** `src/context/resolve.ts` (338 lines), `src/context/filename.ts` (172),
`src/settings/validate.ts` (399)

**Problem.** `resolveScriptContext` is one 50-line function coordinating five private resolvers
(`resolveAuthoring`, `resolveSurfaces`, `resolveJavaScriptMode`, `hasEsLatestPragma`, `inferSurfaces`),
each taking a different pair of arguments. Above it sit eleven exported predicates —
`isFluentContext`, `isInstanceScript`, `isClientCapableContext`, `isServerInstanceContext`,
`isMixedUiActionContext`, `appliesToInstanceScripts`, `appliesOnSurface`, `javascriptModeIs`,
`appliesInJavaScriptModes`, `hasSurface` — each a one-line composition of fields.
`ContextConfidence` is a four-level ordering but the ordering is used only inside `resolve.ts`, so a
reader deciding whether a fact is known must re-derive the ordering permission from the field.

**Solution.** Move the confidence ordering onto the context itself, so a rule asks one question instead
of reading three fields and comparing against a private order. The eleven predicates become one module
with one entry point per question.

**Benefits.** *Locality:* the meaning of each confidence level lives with the type instead of being
re-derived. *Leverage:* a new confidence level is one edit. *Testability:* the ordering becomes directly
assertable rather than verified through rule output.

**Risk.** The eleven predicates are the rules' vocabulary today; renaming them touches many files. The
version worth doing keeps the names and changes what they read.

### F3. Isolate the 1.x layer behind one compatibility adapter — Worth exploring

**Files:** `src/settings/validate.ts` (399 lines), `src/types.ts:168-178`, `src/settings/index.ts`,
`src/catalog.ts`

**Problem.** `docs/decisions.md` FEAT-002 retires the 1.x settings layer — `scriptType`, `ecmaLatest`,
`@sn-es-latest` — in 3.0. Until then the deprecated vocabulary is interleaved with the live one:
`SCRIPT_KINDS` (`types.ts:168-178`) and `SCRIPT_TYPE_VALUES` (`validate.ts:24`) sit beside `SURFACES`
and `AUTHORING_VALUES` in the same file, and `hasEsLatestPragma` (`resolve.ts:62`) reads a comment pragma
that belongs to the retiring layer.

**Solution.** One adapter owns the deprecated translation — the `scriptType`/`ecmaLatest` values, their
mappings onto authoring, surfaces and JavaScript mode, and the deprecation warnings. The live
validation path stops containing the deprecated vocabulary. When 3.0 lands, the adapter is deleted whole.

**Benefits.** *Locality:* the removal is a file deletion rather than an edit spread across the live validation path, which is the
condition `docs/decisions.md` FEAT-002 assumes. *Leverage:* the live path gets smaller now, not at 3.0.
*Testability:* the translation is testable as a table.

**Risk.** The deprecation path has its own tests and warning output; the adapter must preserve the
exact `SettingsDeprecation` records the host surfaces.

### F4. Move the rule-side silence gate behind one trust-aware provenance accessor — Worth exploring

**Files:** `src/analysis/provenance.ts`, `src/analysis/public.ts`, `src/rules/*.ts`

**Problem.** A rule that uses a provenance fact must first ask whether the fact is trustworthy —
matching the platform API by name is forbidden, and the `invalid` and `escaped` flags are the gate.
Today that gate is written at each call site as a conjunction over the `Provenance` fields, so the
"never report from unproven evidence" invariant is enforced per rule rather than by the query that hands
out the evidence.

**Solution.** One accessor returns a fact only when the record proves it, and returns absence otherwise,
so the conjunction has one implementation and a rule cannot forget half of it.

**Benefits.** *Locality:* the invariant `lat.md` treats as binding — silence on unknown facts —
gets one enforcement point on the read path. *Leverage:* a new field on `Provenance` gets the gate for
free. *Testability:* the gate is testable as a function of a record rather than through rule output.

**Risk.** The existing rule-side conjunctions may encode per-rule policy that is not a single
predicate; those rules must keep a narrower check on top of the accessor.

### F5. Fold the provenance conjunct into the platform-identity proof — Worth exploring

**Files:** `src/analysis/platform-method-authority.ts` (108 lines), `src/analysis/provenance.ts`

**Problem.** The authority proof and the provenance gate are two separate questions a caller must ask
in the right order. `hasAuthoritativeGlideRecordMethod` answers "is this still the platform's method"
and the caller separately reads `rec.invalid` / `rec.escaped` from the `Provenance` record. Both are
about the same underlying question — is this receiver's identity proven — and a caller that asks one
without the other has a hole.

**Solution.** One query answers the combined question, with the two existing functions as its named
parts. The seam stays in `platform-method-authority.ts`; the conjunct moves inside it.

**Benefits.** *Locality:* identity proof has one home. *Leverage:* the eleven finders that currently
write the two-part check inherit the combined one. *Testability:* `tests/rules/platform-method-authority.test.ts`
already pins the proof, so the combined query is exercised by existing fixtures.

**Risk.** The provenance half is per-record while the authority half is per-file (deliberately file-wide
for root replacement, per the docblock at `:36-41`). Combining them must not make the file-wide half
look per-record.

### F6. Callers stop writing guard cache keys; the module interns the adapter — Worth exploring

**Files:** `src/rules/unsupported-constructor-rule.ts`, `src/analysis/platform-constructor-calls.ts`

**Problem.** The rule factory's callers hand-construct cache keys for the availability guards. The
guard's identity is derivable from the options the caller already passes, so the key is a value the
caller must know without being told what makes two guards the same.

**Solution.** The module interns the adapter: the caller passes the guard options and receives the
cached adapter, with the key derived inside.

**Benefits.** *Locality:* the identity rule for a guard lives with the guard. *Leverage:* a caller
cannot construct a colliding or missing key. *Testability:* cache hit and miss become assertable at the
module boundary instead of inferred from rule behaviour.

**Risk.** Low. The current keys are correct; this removes an obligation rather than fixing a bug.

### F7. Gate README's three unmarked fact blocks — Worth exploring

**Files:** `README.md`, `scripts/generate-rule-docs.mjs:311-316`, `scripts/check-catalog-docs.mjs`

**Problem.** The generator replaces five marked sections — `classic-rules`, `engine-rules`,
`fluent-rules`, `migration-1.1-to-2.0`, `repository-links` (`generate-rule-docs.mjs:311-316`). The
rest of the README's fact-bearing prose is hand-maintained and `docs:check`'s `git diff --exit-code`
only proves the *marked* sections round-trip. A hand-edited count or list elsewhere drifts with
nothing to catch it.

**Solution.** Add a drift invariant for the three unmarked fact blocks, checking them against the
catalog rather than generating more output.

**Benefits.** *Locality:* the README's facts are checked where they already live. *Testability:* one
negative fixture per block.

### F8. One home for the GlideRecord-like constructor set — Worth exploring

**Files:** `src/constants.ts:172`, `src/analysis/platform-method-authority.ts:15`,
`src/rules/no-client-gliderecord.ts:8`, `src/rules/no-hardcoded-table-names.ts:23`

**Problem.** The fact "which constructors produce a GlideRecord-like cursor" is authored four times
independently. `src/constants.ts:172` declares `GLIDE_RECORD_CTORS = ["GlideRecord",
"GlideRecordSecure"]` and has zero consumers repo-wide — verified with a per-symbol grep across
`src/`, `tests/` and `scripts/`. `platform-method-authority.ts:15` declares the identical two-element
list as `GLIDE_RECORD_CONSTRUCTORS` and is the only one used. `no-client-gliderecord.ts:8`
declares a third copy as `CTORS`. `no-hardcoded-table-names.ts:23` declares a fourth that also carries
`GlideAggregate`.

**Solution.** Delete `GLIDE_RECORD_CTORS`. Move the constructor set into the module that already owns
the proof, `platform-method-authority.ts`, and export it from there as part of the platform-identity
interface. The GlideAggregate-bearing variant in `no-hardcoded-table-names.ts` becomes a derivation,
since the extra member is the only difference. Keep each rule's own pairing of constructor to message
id local.

**Benefits.** *Locality:* one authoring site for a fact four modules currently guess at independently.
*Leverage:* a new record-like constructor lands once. *Testability:* the set becomes part of the
interface `tests/rules/platform-method-authority.test.ts` already pins.

### F9. `src/constants.ts` is 40% dead exports — Worth exploring

**Files:** `src/constants.ts` (25 exports)

**Problem.** Measured: ten exports have zero consumers repo-wide —
`FLUENT_CORE_APIS`, `FLUENT_CORE_API_SET`, `FLUENT_COLUMN_APIS`, `FLUENT_IMPORT_SET`,
`FLUENT_ENTITIES_REQUIRING_ID`, `KNOWN_FLUENT_DIRECTIVES`, `GLIDE_MUTATING_METHODS`,
`CLIENT_GLOBALS_WEAK`, `GLIDE_RECORD_CTORS`, `CLIENT_GLOBALS` — plus the `FluentCoreApi` type derived
from the first. That is 11 of 25 exports. `GLIDE_MUTATING_METHODS` also overlaps the live
`GLIDE_CURSOR_ADVANCERS`/`GLIDE_BULK_METHODS` role sets that F1 consolidates.

**Solution.** Delete them. Keep `PACKAGE_VERSION` and `PLUGIN_NAME`.

**Benefits.** *Locality:* a module whose stated job is to be the home for shared constants stops
answering "is this one used?" for eleven of them. *Leverage:* the deletion test is clean —
nothing imports them.

**Risk.** Confirm against the packed-consumer contract before deleting. None of the eleven appear in
`src/index.ts`'s public surface as checked, but a constant reachable from a published entry would make
this a public-surface change.

### F10. Browser mutation index built only where a browser question is asked — Speculative

**Files:** `src/analysis/file-analysis.ts:240,247`, `src/analysis/mutations.ts:205-752`, `:591`

**Problem.** Every analyzed file pays two whole-program traversals to build the same index twice.
`file-analysis.ts:240` calls `createMutationQuery(program, bindings, bindingWrites, provenance,
javascriptMode)` and `:247` repeats it with the extra argument `"browser"`. Each call enters `buildIndex`
— 548 lines, `:205-752` — and runs its own `walk(program, ...)` at `:591`, over the whole AST, at
file-analysis time, for every file and every lint run. The two indexes differ in exactly two derived
booleans, both computed at the top of `buildIndex`. Only four rule call paths ask the browser question,
verified: `require-callback-for-getreference.ts:87` (`runtime: "browser"`), `no-sync-glideajax.ts:35`,
`no-glideajax-getanswer.ts:35`, and the `mutationsFor` selector at `platform-method-authority.ts:33`.

**Solution.** Keep both variants and the `mutationsFor` seam, but do not construct the browser index at
file-analysis time. Store the inputs and let `mutationsFor` ask for the browser-shaped query only when
`runtime` is `"browser"`, memoising per file. Do not remove the browser variant: the variation is real
and load-bearing — a browser file can reach `globalThis` and `Reflect.apply` where an es5 instance file
cannot.

**Benefits.** *Leverage:* every file in every lint run skips a second full-program walk that only four
call paths can consume. *Locality:* the laziness condition lives inside the module that owns the index.

**Risk.** Speculative because the payoff depends on the walk's share of file-analysis time, which
nobody has profiled. Measure before doing it.

### F11. Make the finding registry the interface and derive citations from it — Speculative

**Files:** `FINDINGS.md`, `scripts/check-catalog-docs.mjs`, `tests/acceptance-ledger.test.ts`

**Problem.** The finding-id registry is data that lives inside prose and nothing reads it. `FINDINGS.md`
is 3,662 lines; its head carries an HTML-comment `SUPER-REVIEW-REGISTRY` JSON block with
`schema_version: 2`, 37 active ids each a content fingerprint, 32 retired ids with status and
replacement ids, and a 13-key `next_sequence`. Measured: 35 distinct ids are cited across `src/`,
`scripts/` and `tests/`. Nineteen of those cited ids are registered as retired with status `resolved` —
`COR-001`, `COR-002`, `COR-006`, `COR-008`, `DOC-001`, `DOC-002`, `IMP-002`, `MNT-001`, `MNT-002`,
`MNT-004`, `OPS-001`, `OPS-002`, `OPS-004`, `OPS-006`, `PER-001`, `PER-002`, `REL-001`, `REL-002`,
`REL-003` — and the citations are still written as live justifications. No script reads or validates the
block; the ten `.mjs` files that mention FINDINGS only string-match `FINDINGS.md <ID>` in comments.

**Solution.** Move the JSON block into an importable module, export the id set with each id's status,
and add one invariant to the existing `docs:check` run: every `FINDINGS.md <ID>` citation in `src/`,
`scripts/` and `tests/` must resolve to a registered id, and a citation of a retired id must be
flagged for rewording. Keep `FINDINGS.md` as the prose home the block embeds from; do not generate the
prose.

**Benefits.** *Locality:* the citation vocabulary gets one home. *Testability:* a stale citation becomes
a failing gate instead of a comment that reads as a live justification. This matters because the
codebase uses these ids as the reason for several decisions — including the COR-016 comment that A1 is
about — so a citation pointing at a resolved finding leaves that decision without a stated basis.

**Risk.** Requires normalising 79 call sites' citation format.

### F12. Make stable-callable classification one query, not three — Worth exploring

**Files:** `src/analysis/stable-invocations.ts`, `src/analysis/glide-query-in-loop.ts:120`,
`src/rules/no-incorrect-array-from-thisarg.ts:36`, `src/rules/require-callback-for-getreference.ts:21`

**Problem.** Three modules answer "is this function binding a stable callable," and the module named
for it answers it once. `analyzeStableInvocations` (`stable-invocations.ts:39`) has exactly one caller,
`glide-query-in-loop.ts:120`. Its internal `resolveBase` loop classifies a binding by walking to its
initializer. `stableMapperFunction` (`no-incorrect-array-from-thisarg.ts:36`) runs the same
classification through `resolveDominatingConstValue`, and `callbackKind`
(`require-callback-for-getreference.ts:21`) runs it again, also through `resolveDominatingConstValue`.
The named module uses the weaker `resolveConstValue`.

**Solution.** Export the callable classification from `stable-invocations.ts` as the module's interface,
alongside the existing `analyzeStableInvocations`, and have both rules call it instead of re-walking.
Keep each rule's policy local: what counts as a mapper, and what counts as a callback, stay rule-owned;
only "this binding resolves to a stable callable, and here it is" moves.

**Benefits.** *Locality:* the module named for the concept becomes the module that owns it.
*Leverage:* the temporal-resolver choice is made once instead of three times, two of them silently
different.

**Risk.** Land B5 first or in the same change, since both callers pass through
`resolveDominatingConstValue`.

---

## R. Refuted candidates

Refutations verified by re-reading the code. Recorded so they are not re-proposed.

**R1. Move the Now.ID path-domain hooks into `now-id.ts`** (was B2, badged Strong). `buildFileAnalysis`
must invoke `analyzePathBindings` exactly once, because `FilePathData` is the single payload on the
single cached `FileAnalysis`. The hooks are the configuration of one interpreter invocation, not N
separable per-domain builders: `onRef` (`file-analysis.ts:180-204`) writes `nowIdAt` and
`provenanceAtNode`/`identifierAtNode` in the same closure, so they cannot be split from that
invocation. What survives is naming the inline hook set in place.

**R2. Collapse `public.ts` into a single publishing adapter** (was B3, badged Strong). The published
file already is the narrowing adapter the candidate asks for, and the block called a duplicate
implementation is contract-mandated divergence that cannot be composed from the internal interface.
`tests/analysis/public-api.test.ts:144` asserts `isPlatformMember(aliasedMember, "DataView",
"getBigInt64") === false`. The internal `isPlatformMember` (`file-analysis.ts:302-313`) returns `true`
for exactly that input, because `DataView` is a `ProvenanceKind` and the `aliased` branch accepts it.
Composing the public behaviour from the internal query either returns `true` and fails the test, or has
to cap the internal shape.

**R3. Widen `unsupportedConstructorRule` into the family factory it half is** (was C9, badged Strong).
The factory's job is options-plus-reporting, and the reporting half is irreducibly rule-specific: a
feature table keyed by name, one or two message ids, per-branch messages. `no-promise.ts:61-77` merges
and sorts two finding kinds; `no-typed-arrays.ts` emits `ctor`, `bigintCtor`, `factory` and
`bigintGetter`. To absorb them the factory interface grows to five parameters whose values differ for
every rule — the shallow "large interface, thin implementation" module the design skill rejects. What
survives is hoisting the duplicated availability-guard closures beside
`isUnsupportedGlobalInvocationProtected`.

**R4. One consensus resolution for every versioned knowledge base** (was D5). Partly refuted. The
resolved-value interface already exists: `featureSupport` (`features.ts:398`) returns the tri-state
`FeatureSupport | "unknown"` and `tests/engine-features.test.ts:59-100` already asserts it as a value.
The candidate conflated the gate `shouldDiagnoseFeature` with the value `featureSupport` and proposed
widening the gate. `featureSupport` knows nothing about Fluent contexts, mixed UI Actions, surfaces or
unknown-mode policy; a rule reading its gate from it would drop the four scope conditions at
`features.ts:425-430`. Separately, Glide's some/every split and Fluent's per-field override do not share
a shape. Residual: one helper (`admissibleReleases`, `features.ts:390-392`) moved next to
`SUPPORTED_SERVICENOW_RELEASES`, plus a comment.

**R5. One evidence registry keyed by id** (was F5). `GlideRecordEvidence` (`glide/manifest.ts:27-55`)
holds two URLs per release, `scoped` and `global`, so a single-row registry cannot represent Glide
without splitting each release into two ids. `FluentEvidenceRecord` (`fluent/manifest.ts:19-27`)
carries `symbol`, `version` and `transition` per row — row facts, not registry facts. The union of every
shape is a shallow module. What survives is a one-line URL derivation.

**R6. REM-002 retirement gate** (was E3, badged Strong). See the correction section. PR #51 has not
merged; the trigger has not fired.

---

## Ordering

By expected payoff, from the completeness critic with the author's revisions:

1. **D1** Project the shipped snapshot to the two facts `registry.ts` reads — Strong, CONFIRMED
2. **F1** Make `GlideCapabilityView` the only home for role membership — Cleanup, CONFIRMED
3. **A1** One memoised path-domain entry point that owns dedupe and exhaustion — Worth exploring
4. **A2** Return budget exhaustion as a value — Worth exploring
5. **B4** Give the execution-boundary rule one implementation — Worth exploring
6. **A6** Per-receiver-kind roles in the Glide manifest — Worth exploring
7. **C1** Split the catalog descriptor literal per rule — Worth exploring
8. **C3** Concentrate the rule visitor protocol — Worth exploring
9. **F5** Fold the provenance conjunct into the platform-identity proof — Worth exploring
10. **F4** Rule-side silence gate behind one accessor — Worth exploring
11. **A5** Fuse the GlideRecord cursor passes — Worth exploring
12. **B5** Merge the two const resolvers — Worth exploring
13. **F12** Stable-callable classification is one query — Worth exploring
14. **F6** Intern the guard adapter — Worth exploring
15. **B1** Named shape for the file-analysis cache key — Worth exploring
16. **D4** Shared declaration index — Worth exploring
17. **E1** One script CLI adapter — Worth exploring
18. **E2** Export the catalog invariants as a module — Worth exploring
19. **F9** `constants.ts` dead exports — Worth exploring
20. **C2** Split the release-review ledger out — Worth exploring
21. **A7** One cursor traversal for both walkers — Worth exploring
22. **F7** README drift gate — Worth exploring
23. **F2** Context resolution confidence algebra — Worth exploring
24. **F3** Isolate the 1.x layer — Worth exploring
25. **A3** Interpreter domain constructors — Worth exploring
26. **D2** Lazy fluent manifests — Worth exploring
27. **C4** Harness filename from catalog applicability — Worth exploring
28. **E5** `compat-consumer` uses the host-verifier seam — Worth exploring
29. **D3** One home for `typos` and `lifecycle` — Worth exploring
30. **E10** Examples assert against the rule's message template — Worth exploring
31. **A4** Typed reason from each finder — Worth exploring
32. **C5** Settings parameter for the matrix constructors — Worth exploring
33. **D6** `idPolicy` precedence named — Worth exploring
34. **C7** Collapse the finding types — Worth exploring
35. **C6** One home for each rule's description — Worth exploring
36. **E8** One temporary-project builder — Worth exploring
37. **E9** `assertInvalid` asserts ranges — Worth exploring
38. **C10** Delete `preset` — Worth exploring
39. **C11** Separate runtime and documentation projections — Worth exploring
40. **C13** Fixture corpus into files — Worth exploring
41. **E12** One home for the surface vocabulary — Worth exploring
42. **E13** Separate release-update tables — Worth exploring
43. **E4** One generated-artifact list — Worth exploring
44. **F8** One constructor set — Worth exploring
45. **E6** One result interface for `run-tests.mjs` — Worth exploring
46. **C8** Derive the gate from applicability — Speculative
47. **C12** `entry()` derives instead of validating — Speculative
48. **B6** Derive the published provenance type — Speculative
49. **D7** One declaration artifact — Speculative
50. **E7** Collapse the tarball seam — Speculative
51. **E11** Split the phase-named test files — Speculative, **blocked on PR #51 merging**
52. **F10** Lazy browser mutation index — Speculative, measure first
53. **F11** Finding registry as an interface — Speculative
54. **A8** Fold do/while completion into the interpreter — Speculative

**Also demoted by the critic, with reasons.** C5 (`Add a settings parameter to the matrix case
constructors`) is test ergonomics rather than interface depth; the verifier had to fold in an unrelated
`location()` correction to make it worth listing. A3 (`Interpreter domain constructors`) is mechanical
clone-and-equality factoring that is close to the one-adapter hypothetical. A7 (`One cursor traversal`)
has a narrower duplication and wider divergence than first claimed. C1 as originally written is
file-layout redistribution; scope it to the descriptor literal.

## Top recommendation

**D1 was implemented first.** `runtimeSnapshot` projects the review fixture to the fields `registry.ts` reads. The generated source fell from 21,927 lines and 828,665 bytes to 3,902 lines and 101,060 bytes. Declaration paths, hashes, absent names, and lifecycle evidence remain in the fixture. D2 then made manifest construction lazy.

**F1 was cleanup, not the second-deepest candidate.** Production already used `analysis.glide`; only tests read the flat exports. Removing them simplified the module before A6 added the per-kind role table.

**C1 drops to seventh.** It is the most-edited file in the repository — 4,545 lines, 30 of the last 77
commits — but the corrected framing is right that as stated it moves roughly 83 lines of authored input
per rule between files without deepening an interface. The version worth doing is narrower: move the
descriptor literal next to the rule, leave `entry()` and the derived fields where they are.

**Blocked, do not attempt yet:** E11 and any rename of `tests/rules/phase3.test.ts`. PR #51 has not
merged and the acceptance ledger pins those files by name and line.
