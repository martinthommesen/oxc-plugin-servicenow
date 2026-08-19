# oxc-plugin-servicenow

First-class **[oxlint](https://oxc.rs/docs/guide/usage/linter.html)** + **[oxfmt](https://oxc.rs/docs/guide/usage/formatter.html)** tooling for:

1. **ServiceNow Fluent** — TypeScript DSL in `.now.ts` files, powered by [`@servicenow/sdk`](https://servicenow.github.io/sdk/guides/fluent-overview)
2. **Classic ServiceNow JavaScript** — Business Rules, Client Scripts, Script Includes, UI Actions, and everything else still running on the restricted platform engine

The plugin is written against the official [`@oxlint/plugins`](https://www.npmjs.com/package/@oxlint/plugins) API (`definePlugin` + `defineRule` + `createOnce`) and is wrapped with `eslintCompatPlugin`, so the same package works in **oxlint** and **ESLint 9+**.

```bash
npm install -D oxc-plugin-servicenow oxlint oxfmt
```

---

## Why this exists

ServiceNow apps now live in two worlds at once.

Fluent `.now.ts` files are **declarative metadata**. They should import from `@servicenow/sdk/core`, declare `$id: Now.ID['…']`, and keep business logic out of the metadata object.

Classic scripts still run on a **restricted, mode-dependent engine**. Compatibility and ES5 Standards reject many modern features. ES2021 supports Promise, async/await, and optional chaining, but still disallows async iteration, WeakRef, and FinalizationRegistry. `current.update()` in a Business Rule retriggers the rule engine. Client-side `GlideRecord` is slow and often blocked. Hardcoded sys_ids rot the moment the app is installed on another instance.

This package does **not** treat every non-Fluent file as ES5. Unknown JavaScript mode stays unknown. Mode-specific rules skip rather than guess.

Existing ESLint plugins (`eslint-plugin-servicenow`, `eslint-plugin-sn`) cover parts of the classic world and nothing of Fluent. This package covers both, on the Oxc toolchain.

---

## Quick start — oxlint

### `.oxlintrc.json`

```jsonc
{
  "jsPlugins": [
    { "name": "servicenow", "specifier": "oxc-plugin-servicenow" }
  ],
  "settings": {
    "servicenow": {
      "javascriptMode": "unknown"
    }
  },
  "rules": {
    "servicenow/no-hardcoded-sysid": "error",
    "servicenow/no-packages-calls": "error",
    "servicenow/no-gs-now": "error",
    "servicenow/require-query-before-next": "error",
    "servicenow/no-client-gliderecord": "error",
    "servicenow/no-br-current-update": "error",
    "servicenow/no-sync-glideajax": "error",
    "servicenow/no-async-iterators": "error",
    "servicenow/no-weak-references": "error",
    "servicenow/fluent-proper-imports": "error",
    "servicenow/fluent-directives": "warn",
    "servicenow/require-fluent-id": "error"
  }
}
```

Or copy the maps exported by the package:

```ts
// oxlint.config.ts
import { defineConfig } from "oxlint";
import servicenow, { configs } from "oxc-plugin-servicenow";

export default defineConfig({
  jsPlugins: [{ name: "servicenow", specifier: "oxc-plugin-servicenow" }],
  rules: configs.recommendedRules,
});
```

> oxlint JS plugins are **alpha**. Custom file parsers and type-aware rules are not supported. This plugin stays within the supported ESTree visitor API. See [JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html) and [writing JS plugins](https://oxc.rs/docs/guide/usage/linter/writing-js-plugins.html).

### Presets

| Preset | Intent |
| --- | --- |
| `configs.recommendedRules` | High-confidence rules that stay quiet when the runtime mode or surface is unknown. |
| `configs.classicEs5Rules` | Compatibility / ES5 engine bans (Promise, async/await, `?.`, WeakMap, …). |
| `configs.es2021Rules` | Features still disallowed after ES2021 (async iteration, WeakRef, BigInt64Array). |
| `configs.clientRules` | Client-side API rules. |
| `configs.businessRuleRules` | Business Rule rules. |
| `configs.fluentRules` | Fluent `.now.ts` metadata rules. |
| `configs.strictRules` | Recommended plus warn-level performance and naming guidance. Does not promote heuristics to errors. |
| `configs.policyRules` | Optional organizational policy (`no-hardcoded-table-names`, `no-complex-fluent-logic`). |
| `configs.securityRules` | Opt-in privilege-sensitive rules. Empty until those rules ship. |

---

## Quick start — oxfmt

oxfmt does **not** currently support custom formatting plugins. The supported extension point is a recommended configuration with file-type overrides.

### `oxfmt.config.ts`

```ts
import { defineConfig } from "oxfmt";
import { recommendedOxfmtConfig } from "oxc-plugin-servicenow/oxfmt";

export default defineConfig(recommendedOxfmtConfig);
```

### `.oxfmtrc.json`

```json
{
  "$schema": "./node_modules/oxfmt/configuration_schema.json",
  "extends": []
}
```

Copy the JSON preset shipped with the package:

```bash
cp node_modules/oxc-plugin-servicenow/oxfmt.recommended.json .oxfmtrc.json
```

What the preset does:

| Files | Style |
| --- | --- |
| `**/*.now.ts` | TypeScript / Fluent — single quotes, trailing commas, width 100 |
| `**/*.{server,client,br,si}.js`, `src/server/**` | Classic Studio style — double quotes, no trailing commas, width 120 |
| `**/.now/**`, `keys.ts` | Ignored (SDK sync artefacts) |

Then:

```bash
npx oxfmt --write .
```

`.now.ts` is TypeScript. oxfmt already knows how to format it; the preset just picks Fluent-friendly options.

---

## ESLint 9+

The plugin is wrapped with `eslintCompatPlugin`, so every `createOnce` rule also has a `create` shim.

```js
// eslint.config.js
import servicenow from "oxc-plugin-servicenow";

export default [servicenow.configs.flat.recommended];
```

```js
export default [servicenow.configs.flat.strict];
```

The flat presets set `files` so ESLint 10 opens classic `*.js` / `*.cjs` / `*.mjs` and Fluent `*.now.ts` / `*.now.tsx`. ESLint 10's default glob is JS/CJS/MJS only.

oxlint parses TypeScript itself. ESLint uses its default JS parser, so type annotations (`import type`, `: string`) in `.now.ts` fail to parse. Add [`typescript-eslint`](https://typescript-eslint.io/getting-started/) in your own config if you lint typed Fluent.

To run these rules on server TypeScript (`src/server/**/*.ts`), add a `files` override. Set `settings.servicenow.javascriptMode` to `es2021` or `es5` for those files. `ecmaLatest` and `// @sn-es-latest` still map to `es2021` for one major-release cycle.

---

## Runtime context

The plugin models four independent dimensions. It does not collapse them into one `scriptType`.

| Dimension | Values | Why it matters |
| --- | --- | --- |
| Authoring form | classic / Fluent | Instance script versus SDK metadata |
| JavaScript mode | Compatibility / ES5 / ES2021 / unknown | Language-feature support |
| Surface | client / server / Business Rule / UI Action / Script Include / scheduled / fix | Available APIs |
| Scope | global / scoped / unknown | API availability |
| Confidence | explicit / filename / inferred / unknown | Whether mode-specific rules may run |

Authority order: explicit settings, then filename conventions, then conservative source inference. Unknown JavaScript mode never assumes ES5.

UI Actions can be client, server, or mixed:

```jsonc
{
  "settings": {
    "servicenow": {
      "surfaces": ["ui-action", "client"]
    }
  }
}
```

## Settings

Configure once. Invalid keys, types, or conflicting values throw a configuration error with the full path.

```jsonc
{
  "settings": {
    "servicenow": {
      "javascriptMode": "es2021",
      "surfaces": ["business-rule"],
      "scope": "scoped",
      "scopePrefix": "x_acme",
      "allowedSysIds": ["97c04b3b1b12100043ab85e5bd0713e2"],
      "allowedTables": ["x_acme_widget"],
      "release": "zurich",
      "fluentSdkVersion": "4.1.0",
      "businessRuleSourceFormat": "full-script"
    }
  }
}
```

| Field | Meaning |
| --- | --- |
| `javascriptMode` | `compatibility`, `es5`, `es2021`, or `unknown` (default) |
| `authoring` | `classic`, `fluent`, or `auto` |
| `surfaces` | `auto` or an array such as `["ui-action","client"]` |
| `scope` | `global`, `scoped`, or `unknown` |
| `scopePrefix` | Application scope prefix such as `x_acme` |
| `allowedSysIds` | 32-character lowercase sys_ids that `no-hardcoded-sysid` ignores |
| `allowedTables` | Table names that `no-hardcoded-table-names` ignores |
| `release` | ServiceNow release identifier used for versioned knowledge |
| `fluentSdkVersion` | Fluent SDK semver the manifest should evaluate |
| `businessRuleSourceFormat` | `full-script`, `body-only`, or `unknown` |
| `scriptType` | **Deprecated.** Use `authoring` and `surfaces`. |
| `ecmaLatest` | **Deprecated.** `true` maps to `javascriptMode: "es2021"`. `false` does not assume ES5. |

Mixed-repository composition:

```ts
import { defineConfig } from "oxlint";
import { configs } from "oxc-plugin-servicenow";

export default defineConfig({
  jsPlugins: [{ name: "servicenow", specifier: "oxc-plugin-servicenow" }],
  rules: configs.recommendedRules,
  overrides: [
    {
      files: ["src/server/**/*.js", "**/*.si.js"],
      settings: { servicenow: { javascriptMode: "es2021", surfaces: ["server"] } },
      rules: configs.es2021Rules,
    },
    {
      files: ["**/*.br.js"],
      settings: { servicenow: { javascriptMode: "es5", surfaces: ["business-rule"] } },
      rules: { ...configs.classicEs5Rules, ...configs.businessRuleRules },
    },
    {
      files: ["**/*.client.js"],
      settings: { servicenow: { surfaces: ["client"] } },
      rules: configs.clientRules,
    },
  ],
});
```

Per-file `// @sn-es-latest` still maps to `es2021` with inferred confidence. Prefer `javascriptMode` in settings.

---

## Rules

### Classic ServiceNow

| Rule | Preset | Fix | What it catches |
| --- | --- | --- | --- |
| [`no-hardcoded-sysid`](docs/rules/no-hardcoded-sysid.md) | recommended | | 32-char hex sys_ids |
| [`prefer-glideaggregate`](docs/rules/prefer-glideaggregate.md) | strict | | `getRowCount()` / iterate-to-count on proven GlideRecord bindings |
| [`no-client-gliderecord`](docs/rules/no-client-gliderecord.md) | recommended | | platform `GlideRecord` in client scripts |
| [`no-gs-now`](docs/rules/no-gs-now.md) | recommended | | `gs.now()` / `gs.nowDateTime()` when `gs` is the platform global |
| [`require-query-before-next`](docs/rules/require-query-before-next.md) | recommended | | `.next()` without `.query()` / `.get()` on every path |
| [`validate-gliderecord-calls`](docs/rules/validate-gliderecord-calls.md) | off (deprecated) | | temporary alias of query-before-next plus unused insert/update/get/next |
| [`no-br-current-update`](docs/rules/no-br-current-update.md) | recommended | | `current.update()` in Business Rules |
| [`no-hardcoded-table-names`](docs/rules/no-hardcoded-table-names.md) | policy | | string-literal table names |
| [`no-packages-calls`](docs/rules/no-packages-calls.md) | recommended | | `Packages.*` Java bridge |
| [`no-sync-glideajax`](docs/rules/no-sync-glideajax.md) | recommended | | `GlideAjax.getXMLWait()` |

### Instance engine (mode-specific)

These rules run only when `javascriptMode` is known, except features that ServiceNow documents as disallowed in every instance mode.

| Rule | Preset | What it catches |
| --- | --- | --- |
| [`no-promise`](docs/rules/no-promise.md) | classic-es5 | platform `Promise` constructor and static methods |
| [`no-async-await`](docs/rules/no-async-await.md) | classic-es5 | `async` / `await` |
| [`no-bigint`](docs/rules/no-bigint.md) | classic-es5 | `10n`, platform `BigInt()` |
| [`no-at-method`](docs/rules/no-at-method.md) | classic-es5 | `.at()` |
| [`no-weak-collections`](docs/rules/no-weak-collections.md) | classic-es5 | platform `WeakMap` / `WeakSet` |
| [`no-weak-references`](docs/rules/no-weak-references.md) | recommended | platform `WeakRef` / `FinalizationRegistry` (all instance modes) |
| [`no-async-iterators`](docs/rules/no-async-iterators.md) | recommended | `for await…of`, async generators (all instance modes) |
| [`no-typed-arrays`](docs/rules/no-typed-arrays.md) | classic-es5 | TypedArray constructors; BigInt64Array also in ES2021 |
| [`no-proxy`](docs/rules/no-proxy.md) | classic-es5 | platform `Proxy` |
| [`no-unsupported-syntax`](docs/rules/no-unsupported-syntax.md) | classic-es5 | `?.`, `??`, `||=`, private instance members, lookbehind |

### Fluent (`.now.ts`)

| Rule | Preset | Fix | What it catches |
| --- | --- | --- | --- |
| [`fluent-proper-imports`](docs/rules/fluent-proper-imports.md) | recommended | | imports that do not match the versioned SDK manifest |
| [`fluent-directives`](docs/rules/fluent-directives.md) | recommended | | `@fluent-ignore`, `@fluent-disable-sync`, `@fluent-disable-sync-for-file` |
| [`prefer-now-include`](docs/rules/prefer-now-include.md) | strict | | large inline `script` / HTML / CSS |
| [`require-fluent-id`](docs/rules/require-fluent-id.md) | recommended | | missing `$id` where the manifest requires it |
| [`fluent-naming-convention`](docs/rules/fluent-naming-convention.md) | strict | | file / `Now.ID` / table export names |
| [`no-complex-fluent-logic`](docs/rules/no-complex-fluent-logic.md) | policy | | loops, classes, try/catch in metadata |

---

## Examples

### Classic Business Rule — bad

```js
var assignmentGroup = "97c04b3b1b12100043ab85e5bd0713e2";
current.assignment_group = assignmentGroup;
current.u_opened = gs.now();
current.update();
```

```
error  servicenow/no-hardcoded-sysid     Hardcoded sys_id '97c04b3b…'
error  servicenow/no-gs-now              gs.now() is timezone-unsafe
error  servicenow/no-br-current-update   current.update() retriggers other rules
```

### Classic Business Rule — good

```js
current.assignment_group = gs.getProperty("x_acme.default_assignment_group");
current.u_opened = new GlideDateTime();
current.work_notes = "Assigned by default routing";
```

### Fluent — bad

```ts
import { BusinessRule } from "@servicenow/sdk";

BusinessRule({
  table: "incident",
  name: "Log state",
  script: `
    (function executeRule(current) {
      var gr = new GlideRecord("sys_journal_field");
      // …dozens of lines of logic…
    })(current);
  `,
});
```

### Fluent — good

```ts
import { BusinessRule } from "@servicenow/sdk/core";
import { logStateChange } from "../server/log-state-change";

BusinessRule({
  $id: Now.ID["log-state-change"],
  table: "incident",
  name: "Log state change",
  when: "after",
  action: ["update"],
  script: logStateChange,
});
```

Or, for a raw script file:

```ts
script: Now.include("../server/log-state-change.server.js"),
```

---

## Migration from ESLint ServiceNow plugins

| Old (`eslint-plugin-servicenow` / `eslint-plugin-sn`) | New |
| --- | --- |
| `servicenow/no-hardcoded-sysids` | `servicenow/no-hardcoded-sysid` |
| `servicenow/no-promise` | `servicenow/no-promise` |
| `servicenow/no-async-await` | `servicenow/no-async-await` |
| `servicenow/no-bigint-and-dataview` | `servicenow/no-bigint` + `servicenow/no-typed-arrays` |
| `sn/no-gs-now` | `servicenow/no-gs-now` |
| `sn/no-client-gliderecord` | `servicenow/no-client-gliderecord` |
| `sn/no-gr-count-iterate` | `servicenow/prefer-glideaggregate` |
| `sn/validate-gliderecord-calls` | `servicenow/require-query-before-next` |
| `sn/no-br-current-update` | `servicenow/no-br-current-update` |
| `servicenow/no-at-method` | `servicenow/no-at-method` |
| `servicenow/no-packages-calls` | `servicenow/no-packages-calls` |
| `servicenow/no-weak-references` | `servicenow/no-weak-references` + `servicenow/no-weak-collections` |
| `servicenow/no-proxy-internal-calls` | `servicenow/no-proxy` |
| `servicenow/no-regexp-lookbehind` / `no-private-class-methods` | `servicenow/no-unsupported-syntax` |
| *(none)* | `servicenow/no-sync-glideajax` |
| *(none)* | `servicenow/fluent-*` and `prefer-now-include` |

1. Install `oxc-plugin-servicenow` + `oxlint`.
2. Drop in `.oxlintrc.json` with the recommended rule map.
3. Optionally keep ESLint around for rules oxlint does not implement yet (`eslint-plugin-oxlint` to disable overlap).
4. Replace Prettier with oxfmt using the shipped preset.
5. Delete `eslint-plugin-servicenow` / `eslint-plugin-sn` once the diagnostics match.

---

## Official docs

- [ServiceNow Fluent](https://servicenow.github.io/sdk/guides/fluent-overview)
- [ServiceNow SDK 3.0 / `Now.include`](https://www.servicenow.com/community/servicenow-ide-sdk-and-fluent/announcing-servicenow-sdk-3-0/ta-p/3216612)
- [JavaScript modes](https://www.servicenow.com/docs/r/xanadu/api-reference/scripts/c_JS_modes.html)
- [JavaScript engine feature support (Zurich)](https://www.servicenow.com/docs/r/zurich/api-reference/scripts/javascript-engine-feature-support.html)
- [Avoid `current.update()` in Business Rules (KB0715782)](https://support.servicenow.com/kb?id=kb_article_view&sysparm_article=KB0715782)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
- [oxfmt configuration](https://oxc.rs/docs/guide/usage/formatter/config.html)

---

## Current oxlint JS plugin limitations

These are platform limits, not bugs in this package:

- JS plugins are **alpha** and the API may still move.
- No type-aware rules (Fluent `Table` generics are not inspected).
- No custom parsers — `.now.ts` is linted as TypeScript, which is what we want.
- Rule options / suggestions / tokens are supported; some older ESLint APIs are not.
- Prefer `createOnce` + `before()` (this plugin does) so oxlint can skip files whose node types the rule never visits.

---

## Migrating to 2.0.0

2.0.0 is a major release because presets and settings change behavior.

1. Replace `settings.servicenow.ecmaLatest` with `javascriptMode`.
2. Replace `settings.servicenow.scriptType` with `authoring` and `surfaces`.
3. Remove ES5-only rules from a context-neutral `recommended` map. Add `configs.classicEs5Rules` where the app is Compatibility or ES5.
4. Replace `validate-gliderecord-calls` with `require-query-before-next`.
5. Do not expect autofixes from `no-gs-now`, `prefer-glideaggregate`, `no-at-method`, `no-weak-references`, or `fluent-proper-imports`.
6. Treat unknown mode as unknown. Valid ES2021 code must not be rejected unless you opt into `classic-es5`.

## Tested compatibility

| Component | Tested range |
| --- | --- |
| Node | 20 and 22 (CI) |
| oxlint | 1.79.x (`>=1.79.0 <2`) |
| ESLint | 10.x (`>=9`) |
| oxfmt | optional peer `>=0.16.0` |
| ServiceNow engine tables | Zurich feature-support document |
| Fluent directives | Official Fluent API reference (Australia) |

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
npm run docs
npm run manifest:check
```

Rules live in `src/rules/`. Each rule has:

- `createOnce` (with `before()` to skip irrelevant files)
- `meta.docs` / `meta.messages`
- unit tests under `tests/rules/`

Use `getScriptContext` and `analyzeProvenance`. Do not match platform APIs by name alone.

Autofixes require proof that the rewrite preserves semantics, plus exact output, syntax-validity, idempotence, and comment-preservation tests. Otherwise emit a diagnostic only.

The test harness walks an [oxc-parser](https://www.npmjs.com/package/oxc-parser) ESTree AST. CI also runs the built plugin under real oxlint and ESLint.

## License

MIT
