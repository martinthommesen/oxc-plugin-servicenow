# Compatibility

This page records versions this repository actually tests.

## Consumers

| Component | Tested range | Notes |
| --- | --- | --- |
| Node.js | 20 and 22 in CI | `engines.node` is `>=20.19.0`. |
| oxlint | 1.79.0 | Peer range `>=1.79.0 <2`. JS plugins are alpha. |
| `@oxlint/plugins` | `^1.79.0` | The plugin uses `definePlugin`, `defineRule`, and `createOnce`. |
| ESLint | 9+ and 10 in devDependencies | Flat configs set `files` so `*.now.ts` is included. |
| oxfmt | 0.16.0 | No custom formatter plugin. Use the recommended config export. |
| ServiceNow JavaScript | `compatibility`, `es5`, `es2021`, `unknown` | Unknown mode never assumes ES5. |
| Fluent SDK knowledge | `DEFAULT_FLUENT_MANIFEST` version `sdk-docs-2026-03` | Version-aware. Unknown APIs stay unknown. |

## Contributors

Contributor installs need Node 20.19 or later because development tooling (`oxc-parser`, `tsx`, oxlint JS plugins) targets that floor.

Consumer applications can use the same Node floor. There is no separate older consumer runtime.

## Packed artifact

CI and `npm test` run a packed-package consumer test. That test:

1. Runs `npm pack`.
2. Asserts the tarball includes `dist/`, `oxfmt.recommended.json`, and license files.
3. Asserts the tarball excludes `src/`, `tests/`, and `.github/`.
4. Installs the tarball in a clean directory and imports public exports.
5. Runs oxlint with the packed plugin.

## Documentation URLs

Rule `docs.url` values currently point at `blob/main/docs/rules`. Release tags should keep those files on `main` until a versioned docs path is generated from the published tag.
