# Compatibility

This page is generated from `scripts/compat-matrix.json`. Do not edit it by hand. Run `npm run docs` after you change the matrix.

CI and `npm run compat` install the packed tarball in a clean consumer for each matrix cell that the current Node version can run.

## Declared ranges

| Component | Declared range | Tested minimum | Tested current or latest |
| --- | --- | --- | --- |
| Node.js | `>=20.19.0` | 20.19.0 | 20 LTS and 22 |
| oxlint | `>=1.79.0 <2` | 1.79.0 | 1.79.0 |
| `@oxlint/plugins` | `^1.79.0` | 1.79.0 | 1.79.0 |
| ESLint | `>=9.0.0` | 9.0.0 | 9.39.5 and 10.8.1 |
| oxfmt | `>=0.64.0` | 0.64.0 | 0.64.0 |
| typescript-eslint | `>=8.0.0 <9` (optional) | 8.46.0 | 8.46.0 |
| Fluent SDK knowledge | selected `fluentSdkVersion` | 3.0.0, 4.1.0 | unspecified selects the current manifest |
| ServiceNow JavaScript | `compatibility`, `es5`, `es2021`, `unknown` | all listed modes | unknown never assumes ES5 |

## Packed-consumer matrix

| Cell | Node | oxlint | ESLint | oxfmt |
| --- | --- | --- | --- | --- |
| `min-hosts` | 20.19.0 | 1.79.0 | 9.0.0 | 0.64.0 |
| `node20-current` | 20 | 1.79.0 | 10.8.1 | 0.64.0 |
| `node22-latest` | 22 | 1.79.0 | 10.8.1 | 0.64.0 |
| `eslint9-current` | current | 1.79.0 | 9.39.5 | 0.64.0 |

A cell fails with one of these classes: `package`, `host-api`, `runtime`, `parser`, or `formatter`.

## Contributors

Contributor installs need Node 20.19.0 or later because development tooling (`oxc-parser`, `tsx`, oxlint JS plugins) targets that floor.

Consumer applications use the same Node floor. There is no separate older consumer runtime.

## Documentation URLs

Rule `docs.url` values point at `blob/main/docs/rules`. Release tags keep those files on `main` until a versioned docs path is generated from the published tag.
