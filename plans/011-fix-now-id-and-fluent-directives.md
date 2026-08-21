# Plan 011: Make Now.ID semantics temporal and Fluent directives exact

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer told you that they maintain the index.
>
> **Dependency gate (run before the drift check)**: Confirm that
> `plans/006-freeze-and-restack-pr51.md`,
> `plans/008-fix-bindings-scopes-and-closures.md`,
> `plans/009-rebuild-stateful-rule-lifecycles.md`, and
> `plans/010-authoritative-fluent-sdk-registry.md` are complete. Follow plan
> 006's Fluent-layer stacked-branch and pull-request workflow for this plan.
> This plan relies on plan 008's corrected lexical scopes and plan 010's
> authoritative
> Fluent registry/import boundary. Do not reimplement these dependencies here.
>
> **Drift check (run first)**: `git diff --stat b87972a..HEAD -- src/analysis/now-id.ts src/analysis/file-analysis.ts src/analysis/index.ts src/utils/ast.ts src/rules/require-fluent-id.ts src/rules/no-now-id-as-reference.ts src/rules/no-duplicate-fluent-id.ts src/rules/fluent-naming-convention.ts src/rules/prefer-now-include.ts src/rules/fluent-directives.ts src/catalog-metadata.ts CHANGELOG.md tests/rules/fluent-ids.test.ts tests/rules/fluent-identity.test.ts tests/rules/fluent.test.ts tests/analysis/foundation.test.ts tests/integration/adversarial.test.ts tests/integration/profiles.test.ts tests/integration/profiles/valid/immutable-now-alias.now.ts tests/integration/profiles/valid/nested-fluent-directive.now.ts tests/integration/profiles/invalid/immutable-now-alias-reference.now.ts tests/integration/profiles/invalid/duplicate-now-alias.now.ts tests/integration/profiles/invalid/nonadjacent-fluent-ignore.now.ts tests/integration/profiles/invalid/block-file-directive-location.now.ts tests/integration/profiles/invalid/fluent-directive-typo-location.now.ts docs/rules/fluent-directives.md docs/rules/require-fluent-id.md docs/rules/no-now-id-as-reference.md docs/rules/no-duplicate-fluent-id.md docs/rules/fluent-naming-convention.md docs/rules/prefer-now-include.md`
> Changes made by completed plans 008 and 010 are expected. Compare their live
> result with the excerpts and required behavior below. Stop on any other
> semantic mismatch or if any dependency is incomplete.

## Status

