# servicenow/require-business-rule-wrapper

Full-script Business Rules must wrap logic in the standard IIFE so top-level variables do not leak. The rule is silent unless `businessRuleSourceFormat` is `full-script`.

- **Family:** classic
- **Preset:** recommended
- **Default severity:** error
- **Fixable:** no
- **Suggestions:** no

## Incorrect

### ❌ unwrapped

```js
var targetGroup = gs.getProperty("x_acme.target_group");
if (current.assignment_group.nil()) {
  current.assignment_group = targetGroup;
}
```

## Correct

### ✅ IIFE wrapper

```js
(function executeRule(current, previous) {
  var targetGroup = gs.getProperty("x_acme.target_group");
  if (current.assignment_group.nil()) {
    current.assignment_group = targetGroup;
  }
})(current, previous);
```

## See also

- [ServiceNow Fluent overview](https://servicenow.github.io/sdk/guides/fluent-overview)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
