# Goal: fully remediate PR #51 before merge or release

## Objective

Starting from PR #51 HEAD `8b650abaa608bb6b5d30914c3de2a16c6ab14d4d`, resolve **every defect and unmet acceptance criterion in this document**. Deliver the work as independently reviewable layers, with red-before-green regression tests and real-host/package evidence. The result must be safe to merge and must make the in-repository release path genuinely executable; explicitly-live publication gates remain human/maintainer work and must be reported as such.

The comparison point is the PR merge base `2af573262d11583e123c3ac470850d8cf515d907` (`git diff origin/main...HEAD`). Treat issues #2–#76, their exact acceptance criteria, and this handoff as the specification. When implementation and an issue disagree, the issue acceptance criterion wins. In particular, issue #6 requires ES2021 to **accept private members**; fix the feature model rather than adding a private-member rejection to the ES2021 preset.

## Operating contract

1. Read `CONTRIBUTING.md`, `docs/rule-authoring.md`, `docs/pr-51-layers.md`, relevant research documents, and issue bodies before changing their subsystem.
2. Restack in dependency order. Do not combine privileged release workflow changes with rule/analysis implementation. If GitHub PR creation is unavailable, create the corresponding ordered branches/commits and provide exact push/PR commands; do not claim issue #75 is complete until separate PRs exist.
3. For every behavioral defect:
   - add the smallest regression that fails for the reported reason;
   - assert the exact rule ID, message, count, and useful source location where applicable;
   - implement the shared/root fix rather than patching individual fixtures;
   - run focused unit tests and at least one real Oxlint or ESLint host fixture;
   - preserve conservative silence for genuinely unknown provenance/context while reporting when a bad path is definitely reachable.
4. Replace tests that currently codify unsafe silence; do not make a gate green with an unrelated diagnostic.
5. Keep generated output with its descriptor/source change. Run generators rather than hand-editing generated files.
6. Keep public APIs compatible unless an issue explicitly requires a break. Document any unavoidable contract or minimum-version change.
7. Maintain a ledger with one row per issue acceptance-criterion checkbox and per handoff checkbox below; many-to-one evidence links are allowed. Record the regression test, implementation commit, validation command, and status. A grouped “probably fixed” entry is not completion.

## Required delivery stack

Create these separately reviewable layers, each green on its own and based on its predecessor:

1. **Context, settings, catalog, and engine capabilities**
2. **Binding, object identity, provenance, and completion-aware control flow**
3. **Classic/stateful rule consumers**
4. **Fluent manifests and binding-aware Fluent rules**
5. **Profiles, oxfmt, generated documentation, and research evidence**
6. **Packed compatibility and trustworthy benchmarks**
7. **Privileged release automation only**

For each layer, provide focused acceptance criteria, validation output, rollback boundary, and dependency on prior layers. PR #51 should become a tracking/restack PR or be superseded with links to the stack.

---

## 1. Context, settings, catalog, and engine capabilities

### Context classification

- [x] **Ambiguous UI Actions:** fix `src/context/resolve.ts` so a bare `*.ui-action.js` is not assumed server-side. Continue AST inference after recognizing the UI Action record type, allowing client, server, mixed, or unresolved execution surfaces as evidence permits. Add bare/client/server/mixed/conflicting UI Action matrices.
- [x] **Legacy precedence:** explicit supported `settings.servicenow.scriptType` values must retain their documented one-major precedence/mapping even when the filename is `.now.ts`; contradictory settings must either resolve according to the documented precedence or fail validation, never silently disable all relevant rules.
- [x] **Server suffix:** recognize the documented `*.server.js` convention and prove real server-only diagnostics execute. Do not remove or rename this public convention without an explicit compatibility decision and migration.
- [x] **Overall confidence:** fix `src/context/resolve.ts` so overall confidence reflects the weakest unresolved independent dimension rather than being promoted by a strong filename/authoring dimension. Test authoring, surfaces, JavaScript mode, and scope independently.
- [x] **Unknown-context silence:** gate `no-hardcoded-sysid` and `no-display-value-date-comparison` according to their documented applicability. Ordinary unclassified JavaScript, including unrelated 32-hex tokens, must remain silent.
- [x] **UI Action docs:** correct the example README block that explicitly sets `ui-action,server` while claiming auto/client preservation. Execute the exact copied configuration in tests.