- **Status**: IN PROGRESS — implemented in PR #81; merge pending.
- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/006-freeze-and-restack-pr51.md`, `plans/008-fix-bindings-scopes-and-closures.md`, `plans/009-rebuild-stateful-rule-lifecycles.md` (stack topology), `plans/010-authoritative-fluent-sdk-registry.md`
- **Category**: bug
- **Planned at**: commit `b87972a`, 2026-08-20

## Why this matters

Three recommended error rules disagree about what a `Now.ID` value is. Immutable aliases of `Now` or `Now.ID` are rejected or missed, branch disagreement can falsely prove an ID, and compound assignment can hide a reference use. Duplicate detection and the strict naming rule then inherit different answers for the same expression.

The directive rule also accepts blank lines, misses nested statements, and reports shifted locations. These defects make suppressions appear valid when the SDK does not attach them to the intended construct. This plan gives every Now consumer one binding-aware, program-point semantic model and makes directive placement and locations exact in both supported hosts.

## Current state

- `src/analysis/file-analysis.ts:138-184` builds `nowIdAt` during the shared path pass. This is the correct place for the single temporal result:

  ```ts
  const nowIdAt = new Map<ESTree.Node, NowIdFact>();
  // ...
  onValue(node) {
    const key = nowIdValue(node, query);
    if (key === undefined) return undefined;
    return { nowIdKey: key };
  },
  onRef({ node, rec, bindingId }) {
    if (rec?.data.nowIdKey != null) nowIdAt.set(node, rec.data.nowIdKey);
    // ...
  },
  ```

- `src/analysis/now-id.ts:109-145` first requires the literal root spelling `Now`, then separately asks whether the root is canonical. The two checks contradict each other:

  ```ts
  function isNowIdLookup(node: ESTree.Node): boolean {
    // ...
    return Boolean(chain && chain.length === 2 && chain[0] === "Now" && chain[1] === "ID");
  }

  export function isCanonicalNowId(node: ESTree.Node, analysis: ProvenanceQuery): boolean {
    const expr = unwrapExpr(node) ?? node;
    return isNowIdLookup(expr) && isCanonicalNow(expr, analysis);
  }
  ```

  Verified at `b87972a`: `$id: SDK.ID["good-key"]` after `const SDK = Now` produces `require-fluent-id/preferNowId`. `consume(SDK.ID["reference-key"])` and `consume(IDs["reference-key"])` after `const IDs = Now.ID` produce no `no-now-id-as-reference` diagnostic.

- `src/analysis/now-id.ts:50-55` merges every disagreement into a value that still means “definitely a Now.ID”:

  ```ts
  export function mergeNowIdFacts(left: NowIdFact, right: NowIdFact): NowIdFact {
    if (left === right) return left;
    // ...
    return unknownNowId();
  }
  ```

  Verified at `b87972a`: `let id = "raw"; if (flag) id = Now.ID["x"]; Record({ $id: id });` is incorrectly accepted by `require-fluent-id`. A path with no ID must not merge with an ID path into definite ID provenance. Two definite ID paths with different or dynamic keys may merge to “ID with unknown key.”

- `src/analysis/now-id.ts:190-211` treats every assignment operator as an alias sink:

  ```ts
  if (parent.type === "AssignmentExpression") {
    const assign = parent as ESTree.AssignmentExpression;
    // no `assign.operator === "="` check
  }
  ```

  `isIdPropertyAssignment()` at lines 172-178 has the same omission. Verified at `b87972a`: `x += Now.ID["identity"]` and `x ||= Now.ID["identity"]` produce no reference diagnostic. Only plain `=` into an identifier is an alias sink. Only plain `=` into a static `$id` member is an ID sink. Compound assignments read/coerce the identity and must report `asReference`.

- `src/analysis/now-id.ts:62-107,180-188` duplicates `unwrapExpression`, static member-chain, and static property helpers from `src/utils/ast.ts` and `src/analysis/members.ts`. Its local unwrapping omits `ChainExpression`. Transparent `ParenthesizedExpression`, `ChainExpression`, `TSAsExpression`, `TSTypeAssertion`, `TSNonNullExpression`, and `TSSatisfiesExpression` wrappers must not change semantic provenance or whether a value feeds `$id`.

- `src/analysis/now-id.ts:263-328` can run a second full `analyzePathBindings()` pass when callers omit `facts`. The production rules currently pass `file.nowIdAt`, but the default keeps a second model alive. Remove that fallback. All Now.ID consumers must use the shared file result.

- `src/rules/require-fluent-id.ts:68-71` uses `file.nowIdAt`, but `src/rules/fluent-naming-convention.ts:80-90` performs a separate direct structural check. `findNowIdMisuses()` and `findDuplicateFluentIds()` also classify uses independently. After this plan, the shared semantic result is authoritative for `require-fluent-id`, `no-now-id-as-reference`, `no-duplicate-fluent-id`, and the Now.ID part of `fluent-naming-convention`. `prefer-now-include` must use the same canonical `Now` resolver for immutable aliases and wrappers.

- `src/rules/fluent-directives.ts:41-70` indexes only `Program.body` and accepts unlimited whitespace/comments:

  ```ts
  function programStatements(program: ESTree.Node) {
    // only Program.body
  }

  function onlyTriviaBetween(...) {
    // trims whitespace and skips all intervening comments
  }
  ```

  Verified at `b87972a`: `// @fluent-ignore\n\nRecord({});` produces no diagnostic. A directive inside a function immediately above `foo();` reports `dangling` because nested statements are absent from the index.

- `src/rules/fluent-directives.ts:123-137,176-187` uses the comment start for first-line placement and fails to add the `//` or `/*` delimiter width to occurrence locations. Verified at `b87972a`: `  // @fluent-ignre` reports zero-based column 3 instead of column 5. A block comment that starts on line 1 but contains `@fluent-disable-sync-for-file` on line 2 is incorrectly accepted.

