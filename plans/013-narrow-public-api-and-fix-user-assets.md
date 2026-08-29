# Plan 013: Narrow the public API and make user assets truthful

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If a STOP condition occurs, stop and report it. Do not improvise.
> When done, update this plan's status in `plans/README.md`, unless the reviewer
> maintains the index.
>
> **Drift check (run first)**:
> `git diff --stat b87972a..HEAD -- package.json package-lock.json src/index.ts src/analysis/index.ts src/catalog.ts src/catalog-metadata.ts src/options src/configs src/oxfmt scripts/generate-rule-docs.mjs scripts/check-catalog-docs.mjs tests examples README.md CHANGELOG.md CONTRIBUTING.md docs .github/workflows/ci.yml`
> Compare the excerpts below with the live files. Expected changes from Plans
> 007 through 012 are not a reason to revert them. Stop if their final contracts
> do not match this plan's dependencies.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: `plans/007-rebuild-path-state-semantics.md`, `plans/008-fix-bindings-scopes-and-closures.md`, `plans/009-rebuild-stateful-rule-lifecycles.md`, `plans/010-authoritative-fluent-sdk-registry.md`, `plans/011-fix-now-id-and-fluent-directives.md`, `plans/012-fix-context-profiles-and-rule-contracts.md`
- **Category**: migration / DX / docs / tech debt
- **Planned at**: commit `b87972a`, 2026-08-20

## Why this matters

The package root exposes implementation data that the user documentation does not use. This turns internal refactors into accidental public API changes. The catalog also joins three name-keyed registries, although `CONTRIBUTING.md` promises one descriptor per rule.

Copied examples cannot resolve the installed plugin. Three valid example trees also fail their documented format command. The migration guide, generated metadata, platform selector, formatter documentation, and release notes contradict executable behavior.

This plan makes one reviewable user-assets stack layer. It does not change rule semantics or the privileged release workflow.

## Current state

The following excerpts are from `b87972a`.

- `src/index.ts:126-157` exposes internal runtime and knowledge tables from the package root:

  ```ts
  export default plugin;
  export { plugin, rules };
  export { recommendedOxfmtConfig, recommended as oxfmtRecommended } from "./oxfmt/index.js";
  export { applyRules } from "./runtime/apply-rules.js";
  export { ruleCatalog } from "./catalog.js";
  export { PACKAGE_NAME, PACKAGE_VERSION, PLUGIN_NAME } from "./constants.js";
  export { getScriptContext, resolveScriptContext } from "./context/index.js";
  export {
    parseRuleOptions,
    schemaFromDescriptor,
    optionDocsFromDescriptor,
    RULE_OPTION_DESCRIPTORS,
  } from "./options/index.js";
  export { DEFAULT_FLUENT_MANIFEST, /* ... */ } from "./fluent/index.js";
  export { ENGINE_FEATURES } from "./engine/index.js";
  export { GLIDE_API_RELEASE, GLIDE_RECORD_METHODS, /* ... */ } from "./glide/index.js";
  ```

  The user guides import only the default plugin and `configs` from the root.
  They import `recommendedOxfmtConfig` from `oxc-plugin-servicenow/oxfmt`.
  Plan 007 defines the supported shared-analysis facade in
  `src/analysis/index.ts`. Plan 008 makes its products immutable.

- `package.json:34-46` defines no stable analysis subpath:

  ```json
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    },
    "./oxfmt": {
      "types": "./dist/oxfmt/index.d.ts",
      "import": "./dist/oxfmt/index.js",
      "default": "./dist/oxfmt/index.js"
    },
    "./oxfmt.recommended.json": "./oxfmt.recommended.json",
    "./package.json": "./package.json"
  }
  ```