### Settings and caching

- [x] **Release selection:** make `settings.release` select validated, versioned knowledge, or reject unsupported/unknown values. Do not accept typos while always applying Zurich behavior.
- [x] **Deep readonly contract:** make every property of `ValidatedServiceNowSettings`, `ValidatedSettingsResult`, and nested collections readonly in TypeScript, matching runtime deep-freeze behavior. Add compile-time negative tests and runtime top-level/nested/cross-context mutation tests.
- [x] **Cache identity:** include `allowedSysIds`, `allowedTables`, `scopePrefix`, and every other semantic input in `src/analysis/file-analysis.ts::settingsKey`. Test one `SourceCode` identity under differing settings and prove no stale allowlist/naming decision leaks.
- [x] **Rule-option parity:** retain the descriptor-driven implementation, but prove every configurable rule’s runtime parser, host `meta.schema`, `applyRules` behavior, and generated docs are in exact parity. Add table-driven valid, invalid, missing, unknown, nested, boundary, and conflicting cases for booleans, integers/minima, enums, strings, arrays/item types, and required properties; require full-path errors and no coercion. Fix demonstrated mismatches rather than rewriting working machinery.

### Presets and engine knowledge

- [x] **ESLint flat profiles:** make `flat.classicEs5`, `flat.client`, `flat.businessRule`, and `flat.fluent` independently consumable by supplying their required ServiceNow settings/context. Prove equivalent behavior through ESLint and Oxlint.
- [x] **ES2021 private members:** issue #6 is authoritative: private instance and static members supported by the target ES2021 engine must be accepted. Correct `ENGINE_FEATURES`, catalog metadata, docs, presets, and tests consistently.
- [x] **Mode-invariant unsupported features:** features genuinely unsupported in every modeled instance mode, including BigInt64/BigUint64 typed arrays if confirmed by evidence, must still diagnose in a known instance script when JavaScript mode is unknown. Do not apply this to private members if #6 says they are supported in ES2021.

**Layer completion:** exhaustive context/conflict matrices pass in unit tests plus real Oxlint and ESLint hosts; public context output and generated applicability docs agree.

---

## 2. Binding, object identity, provenance, and completion-aware control flow

Implement these as shared analysis semantics before changing dependent rules. Preserve the distinction between `BindingId`, `ObjectId`, provenance, must-facts, may-risks, and abrupt completion.

### Joins and reachable paths

- [x] **Must-fact joins:** a fact required for safety is satisfied only when it holds on every reachable path. Fix at least:
  - conditional/logical `GlideRecord.query()` before unconditional `next()`;
  - one-branch bulk-operation filters;
  - one-branch `GlideAggregate.query()` before consumption;
  - one-branch non-empty GlideAjax `sysparm_name` before terminal requests.
- [x] **GlideAggregate tuple facts:** intersect registered aggregate tuples across reachable paths. A field-specific read requires the exact evidence-backed `(type, field)` registration and must not fall back to type-only registration. Define configuration retention/reset across a second query epoch; keep dynamic type/field evidence conservative.
- [x] Cover `if/else`, `&&`, `||`, `??`, conditional expressions, loops, switches, nested functions, early completion, and combinations. Replace existing “branch-unknown is valid” expectations that contradict #5/#52/#59/#61/#62.
- [x] Preserve conservative silence for a genuinely dynamic or escaped value; distinguish ambiguity caused by an unprovable external value from a known good/bad branch join.

### Completion semantics

- [x] **Try/catch/finally:** remove the fabricated pre-try catch path when no handler exists. Model normal, return, throw, break, and continue completions through catch/finally correctly; finally always executes and may replace prior completion. Unreachable post-try statements must stay unreachable.
- [x] **Break/continue:** retain conditional abrupt states until the owning loop/switch consumes them. Add nested `if` + labeled/unlabeled loop cases.
- [x] **Switch:** for switches without `default`, retain both the no-match path and final matched-case fall-through state. Cover fall-through, breaks, returns, and default/no-default.

