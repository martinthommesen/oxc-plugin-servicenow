# Plan 014: Make tests, evidence, compatibility, and benchmarks honest

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If a STOP condition occurs, stop and report it. Do not improvise.
> When done, update this plan's status in `plans/README.md`, unless the reviewer
> maintains the index.
>
> **Drift check (run first)**:
> `git diff --stat b87972a..HEAD -- package.json package-lock.json scripts tests docs README.md PR51-REMEDIATION-GOAL.md .github/workflows/ci.yml .gitignore src/catalog.ts src/fluent docs/pr-51-stack.json`
> Plans 007 through 013 must change many of these files. Compare the excerpts
> below with their final contracts. Stop if a dependency is incomplete or a
> cited test now proves different behavior.

## Status

- **Status**: IN PROGRESS — implemented in PR #84; merge pending.
- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: `plans/007-rebuild-path-state-semantics.md`, `plans/008-fix-bindings-scopes-and-closures.md`, `plans/009-rebuild-stateful-rule-lifecycles.md`, `plans/010-authoritative-fluent-sdk-registry.md`, `plans/011-fix-now-id-and-fluent-directives.md`, `plans/012-fix-context-profiles-and-rule-contracts.md`, `plans/013-narrow-public-api-and-fix-user-assets.md`
- **Category**: tests / DX / performance / documentation
- **Planned at**: commit `b87972a`, 2026-08-20

## Why this matters

The current test count overstates coverage. Six stateful rules pass a matrix that
never calls their reporting operations. Real-host tests usually assert a rule ID,
a line, and a message substring instead of the exact diagnostic contract.

The acceptance ledger labels contradicted criteria as verified without exact test
names. Fluent boundaries, documentation evidence, peer ranges, compatibility
jobs, and benchmark artifacts also rely on hand-maintained claims.

This plan makes evidence executable at the current commit. It is the final
unprivileged evidence layer before Plan 015 updates the release-only stack tip.

## Current state

The following excerpts are from `b87972a`.

- `tests/rules/binding-matrix.test.ts:8-17` gives every rule the same `next()`
  program and permits only one rule to report:

  ```ts
  for (const testCase of glideRecordBindingMatrix("next()")) {
    if (testCase.expect === "report" && rule === "require-query-before-next") {
      assertInvalid(testCase.code, rule, { messageId: "missingQuery" }, options);
    } else {
      assertValid(testCase.code, rule, options);
    }
  }
  ```

  `tests/helpers/binding-matrix.ts:87-95` lists seven stateful rules. The other
  six prove only that unrelated `.next()` code stays silent. Its block-shadowing
  case uses `var`, which is function-scoped.

- `tests/integration/adversarial.test.ts:47-63` asserts one Oxlint label line and
  a message substring. ESLint gets a `messageId`, but neither host gets an exact
  start/end contract. `tests/integration/helpers.ts:8-20` already exposes the
  Oxlint code, severity, filename, message, and full span.

- `tests/options.test.ts:27-105` checks the internal option parser.
  `tests/options.test.ts:112-137` checks ESLint schema rejection. No test runs an
  invalid rule option through the real Oxlint executable.

- `docs/pr-51-acceptance-ledger.md:20-35` marks control-flow criteria verified
  with generic labels such as “implementation checkpoint and targeted
  regression suite.” Rows do not identify exact tests. The file has no generator
  or current-head verifier. It also marks several findings from the PR #51 audit
  verified although the review reproduced failures.

- `tests/fixtures/fluent-sdk-boundaries.json:2-87` stores selected `present`
  names and a few ID policies. It has no tarball integrity, declaration paths,
  declaration hashes, complete export set, ownership, or complete negative set.
  `scripts/check-fluent-manifest.mjs:101-110` checks only those selected names.

- `scripts/compat-matrix.json:10-35` contains unbounded values and false tested
  bounds:

  ```json
  "oxlint": { "peer": ">=1.79.0 <2", "latestCompatible": "latest" },
  "eslint": { "peer": ">=9.0.0", "current": "10.8.1" },
  "oxfmt": { "peer": ">=0.64.0", "latest": "latest" },
  "typescriptEslint": {
    "peer": ">=8.0.0 <9",
    "tested": "8.46.0",
    "minimum": "8.46.0",
    "current": "8.46.0"
  }
  ```

  Every cell installs `typescript-eslint@8.46.0`.
  `scripts/compat-consumer.mjs:67` uses `--legacy-peer-deps` for every cell and
  only calls `parseForESLint()` directly at lines 111-118. CI and the release
  workflow duplicate cell/Node pairs. The checker compares only cell IDs.

