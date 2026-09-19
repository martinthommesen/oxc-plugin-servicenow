A rule cannot decide whether it applies to a file until the file has been classified onto the axes in [[domain]]. This file describes that classification, its confidence levels, and how rules consume the result.

`resolveScriptContext` in [[src/context/resolve.ts#resolveScriptContext]] builds one `ServiceNowScriptContext` per file. Its four dimensions are resolved independently, each carrying its own confidence. `script` on the record returned by `getFileAnalysis` is the instance rules read — see [[analysis#Per-file analysis]].

## Confidence and its ordering

`ContextConfidence` is `"explicit" | "filename" | "inferred" | "unknown"`, ordered by `CONTEXT_CONFIDENCE_ORDER` in [[src/context/resolve.ts#CONTEXT_CONFIDENCE_ORDER]].

The context's overall `confidence` is the *weakest* of the four dimensions, not the strongest. A confident filename must not hide an unknown JavaScript mode, because a rule that trusts the overall value would then run on evidence it does not have.

`ContextSourceMap` records each dimension. `confidenceAtLeast(source, minimum)` compares one dimension against the shared ordering, so applicability checks cannot substitute the weaker overall confidence.

## Authoring

`resolveAuthoring` decides `"classic"` or `"fluent"` in this order:

1. An explicit `settings.servicenow.authoring` other than `"auto"` — confidence `explicit`.
2. A deprecated `settings.servicenow.scriptType` other than `"auto"` — confidence `explicit`. [[src/settings/legacy.ts#legacyAuthoring]] owns this translation. The legacy field outranks the filename, so a client script named `thing.now.ts` stays classic.
3. An explicit `settings.servicenow.surfaces` — confidence `explicit`.
4. The filename, via `authoringFromFilename` in [[src/context/filename.ts#authoringFromFilename]] — `fluent` when the name matches `/\.now\.tsx?$/i`, confidence `filename`.
5. Otherwise `classic`, confidence `unknown`.

## Surfaces

`resolveSurfaces` returns a set. [[src/surfaces.ts#SURFACE_VALUES]] is the authored eight-surface vocabulary. `SERVER_SURFACES` and `CLIENT_SURFACES` intentionally overlap on `ui-action`; `SERVER_ONLY_SURFACES` does not overlap the client set.

For a Fluent file the set is empty and the confidence is `filename`. Explicit Fluent authoring with instance surfaces throws `ServiceNowSettingsError`.

For classic files, in order:

1. An explicit `settings.servicenow.surfaces` array — confidence `explicit`.
2. A legacy `scriptType` that names an execution surface, mapped by [[src/settings/legacy.ts#legacySurface]] — confidence `explicit`.
3. `surfacesFromFilename` — confidence `filename`, with one special case below.
4. AST inference — confidence `inferred`.
5. Otherwise the set is empty, confidence `unknown`.

`surfacesFromFilename` in [[src/context/filename.ts#surfacesFromFilename]] matches the basename against seven filename patterns and the path against seven directory patterns. Four rules make it deterministic:

- **Project-relative directory evidence.** `directoryEvidencePath` strips everything above the host `cwd`, so a checkout that happens to live under `~/client/` contributes no client evidence. A path outside the project contributes only its basename.
- **Specific beats generic.** A generic `server` hit is dropped when a specific subtype also matched, keeping `src/server/helper.si.js` a Script Include instead of an ambiguous file.
- **Ambiguity is not evidence.** If more than one surface matched and `ui-action` is not among them, the function returns `[]` rather than guessing.
- **UI Actions compose.** A bare `ui-action` hit names the record type, so it is kept and AST inference runs to decide whether to add `client`, `server`, or neither. The confidence rises to `inferred` only if the AST supplied one of them.

AST inference (`inferSurfacesFromAst` in [[src/analysis/file-analysis.ts#inferSurfacesFromAst]]) walks the program and counts a reference only when `bindings.isPlatformGlobal` confirms it is the platform global rather than a local shadow. A strong client global (`CLIENT_GLOBALS_STRONG`) marks the file client-capable; `current` or `previous` mark it server. Name matching alone is never sufficient — see [[analysis#Lexical bindings]].

## JavaScript mode

`resolveJavaScriptMode` resolves in this order:

1. An explicit `settings.servicenow.javascriptMode` — confidence `explicit`.
2. Deprecated `ecmaLatest: true`, which maps to `es2021` — confidence `explicit`.
3. A Fluent file, whose mode stays `unknown` at confidence `filename`.
4. Otherwise `unknown`, confidence `unknown`.

The `@sn-es-latest` comment pragma was retired in 3.0 and is ignored; files that relied on it now resolve `unknown` unless settings name a mode.

Unknown mode never falls back to ES5. `appliesInJavaScriptModes` in [[src/context/resolve.ts#appliesInJavaScriptModes]] returns false for it.

## Scope

Scope comes straight from `settings.servicenow.scope`, at confidence `explicit` unless the value is `"unknown"`. There is no filename or AST evidence for application scope.

## How rules consume the context

Rules do not read `ctx.surfaces` and decide for themselves. They call the predicates exported from [[src/context/resolve.ts#appliesOnSurface]], which require both membership *and* a minimum source confidence, `inferred` by default:

- `appliesOnSurface(ctx, surface, minimum)` — one surface, with a confidence floor.
- `isServerInstanceContext(ctx, minimum)` — any of the six server-only surfaces, or a UI Action that also has explicit server evidence.
- `isClientCapableContext(ctx)` — a client surface at `inferred` or stronger. An unknown surface is not client-capable.
- `appliesToInstanceScripts(ctx)` — any non-Fluent file with at least one known dimension. Used by rules for features ServiceNow documents as unavailable in every mode.

The confidence floor is per call site, so a rule that changes behavior on weak evidence can demand `explicit` while a conservative rule accepts `inferred`. `Minimum surface confidence` in each `docs/rules/*.md` page records the floor a rule chose.

## Related

Where the pieces around this classification live.

- [[domain]] — the axes themselves.
- [[analysis]] — where the context is built and cached.
- [[invariants#Silence on unknown facts]] — the rule that consumes all of this.
