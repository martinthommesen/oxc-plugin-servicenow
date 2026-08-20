# Business Rules

Set `businessRuleSourceFormat` to `full-script` or `body-only`. Filename alone does not enable the wrapper rule. Timing uses `businessRuleWhen` and stays unknown unless you set it.

## Commands

1. Install `oxc-plugin-servicenow`, `oxlint`, and `oxfmt`.
2. Run `npx oxlint -c .oxlintrc.json valid` and expect no plugin diagnostics.
3. Run `npx oxlint -c .oxlintrc.json invalid` and expect the documented rules.
4. Run `npx oxfmt -c oxfmt.config.ts --check valid`.

## Settings

```json
{
  "servicenow": {
    "surfaces": [
      "business-rule"
    ],
    "businessRuleSourceFormat": "full-script"
  }
}
```