### JavaScript evaluation and assignment

- [x] **Evaluation order:** visit callee/receiver and arguments in JavaScript order before applying outer-call effects. The nested GlideAjax setup expression must be accepted; same-object alias arguments must not corrupt the receiver snapshot.
- [x] **Computed assignment LHS:** traverse side effects in targets such as `cache[gr.next()] = value`.
- [x] **Logical assignments:** correctly model `&&=`, `||=`, and `??=` with reachable conditional replacement and joins.
- [x] **Destructuring assignment:** update/invalidate tracked bindings for array/object patterns, defaults, rest, and nested patterns.
- [x] **Duplicate uninitialized `var`:** a redeclaration such as `var gr;` must not erase the existing runtime value.
- [x] **Expression aliases:** preserve safe aliases formed through conditional/logical expressions when all reachable values prove the same identity; otherwise degrade conservatively.

### Functions and captures

- [x] **Hoisted capture:** function declaration source order must not determine whether a later-declared `var` binding is captured/escaped.
- [x] **Captured facts:** retain sound temporal `Now.ID` facts inside closures instead of analyzing every nested function with an empty environment. Respect reassignment, shadowing, and invocation uncertainty.
- [x] Test declarations, expressions, arrows, callbacks, recursion, functions before/after assignments, parameters, class scopes, and sibling scopes.

**Layer completion:** the reusable binding matrix causes real state changes—not merely syntax presence—for aliases, reassignment, shadowing, escape, nested scopes, branch/loop/switch/try/finally, closures, and storage patterns. Run it against every stateful consumer, including GlideAjax and `Now.ID`.

---

## 3. Classic and stateful rule consumers

After layer 2 is green, update consumers to use proven binding/object identity and correct epoch semantics.

### Platform globals and wrappers

- [x] **Canonical Business Rule:** `no-br-current-update` must detect `current.update()` inside `(function executeRule(current, previous) { ... })(current, previous)` without treating arbitrary same-named parameters as platform globals.
- [x] **Aliases:** simple proven aliases of `current` and `gs` must be handled by `no-br-current-update` and `no-gs-now`; shadowed/unrelated objects must remain silent.
- [x] **Directive prologue:** `require-business-rule-wrapper` must accept directive statements such as `"use strict";` immediately before the canonical wrapper.

### Identity-based Glide analysis

- [x] **GlideElement collection:** match cursor consumption and retained fields by `ObjectId`, so cross-alias `rec.next()` / `gr.number` is detected. Respect lexical shadowing and multiple same-named bindings.
- [x] Apply the same invalid/escaped provenance guard to `getElement()` as direct field access.
- [x] **`prefer-glideaggregate`:** replace global name-keyed state with binding/object identity. Add outer alias plus shadowed parameter and unrelated API cases.
- [x] **System-query bypass:** detect a definite `addSystemQuery` receiver even when an argument aliases the receiver; argument escape must not suppress the call being inspected.

### Protocol and epoch correctness

- [x] **GlideAjax missing keys:** `addParam()` and `addParam(null, ...)` definitely do not provide `sysparm_name`; do not turn them into an unknown that suppresses the terminal diagnostic.
- [x] **GlideAjax request reset:** model a new request epoch so two complete valid requests on one object do not produce `afterTerminal` on the second setup.
- [x] **Spread arity:** `g_form.getReference(...args)` has unknown runtime arity and must not be reported as definitely callback-free unless the analysis proves it.
- [x] **GlideAggregate late dynamic setup:** configuration after `query()` must not suppress validation of the already-open result epoch.
- [x] **Query modifiers:** if a second query is conditional, retain the path where a late modifier did not affect the existing cursor.
- [x] **setNoCount epochs:** recover after divergent branch query counts; analyze later definite queries and associate `getRowCount()` only with the correct epoch.
- [x] **Query-in-loop:** establish cursor depth only for a proven valid, unescaped GlideRecord/GlideAggregate `ObjectId`; unrelated, reassigned, escaped, dynamically selected, and unknown `.next()` receivers remain silent. Cover aliases, static computed `next`, logical tests, shadowing, nested/multiple cursors, and cursor consumption in `for` test/update positions—including the second iteration onward—in both real hosts.
- [x] **Bulk-filter argument validity:** malformed non-string literals such as `addQuery(42)` are not valid filter evidence.
- [x] **Performance-rule boundary:** restrict `prefer-setnocount-with-choosewindow` to the researched/proven execution methods, or add authoritative evidence and narrowly justified behavior for `get()`/`getAsync()`.

