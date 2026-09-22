The GlideRecord and GlideAggregate family rules depend on which methods exist, what each method does to a query, and whether it is available in the configured application scope. This file describes the manifest that answers those questions.

## Methods carry roles

`GLIDE_RECORD_METHODS` and `GLIDE_AGGREGATE_METHODS` in [[src/glide/manifest.ts#resolveGlideCapabilities]] are the inventories. Each `GlideMethodCapability` has a name, releases, supported scopes, evidence URLs, and a `roles` array.

`GlideMethodRole` is a nine-member enum:

| Role | Effect on a query |
| --- | --- |
| `filter` | Narrows the result set |
| `shape` | Changes ordering, limits, or windowing |
| `acl-bypass` | Reads or writes without ACL enforcement |
| `executor` | Runs the query |
| `consumer` | Reads a value from the current row |
| `cursor-advance` | Moves the cursor |
| `bulk` | Acts on many records at once |
| `value-extractor` | Pulls a value out of a result |
| `neutral` | None of the above |

`require-query-before-next` needs to know which calls execute a query and which merely modify it; `prefer-glideaggregate` needs to distinguish counting from row work; the windowing rules need to recognize a bulk delete. All of that is a set membership test on a deliberate vocabulary rather than a hardcoded list of method names scattered across rule files.

## Scope and release intersect

`resolveGlideCapabilities` in [[src/glide/manifest.ts#resolveGlideCapabilities]] takes the configured scope and release and returns a `GlideCapabilityView`.

It builds the cartesian product of admissible releases and admissible API scopes, then splits the inventory twice:

- `methods` — documented for **every** admissible combination. These are the facts the plugin will act on.
- `possibleMethods` — documented for **at least one** combination.

The view derives these sets under `byKind` for both `GlideRecord` and `GlideAggregate`: `filters`, `modifiers`, `executors`, `possibleExecutors`, `consumers`, `cursorAdvancers`, `bulk`, `systemBypass`, and `valueExtractors`. `byKind` is the only home for a role set; a caller that wants the GlideRecord answer writes `byKind.GlideRecord`.

`modeledMethods` contains the GlideRecord methods whose effects analysis models. `knownMethods` is a complete documented-name firewall and does not imply a modeled effect.

The two directions are both useful. `executors` and `possibleExecutors` differ exactly when the answer is scope-dependent, so a rule can choose to report only on the definite set.

An unknown scope admits both `scoped` and `global`. An omitted release admits both supported releases. As everywhere else, the answer is the intersection, and an omitted axis narrows what can be claimed rather than defaulting.

Results are memoized in `CAPABILITY_CACHE` keyed by `scope:release`, so the intersection is computed once per configuration.

## Evidence

GlideRecord methods cite `GLIDE_RECORD_EVIDENCE`; GlideAggregate roles cite `GLIDE_AGGREGATE_EVIDENCE`. Both inventories have scoped and global pages for Zurich and Australia. `docs/rules/*.md` renders rule applicability.

## Related

The axes this manifest is indexed by, and what consumes it.

- [[domain#Releases]], [[domain#Application scope]] — the two axes.
- [[analysis]] — the path-sensitive domains that consume the role sets.
