# Changelog

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
