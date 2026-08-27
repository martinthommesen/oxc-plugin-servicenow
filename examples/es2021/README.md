# Australia ES2021 server scripts

Promise, async/await, `Object.hasOwn()`, corrected `BigInt.asUintN()` narrowing, BigInt64 typed arrays, and the seven Set composition methods are Supported. Private instance members and DataView BigInt getters are Not Supported; `for await` is Disallowed.

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
    "release": "australia",
    "surfaces": [
      "server"
    ]
  }
}
```