**Layer completion:** each defect has unit and real-host invalid/valid fixtures, including alias, shadow, reassignment, escape, nested scope, and path-sensitive variants. Exact rule IDs—not unrelated diagnostics—make invalid examples fail.

---

## 4. Fluent manifests and binding-aware rules

### Authoritative SDK manifests

- [x] Validate both supported SDK versions against their published declarations rather than synthesizing 3.0.0 from the current manifest.
- [x] Correct at least these known mismatches:
  - SDK 4.1 `List.$id` is optional/deprecated because the ID is derived;
  - exported 4.1 `UserPreference` requires the appropriate ID contract;
  - SDK 3.0 `Table` must match the actual published signature rather than an invented required `$id` delta.
- [x] Add committed, reproducible declaration-derived fixtures or a deterministic checker. Cover every exported factory and relevant ID policy in both versions.

### Import and binding resolution

- [x] Resolve direct, aliased, namespace, local-factory-alias, and SDK barrel re-export bindings by identity. `const BR = BusinessRule; BR(...)` and a project barrel must receive the same validation as direct imports.
- [x] Keep local shadows and unrelated same-named functions silent.
- [x] Add multi-file packed-consumer tests for re-exports and aliases.

### Canonical `Now` binding

- [x] Use one binding-aware canonical-`Now` resolver across `require-fluent-id`, `fluent-naming-convention`, `prefer-now-include`, `no-now-id-as-reference`, `no-duplicate-fluent-id`, and shared helpers. Ignore local/imported/parameter/class/function shadows; support valid static dot/computed access; keep dynamic access conservative; support aliases only when documented and proven. Add nested-scope, alias, reassignment, comments/strings, Oxlint, and ESLint tests.

### `Now.ID` temporal semantics

- [x] Walk transparent TypeScript/parenthesis wrappers (`as`, `satisfies`, non-null, type assertions, parentheses) to the semantic use site. A wrapped `$id` must not be reported as a reference; duplicate wrapped IDs must still be found.
- [x] Replace the string sentinel `"unknown"` with a non-colliding tagged representation so `Now.ID["unknown"]` remains a valid static ID.
- [x] Exclude type-only uses such as `typeof id` from runtime reference-misuse diagnostics.
- [x] Preserve captured module-level `Now.ID` facts through builder/helper closures while respecting temporal reassignment and shadowing.
- [x] Cover `const`/`let`/`var`, duplicate `var`, assignment, destructuring, branches, loops, nested functions, and mixed `$id`/reference use sites.

### Directives

- [x] Enforce the documented immediately-previous-line boundary for Fluent directives. Define and test BOM, EOF, blank lines, intervening comments, top-level constructs, and unsupported placements against actual Fluent semantics.

**Layer completion:** run direct and packed `.now.ts`/`.now.tsx` fixtures with supported SDK/parser combinations; compare diagnostics across Oxlint and ESLint.

---

## 5. Profiles, oxfmt, generated docs, and research evidence

### Runnable profiles and examples

- [x] Generate classic Compatibility/ES5 examples from the correct profile rule maps, not only `recommendedRules`. Their invalid Promise/optional-syntax fixtures must fail for the expected mode-specific rule ID without a hard-coded sys_id crutch.
- [x] Test every copy-paste configuration exactly as documented.

### oxfmt contract

Choose one coherent supported-minimum strategy and prove it:

- [x] Either raise the oxfmt minimum to a version that supports the shipped `overrides`, TS configs, and `defineConfig`, or ship/document configurations compatible with the current minimum.
- [x] At the exact declared minimum, prove classic and Fluent files receive different intended formatting, and run both JSON and documented TypeScript configuration paths from the packed package.
- [x] Keep peer metadata, compatibility matrix, examples, README, and generated docs synchronized.

### Evidence and docs

