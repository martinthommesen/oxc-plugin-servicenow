import { ACL_FILE_GLOBS } from "../context/filename.js";

/**
 * Recommended oxfmt configuration for ServiceNow Fluent + classic scripts.
 *
 * oxfmt does not currently support custom formatting plugins the way Prettier
 * does. This preset is the supported extension point: a complete, copy-paste
 * (or `defineConfig`) configuration with file-type overrides.
 *
 * @see https://oxc.rs/docs/guide/usage/formatter/config.html
 */
// Type aliases, not interfaces, on purpose: oxfmt's own OxfmtOverrideConfig
// carries an open index signature, and only a type alias gets the implicit
// index signature that keeps the preset assignable to it. An interface would
// need an explicit `[key: string]: unknown`, which silently accepts typos
// (FINDINGS.md MNT-007).
export type OxfmtOverride = {
  files: string[];
  excludeFiles?: string[];
  options: Record<string, unknown>;
};

export type OxfmtConfig = {
  $schema?: string;
  printWidth: number;
  tabWidth: number;
  useTabs: boolean;
  semi: boolean;
  singleQuote: boolean;
  trailingComma: "all" | "es5" | "none";
  ignorePatterns: string[];
  overrides: OxfmtOverride[];
};

/**
 * Defaults tuned for mixed Fluent + classic ServiceNow repos:
 *
 * - Fluent `.now.ts` uses modern TypeScript style (single quotes, trailing commas).
 * - Classic ES5-ish Business Rules / Client Scripts keep double quotes and no
 *   trailing commas so they stay close to what Studio authors expect.
 * - Generated / sync artefacts under `.now/` are ignored.
 */
export const recommendedOxfmtConfig: OxfmtConfig = {
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  trailingComma: "all",
  ignorePatterns: [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/.now/**",
    "**/keys.ts",
    "**/*.min.js",
  ],
  overrides: [
    {
      files: ["**/*.now.ts", "**/*.now.tsx"],
      options: {
        printWidth: 100,
        singleQuote: true,
        trailingComma: "all",
        semi: true,
      },
    },
    {
      files: [
        "**/*.server.js",
        "**/*.client.js",
        "**/*.br.js",
        "**/*.si.js",
        "**/*.client.ui-action.js",
        "**/*.server.ui-action.js",
        "**/*.ui-action.js",
        "**/src/server/**/*.js",
        "**/src/client/**/*.js",
        ...ACL_FILE_GLOBS,
      ],
      options: {
        printWidth: 120,
        singleQuote: false,
        trailingComma: "none",
        semi: true,
      },
    },
    {
      files: ["**/now.config.json", "**/.oxlintrc.json", "**/.oxfmtrc.json"],
      options: {
        printWidth: 80,
        trailingComma: "none",
      },
    },
  ],
};

export const recommended = recommendedOxfmtConfig;
