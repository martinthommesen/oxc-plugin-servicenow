# Finding rationale index

Stable finding IDs remain in source comments, test names and the knowledge graph. This index preserves the reasons for those controls; it is not a live findings registry or an acceptance status report.

The complete historical ledger, reserved identities and evidence are immutable at [the pre-simplification commit](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/c510575a595e86174c7941d9abc8f384ece9bc86/FINDINGS.md). Original explanations for earlier findings remain in [the initial remediation report](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/6c2ddceff298d9e3996ceaeee1aa49ad56063a1d/FINDINGS.md) and [the subsequent review](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/e01ac136041845e7db34f659934bebe3563e425d/FINDINGS.md).

Historical PR #51 progress tracking and outstanding live-audit/approval criteria are retired as tracking obligations, not claimed to have passed. [Recorded decisions](docs/decisions.md#historical-remediation-tracking-is-retired) explain that disposition. The product constraints and durable regression controls below remain in force; local checks do not establish current hosted governance, vendor facts or advisory status.

## Retained citations

Each row identifies the constraint behind an existing citation and links to its current implementation, regression test or decision. These IDs retain their historical meanings and must not be recycled.

| ID | Retained rationale and control |
| --- | --- |
| API-002 | Remove the never-computed lifecycle fields `queryState`, `windowed`, `sysparmName`, `aggregates` and `QueryState`; lifecycle facts belong to domain analyzers. [Public API tests](tests/analysis/public-api.test.ts). |
| API-003 | Export the member types needed to name public analysis signatures through supported entry points. [Public type tests](tests/types/readonly.test-d.ts). |
| COR-001 | Apply directory surface heuristics to project-relative paths; ancestor directories must not change script context. [Filename tests](tests/filenames.test.ts). |
| COR-002 | Suppress digest-like hexadecimal values for every supported digest binding name, not only `md5`; retain the tighter component boundary in COR-008. [sys_id tests](tests/rules/no-hardcoded-sysid.test.ts). |
| COR-003 | Preserve JavaScript reachability, branch/completion semantics and correlated callable state; prune constant-unreachable work instead of joining it as executable. [Path reachability tests](tests/analysis/path-reachability.test.ts). |
| COR-006 | Resolve Fluent aliases in execution order and apply assignment effects after the RHS completes, so pending writes cannot hide calls. [Fluent identity tests](tests/rules/fluent-identity.test.ts). |
| COR-007 | Use portable `start`/`range`/`span` offsets for alias write order; missing offsets mean unknown order, never the first initializer. [Alias host parity tests](tests/analysis/alias-write-parity.test.ts). |
| COR-008 | A digest word must be a whole name component; substrings such as `sha` in `shared` must not suppress actual sys_ids. [Digest classifier](src/utils/sysid.ts). |
| COR-009 | An initialized `var` redeclaration writes the coalesced binding; a bare redeclaration is a no-op and conditional/cross-function writes remain uncertain. [Fluent identity tests](tests/rules/fluent-identity.test.ts). |
| COR-011 | Reusable rule instances must reset per-file bindings and counters in `before()`; previous files cannot influence later diagnostics. [Multi-file regressions](tests/rules/multi-file-lifecycle.test.ts). |
| COR-013 | Model `do…while` reachability and `for…in`/`for…of` head rebinding, including `var` declarators, on each loop entry. [Loop-head tests](tests/rules/loop-head-rebind.test.ts). |
| COR-014 | Apply Fluent filename conventions only to Fluent filenames; stripping a Fluent extension is not evidence that a classic file is Fluent. [Fluent rule tests](tests/rules/fluent.test.ts). |
| COR-015 | Catalog surface/mode/confidence restrictions must agree with executable rule gates; preserve the runtime gates and structurally verify their metadata. [Catalog gate tests](tests/catalog-gates.test.ts). |
| COR-016 | Deduplicate findings by node identity, not optional offsets; absent offsets must also suppress claims of execution order. [Offset-free host tests](tests/analysis/offset-free-host.test.ts). |
| COR-017 | Explicit server naming survives UI Action classification; bare UI Actions retain uncertainty and explicit settings retain priority. [Context contract tests](tests/integration/context-contracts.test.ts). |
| DOC-002 | Rule evidence links must cite accepted ServiceNow release documentation, rather than an obsolete unsupported release. [Catalog evidence tests](tests/catalog-evidence.test.ts). |
| DOC-006 | Migration guidance must quote the exact tested peer ranges and link the compatibility matrix; it must not promise untested newer host lines. [Compatibility tests](tests/integration/compat-matrix.test.ts). |
| DX-001 | Benchmark summaries identify clean/dirty source state and meaningful changed files; generated output and baseline files must not make their own run dirty. [Benchmark gate](scripts/benchmark-gate.mjs). |
| FEAT-002 | Keep deprecated `scriptType`/`ecmaLatest` settings through 3.x because absence of consumers was not established; conflicts still fail and the old pragma was retired. [Compatibility decision](docs/decisions.md#compatibility-through-3x). |
| FEAT-003 | Every exported oxlint preset has an ESLint flat counterpart with the same rule map and the plugin attached. [Preset parity tests](tests/plugin.test.ts). |
| IMP-001 | Parse workflow YAML when verifying action pins and cover reusable workflows/composite actions; textual matching alone misses valid YAML forms. [Action pin gate](scripts/check-action-pins.mjs). |
| IMP-002 | Trusted publishing accepts a bounded supported executable npm range, rather than one exact version or unbounded newer releases. [npm policy gate](scripts/check-trusted-publishing-npm.mjs). |
| MNT-001 | Diagnostic-only rules need no autofix application harness; any future fix must satisfy exact-output, syntax, idempotence and comment-preservation controls. [Diagnostic contract tests](tests/plugin.test.ts). |
| MNT-002 | Generate the package version at build time; `sideEffects: false` entry modules must not read the filesystem during evaluation. [Version generator](scripts/generate-version.mjs). |
| MNT-004 | Bind the trusted-publisher OIDC subject to the exact expected repository and environment, in addition to certificate/bundle agreement. [Provenance verifier](scripts/verify-published-package.mjs). |
| MNT-005 | Checked JSDoc in `scripts/*.mjs` is the script type authority; do not maintain unchecked parallel `.d.mts` declarations. [Script type gate tests](tests/scripts-typecheck.test.ts). |
| MNT-006 | Preserve the first SDK version that deprecates a Fluent declaration and ensure lifecycle comparisons can detect drift. [Manifest tests](tests/fluent-manifest.test.ts). |
| MNT-007 | Examples must run as documented under quality gates; formatter preset types must remain assignable without an open index signature that accepts typos. [Packed consumer tests](tests/integration/packed-consumer.test.ts). |
| OPS-001 | Required lint, format and fixture configurations must be tracked so a clean checkout can run every declared gate. [Script path gate](scripts/check-script-paths.mjs). |
| OPS-002 | Required status checks must name jobs the workflows can actually emit, including matrix-expanded names. [Release workflow tests](tests/release/layer7.test.ts). |
| OPS-004 | Keep ordinary tests offline and run packed-consumer installs only through the explicit networked consumer command/job. [Test runner](scripts/run-tests.mjs). |
| OPS-006 | Post-publish probes must exercise current supported exports and package metadata, without requiring the removed root `PACKAGE_VERSION` export. [Packed consumer tests](tests/integration/packed-consumer.test.ts). |
| OPS-007 | CI enforces SDK manifest drift and runs nightly so upstream changes can be detected without a repository push. [CI workflow](.github/workflows/ci.yml). |
| OPS-008 | Mutable hosted governance needs a scheduled audit; keep it advisory so transient API failures do not block merges. [Governance audit](.github/workflows/governance-audit.yml). |
| OPS-009 | CI and release validation must both invoke the compatibility check and propagate its failure status. [Release workflow](.github/workflows/release.yml). |
| OPS-010 | Script coverage includes workflow-only references as well as package scripts, so an untracked workflow helper cannot escape checks. [Script path gate](scripts/check-script-paths.mjs). |
| OPS-011 | Declared support ranges and generated guidance are bounded by exact tested host combinations; registry-dependent checks remain explicit. [Compatibility gate](scripts/check-compat-matrix.mjs). |
| PER-001 | Project the large Fluent snapshot onto explicit shared types; shipping its complete inferred literal declaration causes excessive package/type size. [Artifact gate](scripts/check-release-artifact.mjs). |
| PER-002 | Memoize cursor-state traversal and bound independent retention work/depth; distinct nested states must not multiply unbounded work or retain partial findings. [Domain budget tests](tests/analysis/domain-budget.test.ts). |
| PER-003 | Scale deterministic path work with program size so ordinary longer scripts are analyzed; still degrade conservatively when bounded work exhausts. [Budget scaling tests](tests/analysis/path-budget-scaling.test.ts). |
| PER-004 | Packed-file extraction uses an explicit bounded buffer sized for generated artifacts, rather than Node's small default. [Artifact extraction](scripts/check-release-artifact.mjs). |
| PER-005 | Index binding writes/references once per file instead of re-walking the program per call or loop; scaling evidence must also prove semantic results without exhaustion. [Alias scaling tests](tests/analysis/alias-scaling.test.ts). |
| PER-006 | Expose `pathBudgetExhausted` and discard all incomplete findings and shared facts on exhaustion; an exhausted run cannot count as a clean semantic or performance result. [Exhaustion tests](tests/analysis/path-budget-exhaustion.test.ts). |
| REL-001 | Parse prerelease identifiers without truncating hyphenated suffixes such as `rc-2`. [Release version ordering](scripts/publish-release-package.mjs). |
| REL-002 | Bound each child process, request, retry window and workflow job; an overall verification deadline cannot stop a hung unbounded operation. [Release workflow tests](tests/release/layer7.test.ts). |
| REL-003 | Compare nonnumeric prerelease identifiers in SemVer ASCII order, independent of locale or Node build. [Release version ordering](scripts/publish-release-package.mjs). |
| REL-004 | Absolute timings from a foreign-hardware baseline remain advisory in hosted CI; required checks must not fail merely because runner hardware differs. [Governance policy](scripts/check-release-governance.mjs). |
| REM-001 | `validate-gliderecord-calls` was removed in 3.0; use `require-query-before-next` for sequencing, while the old unused-return check has no replacement. [Migration guide](docs/migration-3.0.md). |
| TST-001 | Sigstore fixture time must lie within the mock root certificate's actual validity window; nightly CI observes time-dependent decay between pushes. [Provenance fixture tests](tests/release/layer7.test.ts). |
| TST-003 | Explicit test paths must resolve and must not silently re-enable network installs; preserve the documented suite boundary for both default and selected runs. [Test runner](scripts/run-tests.mjs). |
| TST-004 | A rule that declines a file differs from an active rule with no diagnostics; gate-sensitive tests assert skipped or valid-active outcomes explicitly. [Outcome assertion tests](tests/helpers/rule-tester-outcome.test.ts). |
| TST-005 | Gate agreement counts actual call-expression callees and matching surface arguments; comments, strings and unrelated surfaces cannot satisfy the check. [Catalog gate tests](tests/catalog-gates.test.ts). |
| TST-006 | Hosted CI and release validation run source, fixture and checked-script type projects, matching the local validation contract. [Release workflow tests](tests/release/layer7.test.ts). |
