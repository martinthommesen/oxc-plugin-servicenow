# Changelog

## Unreleased

### Compatibility

- Raise the Node `engines` floor to `>=20.19.0`. Node 18 is EOL and was never tested.
- Narrow the optional `oxlint` peer range to `>=1.79.0 <2`. The JS-plugin API this package uses shipped around oxlint 1.79.
- ESLint flat `recommended` / `strict` now set `files` so they apply to classic JS and Fluent `*.now.ts`. ESLint 10's default glob is JS/CJS/MJS only and skipped Fluent files. The preset does not include generic `*.ts`. Typed Fluent needs `typescript-eslint` (or another TypeScript parser) in the user's config.

### Fixes

- `no-gs-now` no longer autofixes `gs.now()` / `gs.nowDateTime()` to `new GlideDateTime()`. That rewrite turns a display string into an object. The rule now offers suggestions, with `new GlideDateTime().getDisplayValue()` first.
- Display Business Rules that write `g_scratchpad` classify as `business-rule`, not `client`. `g_scratchpad` and `gel` are no longer client-classification evidence. Override with `settings.servicenow.scriptType`.
- `@sn-es-latest` is recognized only in comments, not when the text appears in a string or template literal.
- `no-packages-calls` flags only `Packages.*` member chains, not object keys or local bindings named `Packages`.
- `no-br-current-update` reports only on Business Rule and `src/server/**` files. Force a file with `settings.servicenow.scriptType: "business-rule"`.
- `no-hardcoded-sysid` matches lowercase 32-hex only, so uppercase MD5s are not flagged.
- `validate-gliderecord-calls`, `prefer-glideaggregate`, and `no-hardcoded-table-names` track `GlideRecordSecure` as well as `GlideRecord`.

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