- `scripts/benchmark.mjs:133-143` accepts failed lint runs if stdout contains an
  opening brace:

  ```js
  child.on("close", (status) => {
    // ...
    if (!stdout.includes("{") && status !== 0) {
      reject(new Error(`oxlint failed (${status}): ${stderr || stdout}`));
      return;
    }
    resolve({ elapsedMs, peakRssKb });
  });
  ```

  It does not parse the host output or reject parser/configuration diagnostics.
  Normal runs print current results but write no current-result file. CI uploads
  `docs/performance-baseline.json`, which is the old reference data. Pull
  requests compare against the baseline in their own branch.

- `scripts/check-catalog-docs.mjs:112-126` accepts a local evidence claim when a
  path exists. It accepts a remote claim when the URL has an HTTPS shape. It
  does not resolve an exact test or a pinned authoritative snapshot.

## Commands you will need

Use these existing npm commands and the commands added by this plan.

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Install | `npm ci` | exit 0 |
| Typecheck | `npm run typecheck` | exit 0, no errors |
| Build | `npm run build` | exit 0 |
| Focused tests | `node scripts/run-tests.mjs PATH...` | selected tests pass |
| All tests | `npm test` | all tests pass |
| Documentation check | `npm run docs:check` | exit 0, no generated diff |
| Fluent boundary check | `npm run manifest:check` | exit 0, exact snapshots match |
| Matrix check | `npm run compat:check` | exit 0, matrix schema and package ranges match |
| Packed compatibility | `npm run compat -- --cell CELL` | the selected real cell passes |
| Benchmark | `npm run bench` | exit 0; writes a validated current-result artifact |
| Full local gate | `npm run validate` | exit 0 |

Add `acceptance:check` and `evidence:check` in Step 5. Both commands must record
or verify exact evidence instead of searching for file names.

## Scope

Modify only these paths:

- `package.json`, `package-lock.json`, and `.gitignore`
- `tests/helpers/binding-matrix.ts` and `tests/rules/binding-matrix.test.ts`
- `tests/integration/helpers.ts`, `tests/integration/adversarial.test.ts`,
  `tests/integration/oxlint.test.ts`, and `tests/integration/eslint.test.ts`
- new real-host matrix fixtures/configs under `tests/integration/profiles/`
- `tests/options.test.ts` and a new `tests/integration/options-oxlint.test.ts`
- `tests/fixtures/fluent-sdk-boundaries.json` or generated versioned replacements
  under `tests/fixtures/fluent-sdk/`
- `tests/fluent-manifest.test.ts`, `tests/integration/compat-matrix.test.ts`,
  `tests/integration/packed-consumer.test.ts`, `tests/benchmark-gate.test.ts`, and
  `tests/perf/`
- `scripts/check-fluent-manifest.mjs` and the deterministic Fluent snapshot tool
  established by Plan 010
- `scripts/compat-matrix.json`, `scripts/check-compat-matrix.mjs`,
  `scripts/compat-consumer.mjs`, and `scripts/generate-compatibility-docs.mjs`
- `scripts/benchmark.mjs` and `scripts/benchmark-gate.mjs`
- new `scripts/pr51-acceptance.json`,
  `scripts/verify-acceptance-ledger.mjs`, and `scripts/verify-doc-evidence.mjs`
- `scripts/run-tests.mjs` only to add a machine-readable exact-test reporter
- `src/catalog.ts` only for the evidence-reference schema established by Plan 013
- `docs/pr-51-acceptance-ledger.md`, `docs/pr-51-validation-report.md`,
  `docs/compatibility.md`, `docs/performance.md`,
  `docs/performance-baseline.json`, generated `docs/rules/*.md`, and `README.md`
- `PR51-REMEDIATION-GOAL.md` only to replace unchecked/checked presentation with
  generated status links; do not rewrite acceptance criteria
