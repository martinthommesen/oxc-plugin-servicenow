You are the senior maintainer responsible for completing the full PR #51 remediation program in:

https://github.com/martinthommesen/oxc-plugin-servicenow

Your goal is to turn the current reconstructed PR stack into the best possible production-grade Oxlint/oxfmt developer-tooling package for ServiceNow development, resolving every valid finding raised in every pull-request comment, submitted review, and inline review thread across the repository.

This is an implementation task, not another review or planning exercise.

The relevant pull requests are:

- #1, #47, #48, #49, and #50: already merged historical foundation/tooling PRs
- #51: non-mergeable tracking PR
- #77: Plan 007 — analysis foundation and path-state
- #78: Plan 008 — bindings, scopes, closures, and comment scanning
- #79: Plan 009 — stateful lifecycle rules
- #80: Plan 010 — authoritative Fluent SDK registry
- #81: Plan 011 — options, Now.ID, and Fluent directives
- #82: Plan 012 — context profiles and rule contracts
- #83: Plan 013 — public API and user-facing assets
- #84: Plan 014 — integration tests, evidence, compatibility, and performance
- #85: Plan 015 — release governance and provenance

The intended dependency order is:

#77 → #78 → #79 → #80 → #81 → #82 → #83 → #84 → #85

PR #51 must remain tracking-only and structurally non-mergeable. It should ultimately be closed without merge after all implementation PRs have been completed and their evidence has been recorded.

Do not tag, publish, create a release, merge a PR, push branches, resolve review threads, alter repository settings, or mutate GitHub/npm governance without explicit approval. Implement and validate the code locally, and report any external actions that remain necessary.

# 1. Operating contract

Before editing:

1. Read all repository-local instructions, including AGENTS.md, CONTRIBUTING.md, package scripts, TypeScript configurations, workflow conventions, existing plans, and generated-file rules.
2. Inspect the current heads and merge bases of #51 and #77–#85. Do not assume the historical SHAs quoted in comments are still current.
3. Read every PR comment, review, and inline thread yourself. Treat the requirements below as a normalized synthesis, not a substitute for checking the original evidence.
4. Inspect linked issues when they define a public contract, especially #57, #58, #66, #70, #74, #75, and #76.
5. Do not mechanically implement comments that have become obsolete. For every unique finding, determine whether it is:
   - Confirmed and requires a fix
   - Already fixed at the current head
   - Superseded by a later design
   - Incorrect or inapplicable, with concrete evidence
   - Blocked by an external/manual control
6. Preserve established repository conventions and active public compatibility contracts unless a deliberate major-version migration explicitly replaces them.
7. Use red-before-green evidence for every behavioral fix. A test that passes before the implementation is not proof of the remediation.
8. Do not make a gate green through an unrelated diagnostic, weakened assertion, broad exclusion, skipped test, legacy peer resolver, stale build output, or synthetic fixture.
9. Do not add speculative abstractions, optional configuration, dependencies, fallback paths, stale TODOs, or formatting churn.
10. Keep release and privileged workflow work last. A secure publisher must not be made operational before semantic correctness and package evidence are complete.

# 2. Establish one truthful remediation ledger

Use the existing PR #51 acceptance ledger as the source of truth, repairing it rather than creating another competing tracker.

Each atomic row must record:

- Stable finding ID
- Originating PR, comment, review, issue, or acceptance requirement
- Exact requirement, including all subcriteria
- Severity and affected subsystem
- Owning implementation PR
- Current disposition
- Failing test or reproduction
- Implementation files
- Verification command
- Exact commit or working-tree identity tested
- Runtime/tool versions
- Result
- Remaining manual or live verification

Allowed dispositions:

- Pending
- Reproduced
- Implemented
- Verified at exact head
- Superseded, with evidence
- Not applicable, with evidence
- Live-pending

Do not treat historical `[x]` checkboxes, an archived test run, a generated snapshot, or a green downstream PR as proof for the current head.

Repair the tracking model:

- Restore Plans 007–015 if they are genuinely authoritative, or remove the dead references and point each PR to concrete ledger rows.
- Make every source path have exactly one historical layer owner.
- Remove overlaps involving `src/catalog.ts`, `src/analysis/now-id.ts`, `src/analysis/fluent-imports.ts`, and any other multiply assigned paths.
- Update the goal document to use the actual immutable archived head and merge base, not obsolete comparisons.
- Ensure the stack validator fetches archive and reconstruction refs before dereferencing them.
- Verify both the archive ref and every reconstruction ref against the recorded commit.
- Preserve immutable archive refs; distinguish them clearly from movable live PR heads.
- Include all omitted must-fact subcriteria in the ledger, including conditional query-before-next, one-branch bulk filters, one-branch aggregate queries, one-branch GlideAjax `sysparm_name`, and the disputed SDK boundaries.
- Keep tracking-only files on #51 rather than duplicating thousands of lines of stack state into implementation PRs.

Every implementation PR must be independently truthful at its own exact head. A command documented by #84 must not depend on a script introduced only in #85.

# 3. Repair the analysis foundation — owning layers #77 and #78

Build one sound, typed, per-file analysis foundation that downstream rules can trust.

