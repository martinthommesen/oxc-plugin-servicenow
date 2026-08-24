# servicenow/no-glideelement-in-collection

Direct GlideRecord field access and path-proven local aliases are GlideElements tied to the cursor. Do not `push` / `unshift` them inside a `.next()` or `._next()` loop.

- **Family:** classic
- **Preset:** recommended
- **Placements:** recommended (error), business-rule (error)
- **Default severity:** error
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** classic
- **Surfaces:** Applies to server, business-rule, script-include, ui-action, scheduled-script, fix-script when those surfaces are known. UI Actions require an explicit server surface; mixed client/server UI Actions stay silent because execution regions are not classified. Unknown surfaces stay silent.
- **JavaScript mode:** Not instance-executed, or independent of JavaScript mode unless a rule documents a mode gate.
- **Last verified:** 2026-08-24
- **Implementation:** [`src/rules/no-glideelement-in-collection.ts`](../../src/rules/no-glideelement-in-collection.ts)

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

### Incorrect: push field

```js
var numbers = [];
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  numbers.push(incident.number);
}
```

### Incorrect: push field alias

```js
var numbers = [];
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  var number = incident.number;
  numbers.push(number);
}
```

## Correct

### Correct: getValue

```js
var numbers = [];
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  numbers.push(incident.getValue("number"));
}
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing. scope-boundary: Separately declared helpers and deferred callbacks stay silent because their invocation timing and value flow are not proven by the cursor traversal. false-negative: A possible platform constructor namespace reassignment, prototype or relevant instance-method mutation, or dynamic-scope uncertainty suppresses matching diagnostics throughout the file.

## Known false positives

- None recorded.

## Known false negatives

- A possible platform constructor namespace reassignment, prototype or relevant instance-method mutation, or dynamic-scope uncertainty suppresses matching diagnostics throughout the file.

## Intentional scope boundaries

- Separately declared helpers and deferred callbacks stay silent because their invocation timing and value flow are not proven by the cursor traversal.

## Overlaps

- None recorded.

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **A GlideElement follows a cursor advanced by next() or _next(); collections must store extracted values.**
  - Verification ID: `rule-evidence-8f2af49a`
  - URL: https://www.servicenow.com/docs/r/zurich/api-reference/server-api-reference/c_GlideRecordScopedAPI.html
  - Verified by: manual
  - Verified at: 2026-08-22
- **Recommended hosts report pushing a cursor field into an array.**
  - Verification ID: `rule-evidence-f581ef18`
  - URL: tests/integration/profiles/invalid/glideelement-push.br.js
  - Verified by: integration-test
  - Verified at: 2026-08-20
- **Path-sensitive fixtures cover local aliases, reassignment, shadowing, all-path joins, and IIFE parameters.**
  - Verification ID: `rule-evidence-ff2c032d`
  - URL: tests/rules/layer3-consumers.test.ts
  - Verified by: fixture
  - Verified at: 2026-08-22
- **Constructor namespace, prototype, instance-method, and dynamic-scope mutations are covered by shared platform-authority fixtures.**
  - Verification ID: `rule-evidence-b5231bb8`
  - URL: tests/rules/platform-method-authority.test.ts
  - Verified by: fixture
  - Verified at: 2026-08-24
- **The Australia-scoped GlideRecord API was reviewed for the methods and lifecycle facts used by this rule.**
  - Verification ID: `rule-evidence-ba597f84`
  - URL: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordScopedAPI.html
  - Verified by: manual
  - Verified at: 2026-08-22
- **The Australia-global GlideRecord API was reviewed for the methods and lifecycle facts used by this rule.**
  - Verification ID: `rule-evidence-d3948e5f`
  - URL: https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideRecordAPI.html
  - Verified by: manual
  - Verified at: 2026-08-22

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