- Directive message IDs are public test contracts. Keep `unknown`, `typo`, `dangling`, `misplaced`, `tsIgnore`, and `firstLine`. The current `dangling` text hard-codes `@fluent-ignore`; make its text/data correct for both previous-line directives without renaming the ID.

- `CONTRIBUTING.md` requires lexical binding/provenance recognition, conservative silence on unknown provenance, actionable messages, exact diagnostic counts/message IDs, generated docs, a changelog note for user-visible behavior, and `npm run validate`.

- `docs/non-goals.md:28` keeps cross-file `$id` uniqueness out of scope. This plan preserves file-local duplicate detection.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Install exactly locked dependencies | `npm ci` | exit 0 |
| Focused rules and host tests | `node scripts/run-tests.mjs tests/rules/fluent-ids.test.ts tests/rules/fluent-identity.test.ts tests/rules/fluent.test.ts tests/analysis/foundation.test.ts tests/integration/adversarial.test.ts tests/integration/profiles.test.ts` | exit 0; all selected tests pass |
| Typecheck | `npm run typecheck` | exit 0, no errors |
| Build | `npm run build` | exit 0 |
| Generate docs | `npm run docs` | exit 0; only expected generated files change |
| Check docs | `npm run docs:check` | exit 0, no generated diff |
| Full validation | `npm run validate` | exit 0, including tests, real hosts, docs, manifest, benchmark, and packed consumer |

Do not replace `npm test` with a quoted glob. `CONTRIBUTING.md` records that Node 20 treats the quoted path as one missing file.

## Scope

**In scope** (the only files the executor may modify):

- `src/analysis/now-id.ts`
- `src/analysis/file-analysis.ts`
- `src/analysis/index.ts`
- `src/utils/ast.ts` only for shared transparent-wrapper/static-member helpers needed by the Now model
- `src/rules/require-fluent-id.ts`
- `src/rules/no-now-id-as-reference.ts`
- `src/rules/no-duplicate-fluent-id.ts`
- `src/rules/fluent-naming-convention.ts`
- `src/rules/prefer-now-include.ts`
- `src/rules/fluent-directives.ts`
- `src/catalog-metadata.ts` only for corrected limitations/evidence claims for these rules
- `CHANGELOG.md` under `## Unreleased`
- `tests/rules/fluent-ids.test.ts`
- `tests/rules/fluent-identity.test.ts`
- `tests/rules/fluent.test.ts`
- `tests/analysis/foundation.test.ts`
- `tests/integration/adversarial.test.ts`
- `tests/integration/profiles.test.ts`
- `tests/integration/profiles/valid/immutable-now-alias.now.ts` (create)
- `tests/integration/profiles/valid/nested-fluent-directive.now.ts` (create)
- `tests/integration/profiles/invalid/immutable-now-alias-reference.now.ts` (create)
- `tests/integration/profiles/invalid/duplicate-now-alias.now.ts` (create)
- `tests/integration/profiles/invalid/nonadjacent-fluent-ignore.now.ts` (create)
- `tests/integration/profiles/invalid/block-file-directive-location.now.ts` (create)
- `tests/integration/profiles/invalid/fluent-directive-typo-location.now.ts` (create)
- Generated rule pages: `docs/rules/fluent-directives.md`, `docs/rules/require-fluent-id.md`, `docs/rules/no-now-id-as-reference.md`, `docs/rules/no-duplicate-fluent-id.md`, `docs/rules/fluent-naming-convention.md`, `docs/rules/prefer-now-include.md`

**Out of scope** (do not modify):

- `docs/pr-51-stack.json` and plan 006 tracking documents. Read and validate
  them during preflight, but do not edit them.