## 3.1 Structured control-flow completion

Replace ad hoc reachability flags with an explicit completion model that can represent at least:

- Normal completion
- Return
- Throw
- Break, including optional target label
- Continue, including optional target label

Joins must preserve completion kind and label ownership rather than flattening all paths into one state.

Implement correct JavaScript behavior for:

### Try/catch/finally

- Do not inject the pre-try state as a synthetic catch path.
- A catch handler must receive only states from reachable throw completions.
- A try without a catch must propagate throws.
- Execute `finally` for every normal and abrupt completion.
- A normally completing finalizer must preserve the original completion kind while applying its state changes.
- An abrupt finalizer must override the prior completion.
- Model returns, throws, breaks, and continues passing through finalizers.
- Do not report diagnostics in code that is unreachable after an exhaustive abrupt construct.

Required red-before-green cases include:

- `try { gr.query(); } finally {} gr.next()`
- Try with no handler
- Try with a handler but no reachable throw
- Throw caught by a handler
- Return or throw passing through a normal finalizer
- A finalizer that returns or throws and overrides an earlier completion
- State mutations performed in a finalizer on an abrupt path

### Switch statements

- Preserve the no-match path when there is no `default`.
- Model entry at any matching case and ordinary fallthrough.
- Preserve fallthrough out of the final matched case.
- Consume only breaks owned by the switch.
- Propagate returns, throws, and labeled breaks.
- Do not create a normal post-switch state when every reachable branch is abrupt.
- Test switches with and without `default`, empty cases, fallthrough chains, and abrupt final cases.

### Loops and labels

- Route labeled and unlabeled break/continue to the construct that owns them.
- An outer `continue` must not be consumed by an inner loop.
- Model loop-carried state to a stable fixpoint sufficient to expose second-iteration behavior.
- Preserve the zero-iteration path only where runtime semantics allow it.
- Do not add a zero-iteration path to `do...while` or unconditional `for (;;)`.
- Model update expressions and loop tests in runtime order.
- Assign or invalidate existing targets before the body of `for...in` and `for...of`.
- Recognize immediately invoked function expressions as executing in the current cursor-loop context, while ordinary nested functions and deferred callbacks do not inherit that context.

## 3.2 JavaScript evaluation order

Ensure stateful callbacks observe runtime order:

- Evaluate the callee object and computed property.
- Evaluate all call arguments from left to right.
- Apply argument side effects.
- Only then invoke the outer-call transition.

For example, `gr.next(gr.query())` must observe the inner query before the outer `next`.

Model assignment evaluation correctly:

- Evaluate the right-hand side before committing the binding write.
- Cover simple, compound, logical, update, and destructuring assignments.
- Invalidate stale provenance for `&&=`, `||=`, `??=`, arithmetic assignments, and loop-target assignments.

## 3.3 Binding, scope, closure, and identity authority

Use stable `BindingId` and object identities rather than identifier spelling.

Cover:

- Function, block, class, catch, module, and relevant ServiceNow wrapper scopes
- `var` hoisting and same-scope redeclarations preserving one binding identity
- `let`/`const` block semantics
- Parameters and default parameters
- Array and object destructuring
- Rest elements
- Assignment patterns
- Computed assignment targets
- `for...in` and `for...of` targets
- Named class-expression self-bindings
- Named function-expression self-bindings
- Nested closures and source-order-sensitive captures
- Parameter, local, and class shadowing of `GlideRecord`, `String`, `undefined`, `Now`, and other platform globals

Mutable alias checks must be temporal:

- A write after a call must not retroactively invalidate an earlier safe alias use.
- A write before the call must prevent the alias from being treated as authoritative.
- Every mutable binding traversed through a namespace/member alias chain must be checked at the use site.

Do not treat an identifier spelled `undefined` as the global value when it resolves to a local binding.

Do not treat an identifier spelled `String` as the global converter when shadowed.

Do not treat a named class expression called `GlideRecord` as the ServiceNow constructor inside its class body.

## 3.4 One shared analysis pass and cache contract

Create one shared per-file analysis result for bindings, object identity, context, Fluent origins, comments/directives, and stateful consumers where practical.

- Cache by the actual source-file or SourceCode identity using a `WeakMap`.
- Never use a process-wide singleton that can leak results between files or concurrent lint runs.
- Do not derive correctness from a lossy string key.
- If a settings key remains, include every semantically relevant field and canonicalize nested sets/maps deterministically.
- Freeze public settings and nested structures deeply enough that rules cannot mutate shared configuration.
- Add isolation tests for multiple files, identical text under different settings, repeated host instances, and concurrent/interleaved analysis.
- Do not serialize the test runner merely to hide a cache race.

Resolve issue #74 explicitly:

- If `getFileAnalysis` and `FileAnalysis` are accepted public contracts, export them deliberately from the package root and prove their declarations in a clean NodeNext consumer.
- Otherwise keep them internal and remove every public claim that consumers can call them.
- Do not leave the issue, README, types, and implementation disagreeing.

## 3.5 Comment and directive lexical authority

The existing small adversarial scanner test is insufficient.

Prefer the host parser’s authoritative comment/token APIs. Where a fallback scanner is genuinely required, implement a bounded linear lexical state machine covering:

- Line and block comments
- Single- and double-quoted strings
- Template literals and `${...}` expressions
- Regular-expression literals where relevant
- Escapes
- CRLF and LF
- BOM
- Shebang
- EOF comments
- Unterminated block comments
- Comment-shaped text inside strings, templates, and regexes

Add a regression large enough to distinguish linear behavior from the old quadratic/backtracking implementation. Use a deterministic workload and a defensible timeout or operation-count invariant rather than a tiny fixture that both implementations pass.

Place this production code and its tests in the layer that actually owns comment/directive parsing. Do not leave #78 as a title about bindings/scopes whose only focused change is an unrelated test.

# 4. Rebuild stateful lifecycle rules — owning layer #79

Use the analysis foundation through one typed lifecycle engine. Do not maintain separate approximate walkers for each rule when they need the same identity and control-flow facts.

## 4.1 Central method authority

Create one evidence-backed authority for relevant ServiceNow methods and capabilities, consumed by all rules.

Distinguish at least:

- Query executors
- Query/filter modifiers
- Cursor-advancing methods
- Bulk operations
- Aggregate configuration and execution
- Windowing/count behavior
- GlideAjax setup and terminal methods
- Value-extraction/conversion methods
- Deferred versus immediate callbacks

Resolve disputed `get`/`getAsync` behavior from authoritative ServiceNow material or pinned declarations and encode the result once. Do not let separate tests declare contradictory API law.

Diagnostics must report the exact receiver and method involved rather than a generic or stale name.

## 4.2 Query-before-next and re-query semantics

- A definite query executor must establish `opened` regardless of whether the previous state was `unopened`, `opened`, or `unknown`.
- `if (condition) gr.query(); gr.query(); gr.next()` must be valid.
- A query on only one reachable path followed by `next()` must remain invalid.
- Joins must not turn “unsafe on every possible object” into silence merely because object identity differs.
- If both branches assign unfiltered records and then call `deleteMultiple`, report the unsafe operation.
- Distinguish unknown identity from unknown safety facts.
- Make any deliberate escape-to-silence boundary an explicit documented false negative, not a fixture under a directory named `valid` that implies correctness.

## 4.3 Cursor-condition recognition

Correctly recognize cursor advances under:

- Direct conditions
- Negation
- `&&`, `||`, and `??` with JavaScript truth behavior
- Conditional and sequence expressions
- Explicit boolean comparisons such as `gr.next() === true`
- Parentheses and supported TypeScript wrappers

Preserve cursor depth for synchronous IIFEs and clear it for declarations or deferred callbacks.

## 4.4 GlideRecord filter and bulk-operation safety

Classify arguments semantically:

- Missing, null, global undefined, and empty static fields are definitely not filters.
- A numeric field such as `addQuery(42)` is not a valid restricting field.
- A locally shadowed `undefined` is dynamic, not the global value.
- Dynamic arguments remain unknown unless another definite filter exists.
- Model encoded queries and other filter methods from the central method authority.

Test branch joins, late definite recovery, aliases, reassignment, dynamic arguments, and multiple possible record identities.

## 4.5 GlideAggregate epochs

Model aggregate state per query epoch:

- Pending aggregate definitions
- Committed definitions at query execution
- Changes after query
- Dynamic aggregate names
- Conditional second queries
- Joins where epochs differ
- A later definite query or aggregate operation recovering from prior uncertainty

Do not flatten all aggregate history into one boolean.

## 4.6 GlideAjax request epochs

Represent each request independently.

- Missing, null, global undefined, or empty parameter keys are definite missing keys.
- Dynamic keys are unknown rather than automatically valid or invalid.
- A terminal request call closes the current request epoch.
- Beginning a new request, including a new `sysparm_name`, opens a fresh epoch.
- Two sequential valid requests must remain valid.
- `addParam()` followed by a terminal call without a valid `sysparm_name` must report.
- A valid first request must not satisfy the second.
- Exact terminal and setup methods must come from the shared method authority.

## 4.7 Windowing and setNoCount

- Track `chooseWindow` and `setNoCount` in the same query epoch.
- Preserve divergent joins as unknown where appropriate.
- Allow a later definite setting or new epoch to recover.
- Do not let sentinel values such as `-1` permanently poison future valid executions.
- Add branch and re-query recovery tests.

## 4.8 Rule-specific fixes

Implement and test all of the following:

- `require-callback-for-getreference` rejects statically non-callable callbacks such as numbers and strings, while remaining conservative for unknown identifiers.
- `no-gliderecord-query-in-loop` detects synchronous IIFEs inside cursor loops.
- Cursor-loop helpers recognize explicit boolean comparisons.
- `no-glideelement-in-collection` uses authoritative object identity, requires the unshadowed global `String` for extraction exemptions, and deduplicates diagnostics when bodies are revisited.
- `prefer-glideaggregate` allows reading the final count after a count-only loop while still detecting iteration used only to count.
- `no-br-current-update` maps the canonical Business Rule wrapper’s argument to its parameter and does not diagnose arbitrary generic-server `current` bindings.
- Surface-specific compatibility rules do not run in unknown or client contexts without proof.
- New and replacement rules are registered in the same layer as their implementation and tests. A deprecation must never point to an unavailable rule.

