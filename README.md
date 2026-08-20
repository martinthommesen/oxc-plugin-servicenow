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
    "servicenow/no-delete-multiple-with-windowing": "error",
    "servicenow/require-callback-for-getreference": "error",
    "servicenow/require-glideajax-sysparm-name": "error",
    "servicenow/validate-glideaggregate-calls": "error",
    "servicenow/no-now-id-as-reference": "error",
    "servicenow/no-glideajax-getanswer": "error",
    "servicenow/no-duplicate-fluent-id": "error",
    "servicenow/no-glideelement-in-collection": "error",
    "servicenow/no-gliderecord-query-modifier-after-query": "error",
    "servicenow/require-business-rule-wrapper": "error",
    "servicenow/no-unfiltered-gliderecord-bulk-operation": "warn",
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
| `configs.securityRules` | Opt-in privilege-sensitive review rules such as `no-system-query-bypass`. |

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

<!-- generated:classic-rules:start -->
| Rule | Preset | Fix | What it catches |
| --- | --- | --- | --- |
| [`no-hardcoded-sysid`](docs/rules/no-hardcoded-sysid.md) | recommended |  | Hardcoded 32-character sys_ids break when an app is installed on another instance |
| [`prefer-glideaggregate`](docs/rules/prefer-glideaggregate.md) | strict |  | `GlideRecord.getRowCount()` (and iterate-to-count loops) load every matching row |
| [`no-client-gliderecord`](docs/rules/no-client-gliderecord.md) | recommended |  | Client-side GlideRecord is slow, often blocked, and a security smell |
| [`no-gs-now`](docs/rules/no-gs-now.md) | recommended |  | `gs.now()` and `gs.nowDateTime()` return timezone-sensitive display strings |
| [`require-query-before-next`](docs/rules/require-query-before-next.md) | recommended |  | Require a proven GlideRecord binding to call `.query()` or `.get()` before `.next()` |
| [`validate-gliderecord-calls`](docs/rules/validate-gliderecord-calls.md) | off |  | Deprecated alias |
| [`no-br-current-update`](docs/rules/no-br-current-update.md) | recommended |  | `current.update()` retriggers other Business Rules and can recurse |
| [`no-hardcoded-table-names`](docs/rules/no-hardcoded-table-names.md) | policy |  | Optional organizational policy |
| [`no-packages-calls`](docs/rules/no-packages-calls.md) | recommended |  | The Rhino `Packages.*` Java bridge is unavailable in scoped apps and on the modern engine |
| [`no-delete-multiple-with-windowing`](docs/rules/no-delete-multiple-with-windowing.md) | recommended |  | `setLimit()` and `chooseWindow()` do not limit `deleteMultiple()` |
| [`require-callback-for-getreference`](docs/rules/require-callback-for-getreference.md) | recommended |  | `g_form.getReference(field)` without a callback is a synchronous server request |
| [`require-glideajax-sysparm-name`](docs/rules/require-glideajax-sysparm-name.md) | recommended |  | GlideAjax requires a non-empty `addParam("sysparm_name", method)` before `getXML` / `getXMLAnswer` / `getXMLWait` |
| [`validate-glideaggregate-calls`](docs/rules/validate-glideaggregate-calls.md) | recommended |  | A proven GlideAggregate must call `query()` before `next()` or `getAggregate()` |
| [`no-glideajax-getanswer`](docs/rules/no-glideajax-getanswer.md) | recommended |  | `getAnswer()` belongs to synchronous GlideAjax |
| [`no-glideelement-in-collection`](docs/rules/no-glideelement-in-collection.md) | recommended |  | Direct GlideRecord field access is a GlideElement tied to the cursor |
| [`no-gliderecord-query-modifier-after-query`](docs/rules/no-gliderecord-query-modifier-after-query.md) | recommended |  | Filters and result-shaping calls after `query()` do not change the open cursor |
| [`require-business-rule-wrapper`](docs/rules/require-business-rule-wrapper.md) | recommended |  | Full-script Business Rules must wrap logic in the standard IIFE so top-level variables do not leak |
| [`no-display-value-date-comparison`](docs/rules/no-display-value-date-comparison.md) | strict |  | Do not relationally compare `GlideDateTime.getDisplayValue()` strings |
| [`no-unfiltered-gliderecord-bulk-operation`](docs/rules/no-unfiltered-gliderecord-bulk-operation.md) | recommended |  | `updateMultiple()` / `deleteMultiple()` without a proven restricting filter can touch every row |
| [`no-gliderecord-query-in-loop`](docs/rules/no-gliderecord-query-in-loop.md) | strict |  | A `query()`, `get()`, or `getAsync()` inside a proven GlideRecord / GlideAggregate `.next()` loop is an N+1 pattern |
| [`prefer-setnocount-with-choosewindow`](docs/rules/prefer-setnocount-with-choosewindow.md) | strict |  | Zurich scoped GlideRecord documents that `query()` after `chooseWindow()` runs `COUNT(*)` unless `setNoCount()` or `setLimit()` skips it |
| [`no-system-query-bypass`](docs/rules/no-system-query-bypass.md) | security |  | Opt-in security review for documented ACL-bypass query APIs: `addSystemQuery`, `addSystemEncodedQuery`, `addSystemOrderBy`, `addSystemOrderByDesc` |
| [`no-sync-glideajax`](docs/rules/no-sync-glideajax.md) | recommended |  | `getXMLWait()` blocks the browser and does not work in Service Portal |
<!-- generated:classic-rules:end -->