- `.github/workflows/ci.yml`

Do not modify these paths:

- `docs/pr-51-stack.json`. Plan 006 owns its immutable topology, archived
  ownership, reconstruction commit, and rollback rules. Put live data in PR
  bodies, not this file.
- `.github/workflows/release.yml`, release helpers/tests, `docs/release.md`, or
  release-governance data. Plan 015 consumes the matrix API from this plan and
  updates the privileged release-only branch.
- `src/rules/`, `src/analysis/`, `src/context/`, or `src/settings/`. If honest
  evidence finds a behavior defect, route it to Plans 007-012.
- The supported Fluent capability registry itself. Plan 010 owns capability and
  version decisions. This plan verifies its authoritative snapshots.
- Publishing, tags, npm trust, registry verification, or GitHub environment
  settings.
- `plans/001-005`; they are complete.

## Git workflow

Plan 006 creates this nonempty draft branch and pull request above Plan 013
before remediation starts. Do not create the branch again.

1. Read `docs/pr-51-stack.json`. Confirm that
   `pr51-remediation/014-tests-evidence-compat` exists, targets
   `pr51-remediation/013-public-api-assets`, and owns every in-scope archived
   path or hunk assigned to Plan 014. Confirm its reconstruction commit and
   rollback rule. The manifest does not store mutable live head SHAs.
2. Run `gh stack view --json` and
   `gh pr view pr51-remediation/014-tests-evidence-compat --json url,baseRefName,headRefName,headRefOid,state,statusCheckRollup,body`.
   Compare topology and ownership with the manifest. Compare the live remote
   head, PR state, and check run with the evidence recorded in the PR body and
   the PR #51 tracking body.
3. Run `gh stack checkout pr51-remediation/014-tests-evidence-compat`. If Plan
   006 already adopted the local branch, a normal checkout of that same existing
   branch is acceptable. Never run `gh stack add` for this plan.
4. Keep these commits separate:
   - `test: replace the tautological binding matrix`
   - `test: pin exact host and option diagnostics`
   - `test: verify authoritative Fluent boundaries`
   - `docs: generate current-head acceptance evidence`
   - `build: make compatibility and benchmarks reproducible`
5. Use `gh stack submit --auto` only if the operator asks you to update the
   existing draft pull request.
6. Run `gh stack view --json`. Confirm that the PR base is the Plan 013 branch.
7. Use the Plan 006 updater to record the current PR URL, base SHA, head SHA,
   state, and check run in this PR body and the PR #51 tracking body. Do not put
   mutable live values in `docs/pr-51-stack.json`.

Stop if manifest topology, archived ownership, reconstruction data, or rollback
rules disagree with the stack. Stop if the live remote head, PR state, or check
run disagrees with the PR-body evidence. Do not place privileged release
workflow edits in this PR. Plan 015 is a separate child PR based on this branch.

## Steps

### Step 1: Replace the tautological matrix with rule-specific cases

Replace `glideRecordBindingMatrix(methodCall)` with typed rule-specific programs.
Each case needs these fields:

```ts
{
  id: string;
  rule: RuleName;
  code: string;
  filename: string;
  settings?: ServiceNowSettings;
  expected: "report" | "silent";
  messageId?: string;
  message: string;
  start: { line: number; column: number };
  end: { line: number; column: number };
}
```

Do not permit a reporting case to become `assertValid` for a different rule.
Group reusable source builders by platform object, but keep each expected result
owned by the target rule.

Give each of these consumers at least one direct reporting case and one adjacent
silent case:

- `require-query-before-next`
- `validate-glideaggregate-calls`
- `no-unfiltered-gliderecord-bulk-operation`
- `no-gliderecord-query-in-loop`
- `no-gliderecord-query-modifier-after-query`
- `no-delete-multiple-with-windowing`
- `prefer-setnocount-with-choosewindow`
- `require-glideajax-sysparm-name`
- `no-glideelement-in-collection`
- `require-fluent-id` and `no-now-id-as-reference`

Apply the relevant binding/control-flow axes to each object family. Cover this
required regression suite across the matrix, without creating meaningless
Cartesian duplicates:

- direct receiver, proven alias, sibling reassignment, and independent objects
- `let` or `const` block shadowing, parameter shadowing, and sibling scopes
- static computed members and unknown computed members
- external call, member storage, array storage, and closure capture escapes
- same-identity and different-identity joins
- `&&`, `||`, `??`, and conditional expressions
- zero/one/many-iteration loops, switch fall-through/default/no-default, and
  nested labeled/unlabeled `break` or `continue`
- `try`, `catch`, and `finally` with normal, return, throw, break, and continue
  completions
- receiver/argument evaluation order and computed assignment targets
- direct functions, arrows, callbacks, recursion, and capture before/after
  assignment
- mutable namespace and `Now.ID` aliases, dynamic keys, and local shadows

Use stable case IDs. Replace the old `var` block-shadowing case with a real
lexical declaration. Add exact report counts. A silent case must prove that its
target operation was reached, not that unrelated syntax was ignored.

**Verify**:

```bash
node scripts/run-tests.mjs tests/rules/binding-matrix.test.ts
```

Every listed consumer has both result classes. No test title says that a
reporting matrix case “stays silent” for an unrelated rule.

### Step 2: Run the matrix through both real hosts with exact diagnostics

Create committed host fixtures from the stable matrix case IDs. Keep one source
of expected diagnostic data. Normalize host output without discarding fields.

For Oxlint, assert the exact:

- raw code, including its host wrapper form
- severity
- fully rendered message
- normalized relative filename
- byte offset, byte length, line, and column for every label
- process exit status and absence of parser/configuration diagnostics

For ESLint, assert the exact:

- `ruleId`, severity, `messageId`, and fully rendered message
- filename
- start and end line/column
- `fatal: false`
- diagnostic count

Oxlint does not expose `messageId` or interpolation data. The exact rendered
message is its contract. ESLint must assert both `messageId` and the same rendered
message. Preserve the host-specific code wrapper in the fixture rather than
normalizing it to a substring.

Change the real-host helper so it returns status, stdout, stderr, and parsed
output. Accept exit 1 only when the invoked lint fixture intentionally produces
lint diagnostics. Reject a signal, malformed/truncated JSON, parser error,
configuration error, or unexpected exit even if stdout contains `{`.

Run the high-risk matrix cases through both hosts. At minimum, include every
reporting rule and one silent case per platform-object family. Include exact
cases for abrupt completion, all three logical operators, lexical shadowing,
escape, closure capture, evaluation order, GlideAjax epochs, and `Now.ID`.

If Plan 012 changed a remediation message, update the single expected fixture to
that final text. Never weaken an exact assertion to a substring because the
messages differ.

**Verify**:

```bash
node scripts/run-tests.mjs tests/integration/oxlint.test.ts tests/integration/eslint.test.ts tests/integration/adversarial.test.ts
```

Both hosts produce the exact committed diagnostics. Silent fixtures have zero
plugin, parser, and configuration diagnostics.

### Step 3: Reject invalid options through the real Oxlint executable

Add `tests/integration/options-oxlint.test.ts`. Generate temporary configs from
the option descriptors exposed through the Plan 013 catalog. Run the installed
Oxlint binary directly.

Cover at least one case for each schema shape:

- string instead of boolean
- numeric string and below-minimum integer
- invalid enum
- non-array and invalid array item
- unknown property
- missing required property, if the catalog defines one
- extra positional option

For `ignoreHashNames: "false"`, the current host exits 1 and emits no lint JSON.
Its stable error includes the exact rule name, bad value, and required boolean
type. Assert the exact stable lines after removing terminal color and stack
boilerplate. Apply the same normalization to the other cases.

Require all invalid cases to:

1. exit nonzero,
2. emit no partial lint diagnostics,
3. identify the exact rule and option failure,
4. leave the target source unread or without rule results.

Also keep one valid boundary case per descriptor through real Oxlint. Valid
options must produce the intended diagnostic or silence, not only load.

**Verify**:

```bash
node scripts/run-tests.mjs tests/options.test.ts tests/integration/options-oxlint.test.ts
```

All internal, ESLint, and Oxlint option tests pass. No host uses coercion.

### Step 4: Verify complete authoritative Fluent boundaries offline

Consume the authoritative package snapshot tool from Plan 010. For every version
in `SUPPORTED_FLUENT_SDK_VERSIONS`, commit generated data that contains:

- exact package name and version
- npm tarball URL and Subresource Integrity (SRI)
- declaration entry paths and SHA-256 hashes
- the complete supported factory/export set
- the complete absent-within-supported-union set
- module ownership for each factory
- the derived `$id` policy and the declaration locator that proves it

Normal CI must not fetch mutable remote data. The refresh command can use the
network, but it must verify the pinned SRI before extraction. It must write
sorted deterministic fixtures. `manifest:check` must compare the in-memory
registry with exact generated sets and policies.

Add mutation tests that fail after each of these changes:

- add or remove an export
- move an export to another module
- change an ID policy
- change a declaration hash or package integrity
- leak a capability into a version before its introduction

Keep explicit negative boundaries for `AliasTemplate` before 4.8.0 and
`StateModel` before 4.10.0. Do not synthesize a historical snapshot from the
current manifest.

**Verify**:

```bash
node scripts/run-tests.mjs tests/fluent-manifest.test.ts
npm run manifest:check
```

Both commands exit 0. A second snapshot generation in a temporary directory is
byte-for-byte identical to the committed fixtures.

### Step 5: Generate exact documentation and acceptance evidence

Create `scripts/pr51-acceptance.json`. Map every atomic criterion in
`PR51-REMEDIATION-GOAL.md` to:

- a stable criterion ID
- its exact source heading and text digest
- the owning plan and stack branch
- one or more exact test file and full suite/test names
- stable matrix/evidence case IDs where applicable
- the npm command that executes the proof
- status: `Pending`, `Verified`, or `Live-pending`

A broad file path, “targeted regression suite,” or “implementation checkpoint”
is not evidence. Downgrade every row to `Pending` until its exact test or pinned
authoritative snapshot passes. Keep live publication criteria `Live-pending`.

Add `scripts/verify-acceptance-ledger.mjs`. It must:

1. parse every atomic criterion from the goal,
2. reject missing, duplicate, changed, or orphaned mappings,
3. inventory actual `node:test` results with full suite/test names,
4. reject absent, duplicate, skipped, todo, or failed proof tests,
5. verify referenced case IDs and authoritative fixture digests,
6. record `git rev-parse HEAD`, worktree state, Node/npm/host versions, commands,
   result counts, and UTC time,
7. write JSON and Markdown artifacts under `artifacts/`, and
8. generate the committed ledger's criterion/evidence links deterministically.

A tracked ledger cannot contain the SHA of the commit that contains itself.
Therefore, keep the current-head result in the CI artifact. State this rule in
the committed ledger. In CI, require a clean worktree and exact `GITHUB_SHA`.
For local pre-commit runs, record the diff digest and mark the result
`uncommitted`; do not call it current-head verified.

Generate `docs/pr-51-validation-report.md` from the same mapping and the latest
accepted evidence artifact. Remove stale test counts, old head hashes, and broad
claims. Historical CI links can remain in a clearly labeled history section.
They must not be presented as proof for the current head.

Strengthen catalog evidence from Plan 013. Give each automated evidence record a
stable `verificationId`. It must resolve to either:

- an exact test file plus full suite/test name and case ID, or
- a pinned authoritative snapshot, integrity, locator, and deterministic
  derivation.

Manual evidence can document context. It cannot satisfy a recommended-error
verification gate. Add `scripts/verify-doc-evidence.mjs` to reject missing,
duplicate, skipped, stale, or unresolvable verification IDs. Derive
`lastVerified` from successful evidence metadata. Do not accept a path's
existence or an HTTPS URL shape as proof.

Add these package scripts:

```json
"acceptance:check": "tsx scripts/verify-acceptance-ledger.mjs",
"evidence:check": "tsx scripts/verify-doc-evidence.mjs"
```

Run them from `validate` after `npm test`. Add them to CI and upload the JSON and
Markdown ledger artifacts with `if: always()`.

**Verify**:

```bash
npm run acceptance:check
npm run evidence:check
npm run docs:check
git diff --exit-code -- docs/pr-51-acceptance-ledger.md docs/rules README.md
```

All commands exit 0. The artifact records the tested commit or clearly says
`uncommitted`. No verified row contains a generic proof label.

