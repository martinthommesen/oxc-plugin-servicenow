# servicenow/prefer-now-include

Large inline `script` / HTML / CSS payloads belong in their own file and should be loaded with `Now.include()`.

- **Family:** fluent
- **Preset:** strict
- **Placements:** strict (warn)
- **Default severity:** warn
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** fluent
- **Surfaces:** Fluent `.now.ts` metadata only.
- **JavaScript mode:** Not instance-executed, or independent of JavaScript mode unless a rule documents a mode gate.
- **Last verified:** 2026-08-20
- **Implementation:** [`src/rules/prefer-now-include.ts`](../../src/rules/prefer-now-include.ts)
- **Fluent manifest:** sdk-docs-2026-03
- **Fluent SDK versions:** 3.0.0, 3.0.1, 3.0.2, 3.0.3, 4.0.0, 4.0.1, 4.0.2, 4.1.0, 4.1.1, 4.2.0, 4.3.0, 4.4.0, 4.4.1, 4.5.0, 4.6.0, 4.6.1, 4.7.0, 4.7.1, 4.7.2, 4.8.0, 4.8.1, 4.9.0, 4.9.1, 4.9.2, 4.10.0, 4.10.1, 4.11.0 (unspecified selects 4.11.0)

## Applicability

| Dimension | Value |
| --- | --- |
| Authoring | fluent |
| Surfaces | Fluent `.now.ts` metadata only. |
| Minimum surface confidence | filename-inferred |
| JavaScript modes | n/a |
| Application scopes | global, scoped, unknown |
| ServiceNow releases | zurich |
| Fluent SDK range | 3.0.0 \|\| 4.1.0 \|\| 4.8.0 \|\| 4.10.0 \|\| 4.10.1 \|\| 4.11.0 |

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `maxLines` | integer | `8` | Line count that treats an inline payload as large. |
| `maxChars` | integer | `400` | Character count that treats an inline payload as large. |

## Incorrect

### Incorrect: inline novel

```ts
import { BusinessRule } from "@servicenow/sdk/core";

BusinessRule({
  $id: Now.ID["log-state"],
  table: "incident",
  name: "Log state",
  when: "after",
  action: ["update"],
  script: `
    (function executeRule(current, previous) {
      var gr = new GlideRecord("sys_journal_field");
      gr.initialize();
      gr.element_id = current.sys_id;
      gr.value = "state changed";
      gr.insert();
      gs.info(current.number);
      gs.info(previous.state);
      gs.info(current.state);
    })(current, previous);
  `,
});
```

## Correct

### Correct: Now.include

```ts
import { BusinessRule } from "@servicenow/sdk/core";

BusinessRule({
  $id: Now.ID["log-state"],
  table: "incident",
  name: "Log state",
  when: "after",
  action: ["update"],
  script: Now.include("../server/log-state.server.js"),
});
```

## Limitations

Unknown, escaped, or ambiguous bindings stay silent instead of guessing.

## Known false positives

- None recorded.

## Known false negatives

- None recorded.

## Intentional scope boundaries

- None recorded.

## Overlaps

- `servicenow/no-complex-fluent-logic`

## Fix safety

- Classification: diagnostic only
- Lifecycle assumptions: No extra lifecycle assumptions.

## Evidence

- **Now.include() loads script and markup files so Fluent metadata stays declarative.**
  - Verification ID: `rule-evidence-1f16b099`
  - URL: https://www.servicenow.com/docs/r/application-development/servicenow-sdk/fluent-constructs.html
  - Verified by: manual
  - Verified at: 2026-08-20
- **Catalog examples cover large inline script versus Now.include.**
  - Verification ID: `rule-evidence-4548a481`
  - URL: src/catalog.ts
  - Verified by: fixture
  - Verified at: 2026-08-20

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
