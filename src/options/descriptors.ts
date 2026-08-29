import type { RuleOptionsDescriptor } from "./descriptor.js";

export interface NoHardcodedSysIdOptions {
  allowedSysIds: string[];
  ignoreHashNames: boolean;
}

export interface NoHardcodedTableNamesOptions {
  allowedTables: string[];
  allowBuiltins: boolean;
}

export interface RequireFluentIdOptions {
  preferNowId: boolean;
}

export interface PreferNowIncludeOptions {
  maxLines: number;
  maxChars: number;
}

export type NamingStyle = "kebab-case" | "snake_case" | "either";

export interface FluentNamingOptions {
  idStyle: NamingStyle;
  fileStyle: NamingStyle;
}

export const noHardcodedSysidOptions: RuleOptionsDescriptor<NoHardcodedSysIdOptions> = {
  ruleName: "no-hardcoded-sysid",
  fields: {
    allowedSysIds: {
      kind: "stringArray",
      default: [],
      description:
        "Additional sys_ids that this rule allows. Settings `allowedSysIds` are also allowed.",
    },
    ignoreHashNames: {
      kind: "boolean",
      default: true,
      description:
        "Ignore 32-character hex values whose nearest variable, property, or assignment owner name looks like an MD5 hash.",
    },
  },
};

export const noHardcodedTableNamesOptions: RuleOptionsDescriptor<NoHardcodedTableNamesOptions> = {
  ruleName: "no-hardcoded-table-names",
  fields: {
    allowedTables: {
      kind: "stringArray",
      default: [],
      description:
        "Additional table names this rule allows. Settings `allowedTables` are also allowed.",
    },
    allowBuiltins: {
      kind: "boolean",
      default: false,
      description: "Allow the built-in platform table list from `BUILTIN_TABLES`.",
    },
  },
};

export const requireFluentIdOptions: RuleOptionsDescriptor<RequireFluentIdOptions> = {
  ruleName: "require-fluent-id",
  fields: {
    preferNowId: {
      kind: "boolean",
      default: true,
      description: "Warn when `$id` is a raw string or sys_id instead of `Now.ID`.",
    },
  },
};

export const preferNowIncludeOptions: RuleOptionsDescriptor<PreferNowIncludeOptions> = {
  ruleName: "prefer-now-include",
  fields: {
    maxLines: {
      kind: "integer",
      default: 8,
      minimum: 1,
      description: "Line count that treats an inline payload as large.",
    },
    maxChars: {
      kind: "integer",
      default: 400,
      minimum: 1,
      description: "Character count that treats an inline payload as large.",
    },
  },
};

const NAMING_STYLES = ["kebab-case", "snake_case", "either"] as const;

export const fluentNamingConventionOptions: RuleOptionsDescriptor<FluentNamingOptions> = {
  ruleName: "fluent-naming-convention",
  fields: {
    idStyle: {
      kind: "enum",
      values: NAMING_STYLES,
      default: "kebab-case",
      description: "Required style for `Now.ID` keys.",
    },
    fileStyle: {
      kind: "enum",
      values: NAMING_STYLES,
      default: "kebab-case",
      description: "Required style for `.now.ts` filenames.",
    },
  },
};
