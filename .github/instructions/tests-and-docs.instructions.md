---
applyTo: "tests/**,lat.md/**,docs/**,CHANGELOG.md,CONTRIBUTING.md,README.md"
---

# Tests and documentation

- Unit tests use the harness in `tests/helpers/rule-tester.ts`; integration tests run the real oxlint binary and a real ESLint `Linter` and are the only proof of production behavior.
- Prefer assertions on observable outcomes over assertions that restate fixture data or the implementation.
- Each leaf section under `lat.md/tests.md` is bound to exactly one `@lat:` comment in a test. A new test spec needs its comment; a removed test needs its spec removed.
- Every `lat.md/` section starts with a paragraph of at most 250 characters. Sections link to generated tables instead of restating them.
- `docs/rules/*.md`, `src/version.ts`, and `docs/pr-51-*.md` are generated. Edits there are defects; the source is the catalog or the generator.
- Version and peer-range claims in docs must match `package.json`. The changelog heading for a release is `## <version> — YYYY-MM-DD` and is the first version heading after `## Unreleased`.
