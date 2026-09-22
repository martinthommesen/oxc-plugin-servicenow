---
applyTo: "src/rules/**,src/catalog/**,src/analysis/**"
---

# Rule, catalog, and analysis code

- A rule is registered by its descriptor in `src/catalog/`; the implementation in `src/rules/` must match the descriptor's applicability gate, messages, and evidence. Review both sides of that pairing together.
- Rules never fix or suggest. Flag any `fix` or `suggest` payload.
- Per-file state lives in the closure and is reset in `before()`. A field initialized at construction and mutated during a visit is a cross-file leak.
- `appliesOnSurface` requires membership and per-dimension confidence; `trustedExpression` rejects shadowed or escaped identity; `featureSupport` returns `unknown` on release disagreement. Code that bypasses these helpers needs a stated reason.
- Path analysis reports exhaustion as a value. A caller that returns partial findings after exhaustion is a defect.
- Follow `docs/rule-authoring.md` for the rule shape, and `lat.md/rules.md` for the catalog axes.
