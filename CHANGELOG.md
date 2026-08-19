# Changelog

## Unreleased

### oxlint

- New recommended rules: `no-delete-multiple-with-windowing`, `require-callback-for-getreference`, `require-glideajax-sysparm-name`, `validate-glideaggregate-calls`, `no-now-id-as-reference`, `no-glideajax-getanswer`, `no-duplicate-fluent-id`.
- New recommended rules: `no-glideelement-in-collection`, `no-gliderecord-query-modifier-after-query`, `require-business-rule-wrapper`. `no-unfiltered-gliderecord-bulk-operation` is recommended at warn.
- New strict/warn rules: `no-display-value-date-comparison`, `no-gliderecord-query-in-loop`.
- New opt-in `configs.securityRules` rule: `no-system-query-bypass`.
- Versioned Zurich GlideRecord method table in `src/glide/manifest.ts` drives filter, modifier, and ACL-bypass names.

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
