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

Classic scripts still run on a **restricted engine**. Promises, `async/await`, BigInt, `.at()`, `WeakMap`, and `Packages.*` are either missing or dangerous. `current.update()` in a Business Rule retriggers the rule engine. Client-side `GlideRecord` is slow and often blocked. Hardcoded sys_ids rot the moment the app is installed on another instance.

Existing ESLint plugins (`eslint-plugin-servicenow`, `eslint-plugin-sn`) cover parts of the classic world and nothing of Fluent. This package covers both, on the Oxc toolchain.

---

## Quick start — oxlint

### `.oxlintrc.json`

```jsonc
{
  "jsPlugins": [
    { "name": "servicenow", "specifier": "oxc-plugin-servicenow" }
  ],
  "rules": {
    "servicenow/no-hardcoded-sysid": "error",
    "servicenow/no-promise": "error",
    "servicenow/no-async-await": "error",
    "servicenow/no-bigint": "error",
    "servicenow/prefer-glideaggregate": "warn",
    "servicenow/no-client-gliderecord": "error",
    "servicenow/no-gs-now": "error",
    "servicenow/validate-gliderecord-calls": "warn",
    "servicenow/no-br-current-update": "error",
    "servicenow/fluent-proper-imports": "error",
    "servicenow/fluent-directives": "warn",
    "servicenow/prefer-now-include": "warn",
    "servicenow/require-fluent-id": "error",
    "servicenow/fluent-naming-convention": "warn",
    "servicenow/no-complex-fluent-logic": "warn",
    "servicenow/no-at-method": "warn",
    "servicenow/no-packages-calls": "error",
    "servicenow/no-typed-arrays": "error",
    "servicenow/no-proxy": "error",
    "servicenow/no-unsupported-syntax": "error",
    "servicenow/no-sync-glideajax": "error"
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

### Recommended vs strict

| Preset | Intent |
| --- | --- |
| `configs.recommendedRules` | High-signal rules. Safe to turn on for an existing app. |
| `configs.strictRules` | Recommended + `no-hardcoded-table-names`, weak-refs, async iterators, and several warns promoted to errors. |

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

To run these rules on server TypeScript (`src/server/**/*.ts`), add a `files` override. Those files usually also need `settings.servicenow.ecmaLatest` or `// @sn-es-latest`.

---

## Settings

Configure once. Every rule reads `settings.servicenow`.

```jsonc
{
  "settings": {
    "servicenow": {
      "allowedSysIds": ["97c04b3b1b12100043ab85e5bd0713e2"],
      "allowedTables": ["x_acme_widget"],
      "scriptType": "auto",
      "ecmaLatest": false,
      "scopePrefix": "x_acme"
    }
  }
}
```

| Field | Meaning |
| --- | --- |
| `allowedSysIds` | sys_ids that `no-hardcoded-sysid` will ignore |
| `allowedTables` | table names that `no-hardcoded-table-names` will ignore |
| `scriptType` | `"auto"` (default) or force `client` / `server` / `business-rule` / `script-include` / `ui-action` / `fluent` |
| `ecmaLatest` | skip classic-engine bans (`no-promise`, `no-async-await`, …) |
| `scopePrefix` | e.g. `x_acme` — used by the Fluent naming rule |

Per-file escape hatch for modern server modules:

```js
// @sn-es-latest
const result = await other();
```

Fluent `.now.ts` files skip engine bans automatically.

---

## Rules

### Classic ServiceNow

