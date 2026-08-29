# oxfmt

oxfmt does not load custom formatter plugins. This package ships a recommended configuration, not a formatter implementation.

## Use the preset

TypeScript:

```ts
import { defineConfig } from "oxfmt";
import { recommendedOxfmtConfig } from "oxc-plugin-servicenow/oxfmt";

export default defineConfig(recommendedOxfmtConfig);
```

JSON:

```bash
cp node_modules/oxc-plugin-servicenow/oxfmt.recommended.json .oxfmtrc.json
```

Then run:

```bash
npx oxfmt --write .
```

## What the preset does

| Files | Style |
| --- | --- |
| `**/*.now.ts` | TypeScript / Fluent. Single quotes. Trailing commas. Width 100. |
| `**/*.{server,client,br,si}.js`, `**/*.ui-action.js`, `src/{server,client}/**` | Classic Studio style. Double quotes. No trailing commas. Width 120. Compound UI Action suffixes such as `.client.ui-action.js` and `.server.ui-action.js` are included. |
| `**/.now/**`, `keys.ts` | Ignored SDK sync artifacts. |

CI formats the dedicated fixtures and all eight example `valid` trees with `--check`.