# 5. Make the Fluent SDK registry authoritative — owning layer #80

Do not validate an in-memory manifest against a fixture generated from the same manifest.

## 5.1 Declaration-derived version data

For every publicly supported SDK version:

- Pin the exact package name and version.
- Record tarball integrity.
- Traverse the actual export graph.
- Extract normalized declaration evidence.
- Store module path, export name, relevant signature/capability, `$id` policy, introduction/deprecation boundary, and extraction metadata.
- Make historical versions independent datasets rather than filtered copies of the current version.
- Compare versions with semantic-version tuples, never lexicographically.

Prefer checked-in, normalized, reviewable declaration fixtures plus an explicit updater script. Routine PR tests must not depend on mutable network state. A scheduled canary may compare with the currently published SDK and open a maintenance issue.

The checker must:

- Resolve every evidence record.
- Prove that the named symbol exists in the pinned declaration artifact.
- Prove module ownership.
- Validate the expected `$id` or `WithID` capability.
- Validate negative boundaries where a symbol must not exist.
- Fail when a referenced fixture is absent.
- Run from `npm run manifest:check` and required CI at the same PR head.

Investigate and correct the reviewed mismatches rather than blindly accepting names:

- Suspected phantom entries: `DatabaseIndex`, `Module`, `ScriptedRestApi`, and `UiFormatter`
- Suspected missing `$id`-bearing factories: `GraphQLApi` and `Sla`
- AliasTemplate’s reported 4.8 boundary
- Any other mismatch discovered from declarations

Do not assume those suggested corrections are correct without declaration evidence.

## 5.2 Fluent import and factory identity

Separate two concepts:

- Import-policy candidates: names imported from any source that may warrant an import diagnostic
- Authoritative semantic factories: bindings proven to originate from the supported ServiceNow SDK export

Rules involving `$id`, duplicate IDs, naming, complexity, or entity semantics must use authoritative binding identity, not `getName(callee)`.

Support:

- Direct imports
- Namespace imports
- Stable same-file aliases
- Destructured aliases where valid
- Temporal mutation checks
- Wrong-module rejection
- TypeScript wrappers

Assess cross-file project barrels against actual host capabilities. Implement bounded, cached, project-root-constrained resolution only if it can be made deterministic and safe. Otherwise document cross-file re-exports as an explicit non-goal and remove project-wide claims that the implementation cannot support.

## 5.3 Evidence URL validation

Parse evidence URLs structurally.

- Require HTTPS where appropriate.
- Validate the hostname, not a substring.
- `servicenow.com.attacker.example` and `attacker.example/servicenow.com` must not pass.
- Define allowed ServiceNow hostnames or subdomain boundaries explicitly.
- Separate external normative evidence from local regression evidence.

# 6. Finish options, canonical Now.ID, and directives — owning layer #81

## 6.1 One source for option contracts

Use the existing descriptor machinery as the single source for:

- Runtime parsing
- JSON schema
- TypeScript option types
- Defaults
- Generated documentation
- Validation errors

Migrate every configurable rule, including at least:

- `no-hardcoded-sysid`
- `no-hardcoded-table-names`
- `require-fluent-id`
- `prefer-now-include`
- `fluent-naming-convention`

Parse each rule’s options once during initialization, not repeatedly per AST node.

Ensure:

- Enums emit a string type and exact values.
- String-array descriptors enforce the intended item type, uniqueness, and minimum length.
- Defaults are applied identically by schema, parser, docs, and types.
- Invalid options fail explicitly.
- Generated docs cannot drift from the descriptors.
- Compile-time negative tests protect readonly option types.

## 6.2 Canonical Now identity

Treat an expression as canonical `Now` only when its binding chain terminates at:

- The unshadowed platform global named exactly `Now`, or
- An explicitly supported ServiceNow SDK import

Do not accept arbitrary unresolved platform globals, `const Now = gs`, similarly named local objects, or wrong-module imports.

Check alias stability at the use location.

Unwrap transparent wrappers when determining semantic use:

- `TSAsExpression`
- `TSSatisfiesExpression`
- `TSNonNullExpression`
- Parenthesized expressions
- Other transparent wrappers supported by the parser

This must allow typed `$id` values such as `Now.ID["task"] as string` without classifying them as references, and it must allow duplicate-ID analysis to see the wrapped identity.

Keep canonical provenance separate from ID-key-shape validation.

## 6.3 Exact directive placement

Use actual comment nodes rather than comment-like text.

Statement-scoped directives such as `@fluent-ignore` and `@fluent-disable-sync` are valid only when:

- They are in a recognized comment.
- They appear on the immediately preceding line.
- No blank line intervenes.
- No unrelated comment intervenes.
- Their target statement is valid for that directive.

File-scoped directives must appear at the documented first meaningful location after BOM/shebang handling.

Test:

- LF and CRLF
- BOM
- Shebang if supported
- EOF
- Blank-line separation
- Intervening comments
- Directive text in strings, templates, regexes, and comments describing directives
- Duplicate directives
- Misspellings
- Wrong scope
- TypeScript suppression placement