- `plans/009-rebuild-stateful-rule-lifecycles.md` owns `src/rules/no-glideelement-in-collection.ts`, binding-aware global `String` extraction, nested collection values, cursor sets, and duplicate GlideElement diagnostics. Use a shared binding helper from plan 009 if it exists after drift; otherwise use the existing binding APIs. Do not duplicate plan 009's helper.
- `src/analysis/bindings.ts` and `src/analysis/path-state.ts` belong to plan 008. If this plan exposes a remaining generic scope/control-flow defect, stop and send it back to plan 008 instead of patching it here.
- `src/analysis/fluent-imports.ts`, `src/rules/fluent-proper-imports.ts`, `src/fluent/manifest.ts`, `src/fluent/registry.ts`, Fluent declaration snapshots, factory/import namespace alias stability (including temporal mutable namespace aliases), project-barrel resolution, and SDK ownership policy belong to plan 010. Consume its authoritative resolver; do not change or duplicate it here, and do not add or invent Fluent APIs.
- Cross-file duplicate IDs or a project index. `docs/non-goals.md` explicitly rejects that without project-wide analysis.
- Following identities through calls, returned objects, arrays, object properties, destructuring, or unknown helpers. These are semantic uses or unknown provenance, not alias sinks.
- Directive suppression implementation in the ServiceNow SDK. This rule validates directive spelling and placement only.
- New directive message IDs, autofixes, suggestions, preset changes, or severity changes.
- Privileged release files and governance artifacts, including `.github/workflows/release.yml`, release scripts, trusted-publishing configuration, and live governance evidence. Plan 006 keeps those in a separate layer.
- Hand edits to generated docs, README rule tables, examples, or recommended `.oxlintrc.json` files. Use `npm run docs`.
- `plans/README.md` until implementation is complete; then update only plan 011's status row as the executor instruction requires.

## Git workflow

Plan 006 creates the branch and nonempty draft pull request before this work
starts. Do not create or rename a branch or pull request.

1. Read plan 011's record in `docs/pr-51-stack.json`. It must name
   `pr51-remediation/011-now-id-directives` as the head branch and
   `pr51-remediation/010-fluent-sdk-registry` as the expected base branch.
   Read its reconstruction commit, owned paths or hunks, and rollback rule.
   The manifest must not contain a mutable current head SHA.
2. Run the read-only ownership validator documented beside that manifest.
   Confirm that every in-scope file or hunk belongs to plan 011. Each new
   fixture path must also have explicit plan-011 ownership.
3. Run `git fetch --prune origin` and `gh stack view --json`. Find the existing
   plan-011 stack entry and pull request. Its head and base branch names must
   match the manifest.
4. Run
   `gh pr view <PR-number> --json body,isDraft,state,url,headRefName,baseRefName,headRefOid,statusCheckRollup`.
   Read the full base and head SHAs and check-run URL recorded in the PR body.
   Run `gh run list --branch <head-branch> --commit <body-head-SHA> --json headSha,status,conclusion,url`.
   Require the live remote head, `headRefOid`, the body head SHA, and the current
   check-run `headSha` to agree. Require the remote base head to equal the body
   base SHA. Require the pull request to be open and draft.
5. Check out the existing remote head branch. Run `git branch --show-current`,
   `git rev-parse HEAD`, and
   `git merge-base --is-ancestor <reconstruction-commit> HEAD`. Expected: the
   manifest head branch, the verified live remote head, and exit 0.

STOP on any missing record, ownership mismatch, topology mismatch, PR-body
mismatch, remote-ref mismatch, or check-run mismatch. Do not repair the stack,
PR body, or manifest here. Keep plan 011 as its focused, non-privileged stacked
pull request. Commit each green logical unit with subjects such as
`fix: make Now.ID aliases temporal` and
`fix: enforce Fluent directive adjacency`. Do not push or mutate the pull
request unless the operator requests it and plan 006 permits it.

## Steps

### Step 1: Lock the semantic contract with focused tests

Add the following cases before changing production code. Use `assertInvalid` with exact `messageId` and count. Use `lint()` plus strict assertions when checking ranges.

In `tests/rules/fluent-identity.test.ts` and `tests/rules/fluent-ids.test.ts`, cover:

1. `const SDK = Now; BusinessRule({ $id: SDK.ID["good-key"] })` is valid for `require-fluent-id`.
2. `consume(SDK.ID["reference-key"])` reports one `asReference`.
3. `const IDs = Now.ID;` and a multi-hop `const MoreIDs = IDs;` preserve static/dynamic lookups.
4. A local or shadowed `Now`, `SDK`, or `IDs` stays silent. Add outer and inner scopes with the same spelling.
5. All transparent TypeScript/ESTree wrappers preserve the result: parentheses, optional `ChainExpression` when the parser emits it, `as`, type assertion, non-null, and `satisfies`.
6. A plain declaration initializer and plain `identifier = value` propagate an ID. A later reassignment changes only later uses.
7. `x += Now.ID["x"]`, `x ||= Now.ID["x"]`, and `$id += Now.ID["x"]` each report one `asReference`. The left side of a compound assignment also reports when it already holds a proven ID.
8. Member assignment, destructuring, object/array storage, return, and call arguments remain semantic uses, not alias sinks.
9. `let id = "raw"; if (flag) id = Now.ID["x"]; BusinessRule({ $id: id })` reports `preferNowId`. Two definite ID branches with different keys remain a proven ID with unknown key.
10. Two `$id` sinks that receive the same static key through `Now`, `Now.ID`, and value aliases report exactly one `duplicate` on the second sink. Dynamic or path-disagreed keys do not produce a duplicate.
11. A wrapped value directly or indirectly feeding an object `$id` property or a plain `config.$id = value` assignment is accepted. A compound `$id` assignment is not accepted as a sink.
12. `fluent-naming-convention` uses the same alias facts and reports `nowId` for a bad static key through `const IDs = Now.ID`.
13. Canonical `Now.include()` still works through an immutable alias and wrappers. A local `Now.include` and mutable/unproven aliases stay untrusted. Factory calls in these fixtures must use plan 010's authoritative resolver unchanged.

In `tests/rules/fluent.test.ts`, cover directive behavior:

1. The two previous-line directives are valid only when their occurrence line is exactly `statementStartLine - 1` and only whitespace follows the comment before the statement.
2. One blank line, two blank lines, or an intervening unrelated comment reports `misplaced`.
3. A directive at the end of its containing statement list reports `dangling`.
4. Directives attach inside nested function/block statements. They do not jump out of an empty nested block to a later outer statement.
5. A one-line block comment on the exact previous line is valid. A multiline block comment whose directive occurrence is two lines above the statement reports `misplaced`.
6. A file directive inside a block comment uses the occurrence line, not the block's start line.
7. Multiple directives in one comment each get their own exact range.
8. Assert all six stable message IDs. Assert zero-based start and end columns span the exact `@directive` text for line and block comments, including indentation, CRLF, and an optional BOM.

**Verify**: run the focused test command from “Commands you will need.” It must fail only on the newly added regression assertions. If an unrelated existing test fails, stop.

### Step 2: Replace parallel Now.ID checks with one shared temporal fact model

Refactor `src/analysis/now-id.ts` and the `FileAnalysis` integration. Use one tagged semantic vocabulary. A suitable shape is:

```ts
type NowIdFact =
  | { readonly kind: "static"; readonly key: string }
  | { readonly kind: "unknown-key" }
  | null;

type CanonicalNowValue =
  | { readonly kind: "now-namespace" }
  | { readonly kind: "now-id-namespace" }
  | NowIdFact;
```

The exact internal names can differ, but these distinctions are mandatory:

- no proven Now semantic value;
- canonical `Now` namespace;
- canonical `Now.ID` namespace;
- definite ID value with a static key;
- definite ID value with an unknown/dynamic key.

Implement one recursive, cycle-safe resolver for canonical immutable namespace aliases. It must:

- start only from a binding-proven platform global `Now`;
- follow only imports/`const` aliases, or the stable-alias policy established by plan 010 where applicable;
- resolve `Now.ID`, an alias of `Now`, an alias of `Now.ID`, and simple immutable chains;
- unwrap using shared `unwrapExpression()` at every step;
- use static member helpers rather than spelling-only chains;
- resolve bindings in the use's real nested scope;
- reject local/shadowed `Now` and mutable or ambiguous namespace values;
- return a definite ID with unknown key for `IDs[key]`, not “no fact.”

Use this resolver only to seed the shared path analysis. Continue to use the plan-008 path engine to propagate ID **values** through declaration initializers and plain assignments at program points. Correct the merge lattice:

- `null + null -> null`;
- `null + any ID -> null` because not every path has an ID;
- the same static key on both paths -> that static key;
- different static keys, or static plus dynamic, when both paths definitely have IDs -> `unknown-key`.