- [x] Escape Markdown table metacharacters in generated rule pages and validate table structure, not only headings.
- [x] Replace the blanket `lastVerified` default with reproducible per-evidence verification or a checker that proves each date. Manual, fixture, integration, and authoritative-source claims must not inherit an unearned universal date.
- [x] Complete the missing deliverables in research #35 and #37–#40: authoritative citations, concrete good/bad examples, explicit detection boundaries, FP/FN analysis, and—where required—data model, cache/incremental strategy, and prioritization.
- [x] Regenerate all owned docs and fixtures and make `docs:check` detect malformed tables and stale examples.

**Layer completion:** examples fail/pass for exact intended reasons; packed oxfmt works at the declared minimum; generated docs are structurally valid and every evidence claim is reproducible.

---

## 6. Packed compatibility and trustworthy benchmarks

### Executable compatibility matrix

- [x] Make the matrix the single executable source for CI, release validation, and generated docs. Each cell must assert its actual Node, npm, host, parser, SDK, and mode versions.
- [x] Run `min-hosts` and every Node-20-labelled cell in a real Node 20 process. Run `eslint9-current` on actual declared `current`, not Node 22.
- [x] Exercise the exact packed tarball in every cell, not the source tree or a filesystem `dist/index.js` import.
- [x] Materially execute advertised dimensions: TypeScript parser minimum/current, ESLint 9 minimum/current and ESLint 10, Fluent SDK 3.0/4.1, `.now.ts` and `.now.tsx`, and all documented JavaScript modes.
- [x] Resolve public bare specifiers from a clean consumer: package root, `/oxfmt`, `/oxfmt.recommended.json`, and `/package.json`; compile their NodeNext declarations. A missing export target must fail the gate.
- [x] Centralize and test npm-pack JSON parsing for both legacy array and npm-12 package-keyed output. Supported Node/npm consumers must complete `npm test`, artifact checks, and compatibility checks.

### Benchmark integrity

- [x] Generate valid Fluent modules with one import and many factory calls; reject parser/config diagnostics and any unexpected nonzero host exit. Parse and validate benchmark JSON before recording samples.
- [x] Require exact one-to-one equality between current benchmark cases and baseline rows. Missing, duplicate, renamed, or extra cases fail.
- [x] Make RSS collection portable or refuse `--write` when memory measurement is unavailable. Never write zero baselines that disable CI checks.
- [x] Always build the current source, or cryptographically prove `dist` freshness, before measuring or writing baselines.
- [x] Compare profiles on comparable fixtures and calibrate thresholds with a test that demonstrates repeated full-file analysis or nonlinear growth turns the gate red.

**Layer completion:** every generated compatibility claim corresponds to an executed cell; intentionally breaking a public export, Node minimum, parser composition, benchmark fixture, baseline row, or build freshness makes the appropriate gate fail.

---

## 7. Privileged release automation

Keep this layer isolated from all untrusted implementation changes and base it on already-reviewed layers 1–6.

- [x] **npm version check:** replace `process.versions.npm` with an executable check such as `npm --version`; parse and verify the explicitly pinned trusted-publishing npm version.
- [x] **Exact runtime matrix:** validate the one inspected tarball on real supported Node jobs and require every result before publish.
- [x] **Least privilege:** dependency installation, package import, compatibility testing, and registry verification run in jobs without `id-token: write`. The OIDC job receives only the inspected artifact, runs `npm publish <inspected.tgz> --ignore-scripts`, performs no install/import, and holds the minimum OIDC permission for the shortest possible interval. Registry installation/import runs only in a separate no-OIDC job; use `--ignore-scripts` for verification installs unless a lifecycle script is itself the subject of a separately sandboxed test.
- [x] **Post-publish isolation:** registry installation/import verification and GitHub release creation occur in separate no-OIDC/minimum-permission jobs.
- [x] **Retry safety:** if the version already exists after an accepted-but-ambiguous publish, compare registry integrity/provenance to the inspected artifact and continue safely when identical; fail clearly on mismatch. GitHub-release creation must also be idempotent.
- [x] **Artifact/public API checks:** verify every export target and declaration before publish and again from the registry without bypassing package exports.
- [ ] **Tag ancestry and exact artifact:** preserve the approved-tag, main-ancestry, changelog, integrity, provenance, and exact-tarball guarantees.
- [x] Add executable workflow/helper tests; text/regex presence checks alone are insufficient.

