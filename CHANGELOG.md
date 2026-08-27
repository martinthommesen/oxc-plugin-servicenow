# Changelog

## Unreleased

### Added

- First-class ACL script support: explicit and filename-derived `acl` surfaces, boundary-safe ESLint and oxfmt globs, and an opt-in `no-gliderecord-query-in-acl` performance review backed by Australian guidance, authoritative `current` handling, and immediate-path analysis that stops at async suspension.
- Full Australia release support: release-keyed JavaScript-engine capabilities, an exact 102-method scoped/global GlideRecord inventory, pinned official source markers, Australia SDK 4.4 manifest-selection coverage, real Oxlint/ESLint release contracts, and generated compatibility metadata.
- New `no-object-hasown` rule for Zurich and Compatibility/ES5 scripts. Australia ES2021 correctly permits `Object.hasOwn()`.
- `no-typed-arrays` now models Australia BigInt64 array support and detects unsupported constructors, static `from`/`of` factories, and documented `DataView` BigInt getters through proven object aliases.

### Fixed

- `no-at-method` now honors visible Array/String constructor and prototype replacements, dynamic-scope uncertainty, optional invocation, and structurally dominating prototype-availability guards while keeping the two built-in domains independent.
- `no-unsupported-syntax` now resolves direct, namespace-qualified, and stable same-execution `RegExp` aliases for constructor-string lookbehind checks while staying silent after visible replacement, shadowing, mutation, or dynamic-scope uncertainty; literal diagnostics remain independent.
- `no-bigint` now resolves stable same-execution call aliases, requires safe alias capture, honors dominating availability guards and visible callable polyfills, and invalidates guards after modeled writes.
- `no-promise` and `no-proxy` now resolve stable same-execution constructor and static-method owner aliases, require safe bare-alias capture, honor dominating availability guards, invalidate guards after modeled built-in writes, and avoid attributing visible callable polyfills or dynamic-scope replacements to ServiceNow.
- `no-weak-references` and `no-weak-collections` now resolve stable same-execution constructor aliases, require bare aliases to be captured inside an availability guard, invalidate guards after modeled built-in writes, and distinguish callable polyfills from object, array, and other non-callable replacements.
- Private instance fields, methods, and accessors now report the documented ES2021 Not Supported status for both Zurich and Australia; private static members remain Supported.
- Omitting `settings.servicenow.release` now keeps release-dependent facts unknown instead of silently selecting Zurich.
- Australia support is fail-closed: every catalog rule requires an explicit, release-keyed review basis before a new release can appear in generated applicability metadata.
- Engine feature rules recognize safe availability guards and proven global aliases while conservatively suppressing diagnostics after relevant global, constructor, prototype, or instance mutations.
- `no-client-gliderecord` now reports only in scoped client applications, matching the documented global/scoped API split, and stays silent for mixed client/server UI Actions.
- `no-packages-calls` is now an opt-in server-side migration policy instead of a recommended correctness error because the Australia removal tool is narrower than every `Packages.*` call and records executing on a MID Server need separate review.
- GlideElement collection analysis now treats all documented Australia GlideRecord methods as methods rather than possible fields, while query lifecycle rules continue to model only methods with proven roles.
- Catalog verification IDs are now scoped to the rule-to-evidence assertion, so shared Australia source cells remain independently auditable without duplicate ledger identities.
- Published README and rule `docs.url` links now target the immutable `v<package version>` repository tag instead of omitted tarball paths or mutable `main`; the documentation gate rejects new relative package links.
- `fluent-directives` now describes ServiceNow SDK controls without falsely implying that `@fluent-ignore` suppresses Oxlint or ESLint diagnostics; real-host fixtures lock in that boundary.
- Every rule's host-facing `meta.docs.recommended` flag now derives from catalog placements instead of stale per-file declarations.
- `no-complex-fluent-logic` now applies its documented multi-statement threshold equally to ordinary function expressions and arrow functions.
- Fluent SDK manifest auditing now accepts only exact `registry.npmjs.org` artifact URLs, rejects redirects, caps metadata and compressed-tarball response bytes, and times out stalled fetches before pinned-integrity and decompression checks.
- `no-glideelement-in-collection` now follows path-proven local field aliases through reassignment, shadowing, all-path branch joins, nested literals, escapes, and immediately invoked function parameters; numeric update coercion also invalidates shared object aliases.
- The public `analyzeProvenance(context, ast)` overload once again analyzes the supplied AST, partitions its cache by tree identity, and never applies the host parser's scope graph to foreign nodes.
- Engine compatibility diagnostics now stay silent when a relevant namespace object escapes to an unknown helper that could install replacement methods, while passing the method value itself does not taint its owner.
- Unknown JavaScript mode now conservatively records possible `globalThis` mutations, and cyclic destructured platform-global aliases terminate safely instead of overflowing the analysis stack.
- `no-gliderecord-query-in-loop` now carries proven cursor depth through direct calls to stable one-call-site local helpers, while mutable, multiply called, generator, shadowed, dynamically scoped, and indirect helpers remain conservatively silent.
- `no-client-gliderecord` now resolves stable, block-dominating constructor aliases and suppresses diagnostics whenever path-dependent assignments, dynamic scope, namespace escape, or visible platform replacement make constructor identity uncertain.
- `no-hardcoded-sysid` now resolves hash-context owners from AST ancestry, preserving the correct owner around nested sibling expressions and preventing suppression from leaking into nested function or class bodies.
- Shared per-file binding-write analysis now drives stable helper and constructor resolution; mutation analysis distinguishes callable replacements from lost platform authority, and `no-br-current-update` / `no-gs-now` stay silent whenever binding replacement, method mutation, namespace escape, or dynamic scope makes platform identity uncertain.
- Client API rules now share platform-method authority checks: GlideAjax and `g_form.getReference()` diagnostics stay silent after constructor, prototype, instance-method, namespace, or dynamic-scope mutation, while immutable callback aliases are classified structurally.
- GlideRecord, GlideRecordSecure, GlideAggregate, and GlideDateTime analyses now apply the same authority model across cursor lifecycle, bulk safety, aggregation, counting, N+1, GlideElement, and security-review diagnostics; domain-specific uncertainty remains path- and epoch-aware, and fresh host values are re-established on later loop evaluations.
- Canonical full-script Business Rule wrappers preserve `current.update()` authority across their required synchronous `current` argument while remaining silent after a pre-call escape, parameter reassignment, receiver-method replacement, or GlideRecord prototype mutation.
- Allocation-site refreshes detach stale aliases, instance-method authority remains scoped to stable receiver identities, and computed security review requires at least one still-authoritative bypass candidate.
- Cursor-loop analysis evaluates defaults selected by explicit `undefined`, stops expanding immutable helper aliases under dynamic scope, and checks GlideElement retention on the first `while` iteration even when the body exits immediately.
- Release validation now rejects tags that do not point to the exact current protected `main` tip.
- GlideRecord lifecycle analysis now recognizes the documented `_query()`, `_next()`, and global-only `queryNoDomain()` APIs without guessing when application scope is unknown.
- ESLint no longer suppresses same-offset query lifecycle diagnostics in later files through retained `createOnce` state.