### Step 6: Make the compatibility matrix executable and bounded

Make `scripts/compat-matrix.json` the only source for the Node/cell pairs and all
host/parser versions. Use exact versions. Never use `latest` in a required cell.

Remove `compat-consumer.mjs`'s "build only when `dist/index.js` is missing" shortcut. Every local compatibility tarball must come from a fresh successful build, or from an explicit immutable tarball argument with a recorded digest. Add a regression that writes a stale-but-present `dist/index.js`, changes a source marker, runs the consumer, and proves the packed output contains the rebuilt marker. Keep privileged release artifact code in plan 015; do not import a release helper into this non-privileged layer.

At this plan's date, the highest compatible pins are Oxlint `1.79.0`, oxfmt
`0.64.0`, ESLint `10.8.1`, and typescript-eslint `8.67.0`. Recheck them with
`npm view` before committing. If a value changed, commit the exact highest
version that satisfies the declared bound and record the resolution date.

Bound the tested peers to the majors that the matrix proves:

```json
"eslint": ">=9.0.0 <11",
"oxfmt": ">=0.64.0 <1",
"oxlint": ">=1.79.0 <2",
"typescript-eslint": ">=8.0.0 <9"
```

Do not raise a minimum only because a test fails. Include distinct cells for:

- Node 20.19.0 with every exact minimum, including typescript-eslint 8.0.0
- current ESLint 9 plus current typescript-eslint 8 through real typed
  `*.now.ts` and `*.now.tsx` composition
- ESLint 10 host behavior without typescript-eslint until its peer accepts 10
- the exact highest Oxlint and oxfmt versions inside their bounds
- exact Node 22.14.0, 24.16.0, and 26.7.0 runtimes with exact host versions

Use full Node patch versions in required cells. Give every cell an expected npm
version or a narrow bundled-npm range. Record how that npm value was resolved.
Do not use moving `current`, LTS aliases, or bare Node majors in a required cell.

Allow parser fields to be absent in the ESLint 10 cell. Remove the global
`--legacy-peer-deps`. Use normal npm resolution for every supported combination.
Each cell must assert the actual Node, npm, Oxlint, ESLint, oxfmt,
typescript-eslint, and TypeScript versions before it runs behavior tests.

Add this machine interface:

```bash
node scripts/check-compat-matrix.mjs --github-matrix
```

On success, stdout must contain exactly one compact JSON object and no banner:

```json
{"include":[{"cell":"min-hosts","node":"20.19.0"}]}
```

The real output contains every matrix cell in source order. Each row contains
only `cell` and `node`; `compat-consumer.mjs` resolves the remaining selected
cell data and asserts installed versions. Invalid, duplicate, missing, or
unbounded data exits nonzero without JSON.

Use this output in a CI prepare job and feed it to the compatibility strategy
with `fromJSON`. Remove copied Node/cell rows from `ci.yml`. Generate
`docs/compatibility.md` and the README compatibility section from the same data.
Update the checker and tests so package peers, generated docs, CI rows, and
consumer assertions cannot drift.

Plan 015 must use this exact interface in `.github/workflows/release.yml`. Do not
edit that privileged workflow here. Record the handoff in
`docs/pr-51-stack.json`; the complete stack cannot claim one-source release
coverage until Plan 015 lands.

**Verify**:

```bash
npm run compat:check
node scripts/check-compat-matrix.mjs --github-matrix | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const value=JSON.parse(s); if(!Array.isArray(value.include)||!value.include.length) process.exit(1)
})'
node scripts/run-tests.mjs tests/integration/compat-matrix.test.ts tests/integration/packed-consumer.test.ts
```

All commands exit 0. This search returns no required-cell `latest` values and no
global legacy peer mode:

```bash
grep -n '"latest"\|legacy-peer-deps' scripts/compat-matrix.json scripts/compat-consumer.mjs
```

Expected result: no matches.

Run every cell in its declared Node runtime. Each prints its asserted exact
version set and passes. Do not use `--all` under one Node process as a substitute.

### Step 7: Validate benchmark executions and compare with the merge base

Refactor the Oxlint process boundary into a testable helper. Accept a timing
sample only if all conditions hold:

- the child exits with the expected status 0 and no signal
- stdout is one complete valid Oxlint JSON document
- `diagnostics` is an array and is empty for the generated valid fixture
- no parser, configuration, plugin-load, or rule diagnostic is present
- stderr contains no host failure

Add unit tests for valid empty output, malformed/truncated JSON, nonzero plus
JSON, parser/config diagnostics, unexpected rule diagnostics, stderr-only
failure, and signal termination.

Add explicit `--baseline PATH` and `--output PATH` arguments. Make `npm run bench`
write `artifacts/performance-current.json` by default. Validate both baseline and
current schemas completely. Match exact `(fixture, profile)` keys and reject
missing, extra, duplicate, or renamed cases.

In pull-request CI:

1. Fetch enough history to resolve the target branch.
2. Compute the merge base with the target branch.
3. Extract `docs/performance-baseline.json` from that exact commit into a
   temporary path.
4. Pass that path with `--baseline`.
5. Pass `artifacts/performance-current.json` with `--output`.
6. Stop if the merge base or baseline is unavailable. Never fall back to the
   pull-request baseline.
7. Upload the current result and failure metadata with `if: always()`.

Use the thresholds from the merge-base baseline, not constants or threshold
changes in the pull request. Start with these reviewable limits:

- elapsed: `baseline * 1.5 + 100 ms`
- peak RSS: `baseline * 1.25 + 25,000 KB`
- maximum recommended large/small scale: `4`
- absolute `classic-large/recommended`: `5,000 ms`

Collect at least ten clean CI samples on the benchmark runner. Add an injected
repeated-full-file traversal and a nonlinear fixture test. The injected defect
must fail these limits while all clean samples pass. If clean variance overlaps
the injected regression, stop and redesign the fixture or runner. Do not loosen
the limits until both become green.

Separate baseline refresh from result capture. Document that a baseline change
needs its own reviewed PR and cannot accompany the performance code it excuses.
Update `docs/performance.md` to describe merge-base comparison and the current
artifact. CI must upload `performance-current`, not
`docs/performance-baseline.json`.

**Verify**:

```bash
node scripts/run-tests.mjs tests/benchmark-gate.test.ts tests/perf
npm run bench -- --baseline docs/performance-baseline.json --output artifacts/performance-current.json
node -e 'const r=require("./artifacts/performance-current.json"); if(!r.results?.length) process.exit(1)'
```

All commands exit 0. The output identifies the baseline source and applied
thresholds. The injected repeated-analysis test fails when enabled.

### Step 8: Run the complete evidence gate

Run the focused checks first. Then run every package gate from a clean checkout
at the Plan 014 head:

```bash
npm ci
npm run lint:check
npm run format:check
npm run typecheck
npm run build
npm test
npm run docs:check
npm run manifest:check
npm run evidence:check
npm run acceptance:check
npm run compat:check
npm run bench -- --baseline docs/performance-baseline.json --output artifacts/performance-current.json
npm run validate
```

All commands exit 0. Run each compatibility cell in the Node runtime declared by
the matrix. Save the current-head acceptance, compatibility, and benchmark
artifacts in CI.

Run `gh stack view --json`. Confirm that Plans 013 and 014 are separate PRs with
the correct bases. Confirm that Plan 015 is the only child allowed to change the
release workflow.

## Test plan

Use these structural patterns:

- Use `tests/helpers/rule-tester.ts` for unit-level message IDs and ranges.
- Use `tests/integration/helpers.ts` for process status and exact host output.
- Use `tests/integration/packed-consumer.test.ts` for clean packed composition.
- Use `tests/benchmark-gate.test.ts` for process and threshold mutation tests.
- Use the Plan 010 snapshot generator for authoritative Fluent data.

The new regression suite must include:

- rule-specific reporting and silent cases for all consumers listed in Step 1
- exact Oxlint and ESLint output for every changed rule family
- invalid options through internal parsing, ESLint, and real Oxlint
- full positive and negative Fluent SDK boundaries for every supported version
- exact acceptance and documentation evidence IDs
- minimum and current peer bounds under their declared Node processes
- benchmark process failures, merge-base selection, artifact schema, exact case
  equality, and injected repeated-analysis failure

## Done criteria

All items must hold:

- [ ] Every matrix consumer has a real reporting operation and an adjacent
      silent case.
- [ ] The required alias, shadow, escape, completion, logical, loop, switch,
      try/finally, closure, and evaluation-order cases pass.
- [ ] Oxlint and ESLint assert exact counts, IDs/codes, severities, rendered
      messages, filenames, and complete ranges.
- [ ] Real Oxlint rejects every invalid option shape without partial results.
- [ ] Fluent fixtures contain verified package integrity, declaration hashes,
      complete positive/negative sets, ownership, and ID policies.
- [ ] Every verified PR #51 criterion resolves to an exact passing test or pinned
      authoritative snapshot.
- [ ] The CI ledger artifact records the exact clean `GITHUB_SHA`.
- [ ] Every automated documentation claim has a resolvable verification ID.
- [ ] Peer ranges are bounded to tested majors and both bounds are exercised.
- [ ] Required compatibility cells contain exact versions, not `latest`.
- [ ] A present but stale `dist` cannot satisfy local compatibility packing.
- [ ] CI consumes Node/cell rows from `--github-matrix`; no copied CI rows remain.
- [ ] Plan 015 has a tested handoff contract for release-matrix consumption.
- [ ] Benchmark samples reject failed/diagnostic host output.
- [ ] Pull-request benchmarks use the merge-base baseline and upload current
      results.
- [ ] Threshold mutation tests reject repeated full-file and nonlinear growth.
- [ ] `npm run typecheck`, `npm run build`, `npm test`, `npm run docs:check`,
      `npm run manifest:check`, `npm run evidence:check`,
      `npm run acceptance:check`, `npm run compat:check`, `npm run bench`, and
      `npm run validate` exit 0.
- [ ] Every compatibility cell passes in its declared Node runtime.
- [ ] Generated files remain clean after their generators run.
- [ ] `gh stack view --json` shows a distinct Plan 014 PR based on Plan 013.
- [ ] No release publishing, governance, registry, or tag logic changed.

## STOP conditions

Stop and report if any condition occurs:

- A reporting fixture fails because a semantic defect remains from Plans 007-012.
  Do not invert the expected result or weaken the assertion.
- Identical pinned hosts produce incompatible diagnostic contracts. Version the
  fixture or make an explicit support decision.
- Real Oxlint accepts an invalid option that the internal parser or ESLint
  rejects. Do not hide the host mismatch.
- A Fluent package SRI, declaration hash, ownership, or derivation is ambiguous.
  Do not hand-edit a generated snapshot.
- A ledger proof test is absent, duplicate, skipped, todo, failed, or only a
  generic file-level claim.
- The worktree is dirty or `HEAD` changes during current-head evidence capture.
- A documentation claim has no exact test or pinned authoritative snapshot.
  Leave it pending.
- A declared peer minimum cannot install and compose with normal peer
  resolution. Do not restore global `--legacy-peer-deps`.
- A required host's highest compatible version cannot be bounded and pinned.
- The CI merge base or its baseline is unavailable. Never use the PR's baseline.
- Clean benchmark variance overlaps the injected slowdown. Do not raise
  thresholds to make both pass.
- The change requires rule semantics, the release workflow, a release helper,
  publishing, or live governance. Route it to the owning plan.
- Any focused verification fails twice after a reasonable correction.
- Plan 014 is not a real child PR of Plan 013.

## Maintenance notes

- Treat stable matrix case IDs and evidence IDs as public test infrastructure.
  Rename them only with ledger and documentation migrations.
- Keep exact host fixtures pinned to exact host versions. Review output changes
  during dependency updates.
- Refresh Fluent snapshots only through the SRI-verifying generator. Keep normal
  CI offline.
- Update `scripts/compat-matrix.json` on a schedule. Pin the resolved highest
  compatible versions in the same review.
- Never use required `latest` cells. Put future-major previews in separate,
  nonblocking jobs.
- Refresh performance baselines in isolated PRs after reviewer approval. Always
  retain the current-result artifact that justified the change.
- The committed acceptance ledger describes mappings. The CI artifact proves a
  specific commit.
- Plan 015 must consume `node scripts/check-compat-matrix.mjs --github-matrix`
  without copying rows. Plan 016 owns final integration and release staging.
