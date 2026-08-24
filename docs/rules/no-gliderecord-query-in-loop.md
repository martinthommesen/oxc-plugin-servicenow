# servicenow/no-gliderecord-query-in-loop

A query inside a proven record cursor loop is an N+1 pattern. Direct IIFEs and stable one-call-site local helpers inherit cursor depth. GlideRecord uses release-keyed executors and `.next()` / `._next()`; GlideAggregate uses its directly documented `query()` / `.next()` lifecycle. Unrelated iterators stay silent.

- **Family:** classic
- **Preset:** strict
- **Placements:** strict (warn)
- **Default severity:** warn
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to server, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Actions require an explicit server surface; mixed client/server UI Actions stay silent because execution regions are not classified. Unknown surfaces stay silent.
- **JavaScript mode:** Not instance-executed, or independent of JavaScript mode unless a rule documents a mode gate.
- **Last verified:** 2026-08-24
- **Implementation:** [`src/rules/no-gliderecord-query-in-loop.ts`](../../src/rules/no-gliderecord-query-in-loop.ts)

## Applicability

| Dimension | Value |
| --- | --- |
| Authoring | classic |
| Surfaces | Applies to server, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Actions require an explicit server surface; mixed client/server UI Actions stay silent because execution regions are not classified. Unknown surfaces stay silent. |
| Minimum surface confidence | filename-inferred |
| JavaScript modes | n/a |
| Application scopes | global, scoped, unknown |
| ServiceNow releases | zurich, australia |
| Fluent SDK range | n/a |

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| _(none)_ | | | This rule has no options. |

## Incorrect

### Incorrect: nested get

```js
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  var caller = new GlideRecord("sys_user");
  caller.get(incident.getValue("caller_id"));
  gs.info(caller.getDisplayValue());
}
```

### Incorrect: query in a stable helper

```js
function loadCaller(id) {
  var caller = new GlideRecord("sys_user");
  caller.get(id);
}
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) loadCaller(incident.getValue("caller_id"));
```

## Correct

### Correct: display value

```js
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  gs.info(incident.getDisplayValue("caller_id"));
}
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. false-negative: Mutable helpers and helpers with multiple direct call sites stay silent because shared provenance is not call-context-sensitive. false-negative: Indirect `.call()`, `.apply()`, `.bind()`, constructor, and deferred callback invocations do not inherit cursor depth. false-negative: A possible platform constructor namespace reassignment, prototype or relevant instance-method mutation, or dynamic-scope uncertainty suppresses matching diagnostics throughout the file. lifecycle: A proven GlideRecord next() / _next() or GlideAggregate next() receiver establishes cursor depth. Direct IIFEs and direct calls to an unmodified local function with one statically visible call site inherit that depth. GlideRecord executors must be definite for the configured scope. GlideAggregate analysis follows its directly documented query() / next() lifecycle; inherited or undocumented executors and cursor aliases stay silent.

## Known false positives

- None recorded.

## Known false negatives

- Mutable helpers and helpers with multiple direct call sites stay silent because shared provenance is not call-context-sensitive.
- Indirect `.call()`, `.apply()`, `.bind()`, constructor, and deferred callback invocations do not inherit cursor depth.
- A possible platform constructor namespace reassignment, prototype or relevant instance-method mutation, or dynamic-scope uncertainty suppresses matching diagnostics throughout the file.

## Intentional scope boundaries

- None recorded.

## Overlaps

- `servicenow/require-query-before-next`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: A proven GlideRecord next() / _next() or GlideAggregate next() receiver establishes cursor depth. Direct IIFEs and direct calls to an unmodified local function with one statically visible call site inherit that depth. GlideRecord executors must be definite for the configured scope. GlideAggregate analysis follows its directly documented query() / next() lifecycle; inherited or undocumented executors and cursor aliases stay silent.

## Evidence

- **A documented GlideRecord query executor inside a next() or _next() loop is an N+1 pattern.**
  - Verification ID: `rule-evidence-7780d508`
  - URL: https://www.servicenow.com/docs/r/zurich/api-reference/server-api-reference/c_GlideRecordScopedAPI.html
  - Verified by: manual
  - Verified at: 2026-08-22
- **GlideAggregate documents query() and next() for aggregate cursor iteration.**
  - Verification ID: `rule-evidence-14a281ed`
  - URL: https://www.servicenow.com/docs/r/zurich/api-reference/server-api-reference/c_GlideAggregateScopedAPI.html
  - Verified by: manual
  - Verified at: 2026-08-22
- **Strict hosts report a nested query inside a proven cursor loop.**
  - Verification ID: `rule-evidence-7856011f`
  - URL: tests/integration/profiles/invalid/nested-cursor-query.br.js
  - Verified by: integration-test
  - Verified at: 2026-08-20
- **Custom iterators with next() do not establish cursor depth.**
  - Verification ID: `rule-evidence-8f290b53`
  - URL: tests/integration/profiles/valid/custom-iterator-loop.br.js
  - Verified by: integration-test
  - Verified at: 2026-08-20
- **Stable one-call-site local helpers inherit cursor depth; mutable, multiply called, generator, shadowed, and indirect helpers stay silent.**
  - Verification ID: `rule-evidence-81ea46a1`
  - URL: tests/rules/phase3.test.ts
  - Verified by: fixture
  - Verified at: 2026-08-22
- **Constructor namespace, prototype, instance-method, and dynamic-scope mutations are covered by shared platform-authority fixtures.**
  - Verification ID: `rule-evidence-e0b6a0ca`
  - URL: tests/rules/platform-method-authority.test.ts
  - Verified by: fixture
  - Verified at: 2026-08-24
- **The Australia-scoped GlideRecord API was reviewed for the methods and lifecycle facts used by this rule.**
  - Verification ID: `rule-evidence-0aa93fce`
  - URL: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html
  - Verified by: manual
  - Verified at: 2026-08-22
- **The Australia-global GlideRecord API was reviewed for the methods and lifecycle facts used by this rule.**
  - Verification ID: `rule-evidence-2bc8eb5d`
  - URL: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordAPI.html
  - Verified by: manual
  - Verified at: 2026-08-22
- **The Australia-scoped GlideAggregate API was reviewed for the methods and lifecycle facts used by this rule.**
  - Verification ID: `rule-evidence-6b04aafc`
  - URL: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideAggregateScopedAPI.html
  - Verified by: manual
  - Verified at: 2026-08-22
- **The Australia-global GlideAggregate API was reviewed for the methods and lifecycle facts used by this rule.**
  - Verification ID: `rule-evidence-b2643a55`
  - URL: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideAggregateAPI.html
  - Verified by: manual
  - Verified at: 2026-08-22

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