| Rule | Preset | Fix | What it catches |
| --- | --- | --- | --- |
| [`no-hardcoded-sysid`](docs/rules/no-hardcoded-sysid.md) | recommended | | 32-char hex sys_ids |
| [`prefer-glideaggregate`](docs/rules/prefer-glideaggregate.md) | recommended | suggest | `getRowCount()` / iterate-to-count |
| [`no-client-gliderecord`](docs/rules/no-client-gliderecord.md) | recommended | | `GlideRecord` in client scripts |
| [`no-gs-now`](docs/rules/no-gs-now.md) | recommended | suggest | `gs.now()` / `gs.nowDateTime()` |
| [`validate-gliderecord-calls`](docs/rules/validate-gliderecord-calls.md) | recommended | | `.next()` without `.query()`, ignored return values |
| [`no-br-current-update`](docs/rules/no-br-current-update.md) | recommended | | `current.update()` |
| [`no-hardcoded-table-names`](docs/rules/no-hardcoded-table-names.md) | strict | | string-literal table names |
| [`no-packages-calls`](docs/rules/no-packages-calls.md) | recommended | | `Packages.*` Java bridge |
| [`no-sync-glideajax`](docs/rules/no-sync-glideajax.md) | recommended | | `GlideAjax.getXMLWait()` |

### Classic engine (Rhino / ES5)

| Rule | Preset | Fix | What it catches |
| --- | --- | --- | --- |
| [`no-promise`](docs/rules/no-promise.md) | recommended | | `new Promise`, `Promise.*`, `.then` |
| [`no-async-await`](docs/rules/no-async-await.md) | recommended | | `async` / `await` |
| [`no-bigint`](docs/rules/no-bigint.md) | recommended | | `10n`, `BigInt()` |
| [`no-at-method`](docs/rules/no-at-method.md) | recommended | suggest | `.at()` |
| [`no-weak-references`](docs/rules/no-weak-references.md) | strict | | `WeakMap` / `WeakSet` / `WeakRef` |
| [`no-async-iterators`](docs/rules/no-async-iterators.md) | strict | | `for await…of`, async generators |
| [`no-typed-arrays`](docs/rules/no-typed-arrays.md) | recommended | | `Int8Array`, `DataView`, … |
| [`no-proxy`](docs/rules/no-proxy.md) | recommended | | `new Proxy`, `Proxy.revocable` |
| [`no-unsupported-syntax`](docs/rules/no-unsupported-syntax.md) | recommended | | `?.`, `??`, `||=`, `#private`, lookbehind |

### Fluent (`.now.ts`)

| Rule | Preset | Fix | What it catches |
| --- | --- | --- | --- |
| [`fluent-proper-imports`](docs/rules/fluent-proper-imports.md) | recommended | fix | imports not from `@servicenow/sdk/core` |
| [`fluent-directives`](docs/rules/fluent-directives.md) | recommended | | `@fluent-ignore` / `@fluent-disable-sync` typos |
| [`prefer-now-include`](docs/rules/prefer-now-include.md) | recommended | | large inline `script` / HTML / CSS |
| [`require-fluent-id`](docs/rules/require-fluent-id.md) | recommended | | missing `$id`, raw sys_id `$id` |
| [`fluent-naming-convention`](docs/rules/fluent-naming-convention.md) | recommended | | file / `Now.ID` / table export names |
| [`no-complex-fluent-logic`](docs/rules/no-complex-fluent-logic.md) | recommended | | loops, classes, try/catch in metadata |

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
| `sn/validate-gliderecord-calls` | `servicenow/validate-gliderecord-calls` |
| `sn/no-br-current-update` | `servicenow/no-br-current-update` |
| `servicenow/no-at-method` | `servicenow/no-at-method` |
| `servicenow/no-packages-calls` | `servicenow/no-packages-calls` |
| `servicenow/no-weak-references` | `servicenow/no-weak-references` |
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
- [JavaScript engine feature support](https://docs.servicenow.com/bundle/utah-api-reference/page/script/JavaScript-engine-upgrade/reference/javascript-engine-feature-support.html)
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

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
```

Rules live in `src/rules/`. Each rule has:

- `createOnce` (with `before()` to skip irrelevant files)
- `meta.docs` / `meta.messages`
- unit tests under `tests/rules/`

The test harness walks an [oxc-parser](https://www.npmjs.com/package/oxc-parser) ESTree AST so CI does not need the oxlint native binary.

## License

MIT