**Explicitly-live gates:** do not mark OIDC publication, registry availability/import/provenance, or GitHub-release creation complete merely from local mocks. Provide a maintainer runbook and record these as pending until an approved real tag proves them.

---

## Mandatory validation matrix

Before declaring completion, all of the following must pass from a clean checkout of each applicable layer:

```bash
npm ci
npm run typecheck
npm run build
npm test
npm run docs:check
npm run manifest:check
npm run bench
npm run release:check -- --consumer
npm run validate
```

Additionally:

- Run the packed consumer and public-subpath tests at every declared minimum/current host combination.
- Run the exact tarball on real Node 20, Node 22, and declared current Node environments.
- Exercise npm-pack parsing with both array and npm-12 keyed JSON shapes.
- Run real Oxlint and ESLint fixtures for every changed rule family.
- Run TypeScript `.now.ts/.now.tsx` packed consumers for each supported parser/SDK combination.
- Run `git diff --check`, generated-file checks, and ensure no ignored/stale `dist` influenced results.

## Definition of done

The task is complete only when:

1. Every issue acceptance-criterion checkbox and every handoff checkbox above has a ledger row, failing-before/fixed-after regression or other executable proof, and a link to a specific commit; many-to-one proof links are allowed.
2. No existing test asserts silence for a path that an issue requires to diagnose.
3. Unknown inputs remain conservative, but a known unsafe reachable path cannot be hidden by an `unknown` join.
4. Binding/object identity—not identifier spelling—drives alias, shadow, reassignment, escape, and closure behavior.
5. Every compatibility/documentation/evidence claim is backed by an executable, correctly versioned proof.
6. The exact artifact passes real supported-host validation and the release workflow is executable, least-privilege, and retry-safe.
7. The seven-layer stack is independently reviewable and green; privileged release changes are isolated.
8. A final report lists: layer/PR links, finding ledger, tests added, commands and environments run, before/after results, remaining live gates, and any intentionally deferred item with owner and blocker. An unresolved checkbox means the goal is not complete.

---

## Review addendum — additional mandatory acceptance criteria

These items refine the earlier checklists with gaps identified by an independent review. Add each checkbox to the same acceptance ledger and delivery layer; they are part of the Definition of done.

### Fluent version authority

- [x] **Complete historical version model:** independently model every publicly supported Fluent SDK line from official versioned declarations, tagged source, release notes, or ServiceNow’s machine-readable version index. At implementation time, recheck the latest official SDK; the review found 4.10.0 current while this branch exposed only 3.0.0 and 4.1.0. Either support the actual current line or explicitly narrow the public support claim.
- [x] **Version-transition boundaries:** audit every capability for introduction, removal, rename, deprecation, module ownership, and `$id` policy. Add explicit boundary tests proving `AliasTemplate` is absent before its documented 4.8.0 introduction and present at/after 4.8, plus at least one removed/renamed/deprecated transition and current-version coverage. Audit `StateModel` and every other capability inherited by the synthesized legacy manifest; do not assume present-day APIs existed historically.
- [x] **Evidence granularity:** record one parseable, authoritative, symbol- and version-specific evidence record per capability transition. Compound prose containing multiple URLs and length-only evidence checks are insufficient. Make the manifest checker validate evidence structure and version applicability rather than snapshot consistency alone.

### Remaining evaluator semantics

- [x] **Loop-condition effects on zero iterations:** the zero-body path begins after evaluating the loop test. Prove side effects in `while`/`for` conditions are retained even when the body never runs, for example `while ((gr.query(), false)) {}` followed by `gr.next()`.
- [x] **Continue targets:** a `continue` must still execute the owning `for` update and `do…while` test before the next iteration/exit. Add labeled and unlabeled cases, including side effects in those expressions and finalizers that produce or override each completion kind.
- [x] **Expression-result identity:** preserve identity through `?:`, operator-correct `&&`/`||`/`??`, sequence expressions, and assignment-expression results when every reachable result proves the same object. Add `flag ? gr : gr` and equivalent logical/sequence/assignment cases; degrade only when results genuinely differ.

