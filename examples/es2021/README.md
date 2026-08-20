# ES2021 server scripts

Promise and async/await are allowed. `for await` remains banned.

## Commands

1. Install `oxc-plugin-servicenow`, `oxlint`, and `oxfmt`.
2. Run `npx oxlint -c .oxlintrc.json valid` and expect no plugin diagnostics.
3. Run `npx oxlint -c .oxlintrc.json invalid` and expect the documented rules.
4. Run `npx oxfmt -c oxfmt.config.ts --check valid`.

## Settings

```json
{
  "servicenow": {
    "javascriptMode": "es2021",
    "surfaces": [
      "server"
    ]
  }
}
```
