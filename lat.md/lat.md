This directory is the knowledge graph for `oxc-plugin-servicenow`: the domain concepts, resolution algorithms, and enforced invariants behind the lint rules. It is managed by [lat.md](https://www.npmjs.com/package/lat.md) — a tool that anchors source code to these definitions. Install the `lat` command with `npm i -g lat.md` and run `lat --help`.

## What lives here, and what does not

The graph answers "what does this plugin model, and why". Consumer instructions and per-rule reference stay where they are.

- `README.md` — quick starts, navigation, and concise configuration guidance; detailed settings, generated rule tables, and historical migration are expandable references.
- `docs/rules/*.md` — one generated page per rule, with applicability, false-positive and false-negative ledgers, and evidence. Authoritative for rule-level detail.
- `docs/decisions.md` — lifecycle decisions with their 3.0 reassessment triggers.
- `docs/non-goals.md` — rejected rule ideas and the conditions that would reopen them.
- `docs/release.md` — release mechanics and governance.

A lat section should never restate a generated table. Link to the page instead.

## How to use it

Navigate and validate the knowledge base with three commands:

- `lat search "<question>"` finds sections semantically.
- `lat section "context#Authoring"` shows one section with its links and incoming references.
- `lat check` validates every link, index entry, and code reference.

## Files

This index lists every file in the graph with a one-line summary.

- [[domain]] — Script surfaces, authoring forms, JavaScript modes, and the release axis.
- [[context]] — How a file is classified, and what each confidence level permits.
- [[analysis]] — Identity, mutation, and path-sensitive analysis behind the rules.
- [[rules]] — The catalog as the single rule registry, and the mandated rule shape.
- [[engine]] — The instance JavaScript engine capability matrix, per mode and release.
- [[glide]] — The GlideRecord and GlideAggregate method manifest and its method roles.
- [[fluent]] — The Fluent SDK model: manifests, id requirements, and declaration snapshots.
- [[invariants]] — The properties the repository's own gates enforce.
- [[tests]] — Test specifications for those invariants, each bound to a test.
