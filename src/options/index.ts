export {
  optionDocsFromDescriptor,
  parseRuleOptions,
  schemaFromDescriptor,
  typeName,
} from "./descriptor.js";
export type {
  BooleanOptionField,
  EnumOptionField,
  IntegerOptionField,
  OptionField,
  RuleOptionDoc,
  RuleOptionsDescriptor,
  StringArrayOptionField,
  StringOptionField,
} from "./descriptor.js";
export {
  RULE_OPTION_DESCRIPTORS,
  fluentNamingConventionOptions,
  noHardcodedSysidOptions,
  noHardcodedTableNamesOptions,
  preferNowIncludeOptions,
  requireFluentIdOptions,
} from "./descriptors.js";
export type {
  ConfigurableRuleName,
  FluentNamingOptions,
  NamingStyle,
  NoHardcodedSysIdOptions,
  NoHardcodedTableNamesOptions,
  PreferNowIncludeOptions,
  RequireFluentIdOptions,
} from "./descriptors.js";
