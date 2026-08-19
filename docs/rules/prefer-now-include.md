# servicenow/prefer-now-include

Large inline `script` / HTML / CSS payloads belong in their own file and should be loaded with `Now.include()`.

- **Family:** fluent
- **Preset:** strict
- **Placements:** strict (warn)
- **Default severity:** warn
- **Fix safety:** diagnostic only
- **Suggestions:** no
- **Authoring:** fluent
- **Surfaces:** Fluent `.now.ts` metadata only
- **JavaScript mode:** Not instance-executed
- **Implementation:** [`src/rules/prefer-now-include.ts`](../../src/rules/prefer-now-include.ts)
- **Fluent manifest:** sdk-docs-2026-03

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

When provenance, surface, or JavaScript mode is unknown, the rule stays silent instead of guessing.

## Evidence

- None recorded. Add an authoritative ServiceNow or Oxc link before expanding this rule.

## See also

- [Contributor rule-authoring guide](../rule-authoring.md)
- [Project non-goals](../non-goals.md)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
