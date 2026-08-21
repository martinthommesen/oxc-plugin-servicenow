# Compatibility

This page is generated from `scripts/compat-matrix.json`. Do not edit it by hand. Run `npm run docs` after you change the matrix.

CI runs every cell under its exact Node runtime. Local `npm run compat` uses the `node24-host` dependency set under the current host Node and npm. `npm run compat -- --all` is only a same-runtime dependency smoke test and is not multi-runtime proof.

## Declared ranges

| Component | Declared range | Tested minimum | Tested current or latest |
| --- | --- | --- | --- |
| Node.js | `>=20.19.0` | 20.19.0 | 20.19.0, 22.14.0, 24.16.0, 26.7.0 |
| oxlint | `>=1.79.0 <2` | 1.79.0 | 1.79.0 |
| `@oxlint/plugins` | `^1.79.0` | 1.79.0 | 1.79.0 |
| ESLint | `>=9.0.0 <11` | 9.0.0 | 9.39.5 and 10.8.1 |
| oxfmt | `>=0.64.0 <1` | 0.64.0 | 0.64.0 |
| typescript-eslint | `>=8.0.0 <9` (optional) | 8.0.0 | 8.67.0 |
| TypeScript parser runtime | optional parser dependency | 5.5.4 | 7.0.2 |
| Fluent SDK knowledge | selected `fluentSdkVersion` | 3.0.0, 3.0.1, 3.0.2, 3.0.3, 4.0.0, 4.0.1, 4.0.2, 4.1.0, 4.1.1, 4.2.0, 4.3.0, 4.4.0, 4.4.1, 4.5.0, 4.6.0, 4.6.1, 4.7.0, 4.7.1, 4.7.2, 4.8.0, 4.8.1, 4.9.0, 4.9.1, 4.9.2, 4.10.0, 4.10.1, 4.11.0 | unspecified selects the current manifest |
| ServiceNow JavaScript | `compatibility`, `es5`, `es2021`, `unknown` | all listed modes | unknown never assumes ES5 |

## Packed-consumer matrix

| Cell | Node | npm | oxlint | ESLint | oxfmt | typescript-eslint | TypeScript |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `min-hosts` | 20.19.0 | 10.8.2 | 1.79.0 | 9.0.0 | 0.64.0 | 8.0.0 | 5.5.4 |
| `node22-host` | 22.14.0 | 10.9.2 | 1.79.0 | 9.39.5 | 0.64.0 | 8.67.0 | 7.0.2 |
| `node24-host` | 24.16.0 | 11.13.0 | 1.79.0 | 10.8.1 | 0.64.0 | not installed | not installed |
| `node26-host` | 26.7.0 | 11.19.0 | 1.79.0 | 10.8.1 | 0.64.0 | not installed | not installed |
| `eslint9-current` | 24.16.0 | 11.13.0 | 1.79.0 | 9.39.5 | 0.64.0 | 8.67.0 | 7.0.2 |

A cell fails with one of these classes: `package`, `host-api`, `runtime`, `parser`, or `formatter`. Parser cells exercise the exported ESLint configuration on real `.now.ts` and `.now.tsx` files. ESLint 10 cells omit typescript-eslint because its current peer range does not accept ESLint 10. Every supported combination installs with normal npm peer resolution.

## Contributors

Contributor installs need Node 20.19.0 or later because development tooling (`oxc-parser`, `tsx`, oxlint JS plugins) targets that floor.

Consumer applications use the same Node floor. There is no separate older consumer runtime.

## Documentation URLs

Rule `docs.url` values point at `blob/main/docs/rules`. Release tags keep those files on `main` until a versioned docs path is generated from the published tag.
