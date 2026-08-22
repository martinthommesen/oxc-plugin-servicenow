# Research: project-wide Fluent validation

Decision date: 2026-08-19.

## Boundary

| Check | Owner |
| --- | --- |
| Same-file duplicate `$id` | `no-duplicate-fluent-id` (implemented) |
| `Now.ID` used as a reference | `no-now-id-as-reference` (implemented) |
| Cross-file `$id` uniqueness | Companion project check, not an Oxlint JS plugin |
| `keys.ts` consistency | Official SDK build |
| `Now.ref()` targets | Project index |
| Table/field/schema | Generated SDK types or instance schema |

The Oxlint JS-plugin API is file-oriented. Ordinary rules must not claim cross-file uniqueness.

## First official project check

Use the SDK, do not re-parse `keys.ts`:

```bash
npx now-sdk build --frozenKeys
```

Evidence:

- [The keys.ts file](https://servicenow.github.io/sdk/config/keys-file)
- [CI integration / frozenKeys](https://servicenow.github.io/sdk/config/ci-integration)
- [Now.ID](https://servicenow.github.io/sdk/fluent/now-id-guide)

`keys.ts` is generated and is the identity registry. `--frozenKeys` fails CI when Fluent identifiers changed without a committed keys file.

## Package split

Keep this package file-local. A later companion CLI may:

1. Invoke or document `now-sdk build --frozenKeys`
2. Index `$id` keys across `.now.ts` files only after the SDK graph is a supported input
3. Validate `Now.ref()` against that index

Do not scan filenames as a substitute for the SDK graph.

## Decision — hold

No project-wide Fluent checker ships in this package until it consumes official SDK artifacts. The first candidate is documenting and optionally wrapping `--frozenKeys`, not a new lint rule.