- `src/catalog.ts:123-142` omits the data that the catalog entry claims to own.
  `src/catalog.ts:144-185` then joins independent registries:

  ```ts
  type RuleCatalogInput = Omit<RuleCatalogEntry, /* placements, evidence, options, ... */> & {
    placements?: readonly RulePlacement[];
  };

  const EXTRA_PLACEMENTS: Partial<Record<string, readonly RulePlacement[]>> = {
    "no-delete-multiple-with-windowing": [
      { profile: "business-rule", severity: "error" },
    ],
  };

  const meta = ruleDocMetadata[name];
  const descriptor = RULE_OPTION_DESCRIPTORS[name as keyof typeof RULE_OPTION_DESCRIPTORS];
  ```

  `src/catalog-metadata.ts:144` contains the second rule registry.
  `src/options/descriptors.ts:112-118` contains the third name-keyed registry.
  `CONTRIBUTING.md:17-20` says that identity, placements, examples, options, and
  evidence live in the catalog descriptor.

- `src/catalog-metadata.ts:153-159` contradicts itself:

  ```ts
  ev("tests/rules/no-promise.test.ts",
    "Platform Promise identifiers report; local bindings stay silent.",
    "fixture", "2026-08-20"),
  // ...
  falsePositives: ["Local bindings named Promise."],
  ```

  `tests/rules/no-promise.test.ts:21-26` proves that local bindings stay silent.
  A silent near miss is not a false positive.

- Every copied project config uses a repository-relative plugin. For example,
  `examples/client/.oxlintrc.json:2-7` contains:

  ```json
  "$schema": "../../node_modules/oxlint/configuration_schema.json",
  "jsPlugins": [
    { "name": "servicenow", "specifier": "../.." }
  ]
  ```

  Every project `package.json` also points its format script at
  `../../oxfmt.recommended.json`. Each project README instead documents its local
  `oxfmt.config.ts`.

- `oxfmt.recommended.json:27-35` omits UI Action names:

  ```json
  "files": [
    "**/*.server.js",
    "**/*.client.js",
    "**/*.br.js",
    "**/*.si.js",
    "**/src/server/**/*.js",
    "**/src/client/**/*.js"
  ]
  ```

  Format checks fail for the Fluent valid sample and all compound
  `*.ui-action.js` valid samples in the Fluent, mixed, and UI Action projects.

- `README.md:492-501` gives a six-step 2.0 migration. It omits preset removals,
  warning severity changes, the typed Fluent parser step, and the oxfmt peer
  floor. `CHANGELOG.md:13-15` claims oxfmt 0.16 coverage and says that the
  publish job performs registry verification. The package requires oxfmt
  `>=0.64.0`, and the workflow isolates registry verification from publication.

- `README.md:253` calls `release` a general identifier. Runtime validation in
  `src/settings/releases.ts` accepts only `"zurich"`. Generated engine pages
  list Xanadu, Yokohama, and Zurich under a label that implies all are accepted.

- `package.json:55-71` has no repository lint or format check. The current source
  produces lint warnings, and a default repository-wide oxfmt check is not
  green. Use a separate repository style config. Do not reuse the shipped
  ServiceNow preset for maintainer source files.

## Commands you will need

Use these existing npm commands. Add the planned commands in Step 7.

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Install | `npm ci` | exit 0 |
| Typecheck | `npm run typecheck` | exit 0, no errors |
| Build | `npm run build` | exit 0 |
| Focused tests | `npm run test:integration` | all integration tests pass |
| All tests | `npm test` | all tests pass |
| Regenerate owned assets | `npm run docs` | exit 0; only owned generated files change |
| Check generated assets | `npm run docs:check` | exit 0; no generated diff |
| Full local gate | `npm run validate` | exit 0 |

After Step 7, these commands must also exist:

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Repository lint | `npm run lint:check` | exit 0, zero warnings |
| Repository format | `npm run format:check` | exit 0, no files listed as unformatted |
| Apply repository format | `npm run format` | exit 0 |

## Scope

Modify only these paths:

- `package.json` and `package-lock.json`
- `.oxlintrc.json` and `.oxfmtrc.json` (create repository-only configs)
- `.github/workflows/ci.yml`
- `src/index.ts`
- `src/analysis/index.ts` only for the export shape agreed in Plan 007
- `src/catalog.ts`
- `src/catalog-metadata.ts` (reduce to dependency-free types/helpers, or delete)
- `src/options/index.ts` and `src/options/descriptors.ts`
- `src/configs/maps.ts` only if the catalog-derived map API changes
- `src/oxfmt/recommended.ts` and `oxfmt.recommended.json`
- `scripts/generate-rule-docs.mjs` and `scripts/check-catalog-docs.mjs`
- `tests/catalog.test.ts`, `tests/configs.test.ts`, `tests/options.test.ts`, and `tests/plugin.test.ts`
- `tests/integration/examples.test.ts`, `tests/integration/oxfmt.test.ts`, and `tests/integration/packed-consumer.test.ts`
- `tests/fixtures/presets-1.1.0.json` (create)
- all eight project `.oxlintrc.json`, `package.json`, and valid source trees under `examples/`
- `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `docs/oxfmt.md`, and `docs/rule-authoring.md`
- generated `docs/rules/*.md` and generated profile/config copies already listed by `docs:check`
- maintainer source files under `src/`, `scripts/`, and `tests/` only for the mechanical format baseline or a concrete self-lint finding

Do not modify these paths:

- `.github/workflows/release.yml`, `scripts/check-release-artifact.mjs`,
  `scripts/verify-published-package.mjs`, `tests/release/`, `docs/release.md`, or
  release-governance JSON. Plan 015 owns privileged release work.
- Rule behavior in `src/rules/`. Plan 012 owns diagnostic remediation text and
  rule contracts. This plan consumes those final messages and regenerates user
  assets. It must not rewrite the messages.
- Analysis, context, settings, Fluent, or stateful semantics from Plans 007-012.
- Publishing, tagging, registry calls, GitHub environment changes, or npm trust
  configuration.
- `plans/001-005`; they are complete.

## Git workflow

Plan 006 creates this nonempty draft branch and pull request before remediation
starts. Do not create the branch again.

1. Read `docs/pr-51-stack.json`. Confirm that
   `pr51-remediation/013-public-api-assets` exists, targets
   `pr51-remediation/012-context-profiles-contracts`, and owns every in-scope
   archived path or hunk assigned to Plan 013. Confirm its reconstruction commit
   and rollback rule. The manifest does not store mutable live head SHAs.
2. Run `gh stack view --json` and
   `gh pr view pr51-remediation/013-public-api-assets --json url,baseRefName,headRefName,headRefOid,state,statusCheckRollup,body`.
   Compare topology and ownership with the manifest. Compare the live remote
   head, PR state, and check run with the evidence recorded in the PR body and
   the PR #51 tracking body.
3. Run `gh stack checkout pr51-remediation/013-public-api-assets`. If Plan 006
   already adopted the local branch, a normal checkout of that same existing
   branch is acceptable. Never run `gh stack add` for this plan.
4. Keep these commits separate:
   - `refactor: narrow public exports and unify catalog descriptors`
   - `docs: fix migration and generated user assets`
   - `test: run copied examples and every valid formatter tree`
   - `chore: add repository lint and format gates`
   - `style: establish repository format baseline` (mechanical changes only)
5. Use `gh stack submit --auto` only if the operator asks you to update the
   existing draft pull request.
6. Run `gh stack view --json` after submission. Confirm that this PR targets the
   Plan 012 branch, not `main` and not PR #51.

Stop if Plan 006 did not create the real branch/PR stack. Also stop if manifest
topology, archived ownership, reconstruction data, or rollback rules disagree
with the stack. Stop if the live remote head, PR state, or check run disagrees
with the PR-body evidence. A layer document or ordered commit list is not a
stack.

## Steps

### Step 1: Define and test the stable package entry points

Make the root runtime namespace intentionally small:

- Keep the default plugin export.
- Keep named `plugin` and `configs`, because the user documentation uses them.
- Keep only documented public configuration types at the root, such as
  `ServiceNowSettings`, `RuleConfigMap`, and `RuleName`.
- Remove root re-exports for oxfmt, test harnesses, catalog data, constants,
  context/settings implementation helpers, option internals, Fluent manifests,
  engine tables, and Glide tables.
- Do not add wildcard exports.

Add `oxc-plugin-servicenow/analysis` to `package.json#exports`. Point it at
`dist/analysis/index.js` and `dist/analysis/index.d.ts`. Export only the immutable
shared-analysis facade that Plans 007 and 008 declared stable. Keep
`oxc-plugin-servicenow/oxfmt`, the JSON preset, and `package.json` unchanged.

Add an exact API contract test in `tests/plugin.test.ts`. Assert the root module's
runtime keys, not only the presence of selected names. Update internal tests to
import internal helpers from their source modules.

Extend the packed consumer test to do all of the following through bare package
specifiers:

1. Import the root, `/analysis`, and `/oxfmt`.
2. Load `/oxfmt.recommended.json` and `/package.json` through supported Node APIs.
3. compile a NodeNext TypeScript consumer that imports every supported type path.
4. Assert that an undeclared path, such as `/catalog`, fails with
   `ERR_PACKAGE_PATH_NOT_EXPORTED`.

Document the supported entry points in `README.md`. Record every removed 1.1 root
name in the 2.0 migration section. Do not preserve an undocumented internal name
only to make an old internal test pass.

**Verify**:

```bash
npm run typecheck
npm run build
node scripts/run-tests.mjs tests/plugin.test.ts tests/integration/packed-consumer.test.ts
```

All commands exit 0. The packed test resolves only bare package specifiers.

### Step 2: Make each catalog descriptor complete

Change the catalog input so each `entry(...)` call supplies these fields:

- all placements and severities
- structured applicability
- evidence records
- executable limitation records
- lifecycle assumptions
- an explicit option descriptor or `undefined`

Remove `EXTRA_PLACEMENTS` and the per-rule `ruleDocMetadata` registry. Remove
`RULE_OPTION_DESCRIPTORS` as an independent name-keyed authority. Derive any map
that an internal caller still needs by iterating `ruleCatalog`.

Rename the retained `ev()` evidence-record constructor to `evidenceRecord()` before moving or consolidating its call sites. Do not preserve the unexplained abbreviation in the new catalog authority.

Keep option field definitions in a dependency-free module that rules and the
catalog can both import. Put the explicit reference to that option descriptor in
the catalog entry. Do not make a rule import the catalog. The dependency order
must stay:

```text
option descriptor data -> rule implementation -> catalog -> generated maps/docs
```

Derive `ruleId`, `docsUrl`, option documentation, fix classification, and
`lastVerified` in the catalog constructor. Make duplicate names and missing
required fields compile-time errors where TypeScript can prove them. Keep runtime
assertions for data-dependent uniqueness.

Update `src/configs/maps.ts`, generators, checkers, and tests to consume only
`ruleCatalog`. Add tests that prove:

- every implementation appears exactly once
- every rule name and `ruleId` is unique
- every placement maps to the exact generated profile severity
- each configurable rule uses the same option descriptor for runtime parsing,
  host schema, and documentation
- adding an option or placement to another registry cannot bypass the catalog

Update `CONTRIBUTING.md` and `docs/rule-authoring.md` with the final dependency
order and the exact one-entry procedure.

**Verify**:

```bash
npm run typecheck
node scripts/run-tests.mjs tests/catalog.test.ts tests/configs.test.ts tests/options.test.ts tests/plugin.test.ts
```

Both commands exit 0. This search returns no independent rule registries:

```bash
grep -R "const EXTRA_PLACEMENTS\|export const ruleDocMetadata\|export const RULE_OPTION_DESCRIPTORS" -n src
```

Expected result: no matches.

### Step 3: Correct generated metadata and consume the final messages

Represent limitations as structured catalog data. Use separate kinds for:

- an actual false positive, which emits on a valid example
- an actual false negative, which stays silent on an unsafe target
- an intentional scope boundary or near miss, which stays silent by design

Give each executable limitation a stable case ID and source example. Extend
`tests/catalog.test.ts` so it executes each case according to its kind. Remove or
reclassify every claim that the current behavior contradicts.

At minimum, correct the stale claims for local `Promise`, local Fluent factory
functions, body-only Business Rules, local `g_form`, local `Now`, and queried
GlideRecord aliases. Audit all remaining false-positive and false-negative items;
do not stop after these named examples.

Plan 012 owns the diagnostic message source. After rebasing on Plan 012:

1. Preserve every message ID and diagnostic range.
2. Confirm that the changed messages state both the problem and the action.
3. Generate any diagnostic text shown in rule pages from
   `implementation.meta.messages`; do not copy message text into catalog data.
4. Add one `CHANGELOG.md` Unreleased note for the coordinated user-visible text.

Do not mark an unresolved behavior as fixed. Keep it as a structured known
limitation with an executable characterization.

**Verify**:

```bash
node scripts/run-tests.mjs tests/catalog.test.ts tests/rules
npm run docs
npm run docs:check
```

All commands exit 0. Generated rule pages contain no known-failure item whose
catalog case proves the opposite.

### Step 4: Generate an exact 1.1-to-2.0 migration table

Create `tests/fixtures/presets-1.1.0.json` from the immutable 1.1 package or tag.
Record its version and source integrity with the two exact preset maps. Do not
reconstruct the old maps from the current catalog.

Add a generated migration table between markers in `README.md`. Compare the
frozen 1.1 maps with the current catalog placements. For every changed rule,
show the old severity, new severity or disabled state, replacement profile, and
required user action.

The generated table must include these changes:

- mode-specific rules leave context-neutral recommended and move to the correct
  `classicEs5Rules` or `es2021Rules` map
- `prefer-glideaggregate`, `prefer-now-include`, and
  `fluent-naming-convention` move from recommended to strict warning
- `no-complex-fluent-logic` moves from recommended to policy warning
- `validate-gliderecord-calls` leaves presets and points to
  `require-query-before-next`
- strict weakens `prefer-glideaggregate`, `prefer-now-include`,
  `fluent-directives`, and `fluent-naming-convention` from error to warning
- strict moves `no-hardcoded-table-names` and `no-complex-fluent-logic` to the
  opt-in policy map

Add these separate migration steps:

- Configure a TypeScript parser before the flat preset selects typed
  `*.now.ts` or `*.now.tsx` files in ESLint.
- Upgrade oxfmt from the old `>=0.16.0` peer floor to `>=0.64.0`.
- Set `release: "zurich"` only; no other release selector is accepted.
- Use the new root and `/analysis` public entry-point policy.

Correct `CHANGELOG.md` so it matches the executable matrix and workflow
isolation. State that registry verification runs after publication in a
separate no-OpenID Connect job. Do not state or imply that a stable release was
published.

Add tests that fail if a removed or weakened 1.1 preset rule has no generated
migration row.

**Verify**:

```bash
node scripts/run-tests.mjs tests/configs.test.ts
npm run docs:check
```

Both commands exit 0. The generated table accounts for every map difference.

### Step 5: Make every example project work after copying

Generate each project config with these portable values:

```json
"$schema": "./node_modules/oxlint/configuration_schema.json",
"jsPlugins": [
  { "name": "servicenow", "specifier": "oxc-plugin-servicenow" }
]
```

Change every project `format` script to this local command:

```json
"format": "oxfmt -c oxfmt.config.ts --check valid"
```

Keep profile-specific settings and rules unchanged unless the catalog-generated
migration requires a documented change.

Extend `tests/integration/examples.test.ts` or the packed consumer test. Pack the
current package once. Copy all eight projects into a clean temporary consumer
that has only the tarball and declared host dependencies installed. From each
copied project directory, run the exact README commands. Assert:

- the valid lint command exits 0 with no plugin diagnostics
- the invalid lint command exits nonzero for the documented rule IDs
- the format check exits 0
- plugin resolution uses `oxc-plugin-servicenow`, not the repository path

Keep the existing in-repository semantic checks. They remain useful, but they do
not replace the copied-consumer check.

**Verify**:

```bash
node scripts/run-tests.mjs tests/integration/examples.test.ts tests/integration/packed-consumer.test.ts
```

All eight copied projects pass their valid lint and format commands. Each
project's invalid command produces its expected plugin rule.

### Step 6: Format every valid example and correct user documentation

Add UI Action suffixes to `src/oxfmt/recommended.ts`. Generate the same patterns
into `oxfmt.recommended.json`. Include compound names such as
`*.client.ui-action.js`. Keep the pattern set aligned with the public filename
conventions in `src/context/filename.ts`.

Run each project's local oxfmt configuration in write mode once. Commit only the
resulting valid sample changes. Then change `tests/integration/oxfmt.test.ts` to
run `--check` on every valid tree.

Correct these documents:

- `README.md` and `docs/oxfmt.md`: list the exact classic suffixes, including UI
  Actions, and state that CI checks all eight valid trees.
- `README.md` settings reference: state that only `release: "zurich"` is
  accepted.
- Generated rule applicability: distinguish an accepted selector from a source
  document's historical platform name. Do not show Xanadu or Yokohama as
  accepted settings.
- `CHANGELOG.md`: remove the oxfmt 0.16 coverage claim and the incorrect publish
  job wording.
- Project READMEs and package scripts: use the same commands.

Do not edit `docs/release.md`. Plan 015 owns it.

**Verify**:

```bash
node scripts/run-tests.mjs tests/integration/oxfmt.test.ts tests/integration/examples.test.ts
npm run docs:check
```

Both commands exit 0. This loop also exits 0 for all eight projects:

```bash
for project in classic-compatibility classic-es5 es2021 client business-rule ui-action fluent mixed; do
  ./node_modules/.bin/oxfmt -c "examples/$project/oxfmt.config.ts" --check "examples/$project/valid" || exit 1
done
```

### Step 7: Add green repository lint and format gates

Create a repository-only `.oxlintrc.json`. Enable maintained correctness rules
and deny all warnings in the npm command. Target `src`, `scripts`, and test code.
Ignore generated output, dependencies, packed artifacts, benchmark output, and
intentionally invalid integration fixtures. Do not disable a warning globally to
hide an existing finding.

Create a repository-only `.oxfmtrc.json`. Preserve the established maintainer
style, including double-quoted TypeScript and JavaScript. Keep this config
separate from the shipped ServiceNow preset. Exclude intentionally invalid and
generated fixtures. Include all maintained source, scripts, and tests.

Add these scripts to `package.json`:

```json
"lint:check": "oxlint --deny-warnings --ignore-pattern 'tests/integration/profiles/**' src scripts tests",
"format": "oxfmt -c .oxfmtrc.json --write src scripts tests",
"format:check": "oxfmt -c .oxfmtrc.json --check src scripts tests"
```

Adjust shell quoting only if it is required on every supported platform. Keep
the same targets and exclusions.

Fix every real lint finding. Apply the formatter once. Put the formatter-only
diff in the dedicated mechanical commit. Review `git diff --word-diff=porcelain`
to confirm that this commit has no behavior changes.

Add `lint:check` and `format:check` to `validate`. Add both checks to the CI test
job. Do not edit the release workflow in this plan; Plan 015 must consume the
final `validate` contract in its privileged branch.

**Verify**:

```bash
npm run lint:check
npm run format:check
npm run validate
```

All commands exit 0. `lint:check` reports zero warnings. `format:check` lists no
unformatted files.

## Test plan

Add or update these tests:

- `tests/plugin.test.ts`: exact root namespace; stable `/analysis` facade.
- `tests/integration/packed-consumer.test.ts`: all supported bare specifiers,
  NodeNext declarations, and one rejected private subpath.
- `tests/catalog.test.ts`: complete/unique catalog entries and executable
  limitation classifications.
- `tests/configs.test.ts`: exact placements and complete 1.1 migration coverage.
- `tests/options.test.ts`: one option descriptor drives runtime parsing, host
  schema, and generated docs.
- `tests/integration/examples.test.ts`: all eight copied projects run the exact
  README commands against a packed install.
- `tests/integration/oxfmt.test.ts`: every valid example tree passes its local
  config.
- Existing rule tests: only update expected final remediation fragments from
  Plan 012. Do not change diagnostic behavior.

Use `node:test` and `node:assert/strict`. Follow `tests/plugin.test.ts` for export
assertions and `tests/integration/packed-consumer.test.ts` for clean consumers.

## Done criteria

All items must hold:

- [ ] The root runtime exports only the documented plugin consumer API.
- [ ] `/analysis`, `/oxfmt`, `/oxfmt.recommended.json`, and `/package.json` work
      from one packed clean consumer.
- [ ] Private paths such as `/catalog` are not exported.
- [ ] Each rule has one complete catalog descriptor.
- [ ] No independent name-keyed placement, metadata, or option registry remains.
- [ ] The catalog evidence constructor uses the descriptive name `evidenceRecord`, not `ev`.
- [ ] Every limitation is an actual false positive, false negative, or explicit
      scope boundary with an executable characterization.
- [ ] The migration table accounts for every 1.1 preset removal and severity
      change.
- [ ] All copied projects resolve the installed package through its bare name.
- [ ] All eight valid trees pass their documented oxfmt check.
- [ ] The release selector and oxfmt/release-note text match executable behavior.
- [ ] `npm run lint:check` exits 0 with zero warnings.
- [ ] `npm run format:check` exits 0.
- [ ] `npm run typecheck`, `npm run build`, `npm test`, `npm run docs:check`, and
      `npm run validate` exit 0.
- [ ] `npm run docs && git diff --exit-code -- README.md docs/rules examples tests/integration/profiles/configs tests/integration/fixtures/.oxlintrc.json` exits 0.
- [ ] No release publishing, governance, tag, or registry file changed.
- [ ] The PR base is the Plan 012 branch and `gh stack view --json` shows a
      distinct PR.

## STOP conditions

Stop and report if any condition occurs:

- Plans 007 or 008 did not define an immutable, documented analysis facade.
- A maintainer does not approve the root export removals from the 1.1 surface.
- A catalog refactor creates `rule -> catalog -> rule` or duplicates option field
  definitions.
- The 1.1 preset source or its integrity cannot be established.
- A generated migration replacement does not exist in the current rule map.
- A copied project requires a repository-relative path.
- A valid example still fails after the preset and sample use the same config.
- The repository style choice is unresolved. Do not commit a 194-file format
  change before that decision.
- A lint finding requires weakening a rule or linting an intentionally invalid
  fixture.
- A rule message or diagnostic range must change here. Route it to Plan 012.
- The change requires `.github/workflows/release.yml`, `docs/release.md`, a
  release helper, publishing, or live governance work. Route it to Plan 015.
- Any focused verification fails twice after a reasonable correction.
- The branch is not a real stacked PR above Plan 012.

## Maintenance notes

- Treat the root export key set and package subpaths as compatibility contracts.
  Add a migration note before the next intentional change.
- Keep `src/analysis/index.ts` small. New analysis internals are private unless a
  separate API review approves them.
- Add rule data in one catalog entry. Keep option field data dependency-free so
  rules never import the catalog.
- Regenerate user assets in the same change as a descriptor or placement update.
- Refresh the 1.1 fixture only to correct provenance. Never rewrite history from
  current data.
- Run every copied-project and valid-tree check when filename conventions or the
  formatter preset changes.
- Keep the mechanical format commit separate during review and future rebases.
- Plan 014 adds exact evidence and host-output gates on top of this catalog.
- Plan 015 must consume the final public entry points and `validate` command in a
  release-only PR. Publishing remains outside this plan.
