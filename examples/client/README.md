# Client and Catalog Client Scripts

Do not use client GlideRecord. Use GlideAjax with `sysparm_name` and an async callback.

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
      "client"
    ]
  }
}
```