### Instance engine (mode-specific)

These rules run only when `javascriptMode` is known, except features that ServiceNow documents as disallowed in every instance mode.

<!-- generated:engine-rules:start -->
| Rule | Preset | What it catches |
| --- | --- | --- |
| [`no-promise`](docs/rules/no-promise.md) | classic-es5 | Compatibility and ES5 Standards modes do not implement Promises |
| [`no-async-await`](docs/rules/no-async-await.md) | classic-es5 | async/await is not implemented in Compatibility or ES5 Standards mode |
| [`no-bigint`](docs/rules/no-bigint.md) | classic-es5 | BigInt literals and `BigInt()` are unsupported in Compatibility or ES5 Standards mode |
| [`no-at-method`](docs/rules/no-at-method.md) | classic-es5 | `.at()` is not implemented in Compatibility or ES5 Standards mode |
| [`no-weak-references`](docs/rules/no-weak-references.md) | recommended | WeakRef and FinalizationRegistry are disallowed in every instance JavaScript mode, including ES2021 |
| [`no-weak-collections`](docs/rules/no-weak-collections.md) | classic-es5 | WeakMap and WeakSet are disallowed in Compatibility and ES5 Standards mode |
| [`no-typed-arrays`](docs/rules/no-typed-arrays.md) | classic-es5 | TypedArray and DataView constructors are unsupported in Compatibility and ES5 Standards mode |
| [`no-proxy`](docs/rules/no-proxy.md) | classic-es5 | `Proxy` is unsupported in Compatibility and ES5 Standards mode |
| [`no-unsupported-syntax`](docs/rules/no-unsupported-syntax.md) | classic-es5 | Optional chaining, nullish coalescing, logical assignment, private instance members, and RegExp lookbehind are unsupported in Compatibility and ES5 Standards mode |
| [`no-async-iterators`](docs/rules/no-async-iterators.md) | recommended | `for await…of` and async generators are disallowed in every instance JavaScript mode, including ES2021 |
<!-- generated:engine-rules:end -->

### Fluent (`.now.ts`)

<!-- generated:fluent-rules:start -->
| Rule | Preset | Fix | What it catches |
| --- | --- | --- | --- |
| [`fluent-proper-imports`](docs/rules/fluent-proper-imports.md) | recommended |  | Fluent entity and column APIs must be imported from `@servicenow/sdk/core` |
| [`fluent-directives`](docs/rules/fluent-directives.md) | recommended |  | Validate `@fluent-ignore`, `@fluent-disable-sync`, and `@fluent-disable-sync-for-file`, catch typos, and reject `@ts-ignore` as a Fluent suppress |
| [`prefer-now-include`](docs/rules/prefer-now-include.md) | strict |  | Large inline `script` / HTML / CSS payloads belong in their own file and should be loaded with `Now.include()` |
| [`require-fluent-id`](docs/rules/require-fluent-id.md) | recommended |  | Fluent entities must declare `$id` |
| [`fluent-naming-convention`](docs/rules/fluent-naming-convention.md) | strict |  | `.now.ts` files and `Now.ID` keys should be kebab-case |
| [`no-complex-fluent-logic`](docs/rules/no-complex-fluent-logic.md) | policy |  | Optional architectural policy |
| [`no-now-id-as-reference`](docs/rules/no-now-id-as-reference.md) | recommended |  | `Now.ID[...]` is a metadata identity, not a reference |
| [`no-duplicate-fluent-id`](docs/rules/no-duplicate-fluent-id.md) | recommended |  | Two Fluent definitions that share the same static `Now.ID` key as `$id` collide |
<!-- generated:fluent-rules:end -->

---

## Examples

Runnable profile projects live under [`examples/`](examples/README.md):

| Project | Context |
| --- | --- |
| [classic-compatibility](examples/classic-compatibility/) | Compatibility-mode server scripts |
| [classic-es5](examples/classic-es5/) | ES5 Standards server scripts |
| [es2021](examples/es2021/) | ES2021 server scripts |
| [client](examples/client/) | Client Scripts and Catalog Client Scripts |
| [business-rule](examples/business-rule/) | Full-script Business Rules |
| [ui-action](examples/ui-action/) | Client, server, and mixed UI Actions |
| [fluent](examples/fluent/) | Fluent `.now.ts` metadata |
| [mixed](examples/mixed/) | One repository with several surfaces |

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
npm run validate
```

`npm run validate` runs typecheck, build, tests, generated-doc consistency, and the Fluent manifest check. Tests include oxlint, ESLint, oxfmt, profile fixtures, and a packed-package consumer.

See [Contributing](CONTRIBUTING.md), [Write a ServiceNow lint rule](docs/rule-authoring.md), [Compatibility](docs/compatibility.md), and [Non-goals](docs/non-goals.md).

Rules live in `src/rules/`. Each rule has:

- `createOnce` (with `before()` to skip irrelevant files)
- `meta.docs` / `meta.messages`
- unit tests under `tests/rules/`

Use `getScriptContext` and `analyzeProvenance`. Do not match platform APIs by name alone.

Autofixes require proof that the rewrite preserves semantics, plus exact output, syntax-validity, idempotence, and comment-preservation tests. Otherwise emit a diagnostic only.

The test harness walks an [oxc-parser](https://www.npmjs.com/package/oxc-parser) ESTree AST. CI also runs the built plugin under real oxlint and ESLint.

## License

MIT
