# Compatibility-mode server scripts

Use `configs.classicEs5Rules` or set `javascriptMode` to `compatibility`. Recommended stays silent on Promise until the mode is known.

## Commands

1. Install `oxc-plugin-servicenow`, `oxlint`, and `oxfmt`.
2. Run `npx oxlint -c .oxlintrc.json valid` and expect no plugin diagnostics.
3. Run `npx oxlint -c .oxlintrc.json invalid` and expect the documented rules.
4. Run `npx oxfmt -c oxfmt.config.ts --check valid`.

## Settings

```json
{
  "servicenow": {
    "javascriptMode": "compatibility",
    "surfaces": [
      "server"
    ]
  }
}
```