## 2.0.0 — 2026-08-22

The 2.0.0 release includes the validated settings, context, rule, and release-governance changes documented below.

### Validation

- Rule options use one descriptor for host schema, runtime parsing, and generated docs. Invalid types throw a path-specific `ServiceNowConfigError`.
- Shared validated settings defaults are deeply frozen, including nested `allowedSysIds` and `allowedTables`.
- Generated rule pages include a structured applicability matrix, evidence records, false-positive and false-negative lists, overlaps, and fix safety. `npm run docs:check` fails on stale metadata.

### Analysis

- Shared per-file analysis now uses lexical binding IDs and runtime object IDs.
- Path joins keep alias identity only when every reachable path agrees.
- `return`, `throw`, `break`, and `continue` no longer join into later statements.
- Unknown execution context is neither client nor server. Comments and strings do not classify a file.
- Fluent authoring cannot list instance execution surfaces.

### oxlint

- Rule registry is derived from catalog descriptors. Adding a rule requires an implementation file, one catalog entry, and tests.
- `PACKAGE_VERSION` is read from `package.json`.
- New `settings.servicenow.businessRuleWhen` metadata. Default `unknown`.
- New strict/warn rule: `prefer-setnocount-with-choosewindow`.
- Example projects cover Compatibility, ES5, ES2021, client, Business Rule, UI Action, Fluent, and mixed repositories.
- Phase 5 research notes record implement/hold/reject decisions for issues #35–#40.

- New recommended rules: `no-delete-multiple-with-windowing`, `require-callback-for-getreference`, `require-glideajax-sysparm-name`, `validate-glideaggregate-calls`, `no-now-id-as-reference`, `no-glideajax-getanswer`, `no-duplicate-fluent-id`.
- New recommended rules: `no-glideelement-in-collection`, `no-gliderecord-query-modifier-after-query`, `require-business-rule-wrapper`. `no-unfiltered-gliderecord-bulk-operation` is recommended at warn.
- New strict/warn rules: `no-display-value-date-comparison`, `no-gliderecord-query-in-loop`.
- New opt-in `configs.securityRules` rule: `no-system-query-bypass`.
- Versioned Zurich GlideRecord method table in `src/glide/manifest.ts` drives filter, modifier, and ACL-bypass names.
- Rule catalog placements now generate preset maps, README rule tables, and recommended oxlintrc copies. `npm run docs` deletes stale rule pages.
- Packed-package consumer test installs `npm pack` output and runs oxlint against the published exports.
- Contributor docs: `npm run validate`, rule-authoring guide, and non-goals policy.
- `npm test` lists `*.test.ts` files so Node 20 CI does not treat a quoted glob as a missing path.

