# servicenow/prefer-now-include

Large inline `script` / HTML / CSS payloads belong in their own file and should be loaded with `Now.include()`.

- **Family:** fluent
- **Preset:** recommended
- **Default severity:** warn
- **Fixable:** no
- **Suggestions:** no

## Incorrect

### ❌ inline novel

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

### ✅ Now.include

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

## See also

- [ServiceNow Fluent overview](https://servicenow.github.io/sdk/guides/fluent-overview)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