### `Now.ID` provenance and use sites

- [x] **Lexical alias exemption only:** treat a `Now.ID` RHS as alias initialization only when the assignment target is a proven lexical identifier. Member writes, computed storage, arrays, object properties, call arguments, returns, and spreads are real uses; `config.reference = Now.ID["x"]` must be reported.
- [x] **Provenance separate from key precision:** a dynamic key such as `Now.ID[key]` is still definitely `Now.ID` provenance even though its key is unknown. Report it outside `$id`, accept it as an identity value at `$id`, and reserve static-key precision for duplicate/naming checks. Do not conflate dynamic key, merged ambiguity, and not-a-Now-ID.

### Cursor and counting proof precision

- [x] **Operator-aware cursor implication:** loop-body entry proves cursor success for the appropriate `&&` paths but not merely because either operand of `||` or `??` contains `.next()`. Define truth/nullish implication for both operand orders and share it between query-in-loop and GlideElement analysis. Test `&&`, `||`, and `??` in both orders with aliases, shadowing, and fallback-only body entry.
- [x] **Actual count proof for `prefer-glideaggregate`:** require one stable numeric counter modified only by `counter++`, `++counter`, or `counter += 1`. An empty loop, arbitrary `+= calculateRisk(gr)`, record-field access, calls receiving the record, other counter uses, or identity ambiguity must not be described as “only iterated to count rows.” Report at the proven loop and add positive/negative scope and alias cases.

### Authoritative Fluent factory resolution

- [x] Split “known capability candidate” from “authoritative factory.” `fluent-proper-imports` may resolve a recognized API name from the wrong module to issue the import-policy diagnostic; semantic rules such as `$id`, naming, and factory-specific validation must run only when the binding resolves through the capability’s correct owning module or a proven project re-export. Add a wrong-module fixture that emits the import error without cascading semantic errors.

### Metadata truth assertions

- [x] Reconcile structured FP/FN claims with executable behavior. In particular, the lower-case-only sys_id matcher cannot describe uppercase 32-hex values as known false positives; classify them as intentional exclusions or false negatives according to the chosen policy. Add behavior-linked assertions for metadata claims, including abrupt-path guarantees and version applicability, so generated docs cannot stamp implementation assumptions as verified truth.

### Modern host matrix and governance

- [x] **Current runtime coverage:** recheck the official Node release schedule at implementation time. The review found Node 20 to be EOL/minimum compatibility, Node 22 and 24 supported LTS lines, and Node 26 Current. Label Node 20 accurately and test the exact minimum plus Node 22, Node 24, Node 26/current, and future declared supported lines implied by the open-ended engine range.
- [x] **Meaningful host dimensions:** test minimum and actual latest-compatible Oxlint as distinct versions, ESLint 9/10 as supported, and minimum/current oxfmt. A “latest” cell identical to the minimum is not evidence of current compatibility.
- [x] **Repository enforcement:** configure and capture evidence for a `main` branch/repository ruleset requiring pull requests and all test, compatibility, benchmark, docs, manifest, and artifact checks; disable force-push/deletion; protect `v*` tags; and restrict the protected `release` environment and npm trusted publisher to the intended repository, workflow path, environment, and tag refs. Live controls are recorded in `docs/release-governance-live.json`; stable-tag publication remains line 237's live gate.
- [x] **Separate readiness phases:** define merge readiness as green in-repository code/configuration plus verified permissions, and release readiness as the post-merge protected-tag publication and live registry/GitHub verification. Remove any circular policy requiring a tag-only live publish before the implementation can merge.

### Release resiliency and workflow hygiene

- [x] **Eventual consistency:** apply bounded retry/backoff to registry metadata, integrity, provenance/attestation, installation, and public-import assertions that may lag after publication. Preserve immediate failure for integrity mismatch or other non-transient errors.
- [x] **Consistent action pins:** use one centrally reviewed set of full action SHAs across test, benchmark, compatibility, and release workflows; add a check that detects divergent checkout/setup-node or other shared-action pins.
