# oxc-plugin-servicenow

First-class **[oxlint](https://oxc.rs/docs/guide/usage/linter.html)** + **[oxfmt](https://oxc.rs/docs/guide/usage/formatter.html)** tooling for:

1. **ServiceNow Fluent** — TypeScript DSL in `.now.ts` files, powered by [`@servicenow/sdk`](https://servicenow.github.io/sdk/guides/fluent-overview)
2. **Classic ServiceNow JavaScript** — Business Rules, Client Scripts, Script Includes, UI Actions, and everything else still running on the restricted platform engine

The plugin is written against the official [`@oxlint/plugins`](https://www.npmjs.com/package/@oxlint/plugins) API (`definePlugin` + `defineRule` + `createOnce`) and is wrapped with `eslintCompatPlugin`, so the same package works in **oxlint** and **ESLint 9+**.

```bash
npm install -D oxc-plugin-servicenow oxlint oxfmt
```

## Supported package entry points

| Entry point | Supported exports |
| --- | --- |
| `oxc-plugin-servicenow` | Default plugin, `plugin`, `configs`, and the `ServiceNowSettings`, `RuleConfigMap`, and `RuleName` types. |
| `oxc-plugin-servicenow/analysis` | `analyzeProvenance`, `getScriptContext`, and their read-only public types. |
| `oxc-plugin-servicenow/oxfmt` | The TypeScript oxfmt configuration exports. |
| `oxc-plugin-servicenow/oxfmt.recommended.json` | The JSON oxfmt preset. |
| `oxc-plugin-servicenow/package.json` | Package metadata through Node package exports. |

Other source and `dist` paths are internal. Do not import them.

`analyzeProvenance(context, ast?)` analyzes `context.sourceCode.ast` by default. Pass an explicit AST only when its nodes are the ones you will query. Explicit trees are cached independently and use their own lexical bindings rather than borrowing the host parser's scope graph.

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
| `configs.es2021Rules` | Features still unavailable after ES2021, including universal restrictions and release-dependent BigInt typed-array support. |
| `configs.clientRules` | Client-side API rules. |
| `configs.aclRules` | ACL-specific review rules. |
| `configs.businessRuleRules` | Business Rule rules. |
| `configs.fluentRules` | Fluent `.now.ts` metadata rules. |
| `configs.strictRules` | Recommended plus warn-level performance and naming guidance. Does not promote heuristics to errors. |
| `configs.policyRules` | Optional organizational and migration policy (`no-hardcoded-table-names`, `no-complex-fluent-logic`, `no-packages-calls`). |
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
| `**/*.{server,client,br,si,acl}.js`, `**/*.ui-action.js`, `src/{server,client}/**`, ACL directories | Classic Studio style — double quotes, no trailing commas, width 120. Includes compound `.client.ui-action.js` and `.server.ui-action.js` suffixes. |
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

`configs.flat.client` selects client-script filenames and supplies the client surface, but deliberately does not guess application scope. Merge `settings.servicenow.scope: "scoped"` when using it for a scoped application; `no-client-gliderecord` stays silent for global or unknown scope because ServiceNow still documents the global client API.

`configs.flat.acl` selects boundary-delimited ACL and access-control export names plus ACL directories, then supplies the ACL surface. Its advisory query rule is also available in strict and security; recommended remains unchanged.

oxlint parses TypeScript itself. ESLint uses its default JS parser, so type annotations (`import type`, `: string`) in `.now.ts` fail to parse when you use only `plugin.configs.flat.recommended`.

For typed Fluent files, compose the recommended (or strict) preset with a TypeScript parser. This package tests [`typescript-eslint`](https://typescript-eslint.io/getting-started/) `8.x` with ESLint 9. `typescript-eslint` 8 does not accept ESLint 10 as a peer. Type-aware linting is not required.

```js
// eslint.config.js — typed Fluent composition
import servicenow from "oxc-plugin-servicenow";
import tseslint from "typescript-eslint";

export default [
  {
    files: ["**/*.now.ts", "**/*.now.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        sourceType: "module",
        ecmaVersion: "latest",
      },
    },
  },
  servicenow.configs.flat.recommended,
];
```

Ordinary TypeScript outside `*.now.ts` / `*.now.tsx` stays unaffected unless you add those files to the config yourself.

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
      "release": "australia",
      "fluentSdkVersion": "4.4.1",
      "businessRuleSourceFormat": "full-script"
    }
  }
}
```

| Field | Meaning |
| --- | --- |
| `javascriptMode` | `compatibility`, `es5`, `es2021`, or `unknown` (default) |
| `authoring` | `classic`, `fluent`, or `auto` |
| `surfaces` | `auto` or a non-empty array. Supports `acl` for Access Control scripts. Mixed UI Actions must omit deprecated `scriptType` and use values such as `["ui-action","client","server"]`. |
| `scope` | `global`, `scoped`, or `unknown` |
| `scopePrefix` | Application scope prefix such as `x_acme` |
| `allowedSysIds` | 32-character lowercase sys_ids that `no-hardcoded-sysid` ignores |
| `allowedTables` | Table names that `no-hardcoded-table-names` ignores |
| `release` | Optional release selector: `"zurich"` or `"australia"`. Omission uses only facts shared by every supported release. |
| `fluentSdkVersion` | Fluent SDK semver the manifest should evaluate. This is independent from the instance `release`. |
| `businessRuleSourceFormat` | `full-script`, `body-only`, or `unknown` |
| `scriptType` | **Deprecated.** Use `authoring` and `surfaces`. |
| `ecmaLatest` | **Deprecated.** `true` maps to `javascriptMode: "es2021"`. `false` does not assume ES5. |

Australia support is release-aware rather than a renamed Zurich default:

| Engine capability | Zurich ES2021 | Australia ES2021 | ES5 Standards |
| --- | --- | --- | --- |
| `Object.hasOwn()` | Not Supported | Supported | Not Supported |
| `BigInt64Array` / `BigUint64Array` | Not Supported | Supported | Not Supported |
| `TypedArray.from()` / `TypedArray.of()` | Not Supported | Supported | Typed arrays Disallowed |
| `BigInt.asUintN()` / `BigInt.asIntN()` narrowing | Incorrect edge cases | Corrected | BigInt Not Supported |
| Private instance members | Not Supported | Not Supported | Not Supported |
| `DataView` BigInt getters | Not Supported | Not Supported | Not Supported |
| `Function.prototype.toString()` source text for methods and computed property names | Disallowed | Supported | Disallowed |

ServiceNow publishes feature-table columns for ES2021 and ES5 Standards, while documenting Compatibility as a distinct third mode. The plugin deliberately applies each feature-table ES5 cell to Compatibility mode as package policy; capability metadata marks those inferred cells separately from official table cells. Update-ledger entries explicitly marked for all modes, such as Australia's variable-length Date fractions, are modeled directly for Compatibility instead of using that inference. “Not Supported” retains ServiceNow's precise meaning: the feature has not been validated for that release and mode, unlike “Disallowed,” which produces a platform error.

The narrow `Function.prototype.toString()` delta is recorded as compatibility knowledge but has no lint diagnostic: static analysis cannot prove that code depends on exact returned method source text without unacceptable false positives. `no-incorrect-bigint-asuintn` is intentionally narrower: it reports only literal negative-input calls where the pre-Australia and specified unsigned results are provably different. ServiceNow's unversioned Australia reference URLs were reviewed with the official `Australia` release label and March 12, 2026 update date; those source markers are pinned beside the capability tables so a later default-documentation change cannot silently relabel the review. Australia release notes identify the SDK 4.4 family. The plugin keeps `fluentSdkVersion` independent so users can select a reviewed declaration manifest; that setting does not assert that an SDK version is compatible with a particular instance.

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
      settings: { servicenow: { surfaces: ["client"], scope: "scoped" } },
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
| [`no-hardcoded-sysid`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/no-hardcoded-sysid.md) | recommended |  | Hardcoded 32-character sys_ids break when an app is installed on another instance |
| [`prefer-glideaggregate`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/prefer-glideaggregate.md) | strict |  | `GlideRecord.getRowCount()` (and iterate-to-count loops) load every matching row |
| [`no-client-gliderecord`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/no-client-gliderecord.md) | recommended |  | Proven platform GlideRecord calls are unsupported in scoped client applications |
| [`no-gs-now`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/no-gs-now.md) | recommended |  | `gs.now()` and `gs.nowDateTime()` return timezone-sensitive display strings |
| [`require-query-before-next`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/require-query-before-next.md) | recommended |  | Require a documented, scope-supported GlideRecord query executor before `.next()` or `._next()` |
| [`validate-gliderecord-calls`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/validate-gliderecord-calls.md) | off |  | Deprecated alias |
| [`no-br-current-update`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/no-br-current-update.md) | recommended |  | `current.update()` retriggers other Business Rules and can recurse |
| [`no-hardcoded-table-names`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/no-hardcoded-table-names.md) | policy |  | Optional organizational policy |
| [`no-packages-calls`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/no-packages-calls.md) | policy |  | Optional migration policy |
| [`no-delete-multiple-with-windowing`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/no-delete-multiple-with-windowing.md) | recommended |  | `setLimit()` and `chooseWindow()` do not limit `deleteMultiple()` |
| [`require-callback-for-getreference`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/require-callback-for-getreference.md) | recommended |  | `g_form.getReference(field)` without a callback is a synchronous server request |
| [`require-glideajax-sysparm-name`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/require-glideajax-sysparm-name.md) | recommended |  | GlideAjax requires a non-empty `addParam("sysparm_name", method)` before `getXML` / `getXMLAnswer` / `getXMLWait` |
| [`validate-glideaggregate-calls`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/validate-glideaggregate-calls.md) | recommended |  | A proven GlideAggregate must call `query()` before `next()` or `getAggregate()` |
| [`no-glideajax-getanswer`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/no-glideajax-getanswer.md) | recommended |  | `getAnswer()` belongs to synchronous GlideAjax |
| [`no-glideelement-in-collection`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/no-glideelement-in-collection.md) | recommended |  | Direct GlideRecord field access and path-proven local aliases are GlideElements tied to the cursor |
| [`no-gliderecord-query-modifier-after-query`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/no-gliderecord-query-modifier-after-query.md) | recommended |  | Filters and result-shaping calls after a documented query executor do not change the open cursor |
| [`require-business-rule-wrapper`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/require-business-rule-wrapper.md) | recommended |  | Full-script Business Rules must wrap logic in the standard IIFE so top-level variables do not leak |
| [`no-display-value-date-comparison`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/no-display-value-date-comparison.md) | strict |  | Do not relationally compare `GlideDateTime.getDisplayValue()` strings |
| [`no-unfiltered-gliderecord-bulk-operation`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/no-unfiltered-gliderecord-bulk-operation.md) | recommended |  | `updateMultiple()` / `deleteMultiple()` without a proven restricting filter can touch every row |
| [`no-gliderecord-query-in-acl`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/no-gliderecord-query-in-acl.md) | strict |  | Review proven GlideRecord, GlideRecordSecure, and GlideAggregate query executions on an ACL's immediate evaluation path |
| [`no-gliderecord-query-in-loop`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/no-gliderecord-query-in-loop.md) | strict |  | A query inside a proven record cursor loop is an N+1 pattern |
| [`prefer-setnocount-with-choosewindow`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/prefer-setnocount-with-choosewindow.md) | strict |  | The reviewed Zurich and Australia-scoped GlideRecord references document that `query()` after `chooseWindow()` runs `COUNT(*)` unless `setNoCount()` or `setLimit()` skips it |
| [`no-system-query-bypass`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/no-system-query-bypass.md) | security |  | Opt-in security review for documented ACL-bypass query APIs |
| [`no-sync-glideajax`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/no-sync-glideajax.md) | recommended |  | `getXMLWait()` blocks the browser and does not work in Service Portal |
<!-- generated:classic-rules:end -->

### Instance engine (mode-specific)

These rules run only when `javascriptMode` is known, except features that ServiceNow documents as disallowed in every instance mode.

<!-- generated:engine-rules:start -->
| Rule | Preset | What it catches |
| --- | --- | --- |
| [`no-promise`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/no-promise.md) | classic-es5 | Compatibility and ES5 Standards modes do not implement Promises |
| [`no-async-await`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/no-async-await.md) | classic-es5 | async/await is not implemented in Compatibility or ES5 Standards mode |
| [`no-bigint`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/no-bigint.md) | classic-es5 | BigInt literals and `BigInt()` are unsupported in Compatibility or ES5 Standards mode |
| [`no-incorrect-bigint-asuintn`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/no-incorrect-bigint-asuintn.md) | es2021 | Zurich can return a negative input unchanged from BigInt.asUintN() when the requested width exceeds the input's signed byte representation; Australia corrects the ES2021 behavior |
| [`no-at-method`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/no-at-method.md) | classic-es5 | `.at()` is not implemented in Compatibility or ES5 Standards mode |
| [`no-weak-references`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/no-weak-references.md) | recommended | WeakRef and FinalizationRegistry are disallowed in every instance JavaScript mode, including ES2021 |
| [`no-map-set`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/no-map-set.md) | classic-es5 | ServiceNow supports Map and Set in ES2021 but not in Compatibility or ES5 Standards mode in either Zurich or Australia |
| [`no-weak-collections`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/no-weak-collections.md) | classic-es5 | WeakMap and WeakSet are disallowed in Compatibility and ES5 Standards mode |
| [`no-object-hasown`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/no-object-hasown.md) | classic-es5 | `Object.hasOwn()` is Not Supported in Zurich ES2021 and Australia ES5; Australia ES2021 Supports it |
| [`no-unsupported-date-fraction`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/no-unsupported-date-fraction.md) | classic-es5 | Australia adds variable-length ISO fractional-second parsing to all JavaScript modes, while Zurich accepts fractional seconds only when exactly three digits are present |
| [`no-unsupported-set-methods`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/no-unsupported-set-methods.md) | es2021 | Set.prototype.intersection(), union(), difference(), symmetricDifference(), isSubsetOf(), isSupersetOf(), and isDisjointFrom() are available in Australia ES2021 but not Zurich ES2021 |
| [`no-unsupported-static-methods`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/no-unsupported-static-methods.md) | es2021 | Error.isError(), Promise.try(), and Promise.withResolvers() are available in Australia ES2021 but not Zurich ES2021 |
| [`no-typed-arrays`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/no-typed-arrays.md) | classic-es5 | General TypedArray constructors and DataView construction are Disallowed by the ES5 cell, while BigInt64Array and BigUint64Array are Not Supported there |
| [`no-proxy`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/no-proxy.md) | classic-es5 | `Proxy` is unsupported in Compatibility and ES5 Standards mode |
| [`no-unsupported-syntax`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/no-unsupported-syntax.md) | classic-es5 | The ES5 table marks optional chaining, nullish coalescing, logical assignment, private members, and RegExp lookbehind Not Supported |
| [`no-async-iterators`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/no-async-iterators.md) | recommended | `for await…of` and async generators are disallowed in every instance JavaScript mode, including ES2021 |
<!-- generated:engine-rules:end -->

### Fluent (`.now.ts`)

<!-- generated:fluent-rules:start -->
| Rule | Preset | Fix | What it catches |
| --- | --- | --- | --- |
| [`fluent-proper-imports`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/fluent-proper-imports.md) | recommended |  | Fluent entity and column APIs must be imported from the module recorded in the selected SDK manifest |
| [`fluent-directives`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/fluent-directives.md) | recommended |  | Validate documented ServiceNow Fluent SDK directive names and placement |
| [`prefer-now-include`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/prefer-now-include.md) | strict |  | Large inline `script` / HTML / CSS payloads belong in their own file and should be loaded with `Now.include()` |
| [`require-fluent-id`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/require-fluent-id.md) | recommended |  | Fluent entities must declare `$id` when the selected SDK manifest marks the imported factory as requiring an id |
| [`fluent-naming-convention`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/fluent-naming-convention.md) | strict |  | `.now.ts` files and `Now.ID` keys should be kebab-case |
| [`no-complex-fluent-logic`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/no-complex-fluent-logic.md) | policy |  | Optional architectural policy |
| [`no-now-id-as-reference`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/no-now-id-as-reference.md) | recommended |  | `Now.ID[...]` is a metadata identity, not a reference |
| [`no-duplicate-fluent-id`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rules/no-duplicate-fluent-id.md) | recommended |  | Two Fluent definitions that share the same static `Now.ID` key as `$id` collide |
<!-- generated:fluent-rules:end -->

---

## Examples

Runnable profile projects live under [`examples/`][repository-examples]:

| Project | Context |
| --- | --- |
| [classic-compatibility][repository-example-classic-compatibility] | Compatibility-mode server scripts |
| [classic-es5][repository-example-classic-es5] | ES5 Standards server scripts |
| [es2021][repository-example-es2021] | ES2021 server scripts |
| [client][repository-example-client] | Client Scripts and Catalog Client Scripts |
| [business-rule][repository-example-business-rule] | Full-script Business Rules |
| [ui-action][repository-example-ui-action] | Client, server, and mixed UI Actions |
| [fluent][repository-example-fluent] | Fluent `.now.ts` metadata |
| [mixed][repository-example-mixed] | One repository with several surfaces |

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
- [ServiceNow SDK release notes (Australia)](https://www.servicenow.com/docs/r/release-notes/servicenow-sdk-rn.html)
- [JavaScript modes (Australia)](https://www.servicenow.com/docs/r/api-reference/scripts/c_JS_modes.html)
- [JavaScript engine feature support (Zurich)](https://www.servicenow.com/docs/r/zurich/api-reference/scripts/javascript-engine-feature-support.html)
- [JavaScript engine feature support (Australia)](https://www.servicenow.com/docs/r/api-reference/scripts/javascript-engine-feature-support.html)
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

<!-- generated:migration-1.1-to-2.0:start -->
| Rule | 1.1 preset | 1.1 | 2.0 | Replacement profile | Required action |
| --- | --- | --- | --- | --- | --- |
| `servicenow/fluent-naming-convention` | recommended | warn | off | configs.strictRules (warn) | Select configs.strictRules (warn). |
| `servicenow/no-async-await` | recommended | error | off | configs.classicEs5Rules (error) | Select configs.classicEs5Rules (error). |
| `servicenow/no-async-iterators` | recommended | off | error | configs.classicEs5Rules (error)<br>configs.es2021Rules (error) | Review the off-to-error severity change. |
| `servicenow/no-at-method` | recommended | warn | off | configs.classicEs5Rules (error) | Select configs.classicEs5Rules (error). |
| `servicenow/no-bigint` | recommended | error | off | configs.classicEs5Rules (error) | Select configs.classicEs5Rules (error). |
| `servicenow/no-complex-fluent-logic` | recommended | warn | off | configs.policyRules (warn) | Select configs.policyRules (warn). |
| `servicenow/no-delete-multiple-with-windowing` | recommended | off | error | configs.businessRuleRules (error) | Review the off-to-error severity change. |
| `servicenow/no-duplicate-fluent-id` | recommended | off | error | configs.fluentRules (error) | Review the off-to-error severity change. |
| `servicenow/no-glideajax-getanswer` | recommended | off | error | configs.clientRules (error) | Review the off-to-error severity change. |
| `servicenow/no-glideelement-in-collection` | recommended | off | error | configs.businessRuleRules (error) | Review the off-to-error severity change. |
| `servicenow/no-gliderecord-query-modifier-after-query` | recommended | off | error | configs.businessRuleRules (error) | Review the off-to-error severity change. |
| `servicenow/no-now-id-as-reference` | recommended | off | error | configs.fluentRules (error) | Review the off-to-error severity change. |
| `servicenow/no-packages-calls` | recommended | error | off | configs.policyRules (warn) | Select configs.policyRules (warn). |
| `servicenow/no-promise` | recommended | error | off | configs.classicEs5Rules (error) | Select configs.classicEs5Rules (error). |
| `servicenow/no-proxy` | recommended | error | off | configs.classicEs5Rules (error) | Select configs.classicEs5Rules (error). |
| `servicenow/no-typed-arrays` | recommended | error | off | configs.classicEs5Rules (error)<br>configs.es2021Rules (error) | Select configs.classicEs5Rules (error)<br>configs.es2021Rules (error). |
| `servicenow/no-unfiltered-gliderecord-bulk-operation` | recommended | off | warn | Enable the rule explicitly | Review the off-to-warn severity change. |
| `servicenow/no-unsupported-syntax` | recommended | error | off | configs.classicEs5Rules (error)<br>configs.es2021Rules (error) | Select configs.classicEs5Rules (error)<br>configs.es2021Rules (error). |
| `servicenow/no-weak-references` | recommended | off | error | configs.classicEs5Rules (error)<br>configs.es2021Rules (error) | Review the off-to-error severity change. |
| `servicenow/prefer-glideaggregate` | recommended | warn | off | configs.strictRules (warn) | Select configs.strictRules (warn). |
| `servicenow/prefer-now-include` | recommended | warn | off | configs.strictRules (warn) | Select configs.strictRules (warn). |
| `servicenow/require-business-rule-wrapper` | recommended | off | error | configs.businessRuleRules (error) | Review the off-to-error severity change. |
| `servicenow/require-callback-for-getreference` | recommended | off | error | configs.clientRules (error) | Review the off-to-error severity change. |
| `servicenow/require-glideajax-sysparm-name` | recommended | off | error | configs.clientRules (error) | Review the off-to-error severity change. |
| `servicenow/require-query-before-next` | recommended | off | error | configs.businessRuleRules (error) | Review the off-to-error severity change. |
| `servicenow/validate-glideaggregate-calls` | recommended | off | error | configs.businessRuleRules (error) | Review the off-to-error severity change. |
| `servicenow/validate-gliderecord-calls` | recommended | warn | off | Enable the rule explicitly | Replace it with `servicenow/require-query-before-next`. |
| `servicenow/fluent-directives` | strict | error | warn | configs.recommendedRules (warn)<br>configs.fluentRules (warn) | Review the error-to-warn severity change. |
| `servicenow/fluent-naming-convention` | strict | error | warn | Enable the rule explicitly | Review the error-to-warn severity change. |
| `servicenow/no-async-await` | strict | error | off | configs.classicEs5Rules (error) | Select configs.classicEs5Rules (error). |
| `servicenow/no-at-method` | strict | error | off | configs.classicEs5Rules (error) | Select configs.classicEs5Rules (error). |
| `servicenow/no-bigint` | strict | error | off | configs.classicEs5Rules (error) | Select configs.classicEs5Rules (error). |
| `servicenow/no-complex-fluent-logic` | strict | error | off | configs.policyRules (warn) | Select configs.policyRules (warn). |
| `servicenow/no-delete-multiple-with-windowing` | strict | off | error | configs.recommendedRules (error)<br>configs.businessRuleRules (error) | Review the off-to-error severity change. |
| `servicenow/no-display-value-date-comparison` | strict | off | warn | Enable the rule explicitly | Review the off-to-warn severity change. |
| `servicenow/no-duplicate-fluent-id` | strict | off | error | configs.recommendedRules (error)<br>configs.fluentRules (error) | Review the off-to-error severity change. |
| `servicenow/no-glideajax-getanswer` | strict | off | error | configs.recommendedRules (error)<br>configs.clientRules (error) | Review the off-to-error severity change. |
| `servicenow/no-glideelement-in-collection` | strict | off | error | configs.recommendedRules (error)<br>configs.businessRuleRules (error) | Review the off-to-error severity change. |
| `servicenow/no-gliderecord-query-in-acl` | strict | off | warn | configs.aclRules (warn)<br>configs.securityRules (warn) | Review the off-to-warn severity change. |
| `servicenow/no-gliderecord-query-in-loop` | strict | off | warn | Enable the rule explicitly | Review the off-to-warn severity change. |
| `servicenow/no-gliderecord-query-modifier-after-query` | strict | off | error | configs.recommendedRules (error)<br>configs.businessRuleRules (error) | Review the off-to-error severity change. |
| `servicenow/no-hardcoded-table-names` | strict | warn | off | configs.policyRules (warn) | Select configs.policyRules (warn). |
| `servicenow/no-now-id-as-reference` | strict | off | error | configs.recommendedRules (error)<br>configs.fluentRules (error) | Review the off-to-error severity change. |
| `servicenow/no-packages-calls` | strict | error | off | configs.policyRules (warn) | Select configs.policyRules (warn). |
| `servicenow/no-promise` | strict | error | off | configs.classicEs5Rules (error) | Select configs.classicEs5Rules (error). |
| `servicenow/no-proxy` | strict | error | off | configs.classicEs5Rules (error) | Select configs.classicEs5Rules (error). |
| `servicenow/no-typed-arrays` | strict | error | off | configs.classicEs5Rules (error)<br>configs.es2021Rules (error) | Select configs.classicEs5Rules (error)<br>configs.es2021Rules (error). |
| `servicenow/no-unfiltered-gliderecord-bulk-operation` | strict | off | warn | configs.recommendedRules (warn) | Review the off-to-warn severity change. |
| `servicenow/no-unsupported-syntax` | strict | error | off | configs.classicEs5Rules (error)<br>configs.es2021Rules (error) | Select configs.classicEs5Rules (error)<br>configs.es2021Rules (error). |
| `servicenow/prefer-glideaggregate` | strict | error | warn | Enable the rule explicitly | Review the error-to-warn severity change. |
| `servicenow/prefer-now-include` | strict | error | warn | Enable the rule explicitly | Review the error-to-warn severity change. |
| `servicenow/prefer-setnocount-with-choosewindow` | strict | off | warn | Enable the rule explicitly | Review the off-to-warn severity change. |
| `servicenow/require-business-rule-wrapper` | strict | off | error | configs.recommendedRules (error)<br>configs.businessRuleRules (error) | Review the off-to-error severity change. |
| `servicenow/require-callback-for-getreference` | strict | off | error | configs.recommendedRules (error)<br>configs.clientRules (error) | Review the off-to-error severity change. |
| `servicenow/require-glideajax-sysparm-name` | strict | off | error | configs.recommendedRules (error)<br>configs.clientRules (error) | Review the off-to-error severity change. |
| `servicenow/require-query-before-next` | strict | off | error | configs.recommendedRules (error)<br>configs.businessRuleRules (error) | Review the off-to-error severity change. |
| `servicenow/validate-glideaggregate-calls` | strict | off | error | configs.recommendedRules (error)<br>configs.businessRuleRules (error) | Review the off-to-error severity change. |
| `servicenow/validate-gliderecord-calls` | strict | error | off | Enable the rule explicitly | Replace it with `servicenow/require-query-before-next`. |
<!-- generated:migration-1.1-to-2.0:end -->

1. Replace `settings.servicenow.ecmaLatest` with `javascriptMode`.
2. Replace `settings.servicenow.scriptType` with `authoring` and `surfaces`.
3. Remove ES5-only rules from a context-neutral `recommended` map. Add `configs.classicEs5Rules` where the app is Compatibility or ES5.
4. Replace `validate-gliderecord-calls` with `require-query-before-next`.
5. Do not expect autofixes from `no-gs-now`, `prefer-glideaggregate`, `no-at-method`, `no-weak-references`, or `fluent-proper-imports`.
6. Treat unknown mode as unknown. Valid ES2021 code must not be rejected unless you opt into `classic-es5`.
7. Configure the `typescript-eslint` parser before an ESLint flat preset selects typed `*.now.ts` or `*.now.tsx` files.
8. Upgrade oxfmt from the 1.1 peer floor of `>=0.16.0` to `>=0.64.0`.
9. Set `settings.servicenow.release` to `"zurich"` or `"australia"` when the target is known. Omit it to use only cross-release facts.
10. Import shared analysis only from `oxc-plugin-servicenow/analysis`.

The 2.0 root no longer exports these 1.1 implementation details: `rules`,
`recommendedOxfmtConfig`, `oxfmtRecommended`, `applyRules`, `ruleCatalog`,
`PACKAGE_NAME`, `PACKAGE_VERSION`, and `PLUGIN_NAME`. It also removes the
`ScriptKind`, `LintMessage`, and `LintSourceOptions` root types. Import oxfmt
configuration from `/oxfmt`. Test harnesses and catalog data have no public
replacement.

## Tested compatibility

These declared ranges are validated by the repository test suite.

<!-- generated:compatibility:start -->
| Component | Tested range |
| --- | --- |
| Node | 20.19.0, 22.14.0, 24.16.0, 26.7.0 |
| oxlint | 1.79.0 and 1.79.0 (`>=1.79.0 <2`) |
| ESLint | 9.0.0, 9.39.5, and 10.8.1 (`>=9.0.0 <11`) |
| oxfmt | 0.64.0 and 0.64.0 (`>=0.64.0 <1`) |
| ServiceNow engine tables | zurich, australia |
| Fluent SDK | 3.0.0, 3.0.1, 3.0.2, 3.0.3, 4.0.0, 4.0.1, 4.0.2, 4.1.0, 4.1.1, 4.2.0, 4.3.0, 4.4.0, 4.4.1, 4.5.0, 4.6.0, 4.6.1, 4.7.0, 4.7.1, 4.7.2, 4.8.0, 4.8.1, 4.9.0, 4.9.1, 4.9.2, 4.10.0, 4.10.1, 4.11.0 |
<!-- generated:compatibility:end -->

## Development

```bash
npm install
npm run validate
```

`npm run validate` checks workflow action pins and the compatibility matrix; runs lint, format, project and fixture typechecking, build, tests, and Fluent-manifest verification; then checks evidence, acceptance, generated-documentation consistency, benchmarks, and the release artifact with a packed consumer.

See [Contributing][repository-contributing], [Write a ServiceNow lint rule][repository-rule-authoring], and [Non-goals][repository-non-goals].

Rules live in `src/rules/`. Each rule has:

- `createOnce` (with `before()` to skip irrelevant files)
- `meta.docs` / `meta.messages`
- unit tests under `tests/rules/`

Use `getScriptContext` and `analyzeProvenance`. Do not match platform APIs by name alone.

Autofixes require proof that the rewrite preserves semantics, plus exact output, syntax-validity, idempotence, and comment-preservation tests. Otherwise emit a diagnostic only.

The test harness walks an [oxc-parser](https://www.npmjs.com/package/oxc-parser) ESTree AST. CI also runs the built plugin under real oxlint and ESLint.

<!-- generated:repository-links:start -->
[repository-examples]: https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/examples/README.md
[repository-example-classic-compatibility]: https://github.com/martinthommesen/oxc-plugin-servicenow/tree/v2.0.0/examples/classic-compatibility
[repository-example-classic-es5]: https://github.com/martinthommesen/oxc-plugin-servicenow/tree/v2.0.0/examples/classic-es5
[repository-example-es2021]: https://github.com/martinthommesen/oxc-plugin-servicenow/tree/v2.0.0/examples/es2021
[repository-example-client]: https://github.com/martinthommesen/oxc-plugin-servicenow/tree/v2.0.0/examples/client
[repository-example-business-rule]: https://github.com/martinthommesen/oxc-plugin-servicenow/tree/v2.0.0/examples/business-rule
[repository-example-ui-action]: https://github.com/martinthommesen/oxc-plugin-servicenow/tree/v2.0.0/examples/ui-action
[repository-example-fluent]: https://github.com/martinthommesen/oxc-plugin-servicenow/tree/v2.0.0/examples/fluent
[repository-example-mixed]: https://github.com/martinthommesen/oxc-plugin-servicenow/tree/v2.0.0/examples/mixed
[repository-contributing]: https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/CONTRIBUTING.md
[repository-rule-authoring]: https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/rule-authoring.md
[repository-non-goals]: https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v2.0.0/docs/non-goals.md
<!-- generated:repository-links:end -->

## License

MIT
