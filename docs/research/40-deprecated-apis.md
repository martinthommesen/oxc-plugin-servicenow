# Research: release-aware deprecated API diagnostics

Decision date: 2026-08-19.

## Decision — hold

Do not ship an unversioned deprecation list.

## Required manifest entry

Every candidate API needs all of the following before it can become a diagnostic:

| Field | Purpose |
| --- | --- |
| `name` | Binding-aware global or member |
| `kind` | `deprecated`, `removed`, `unsupported-in-scope`, `internal` |
| `releaseAdded` | First documented release, if known |
| `releaseDeprecated` | Deprecation release |
| `releaseRemoved` | Removal release, if any |
| `surfaces` | client / server / both |
| `scope` | global / scoped / both |
| `javascriptMode` | If mode-specific |
| `replacement` | Official replacement or `none` |
| `evidence` | Authoritative URL |
| `plugins` | Required plugins, or `none` |

User target release comes from `settings.servicenow.release`. Unknown release stays silent.

## Data sources

Prefer official API reference pages and SDK release notes. Community lists and blog posts are not enough.

Fluent SDK deprecations belong in `src/fluent/manifest.ts` with the same evidence rule already used for imports.

## Detection

Reuse binding-aware provenance from #3. Do not match deprecated names on shadowed locals.

Plugin-specific APIs are not universal. Mark them `plugins` and skip unless the user opts in.

## Update process

A human repeats the API reference review when `SUPPORTED_SERVICENOW_RELEASES`, the Glide evidence table, or `DEFAULT_FLUENT_MANIFEST.version` changes. There is no machine-readable ServiceNow deprecation feed that this repository can trust yet.

## Preset

If a versioned table exists later:

- removed + currently targeted release: `error` in `classic-es5` or `es2021` as applicable
- deprecated but present: `strict` / `warn`
- never `recommended` until the table is generated from official sources
