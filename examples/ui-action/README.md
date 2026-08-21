# UI Actions

A mixed UI Action is two scripts: one client file and one server file. Leave `surfaces` on `auto` so `.client.ui-action.js` and `.ui-action.js` classify separately. For a mixed record, keep those two files.

## Commands

1. Install `oxc-plugin-servicenow`, `oxlint`, and `oxfmt`.
2. Run `npx oxlint -c .oxlintrc.json valid` and expect no plugin diagnostics.
3. Run `npx oxlint -c .oxlintrc.json invalid` and expect the documented rules.
4. Run `npx oxfmt -c oxfmt.config.ts --check valid`.

## Settings

```json
{
  "servicenow": {
    "surfaces": "auto"
  }
}
```