Store the resulting facts once in `FileAnalysis`. Rename `nowIdAt` only if the new name materially clarifies the public internal contract. Remove `collectNowIdFacts()` and remove default parameters that can trigger another full path pass. Make `findNowIdMisuses()` and `findDuplicateFluentIds()` require the shared map. Keep the analysis pass-count test green and add an assertion that enabling all three ID rules does not construct a second Now analysis.

Delete the local `unwrapExpr`, `staticChain`, and `staticMemberName` copies. Extend `src/utils/ast.ts` only if a shared helper cannot handle wrappers at each member segment. Do not add a second name-based helper.

**Verify**: `npm run typecheck && node scripts/run-tests.mjs tests/analysis/foundation.test.ts tests/rules/fluent-identity.test.ts tests/rules/fluent-ids.test.ts` -> exit 0; all tests pass.

### Step 3: Classify semantic uses and sinks once

In `src/analysis/now-id.ts`, make one use-site classifier serve reference misuse and duplicate-ID sinks. It must walk through transparent wrappers to the effective parent.

Treat only these as non-reference sinks:

- an identifier `VariableDeclarator` initializer;
- the right side of `AssignmentExpression` with `operator === "="` and an identifier left side;
- an object property value whose static key is `$id`;
- the right side of `AssignmentExpression` with `operator === "="` and a static member left side named `$id`.

The first two propagate alias identity. The last two consume the value as metadata identity. Everything else is a semantic value use. In particular, compound/logical assignment, update/coercion, member storage, destructuring, array/object storage, return, and call arguments are not alias sinks.

Keep declaration identifiers, noncomputed property keys, and type-only syntax excluded. Deduplicate by AST node/range so a wrapper and its inner expression cannot report twice. Duplicate detection must count only definite static keys at `$id` sinks and must report only the second and later sinks.

Update all consumers:

- `require-fluent-id` asks the shared fact map whether the exact `$id` value is definitely an ID on every path.
- `no-now-id-as-reference` reports the shared classifier's semantic uses.
- `no-duplicate-fluent-id` consumes the shared classifier's static `$id` sinks.
- `fluent-naming-convention` reads static keys from the shared facts rather than calling an independent structural predicate.
- `prefer-now-include` uses the shared canonical-Now resolver for `Now.include()` aliases and wrappers.

Keep existing rule message IDs and diagnostic-only behavior.

**Verify**: `npm run typecheck && node scripts/run-tests.mjs tests/rules/fluent-ids.test.ts tests/rules/fluent-identity.test.ts tests/rules/fluent.test.ts` -> exit 0; all tests pass.

### Step 4: Enforce exact directive placement in every statement list

Refactor `src/rules/fluent-directives.ts` around directive **occurrences**, not comment starts.

1. Represent each regex match with its absolute source start/end and computed line/column range. Derive the absolute start as `comment.start + 2 + match.index`: explicitly add the two-character `//` or `/*` delimiter before the match index. Handle both `//` and `/* */`, fallback comments, CRLF, indentation, and BOM. Report an end location that spans the matched directive text.
2. Collect eligible statements for every statement-list container, at minimum `Program.body`, `BlockStatement.body`, and `SwitchCase.consequent`. Include unbraced nested statement bodies if the AST places a directive between the controlling construct and its body. Associate a directive only with the next direct eligible construct in its containing list/body. Never cross a closing brace or switch case.
3. For a manifest directive with `placement: "previous-line"`, require the occurrence line to equal `next.start.loc.line - 1`. Require only horizontal whitespace after the directive comment and before the statement. A blank line or intervening comment is `misplaced` even though it is trivia. If no statement exists in the same container, report `dangling`.
4. For `placement: "first-line"`, compare the occurrence line with `firstNonEmptyLine(text)`. Do not use the comment's start line.
5. Drive placement from `manifest.directives[].placement`, not hard-coded directive-name branches. If plan 010 changed the manifest access API, use that authoritative API.
6. Keep the six message IDs. Change `dangling` text to use `@{{name}}` and pass `data: { name }`, so `fluent-disable-sync` does not receive an `@fluent-ignore` message.
7. Find `@ts-ignore` and `@ts-expect-error` occurrences with the same absolute-range helper. Do not label the start of the whole comment.