### Breaking — 2.0.0 foundation

- Unknown JavaScript mode no longer assumes ES5. Mode-specific engine rules skip until `javascriptMode` is `compatibility`, `es5`, or `es2021`.
- `recommended` no longer enables ES5-only bans. Use `configs.classicEs5Rules` or `configs.es2021Rules`.
- `validate-gliderecord-calls` is removed from presets. Use `require-query-before-next`. The old rule remains as a deprecated alias with corrected `chooseWindow` and bulk-return semantics.
- `ecmaLatest` and `scriptType` are deprecated. `ecmaLatest: true` maps to `javascriptMode: "es2021"`. `ecmaLatest: false` does not assume ES5.
- UI Actions are no longer mutually exclusive with client or server. Set `surfaces` for mixed UI Actions.
- `no-br-current-update` reports only on Business Rule surfaces, not every `src/server/**` file.
- Unsafe suggestions and autofixes are removed from `no-gs-now`, `prefer-glideaggregate`, `no-at-method`, `no-weak-references`, and `fluent-proper-imports`.
- `no-weak-references` now covers only `WeakRef` / `FinalizationRegistry`. Use `no-weak-collections` for WeakMap / WeakSet in ES5/Compatibility.
- `no-promise` no longer flags arbitrary `.then` / `.catch` / `.finally` calls.
- Invalid `settings.servicenow` values throw a configuration error instead of failing silently.
- Package version is 2.0.0.

### Compatibility

- Raise the Node `engines` floor to `>=20.19.0`. Node 18 is EOL and was never tested.
- Narrow the optional `oxlint` peer range to `>=1.79.0 <2`. The JS-plugin API this package uses shipped around oxlint 1.79.
- ESLint flat `recommended` / `strict` now set `files` so they apply to classic JS and Fluent `*.now.ts`. ESLint 10's default glob is JS/CJS/MJS only and skipped Fluent files. The preset does not include generic `*.ts`. Typed Fluent needs `typescript-eslint` (or another TypeScript parser) in the user's config.

### Fixes

- `no-gs-now` no longer autofixes or suggests replacing `gs.now()` / `gs.nowDateTime()` with `new GlideDateTime()`. That rewrite turns a display string into an object.
- Display Business Rules that write `g_scratchpad` classify as `business-rule`, not `client`. `g_scratchpad` and `gel` are no longer client-classification evidence.
- `@sn-es-latest` is recognized only in comments, not when the text appears in a string or template literal.
- `no-packages-calls` flags only `Packages.*` member chains, not object keys or local bindings named `Packages`.
- `no-br-current-update` reports only on Business Rule surfaces. `src/server/**` is not a Business Rule unless settings say so.
- `no-hardcoded-sysid` matches lowercase 32-hex only, so uppercase MD5s are not flagged.
- GlideRecord rules use binding-aware provenance, including `GlideRecordSecure`.

## 1.1.0 — 2026-08-19

### Fixes

- `prefer-glideaggregate` no longer treats `if (gr.next())` as an iterate-to-count loop
- `no-br-current-update` skips UI Action files (`*.ui-action.js`, `sys_ui_action`, …)
- `package-lock.json` now matches `package.json`, so `npm ci` works in CI

### oxlint

- `no-gs-now` also flags `gs.nowDateTime()`
- New recommended rules: `no-typed-arrays`, `no-proxy`, `no-unsupported-syntax`, `no-sync-glideajax`
- Fluent factory list now includes `AliasTemplate`, `InboundEmailAction`, `CatalogItemRecordProducer`, `StateModel`, and `UiFormatter`

### Tooling

- Catalog examples are executed as tests
- `npm run docs` / `npm run docs:check` regenerate and verify `docs/rules/`

## 1.0.0 — 2026-08-19

Initial public release.

### oxlint

- 20 rules covering classic ServiceNow scripts and Fluent `.now.ts` metadata
- `recommended` and `strict` presets
- ESLint 9 flat-config exports (`plugin.configs.flat.*`)
- High-performance `createOnce` visitors, with `eslintCompatPlugin` shims for ESLint
- Settings: `allowedSysIds`, `allowedTables`, `scriptType`, `ecmaLatest`, `scopePrefix`

### oxfmt

- Recommended configuration with Fluent vs classic-script overrides
- JSON preset at `oxc-plugin-servicenow/oxfmt.recommended.json`
- TypeScript export at `oxc-plugin-servicenow/oxfmt`