Misplaced or dangling directives must produce the intended diagnostic rather than silently suppressing a rule.

# 7. Correct context profiles and rule contracts — owning layer #82

## 7.1 One context authority

Expose one explicit resolved context model containing the relevant dimensions, such as:

- Script surface/type
- Server/client/unknown
- JavaScript mode
- Classic versus ES2021 feature support
- Fluent status
- Instance-script status
- Filename/path evidence
- Explicit configuration evidence
- Conflict state

Define precedence and conflict behavior. Do not let one helper infer Fluent from `.now.ts` while another later overwrites it from a generic path.

Unknown context must be quiet for rules that require a proven surface or engine. Unknown must not mean classic by default.

Add a full cross-product test matrix for:

- Known and unknown surfaces
- Client and server
- Business Rule, UI Action, generic server, and instance script
- Classic ES5, ES2021, and unknown mode
- `.now.ts` and `.now.tsx`
- Explicit overrides
- Conflicting evidence
- Fluent and non-Fluent paths

## 7.2 Feature-level engine contracts

Model syntax support per feature rather than one broad “unsupported syntax” switch.

- ES2021 features must not be rejected when ES2021 is proven.
- Classic-only bans must live in explicit classic/compatibility presets.
- Recommended must not impose ES5 bans on unknown or modern code.
- Each feature needs exact valid and invalid host fixtures.

## 7.3 Rule behavior

Repair and prove:

- Every new rule is registered in the catalog and exported plugin.
- `require-business-rule-wrapper` accepts only the canonical named wrapper shape and legal directive prologues; it must not accept any arbitrary IIFE.
- Wrapper detection is shared with Business Rule rules such as `no-br-current-update`.
- `no-hardcoded-sysid` runs only in proven instance-script contexts and has an explicit lowercase/uppercase sys_id policy.
- `no-promise` does not flag arbitrary methods named `then`, `catch`, or `finally`; require actual Promise provenance or remove the unsafe member-name heuristic.
- `no-system-query-bypass` avoids quadratic/path-insensitive matching and uses binding/context facts.
- `no-display-value-date-comparison` uses proven Glide/date/display-value provenance. If such provenance cannot be established, narrow the rule or lower its confidence rather than shipping a syntactic error-level rule.
- Duplicate Fluent IDs are described as file-local unless genuine project-wide analysis exists.
- Automatic fixes and suggestions match the documented 2.x policy. If the migration promises diagnostic-only behavior, remove remaining code-changing fixers/suggestions or revise the public contract consistently.

# 8. Make the catalog, presets, API, docs, and examples one coherent product — owning layer #83

## 8.1 Catalog as the single source of truth

Derive from one typed catalog:

- The public `rules` map
- Rule-name types
- Preset maps
- Metadata
- Option descriptors
- Documentation pages
- README rule tables
- Example expectations

Every rule file that is intended to ship must be reachable through the public plugin. Every documented rule must exist.

Generate and export the promised preset maps, including the applicable forms of:

- Recommended
- Strict
- Classic ES5
- ES2021
- Client
- Business Rule
- Fluent
- Policy
- Security

Do not document exports that do not exist.

Make the intended 2.x preset contract explicit:

- Recommended is conservative and quiet on unknown contexts.
- Classic compatibility bans are opt-in.
- Deprecated compatibility rules are not silently enabled.
- Each preset has exact real-host tests.

## 8.2 Public API

Inventory the actual package exports and distinguish:

- Supported public API
- Internal implementation details
- Deprecated compatibility exports
- Removed 2.x exports

Test ESM/NodeNext import and declaration consumption from the packed tarball. Preserve active 1.x contracts unless the 2.x migration deliberately removes them and documents that removal.

Do not claim the public API is narrowed while only adding documentation.

## 8.3 Independently runnable examples

Separate internal fixtures from copyable consumer projects.

Published/copyable examples must:

- Resolve the plugin by `specifier: "oxc-plugin-servicenow"`, not `../..`.
- Use a portable schema reference or omit repository-relative schema paths.
- Declare the required development dependencies or be installed by a documented workspace mechanism.
- Use the same command and configuration in README and package scripts.
- Run against the packed tarball in a clean temporary project.
- Have valid fixtures produce zero plugin diagnostics.
- Have invalid fixtures assert the exact expected rule IDs, message IDs, counts, and relevant locations.
- Run oxfmt through the public supported configuration path.
- Prove JSON and TypeScript formatter configuration where both are documented.
- Prove classic and Fluent formatting actually differ where claimed.
- Contain files already formatted according to their own formatter preset.

Execute the exact configuration blocks copied from the README, including UI Action and mixed-profile examples. Do not reconstruct a similar config in the test.

## 8.4 Honest generated documentation and evidence

Evidence records must include:

- Evidence kind
- Exact claim
- Symbol or section
- Source identity/domain
- Version
- Verification date
- Concrete local test/fixture reference where applicable
- Separate normative external evidence and local regression evidence

A local source file must not self-certify a ServiceNow platform claim.

Validate that referenced tests and fixtures exist and actually assert the documented behavior.

