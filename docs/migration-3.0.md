# Migrating to 3.0.0

3.0.0 raises the supported toolchains and removes the three deprecations
announced through the 2.x line. Every rule, preset, config, and formatter
behavior is otherwise unchanged. Work through the steps in order; each one
names the exact break and its replacement.

## 1. Run on Node.js 22.12.0 or later

`engines` moves from `>=20.19.0` to `>=22.12.0` because Node.js 20 reached
end-of-life in April 2026. The lowest tested host moves from 20.19.0 to
22.12.0 (npm 10.9.0).

- Upgrade local runtimes and CI images to Node.js 22.12.0 or later
  (22.x, 24.x, and 26.x are tested).
- If a workflow pins `node-version: 20.x`, move it to a tested version
  from the README compatibility table.

## 2. Upgrade the oxlint and oxfmt peers

- `oxlint` peer: `>=1.79.0 <2` becomes `>=1.83.0 <2`.
- `oxfmt` peer: `>=0.64.0 <1` becomes `>=0.68.0 <1`.
- `eslint` (`>=9.0.0 <11`) and `typescript-eslint` (`>=8.0.0 <9`) ranges
  are unchanged.

Run `npm install oxlint@^1.83.0 oxfmt@^0.68.0` (or the equivalent for your
package manager) in every consumer. The 1.83/0.68 pair is the tested
minimum; newer 1.x/0.x releases stay accepted.

## 3. Drop `servicenow/validate-gliderecord-calls` from configs

The deprecated alias is removed (FINDINGS.md REM-001): the rule, its
catalog entry, and its rule page are gone. A config that still names it
fails host resolution, so delete the key:

```diff
 {
   "rules": {
     "servicenow/no-hardcoded-sysid": "error",
-    "servicenow/validate-gliderecord-calls": "error",
+    "servicenow/require-query-before-next": "error"
   }
 }
```

`require-query-before-next` (already in `recommended`) replaces the
cursor-sequencing half: missing query before `.next()`/`._next()`. The
alias's unused-return half (`unusedReturn` on ignored `insert`, `update`,
`deleteRecord`, `get`, `next`, and `_next` results) has no surviving rule
and is dropped. If you enforced return checking through the alias, that
coverage ends here; nothing else reports those cases.

## 4. Stop reading the removed provenance fields

`AnalysisProvenance.queryState`, `windowed`, `sysparmName`, and
`aggregates` are removed with the `QueryState` type (FINDINGS.md API-002).
The fields were never computed: every value stayed at its default
(`"unopened"`, `false`, `false`, empty set) whatever the source did, so
deleting reads changes no outcome. TypeScript consumers get a compile
error at each read; delete the read.

Consumers that need lifecycle facts should use the rules that compute
them:

| Dropped field      | Replacement rule(s)                                              |
| ------------------ | ---------------------------------------------------------------- |
| `queryState`       | `servicenow/require-query-before-next`                           |
| `windowed`         | `servicenow/prefer-setnocount-with-choosewindow`, windowing rules |
| `sysparmName`      | `servicenow/require-glideajax-sysparm-name`, GlideAjax rules      |
| `aggregates`       | `servicenow/validate-glideaggregate-calls`, aggregate rules       |

The remaining `Provenance` members (`kind`, `invalid`, `escaped`,
`bindingId`, `objectId`) are unchanged.

## 5. Replace `// @sn-es-latest` with `javascriptMode`

The per-file `// @sn-es-latest` pragma is retired (FINDINGS.md FEAT-002):
it was a repository convention, not ServiceNow metadata. Pragma-only
files previously resolved `es2021` JavaScript mode with `inferred`
confidence; they now resolve `unknown` mode, which suppresses
mode-gated diagnostics instead of guessing. Runs over such files can go
quiet where 2.x reported.

Set the mode explicitly on every file that carried the pragma:

```json
{
  "settings": {
    "servicenow": {
      "javascriptMode": "es2021"
    }
  }
}
```

`scriptType` and `ecmaLatest` stay supported with their existing
deprecations; only the pragma is removed.

## 6. Adjust TypeScript consumers to the stricter declarations

- The compile target moves from ES2022 to ES2023. Consumers on
  TypeScript 5.x keep working; the shipped `.d.ts` files use no newer
  declaration syntax.
- Optional properties in shipped types are now spelled with explicit
  `| undefined` (`exactOptionalPropertyTypes`). Code that assigns an
  explicit `undefined` to an optional input keeps compiling; code that
  passes options through its own `exactOptionalPropertyTypes` types may
  need the same `| undefined` spelling.
- `@types/node` follows the engines floor on the 22.x line. Types that
  only exist on newer Node.js releases are no longer visible.

## What stays the same

- All presets keep their names and severities, including the thin
  `security`/`securityRules` and `policy`/`policyRules` presets
  (reassessed at the 3.0 boundary and kept; see `docs/decisions.md`).
- The ESLint 9 and ESLint 10 peer range is unchanged. Typed
  `*.now.ts`/`*.now.tsx` linting now also covers ESLint 10 with
  typescript-eslint 8.56.0 or later (tested at 8.70.0).
- The `oxfmt.recommended.json` configuration and every documented
  formatter behavior are unchanged.
- Public entry points stay `oxc-plugin-servicenow`,
  `oxc-plugin-servicenow/analysis`, and `oxc-plugin-servicenow/oxfmt`
  with the same export keys.