Do not implement suppression or an autofix.

**Verify**: `npm run typecheck && node scripts/run-tests.mjs tests/rules/fluent.test.ts tests/rules/fluent-identity.test.ts` -> exit 0; all directive tests pass with exact IDs and ranges.

### Step 5: Prove the fixes in real Oxlint and ESLint

Create exactly the seven fixture paths named in Scope: the two valid fixtures and five invalid fixtures. Extend `tests/integration/adversarial.test.ts` and `tests/integration/profiles.test.ts`; do not create additional fixtures.

The real-host matrix must cover:

- immutable aliases of `Now` and `Now.ID` accepted as `$id`;
- the same alias used as a reference reports `no-now-id-as-reference/asReference`;
- duplicate static IDs through aliases report one `no-duplicate-fluent-id/duplicate`;
- local/shadowed `Now` in a nested scope stays silent;
- a nested adjacent directive is accepted;
- a non-adjacent directive reports `fluent-directives/misplaced`;
- a multiline block-comment file directive reports `firstLine` at the `@` occurrence;
- a typo reports `typo` at the exact `@...` range.

For ESLint, assert exact `ruleId`, `messageId`, line, column, end line, and end column. For Oxlint JSON, assert exact plugin rule ID, count, message text/data rendering, and label `offset`, `length`, `line`, and `column`. Use the existing `runOxlint()` and `eslintMessages()` helpers. Do not weaken assertions to “contains some Fluent diagnostic.”

**Verify**: `npm run build && node scripts/run-tests.mjs tests/integration/adversarial.test.ts tests/integration/profiles.test.ts` -> exit 0; both hosts pass every new assertion.

### Step 6: Update truthful metadata, generated docs, and the changelog

In `src/catalog-metadata.ts`, update only the affected entries:

- remove the false claim that local objects named `Now` are a known false positive;
- remove the block-comment directive false-negative after block comments are covered;
- describe dynamic/path-ambiguous ID boundaries accurately;
- point fixture evidence at a test that now asserts aliases, scopes, message IDs, and ranges.

Do not change evidence dates without a reproducible test/evidence update. Do not hand-edit generated pages. Add a concise bullet under `CHANGELOG.md`'s `## Unreleased` that says Now.ID aliases/uses and Fluent directive placement are corrected.

Run `npm run docs`. Inspect `git diff -- docs/rules README.md docs/compatibility.md examples tests/integration/profiles/configs`. Only the six in-scope generated rule pages may change. If another generated artifact changes because an in-scope catalog description legitimately feeds it, stop and request a scope decision rather than committing it silently.

**Verify**: `npm run docs:check` -> exit 0 with no generated diff.

### Step 7: Run the complete repository gate

Run:

```bash
npm run validate
```

Then inspect scope:

```bash
git status --short
git diff --name-only
```

Every changed path must be in this plan's in-scope list, except `plans/README.md` when the executor marks plan 011 complete.

**Verify**: `npm run validate` exits 0. `git diff --name-only` contains no out-of-scope path.

## Test plan

- `tests/rules/fluent-identity.test.ts`: immutable Now and Now.ID namespace aliases through plan 010-resolved factory calls, wrappers, shadowing, and branch semantics. Factory/import namespace behavior itself remains plan 010 scope.
- `tests/rules/fluent-ids.test.ts`: exact reference-use classification, plain assignment sinks, compound assignment uses, duplicates through aliases, dynamic keys, and nested scopes.
- `tests/rules/fluent.test.ts`: shared naming/include behavior and all directive message IDs, placement classes, comments, BOM/CRLF, and exact ranges.
- `tests/analysis/foundation.test.ts`: one shared Now semantic analysis pass.
- `tests/integration/adversarial.test.ts` and `tests/integration/profiles.test.ts`: exact Oxlint and ESLint behavior on physical fixtures.
- Structural pattern: keep `node:test`, `node:assert/strict`, `assertValid`, `assertInvalid`, and `lint` conventions from the existing files. Do not introduce another test runner.
- Final verification: the focused command passes, then `npm run validate` passes.

## Done criteria

All items must hold:

- [ ] Plans 006, 008, and 010 are complete; plan 006's Fluent-layer stack workflow is followed; this implementation does not duplicate their scope.
- [ ] `npm run typecheck` and `npm run build` exit 0.
- [ ] The focused test command exits 0 with exact counts, message IDs, and ranges.
- [ ] `npm run validate` exits 0.
- [ ] Immutable aliases of `Now` and `Now.ID`, transparent wrappers, and nested scopes behave identically in all four Now.ID consumers.
- [ ] A path with an ordinary value is not merged into definite Now.ID provenance.
- [ ] Only plain identifier assignments propagate aliases. Compound assignments are reference uses.
- [ ] Duplicate static keys report only at the second and later `$id` sinks. Dynamic or ambiguous keys stay silent.
- [ ] Previous-line directives require exact line adjacency in nested statement lists and never cross a scope boundary.
- [ ] Line/block comment occurrences have exact start/end ranges in Oxlint and ESLint.
- [ ] Existing directive message IDs remain unchanged and are asserted.
- [ ] `grep -n "function unwrapExpr\|function staticChain\|function staticMemberName\|collectNowIdFacts" src/analysis/now-id.ts` returns no matches.
- [ ] `grep -n "Program.body\|onlyTriviaBetween" src/rules/fluent-directives.ts` does not show the old top-level-only/trivia placement implementation.
- [ ] `npm run docs:check` exits 0, and generated limitations match tested behavior.
- [ ] `CHANGELOG.md` has an Unreleased fix note.
- [ ] `git diff --name-only` contains only in-scope files plus the executor's plan 011 status-row update.
- [ ] Plan 011's row in `plans/README.md` is `DONE`.

## STOP conditions

Stop and report without improvising if:

- The plan-011 manifest topology or ownership is missing or mismatched. Also
  stop if the live remote head, PR body head/base SHAs, PR topology/state, or
  current check-run head disagree. Never add a mutable head SHA to the manifest.
- Plan 006, plan 008, plan 009, or plan 010 is incomplete.
- The live plan-008 path API cannot represent “no fact on one path” separately from “definite ID with unknown key.” Send the required lattice capability back to plan 008.
- Plan 010 already replaced `fluent-imports.ts` or the manifest API in a way that contradicts this plan's excerpts. Reconcile with plan 010's documented contract before editing.
- Official SDK evidence contradicts exact previous-line or first-non-empty-line semantics.
- Either host omits reliable comment ranges or represents comment bodies differently enough that one absolute occurrence calculation cannot serve both hosts.
- Correct behavior would require following a mutable namespace or ID through arbitrary calls, object properties, arrays, destructuring, or cross-file state.
- Correct duplicate detection would require a project-wide index.
- A new test exposes a generic lexical-scope, closure, or control-flow defect owned by plan 008.
- The implementation would need `src/rules/no-glideelement-in-collection.ts` or binding-aware global `String` work owned by plan 009.
- `npm run docs` changes an unrelated generated page or configuration.
- A verification command fails twice after one reasonable correction.
- The fix requires any out-of-scope file.

## Maintenance notes

- Keep `FileAnalysis` as the only producer of temporal Now.ID facts. New Fluent rules must consume that result instead of walking the file again.
- Preserve the distinction between “definitely an ID with unknown key” and “not definitely an ID.” It controls both false positives and duplicate precision.
- When adding a transparent TypeScript expression wrapper, extend the shared AST unwrapping helper once and add a Now.ID regression test.
- When adding a directive to the Fluent manifest, use its declared placement. Do not add a name-specific branch to `fluent-directives.ts`.
- Reviewers should scrutinize assignment-operator checks, wrapper-to-effective-parent traversal, scope-local statement association, CRLF/BOM offsets, and Oxlint/ESLint range parity.
- Plan 009 owns `String` extraction and every GlideElement collection behavior. Reuse its binding helper when available; do not create a Fluent-only copy.
- Plan 010 owns factory/import namespace alias stability, new SDK versions, APIs, module ownership, and cross-file barrel decisions. Re-run this plan's Now alias tests after registry changes, but fix factory resolver regressions in plan 010's scope.
- Cross-file `$id` uniqueness remains deliberately deferred until a project index exists.
