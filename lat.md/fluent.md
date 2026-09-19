Fluent is the ServiceNow SDK's TypeScript authoring format for metadata. Its files are not executed by the instance, so it needs its own model of imports, factories, ids, and directives. This file describes that model.

## What Fluent is here

A `.now.ts` file declares ServiceNow metadata through TypeScript calls — a table, a column, an automation — rather than through records in an instance. The SDK compiles it.

`FLUENT_CORE_MODULE` in `src/fluent/manifest.ts` names the module those calls come from, `@servicenow/sdk/core`.

A Fluent file has no execution surface and no JavaScript mode; see [[context#Surfaces]]. The API surface is versioned by the SDK package, a different axis from the instance release — see [[domain#Two independent version axes]].

## The manifest

`DEFAULT_FLUENT_MANIFEST` in [[src/fluent/manifest.ts#DEFAULT_FLUENT_MANIFEST]] is the reviewed API inventory. `FluentSdkManifest` holds:

- `apis` — one `FluentApiCapability` per callable, with its defining `module`, its `kind`, its `idRequirement`, its introduction and deprecation versions, and its evidence records.
- `directives` — `@fluent-*` comment directives and where each is allowed.
- `typos` — near-miss names mapped to their likely intent, so a misspelling can be corrected rather than merely reported.

`FluentApiKind` is `"entity" | "column" | "automation" | "helper"`. `FluentIdRequirement` is `"required" | "optional" | "deprecated" | "forbidden" | "unknown"` — this is what makes an id rule possible without a name list. `require-fluent-id` reads `capability.idRequirement` and reports only where an id is genuinely required.

`apisByName` is the indexed lookup. `entitiesRequiringId`, `importOwnedApis`, and `knownDirectiveNames` derive the other views the rules need.

## Version registry

The registry maps an SDK semver string to the manifest reviewed for it.

`resolveFluentManifest` in [[src/fluent/registry.ts#resolveFluentManifest]] builds a reviewed version on first use and memoizes it. `SUPPORTED_FLUENT_SDK_VERSIONS` in [[src/fluent/sdk-versions.ts]] lists 27 versions from `3.0.0` to `4.11.0`. Unknown versions remain settings errors.

`FLUENT_SDK_ARTIFACTS` records the npm integrity hashes of the exact package pair each reviewed manifest came from. That is what makes "reviewed against 4.8.0" a checkable claim: the manifest is tied to a specific published artifact, not to a version string.

## Declaration snapshots

`tests/fixtures/fluent-sdk-declarations.json` is the review artifact: it holds every audited field per version. `src/fluent/declaration-snapshots.ts` is generated from it and ships only what the runtime reads.

The fixture holds declaration paths, hashes, absent names, and lifecycle evidence. Typos come from `DEFAULT_FLUENT_MANIFEST`, their authored home. The shipped module contains id policies and discovered names with module and introduction version, which is all `registry.ts` reads.

Because the fixture is a complete superset of the audited object, the generated module can be rebuilt offline from it with a deterministic TypeScript serializer; `scripts/audit-fluent-sdk.mjs --update` is only needed to re-audit against npm. `npm run manifest:check` compares the shipped projection against the fixture, and `npm run manifest:drift` re-audits against the live registry.

`src/fluent/declaration-index.ts` exposes only the joins the registry uses: snapshot presence, declared id policy, first matching policy version, and discovered entries. The generator derives lifecycle from the audited objects rather than reading its previous output.

## Imports and factory resolution

A Fluent call is only a platform call if it came from the SDK, so each call site is resolved back to a manifest entry.

`collectFluentImports` in `src/analysis/fluent-imports.ts` records which local names are bound to which SDK exports, and `resolveFluentFactory` resolves a call's callee through those bindings to a `FluentApiCapability`. This is the same discipline as [[analysis#Lexical bindings]]: a local function named `Table` is not the SDK's `Table`. `FileAnalysis.fluent.resolveFactory` exposes the result, along with `isCanonicalNow` for `Now.ID` handling.

## Directives

The `@fluent-*` directives are read from comments rather than from the AST's bindings, so they are handled separately.

`fluent-directives` validates placement and flags a dangling directive. `docs/rules/*.md` records the placement rules per directive.

## Related

The axes Fluent is orthogonal to, and the gates over this model.

- [[domain]] — the axes.
- [[analysis]] — where imports and factories are resolved.
- [[invariants#Generated files round-trip]] — the manifest and snapshot gates.