Do not assign one blanket `lastVerified` date to every record. Record per-evidence `verifiedAt`, and compute or validate summary dates without pretending every claim was rechecked on the newest date.

Validate calendar dates exactly rather than relying on normalizing `Date.parse`.

Generated-file drift checks must detect:

- Modified tracked files
- Missing generated files
- Newly generated untracked files
- Stale extra generated files

Prefer generation into a temporary tree and complete file-set/content comparison.

Keep future release notes under `Unreleased` until implementation and version identity are genuinely ready. Package version, lockfile, changelog, docs, and tarball names must never disagree.

# 9. Make integration evidence authoritative — owning layer #84

Distribute focused rule and analysis tests back to their owning PRs. Keep #84 for cross-layer, host-level, adversarial, packed-consumer, compatibility, and performance evidence.

Do not leave 17,000 lines of tests seven PRs after the code they verify.

## 9.1 Replace tests that encode defects

Delete or rewrite fixtures that call unsafe silence “valid,” including:

- Try/finally cases that pass only because of a synthetic catch path
- One-branch query cases represented by a different and weaker identity-union scenario
- Both-branch unfiltered bulk operations treated as valid
- Escaped-object false negatives presented as successful behavior
- Disputed `getAsync` behavior treated as authoritative without evidence

For intentional conservative false negatives, document them explicitly and pair them with nearby precision tests showing what remains detectable.

Preserve the strong binding matrix and expand it with:

- Try/catch/finally
- Switch with and without default
- Labeled break/continue
- Second-iteration loop state
- Call argument evaluation order
- Compound and destructuring assignments
- Hoisting and redeclaration
- Shadowed globals
- Mutable aliases
- IIFEs versus deferred callbacks
- Cache isolation

Typecheck valid TypeScript/Fluent fixtures. Exclude only intentionally invalid fixture trees, or use a separate fixture tsconfig.

## 9.2 One executable compatibility source

Define all compatibility dimensions in one typed or validated source:

- Actual Node runtime
- Oxlint
- ESLint
- oxfmt
- TypeScript
- typescript-eslint
- ServiceNow Fluent SDK
- File extension and configuration mode

Generate or deeply validate workflow matrices from this source. Checking cell IDs alone is insufficient; verify every dimension.

Requirements:

- Each Node-labelled cell must run under that actual Node runtime.
- A local one-process `--all` mode must be named/documented as a same-runtime dependency smoke test, not multi-runtime proof.
- Authoritative installs use normal npm peer resolution, not `--legacy-peer-deps`.
- Test the actual declared peer floors or raise the peer ranges to the oldest versions genuinely proven.
- Exercise the plugin’s exported ESLint config/rules on real `.ts` and `.tsx` Fluent files, not only the parser in isolation.
- Pin release-critical support cells.
- Put floating `latest`/`current` canaries in scheduled or non-blocking maintenance jobs.
- Avoid a `generatedFrom` field pointing to the file itself.
- Rebuild from a clean `dist` before packing.
- Install and execute the exact tarball produced from the current source.
- Do not let #84’s checker require release-workflow cells introduced only in #85.
- Every advertised `npm run validate` command must be executable at #84’s exact head. Move #85-owned steps out or provide the required nonprivileged implementation at #84.

## 9.3 Benchmark correctness

Benchmark only syntactically and semantically valid fixtures.

- Emit a shared Fluent import once rather than redeclaring it in every generated record.
- Parse and validate the complete Oxlint JSON output.
- Reject parser errors, configuration errors, crashes, truncated output, and unexpected exit codes.
- Accept a diagnostic exit only when the expected diagnostics are proven.
- Do not turn a failed process into a fast timing sample.
- Write current results to a distinct artifact file.
- Preserve raw samples, environment, CPU, runtime/tool versions, commit, commands, cases, and measurements.
- Upload the current result, not the checked-in baseline.
- Compare current results with the approved baseline separately.
- Treat absolute timing as trend evidence unless runners are controlled.
- Keep hard correctness and scaling guards.
- Fail or explicitly mark evidence unavailable when required memory metrics cannot be collected.
- Protect all temporary cleanup with `finally`.
- Never upload a historical baseline under a name implying it is the current run.

## 9.4 CI correctness

- Set workflow-level `contents: read`.
- Grant write or ID-token permission only to the exact jobs requiring it.
- Run deterministic docs/manifest/artifact checks once unless cross-runtime behavior is intentionally being tested.
- Avoid running expensive release checks in every Node test cell and again in standalone jobs.
- Install dependencies in jobs before scripts that may acquire dependencies.
- Keep required check names stable and mechanically checked against governance expectations.
- Pin actions to reviewed full commit SHAs and enforce one pin set across workflows.

# 10. Finish release governance and provenance — owning layer #85, last

Do not make a stable release candidate until #77–#84 are complete and revalidated root-to-tip.

Preserve the good architecture already present:

- Read-only validation
- One clean, inspected tarball
- Exact-tarball consumer matrix
- Artifact-only OIDC publish job
- No checkout or dependency installation in the publish job
- No long-lived npm token
- `--ignore-scripts`
- Separate registry verification without OIDC
- Separate GitHub release creation with only `contents: write`

