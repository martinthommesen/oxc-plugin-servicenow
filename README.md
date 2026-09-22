# oxc-plugin-servicenow

ServiceNow lint rules for **[oxlint](https://oxc.rs/docs/guide/usage/linter.html)** and **ESLint 9–10**, plus an **[oxfmt](https://oxc.rs/docs/guide/usage/formatter.html)** configuration preset.

- **Classic scripts:** catch unsafe GlideRecord usage, Business Rule recursion, client API mistakes, and mode-specific engine restrictions.
- **Fluent metadata:** check imports, IDs, and directives in `.now.ts` / `.now.tsx` files.
- **Conservative by design:** rules report diagnostics, not fixes, and stay silent when the required runtime context or API identity is unknown.

[Quick start](#quick-start--oxlint) · [ESLint](#eslint-9) · [Formatting](#quick-start--oxfmt) · [Presets](#presets) · [Settings](#settings) · [Rules](#rules) · [Troubleshooting](#troubleshooting-a-quiet-run) · [Documentation](#documentation)

## Quick start — oxlint

Requires **Node.js 22.12.0+**. Install the supported oxlint minor line:

```bash
npm install -D oxc-plugin-servicenow oxlint@~1.83.0
```

Create `oxlint.config.ts`:

```ts
import { defineConfig } from "oxlint";
import { configs } from "oxc-plugin-servicenow";

export default defineConfig({
  jsPlugins: [{ name: "servicenow", specifier: "oxc-plugin-servicenow" }],
  rules: configs.recommendedRules,
});
```

```bash
npx oxlint .
```

**Set your runtime context next.** Names such as `*.br.js`, `*.client.js`, and `*.now.ts` identify script context; generic `foo.js` does not. Set JavaScript mode and scope explicitly where known—see [Settings](#settings) and the [mixed-project example][repository-example-mixed].

## ESLint 9+

Install `oxc-plugin-servicenow` and ESLint, then create `eslint.config.js`:

```bash
npm install -D oxc-plugin-servicenow eslint@^10
```

```js
// eslint.config.js
import servicenow from "oxc-plugin-servicenow";

export default [servicenow.configs.flat.recommended];
```

```bash
npx eslint .
```

Flat presets select classic JavaScript and Fluent files. **Typed Fluent files also need a TypeScript parser**; oxlint parses them natively.

<details>
<summary>ESLint configuration for typed Fluent files</summary>

Install `typescript-eslint` 8.x (8.56.0 or later for ESLint 10):

```bash
npm install -D typescript-eslint@^8.56.0
```

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

Type-aware linting is not required. Ordinary TypeScript is unaffected unless you add a `files` override and parser; set `javascriptMode` for server TypeScript.

</details>

## Quick start — oxfmt

The formatter preset selects Fluent-friendly and classic Studio styles; it is configuration, not a custom formatting plugin.

```bash
npm install -D oxc-plugin-servicenow oxfmt@~0.68.0
cp node_modules/oxc-plugin-servicenow/oxfmt.recommended.json .oxfmtrc.json
npx oxfmt --write .
```

Already have an oxfmt config? Merge the preset rather than overwriting it. See the [formatter guide](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/oxfmt.md) for TypeScript configuration and file overrides.

## Presets

Use rule maps in oxlint and `configs.flat.*` in ESLint. Start with `recommended`; add runtime-specific presets only for the files they apply to.

| Rule map | ESLint flat preset | Use for |
| --- | --- | --- |
| `configs.recommendedRules` | `configs.flat.recommended` | High-confidence checks; unknown context stays unknown. |
| `configs.classicEs5Rules` | `configs.flat.classicEs5` | Compatibility / ES5 engine restrictions. |
| `configs.es2021Rules` | `configs.flat.es2021` | Remaining ES2021 restrictions and release-dependent checks. |
| `configs.clientRules` | `configs.flat.client` | Client-side APIs; set application scope separately. |
| `configs.aclRules` | `configs.flat.acl` | ACL review rules. |
| `configs.businessRuleRules` | `configs.flat.businessRule` | Business Rules. |
| `configs.fluentRules` | `configs.flat.fluent` | Fluent metadata. |
| `configs.strictRules` | `configs.flat.strict` | Recommended plus warn-level performance and naming guidance. |
| `configs.policyRules` | `configs.flat.policy` | Opt-in organizational and migration policy. |
| `configs.securityRules` | `configs.flat.security` | Opt-in privilege-sensitive review. |

## Settings

Configure `settings.servicenow` per file group. Explicit settings take precedence over filename conventions and conservative source inference. Unknown JavaScript mode never assumes ES5; invalid or conflicting settings throw a configuration error.

```jsonc
{
  "settings": {
    "servicenow": {
      "javascriptMode": "es2021",
      "surfaces": ["business-rule"],
      "scope": "scoped"
    }
  }
}
```

The instance `release` and `fluentSdkVersion` are independent. Set each only when known. For mixed UI Actions, use `surfaces: ["ui-action", "client", "server"]`.

<details>
<summary>All settings</summary>

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
| `businessRuleWhen` | Business Rule timing: `before`, `after`, `async`, `display`, or `unknown` (default). Timing-specific Business Rule rules stay silent until it is set; it is never inferred from the filename. |
| `scriptType` | **Deprecated.** Use `authoring` and `surfaces`. |
| `ecmaLatest` | **Deprecated.** `true` maps to `javascriptMode: "es2021"`. `false` does not assume ES5. |

</details>

<details>
<summary>Mixed-repository configuration (oxlint)</summary>

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

</details>

Release-specific coverage is documented in the [Australia engine update ledger](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/australia-engine-updates.md). “Not Supported” means not validated by ServiceNow for that release and mode; “Disallowed” means a platform error. Compatibility uses ES5 feature-table cells as package policy, not as an official Compatibility table.

## Rules

Each rule page includes examples, applicability, limitations, and evidence. All rules are diagnostic-only.

### Classic ServiceNow

<details>
<summary>Browse classic script rules</summary>

<!-- generated:classic-rules:start -->
| Rule | Profile | Fix | What it catches |
| --- | --- | --- | --- |
| [`no-hardcoded-sysid`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/no-hardcoded-sysid.md) | recommended |  | Hardcoded 32-character sys_ids break when an app is installed on another instance |
| [`prefer-glideaggregate`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/prefer-glideaggregate.md) | strict |  | `GlideRecord.getRowCount()` (and iterate-to-count loops) load every matching row |
| [`no-client-gliderecord`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/no-client-gliderecord.md) | recommended |  | Proven platform GlideRecord calls are unsupported in scoped client applications |
| [`no-gs-now`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/no-gs-now.md) | recommended |  | `gs.now()` and `gs.nowDateTime()` return timezone-sensitive display strings |
| [`require-query-before-next`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/require-query-before-next.md) | recommended |  | Require a documented, scope-supported GlideRecord query executor before `.next()` or `._next()` |
| [`no-br-current-update`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/no-br-current-update.md) | recommended |  | `current.update()` retriggers other Business Rules and can recurse |
| [`no-hardcoded-table-names`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/no-hardcoded-table-names.md) | policy |  | Optional organizational policy |
| [`no-packages-calls`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/no-packages-calls.md) | policy |  | Optional migration policy |
| [`no-delete-multiple-with-windowing`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/no-delete-multiple-with-windowing.md) | recommended |  | `setLimit()` and `chooseWindow()` do not limit `deleteMultiple()` |
| [`require-callback-for-getreference`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/require-callback-for-getreference.md) | recommended |  | `g_form.getReference(field)` without a callback is a synchronous server request |
| [`require-glideajax-sysparm-name`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/require-glideajax-sysparm-name.md) | recommended |  | GlideAjax requires a non-empty `addParam("sysparm_name", method)` before `getXML` / `getXMLAnswer` / `getXMLWait` |
| [`validate-glideaggregate-calls`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/validate-glideaggregate-calls.md) | recommended |  | A proven GlideAggregate must call `query()` before `next()` or `getAggregate()` |
| [`no-glideajax-getanswer`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/no-glideajax-getanswer.md) | recommended |  | `getAnswer()` belongs to synchronous GlideAjax |
| [`no-glideelement-in-collection`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/no-glideelement-in-collection.md) | recommended |  | Direct GlideRecord field access and path-proven local aliases are GlideElements tied to the cursor |
| [`no-gliderecord-query-modifier-after-query`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/no-gliderecord-query-modifier-after-query.md) | recommended |  | Filters and result-shaping calls after a documented query executor do not change the open cursor |
| [`require-business-rule-wrapper`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/require-business-rule-wrapper.md) | recommended |  | Full-script Business Rules must wrap logic in the standard IIFE so top-level variables do not leak |
| [`no-display-value-date-comparison`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/no-display-value-date-comparison.md) | strict |  | Do not relationally compare `GlideDateTime.getDisplayValue()` strings |
| [`no-unfiltered-gliderecord-bulk-operation`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/no-unfiltered-gliderecord-bulk-operation.md) | recommended |  | `updateMultiple()` / `deleteMultiple()` without a proven restricting filter can touch every row |
| [`no-gliderecord-query-in-acl`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/no-gliderecord-query-in-acl.md) | strict |  | Review proven GlideRecord, GlideRecordSecure, and GlideAggregate query executions on an ACL's immediate evaluation path |
| [`no-gliderecord-query-in-loop`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/no-gliderecord-query-in-loop.md) | strict |  | A query inside a proven record cursor loop is an N+1 pattern |
| [`prefer-setnocount-with-choosewindow`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/prefer-setnocount-with-choosewindow.md) | strict |  | The reviewed Zurich and Australia-scoped GlideRecord references document that `query()` after `chooseWindow()` runs `COUNT(*)` unless `setNoCount()` or `setLimit()` skips it |
| [`no-system-query-bypass`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/no-system-query-bypass.md) | security |  | Opt-in security review for documented ACL-bypass query APIs |
| [`no-sync-glideajax`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/no-sync-glideajax.md) | recommended |  | `getXMLWait()` blocks the browser and does not work in Service Portal |
<!-- generated:classic-rules:end -->

</details>

### Instance engine (mode-specific)

<details>
<summary>Browse engine compatibility rules</summary>

These rules run only when `javascriptMode` is known, except for features that ServiceNow documents as unavailable in every instance mode for the selected release.

<!-- generated:engine-rules:start -->
| Rule | Profile | What it catches |
| --- | --- | --- |
| [`no-promise`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/no-promise.md) | classic-es5 | Compatibility and ES5 Standards modes do not implement Promises |
| [`no-async-await`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/no-async-await.md) | classic-es5 | async/await is not implemented in Compatibility or ES5 Standards mode |
| [`no-bigint`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/no-bigint.md) | classic-es5 | BigInt literals and `BigInt()` are unsupported in Compatibility or ES5 Standards mode |
| [`no-incorrect-array-from-thisarg`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/no-incorrect-array-from-thisarg.md) | es2021 | Zurich throws when Array.from receives an explicit primitive mapper thisArg—even for an empty source, because conversion precedes iteration—and gives a non-strict mapper the wrong this when that argument is omitted |
| [`no-unhoisted-block-function-use`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/no-unhoisted-block-function-use.md) | classic-es5 | Before Australia, ServiceNow does not correctly hoist nested block function declarations to block entry |
| [`no-object-method-constructor`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/no-object-method-constructor.md) | es2021 | ServiceNow Australia enforces ECMAScript's non-constructible shorthand object methods, while Zurich's ES2021 engine incorrectly permits them |
| [`no-incorrect-bigint-asuintn`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/no-incorrect-bigint-asuintn.md) | es2021 | Zurich can return a negative input unchanged from BigInt.asUintN() when the requested width exceeds the input's signed byte representation; Australia corrects the ES2021 behavior |
| [`no-at-method`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/no-at-method.md) | classic-es5 | `.at()` is not implemented in Compatibility or ES5 Standards mode |
| [`no-weak-references`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/no-weak-references.md) | recommended | WeakRef and FinalizationRegistry are disallowed in every instance JavaScript mode, including ES2021 |
| [`no-map-set`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/no-map-set.md) | classic-es5 | ServiceNow supports Map and Set in ES2021 but not in Compatibility or ES5 Standards mode in either Zurich or Australia |
| [`no-weak-collections`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/no-weak-collections.md) | classic-es5 | WeakMap and WeakSet are disallowed in Compatibility and ES5 Standards mode |
| [`no-object-hasown`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/no-object-hasown.md) | classic-es5 | `Object.hasOwn()` is Not Supported in Zurich ES2021 and Australia ES5; Australia ES2021 Supports it |
| [`no-unsupported-date-fraction`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/no-unsupported-date-fraction.md) | classic-es5 | Australia adds variable-length ISO fractional-second parsing to all JavaScript modes, while Zurich accepts fractional seconds only when exactly three digits are present |
| [`no-unsupported-set-methods`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/no-unsupported-set-methods.md) | es2021 | Set.prototype.intersection(), union(), difference(), symmetricDifference(), isSubsetOf(), isSupersetOf(), and isDisjointFrom() are available in Australia ES2021 but not Zurich ES2021 |
| [`no-unsupported-static-methods`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/no-unsupported-static-methods.md) | classic-es5 | Error.isError(), Promise.try(), and Promise.withResolvers() are available in Australia ES2021 but not Zurich ES2021 |
| [`no-typed-arrays`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/no-typed-arrays.md) | classic-es5 | General TypedArray constructors and DataView construction are Disallowed by the ES5 cell, while BigInt64Array and BigUint64Array are Not Supported there |
| [`no-proxy`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/no-proxy.md) | classic-es5 | `Proxy` is unsupported in Compatibility and ES5 Standards mode |
| [`no-unsupported-syntax`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/no-unsupported-syntax.md) | classic-es5 | The ES5 table marks ordinary object shorthand methods Not Supported and async/generator methods Disallowed |
| [`no-async-iterators`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/no-async-iterators.md) | recommended | `for await…of` and async generators are disallowed in every instance JavaScript mode, including ES2021 |
<!-- generated:engine-rules:end -->

</details>

### Fluent (`.now.ts`)

<details>
<summary>Browse Fluent metadata rules</summary>

<!-- generated:fluent-rules:start -->
| Rule | Profile | Fix | What it catches |
| --- | --- | --- | --- |
| [`fluent-proper-imports`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/fluent-proper-imports.md) | recommended |  | Fluent entity and column APIs must be imported from the module recorded in the selected SDK manifest |
| [`fluent-directives`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/fluent-directives.md) | recommended |  | Validate documented ServiceNow Fluent SDK directive names and placement |
| [`prefer-now-include`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/prefer-now-include.md) | strict |  | Large inline `script` / HTML / CSS payloads belong in their own file and should be loaded with `Now.include()` |
| [`require-fluent-id`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/require-fluent-id.md) | recommended |  | Fluent entities must declare `$id` when the selected SDK manifest marks the imported factory as requiring an id |
| [`fluent-naming-convention`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/fluent-naming-convention.md) | strict |  | `.now.ts` files and `Now.ID` keys should be kebab-case |
| [`no-complex-fluent-logic`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/no-complex-fluent-logic.md) | policy |  | Optional architectural policy |
| [`no-now-id-as-reference`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/no-now-id-as-reference.md) | recommended |  | `Now.ID[...]` is a metadata identity, not a reference |
| [`no-duplicate-fluent-id`](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rules/no-duplicate-fluent-id.md) | recommended |  | Two Fluent definitions that share the same static `Now.ID` key as `$id` collide |
<!-- generated:fluent-rules:end -->

</details>

## Examples

Runnable profile projects live under [`examples/`][repository-examples]:

| Project | Context |
| --- | --- |
| [classic-compatibility][repository-example-classic-compatibility] | Compatibility-mode server scripts |
| [classic-es5][repository-example-classic-es5] | ES5 Standards server scripts |
| [es2021][repository-example-es2021] | ES2021 server scripts |
| [client][repository-example-client] | Client Scripts |
| [business-rule][repository-example-business-rule] | Full-script Business Rules |
| [ui-action][repository-example-ui-action] | Client, server, and mixed UI Actions |
| [fluent][repository-example-fluent] | Fluent `.now.ts` metadata |
| [mixed][repository-example-mixed] | One repository with several surfaces |

## Troubleshooting a quiet run

No diagnostics does not necessarily mean a rule ran. Check:

1. **Surface:** use recognized names such as `*.client.js`, `*.br.js`, `*.si.js`, `*.server.js`, or `*.now.ts`, or set `surfaces` in a file override.
2. **Mode and metadata:** set `javascriptMode` for engine checks, `scope: "scoped"` for scoped-client restrictions, and `businessRuleWhen` for timing-specific checks. The retired `// @sn-es-latest` pragma is ignored.
3. **API identity:** rules cannot report on receivers they cannot prove. Escaped or dynamic objects and analysis-budget exhaustion can suppress findings.

Try one rule against one file and compare with its [rule page](#rules). oxlint JS plugins remain **alpha**, with no custom parsers or type-aware rules; see the [host limitations](https://oxc.rs/docs/guide/usage/linter/js-plugins.html).

## Documentation

- [Examples](#examples) — runnable projects for each script context.
- [Migration to 3.0.0](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/migration-3.0.md) — breaking changes and replacements.
- [Compatibility](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/compatibility.md) — supported toolchains and tested combinations.
- [Formatter guide](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/oxfmt.md) — configuration and styles.
- [Contributing][repository-contributing] · [Rule authoring][repository-rule-authoring] · [Non-goals][repository-non-goals].

## Migrating to 3.0.0

Follow the [3.0 migration guide](https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/migration-3.0.md) before upgrading: toolchain floors changed, and the deprecated GlideRecord rule alias, unused provenance fields, and mode pragma were removed.

## Migrating to 2.0.0

Upgrading from 1.x? Review these historical changes before following the 3.0 guide.

<details>
<summary>1.x → 2.0 preset and API changes</summary>

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

</details>

## Supported package entry points

<details>
<summary>Public exports for configuration and integrations</summary>

| Entry point | Supported exports |
| --- | --- |
| `oxc-plugin-servicenow` | Default plugin, `plugin`, `configs`, and the `ServiceNowSettings`, `RuleConfigMap`, and `RuleName` types. |
| `oxc-plugin-servicenow/analysis` | `analyzeProvenance`, `getScriptContext`, and their read-only public types. |
| `oxc-plugin-servicenow/oxfmt` | The TypeScript oxfmt configuration exports. |
| `oxc-plugin-servicenow/oxfmt.recommended.json` | The JSON oxfmt preset. |
| `oxc-plugin-servicenow/package.json` | Package metadata through Node package exports. |

Other source and `dist` paths are internal. Do not import them.

`analyzeProvenance(context, ast?)` analyzes `context.sourceCode.ast` by default. Pass an explicit AST only when its nodes are the ones you will query. Explicit trees are cached independently and use their own lexical bindings.

</details>

## Tested compatibility

<details>
<summary>Tested toolchains and ServiceNow versions</summary>

<!-- generated:compatibility:start -->
| Component | Tested range |
| --- | --- |
| Node | 22.12.0, 22.14.0, 24.16.0, 26.7.0 |
| oxlint | 1.83.0 and 1.83.0 (`>=1.83.0 <1.84.0`) |
| ESLint | 9.0.0, 9.39.5, and 10.11.0 (`>=9.0.0 <11`) |
| oxfmt | 0.68.0 and 0.68.0 (`>=0.68.0 <0.69.0`) |
| ServiceNow engine tables | zurich, australia |
| Fluent SDK | 3.0.0, 3.0.1, 3.0.2, 3.0.3, 4.0.0, 4.0.1, 4.0.2, 4.1.0, 4.1.1, 4.2.0, 4.3.0, 4.4.0, 4.4.1, 4.5.0, 4.6.0, 4.6.1, 4.7.0, 4.7.1, 4.7.2, 4.8.0, 4.8.1, 4.9.0, 4.9.1, 4.9.2, 4.10.0, 4.10.1, 4.11.0 |
<!-- generated:compatibility:end -->

</details>

## Development

```bash
npm ci
npm run validate
```

See [Contributing][repository-contributing] for the full validation workflow.

<!-- generated:repository-links:start -->
[repository-examples]: https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/examples/README.md
[repository-example-classic-compatibility]: https://github.com/martinthommesen/oxc-plugin-servicenow/tree/v3.0.0/examples/classic-compatibility
[repository-example-classic-es5]: https://github.com/martinthommesen/oxc-plugin-servicenow/tree/v3.0.0/examples/classic-es5
[repository-example-es2021]: https://github.com/martinthommesen/oxc-plugin-servicenow/tree/v3.0.0/examples/es2021
[repository-example-client]: https://github.com/martinthommesen/oxc-plugin-servicenow/tree/v3.0.0/examples/client
[repository-example-business-rule]: https://github.com/martinthommesen/oxc-plugin-servicenow/tree/v3.0.0/examples/business-rule
[repository-example-ui-action]: https://github.com/martinthommesen/oxc-plugin-servicenow/tree/v3.0.0/examples/ui-action
[repository-example-fluent]: https://github.com/martinthommesen/oxc-plugin-servicenow/tree/v3.0.0/examples/fluent
[repository-example-mixed]: https://github.com/martinthommesen/oxc-plugin-servicenow/tree/v3.0.0/examples/mixed
[repository-contributing]: https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/CONTRIBUTING.md
[repository-rule-authoring]: https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/rule-authoring.md
[repository-non-goals]: https://github.com/martinthommesen/oxc-plugin-servicenow/blob/v3.0.0/docs/non-goals.md
<!-- generated:repository-links:end -->

## License

MIT