Strengthen it as follows.

## 10.1 One release identity

Before enabling release:

- Query the registry at execution time.
- Choose a version greater than the current published versions/dist-tags.
- Treat narrowed peer ranges and other documented breaking changes as a major-version migration.
- Make `package.json`, lockfile, changelog, docs, tag, tarball name, GitHub release title, and npm package identity agree.
- Require the release heading to be the first version heading after `Unreleased`.
- Reject future or malformed dates according to a documented policy.
- Never use a historical or phantom changelog heading merely because its number matches.
- Do not leave a path that republishes an old version with new bytes.
- Revert unrelated lockfile metadata loss, including platform `libc` constraints, and pin the npm version used for lockfile maintenance.
- Decide whether prereleases are supported. If yes, publish them under an explicit non-`latest` dist-tag such as `next`; otherwise reject prerelease versions during validation.

Keep the repository at its current non-release version until the entire stack is merge-ready. Do not bump merely to make a checker green.

## 10.2 Clean exact artifact

- Clean `dist` before every release build.
- Never pack over stale output.
- Use `npm pack --ignore-scripts`.
- Inspect the exact tarball that will be published.
- Preserve a normalized `npm pack --json` manifest including paths, sizes, modes, links, integrity, and hashes.
- Reject path traversal, unexpected executable files, symlinks where not allowed, source/tests/workflows/scripts/plans, and stale extra outputs.
- Resolve dangling sourcemaps: either ship the referenced source deliberately or stop shipping JavaScript source maps and retain only useful declaration maps.
- Run all consumer tests against this exact artifact.
- Publish these exact bytes without rebuilding.

## 10.3 Tag and source identity

Use an explicit policy. Prefer stable releases only from the current protected `main` tip:

- Tag must equal `v${package.json.version}`.
- Tag commit must equal the current protected `origin/main` tip.
- If historical-main or backport releases are deliberately supported, document and test the different policy instead of relying only on “is an ancestor.”
- Changelog, package identity, inspected tarball, registry bytes, and attestation subject must all correspond to that same commit.

## 10.4 Publish outcome and retries

Do not use broad `continue-on-error` semantics that make setup, npm pinning, OIDC, or an ordinary publish failure look successful.

Model explicit outcomes:

- Publish accepted
- Version already exists and requires identity verification
- Ambiguous network outcome
- Permanent failure

Only the first three may proceed to registry verification under their defined conditions.

Retries must:

- Be bounded
- Use structured status/exit information
- Retry only transient network, publication-lag, 429, and 5xx conditions
- Fail immediately on malformed metadata, authentication/configuration errors, wrong package/version, integrity mismatch, or contradictory provenance
- Use a fresh temporary consumer directory per install attempt
- Use `os.tmpdir()` or create fallback parents before `mkdtemp`
- Never classify an arbitrary message containing “404” as registry lag

Add workflow-level tests for:

- Successful publish
- Ambiguous publish followed by matching registry bytes
- Already-existing identical package
- Missing registry version after failed publish
- Immediate integrity mismatch failure
- Permanent OIDC/authorization failure
- Eventual-consistency success within the bound
- Timeout
- GitHub release retry with identical bytes
- GitHub release retry with different bytes

## 10.5 Verify provenance identity, not presence

Do not accept any HTTPS attestation URL or arbitrary provenance object.

Fetch or cryptographically verify the actual attestation and require:

- Subject package and version
- Subject digest matching the inspected tarball
- Expected repository
- Expected workflow path
- Expected commit SHA
- Expected tag/ref
- Expected GitHub Actions builder identity
- Expected protected release environment where represented
- Correct trusted-publishing path

Registry integrity and provenance identity are separate checks; both must pass.

Keep this verification in a job with no `id-token: write`.

## 10.6 GitHub release idempotency

For an existing release, verify:

- Exact tag
- Target commit
- Expected title
- Draft state
- Prerelease state
- Release notes policy
- Asset name
- Asset bytes/digest
- No conflicting assets

Use the exact changelog version section as release notes or explicitly define the changelog as the sole source of truth. Do not accept a generic or stale release merely because one asset matches.

## 10.7 Trusted-publishing npm version

Use one shared implementation and constant for trusted-publishing npm validation.

The workflow must call the same checked helper exercised by tests. Do not duplicate an inline parser/version constant that can drift from `scripts/check-trusted-publishing-npm.mjs`.

## 10.8 Live governance

Treat desired governance and captured governance as different artifacts.

Add a read-only scheduled or manually dispatched audit, where APIs permit, for:

- Main branch/ruleset enforcement
- Exact required check contexts
- Tag protection
- Release environment reviewers
- Self-review prevention
- Actions policy
- Action pin policy
- Absence of a long-lived `NPM_TOKEN`
- npm trusted-publisher repository/workflow/environment identity

Fail or open a maintenance issue on drift without mutating controls from PR CI.

Where npm or GitHub does not expose a reliable read API, mark the item `Live-pending` and document the exact manual verification. Never convert a static JSON snapshot into “live proof” by naming it `live`.

The current single-reviewer plus prevent-self-review topology may deadlock a solo maintainer. Record the required external correction:

- At least two eligible actors, or
- A documented independent tagger/approver flow

Do not modify repository/environment settings without approval.

Parse workflow YAML in tests and assert the actual job graph:

- Publish job has no checkout or install
- Publish job has only `id-token: write`
- Registry verification has no ID-token
- GitHub release job has only the required contents permission
- Dependencies and job conditions are correct
- The exact tarball flows through validate → consumer → publish → registry verify → release

Do not rely primarily on regexes that can match comments or break on equivalent formatting.

Live provenance from a real protected-tag publication must remain `Live-pending` until such a release is explicitly authorized and performed. Merge readiness must not circularly require a tag-only release job that cannot run before merge.

# 11. Stack discipline

Implement in dependency order.

For each owning layer:

1. Reproduce each assigned defect at that layer’s current head.
2. Add the smallest focused failing test.
3. Implement the correction.
4. Run narrow checks.
5. Run the complete checks available at that exact layer.
6. Record exact evidence.
7. Restack every descendant onto the corrected predecessor.
8. Re-run affected descendant checks.
9. Re-review the new three-dot diff for scope leakage.

Do not hide an earlier layer’s missing implementation by wiring it only in #84.

Preferred ownership:

- #77: CFG/path-state core, state joins, evaluation order, shared per-file cache foundation
- #78: bindings, scopes, closures, identity, alias stability; move comment-scanner work to its real owner unless it genuinely belongs here
- #79: lifecycle engine and stateful ServiceNow rules
- #80: declaration-derived Fluent registry and import/factory identity
- #81: option descriptors, canonical Now.ID, directives
- #82: context/engine profiles and rule semantics
- #83: catalog, public exports, docs, examples, migration assets
- #84: host integration, packed consumers, compatibility, evidence, benchmark
- #85: privileged release workflow and live-governance contracts

If the existing stack cannot preserve unique, coherent ownership without unreasonable history surgery, document the evidence and propose the smallest justified restack. Do not silently keep fictional rollback boundaries.

Keep implementation PRs as real drafts until their own acceptance criteria pass. Since changing remote PR state is an external action, report the exact recommended title/draft/base changes rather than applying them without approval.

# 12. Required verification

Use a clean installation whenever dependencies or the lockfile change.

During iteration, run the narrowest relevant tests. Before declaring the working tree complete, run every applicable repository gate, including the actual equivalents of:

- Clean `npm ci`
- Formatting check
- Typecheck
- Build
- Unit tests
- Rule tests
- Integration tests
- Real Oxlint host tests
- Real ESLint/TypeScript host tests
- Valid-fixture typecheck
- Documentation generation/drift check
- Catalog consistency check
- Manifest check
- oxfmt integration
- Packed-consumer tests
- Compatibility consistency check
- Supported runtime matrix
- Benchmark correctness/scaling check
- Artifact inspection
- Workflow graph/action-pin check
- Nonpublishing release check
- Canonical `npm run validate`

Do not claim local execution of Node 20/22/24/26 unless those actual runtimes were used.

Every gate must fail closed on parser errors, missing tools, malformed output, stale build output, unavailable required metrics, and unexpected diagnostics.

# 13. Definition of done

The remediation is complete only when:

1. Every unique substantive PR comment/review finding has a recorded disposition and evidence.
2. Every confirmed semantic defect has a red-before-green regression at the owning layer.
3. No test calls a known unsafe false negative “valid.”
4. Control-flow, binding, identity, lifecycle, context, and Fluent analyses share consistent authority.
5. Every shipped rule is registered, documented, configurable, and tested through the real host.
6. Every documented rule, preset, command, export, example, version, and compatibility claim is executable from the packed package.
7. The Fluent manifest is proven from version-pinned declarations rather than self-snapshots.
8. `npm run validate` succeeds from a clean checkout at the intended final nonpublishing head.
9. Required CI cells run their advertised real runtimes and normal peer resolution.
10. Benchmark artifacts contain the current run and cannot record parser/config failures as performance samples.
11. Release validation builds and inspects one clean tarball and every later job uses exactly those bytes.
12. The publish job has no checkout, install, scripts, long-lived token, or unrelated permission.
13. Provenance verification proves subject and workflow identity.
14. Package, changelog, docs, tag policy, registry policy, and release asset identity cannot diverge.
15. Live controls that cannot be proven in code remain explicitly `Live-pending`.
16. No tag, publish, merge, release, branch push, PR-state mutation, or governance mutation has been performed without approval.

# 14. Final report

Return a self-contained implementation report containing:

- Executive summary
- Exact current heads and bases inspected
- Finding-disposition table
- Changes grouped by owning PR/layer
- Important design decisions and why
- Tests added, including which ones failed before each fix
- Complete verification commands and results
- Actual runtime/tool matrix used
- Public API and migration impact
- Package/version decision
- Performance evidence
- Release-workflow security properties
- Remaining live/manual governance actions
- Any blocked validation and the precise reason
- Recommended restack, PR-title, draft-state, and merge order
- Explicit confirmation that no release/tag/publish/merge or other unauthorized external action occurred

Do not stop after making the existing tests pass. The result must make the implementation, tests, documentation, compatibility evidence, and release claims agree with reality.