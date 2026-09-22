import type { Rule } from "@oxlint/plugins";
import type * as metadata from "../catalog-metadata.js";
import type { RuleOptionDoc, RuleOptionsDescriptor } from "../options/descriptor.js";
import type {
  ApplicationScope,
  JavaScriptMode,
  ServiceNowRelease,
  ServiceNowSettings,
} from "../types.js";

export type RuleFamily = "classic" | "fluent" | "engine";
export type RuleProfile =
  | "recommended"
  | "strict"
  | "classic-es5"
  | "es2021"
  | "client"
  | "acl"
  | "business-rule"
  | "fluent"
  | "policy"
  | "security";
export interface RulePlacement {
  profile: RuleProfile;
  severity: "warn" | "error";
}
export interface RuleApplicability {
  authoring: "classic" | "fluent" | "both";
  surfaces: string;
  javascriptMode: string;
  minimumSurfaceConfidence: metadata.SurfaceConfidence;
  javascriptModes: readonly JavaScriptMode[] | "n/a";
  scopes: readonly ApplicationScope[];
  serviceNowReleases: readonly ServiceNowRelease[];
  fluentSdkRange?: string | undefined;
}
export interface RuleExample {
  name: string;
  filename?: string;
  code: string;
  settings?: ServiceNowSettings;
}
export interface RuleLimitationCase extends RuleExample {
  caseId: string;
  kind: "false-positive" | "false-negative" | "scope-boundary";
  description: string;
}
export type { RuleOptionDoc };

export interface RuleCatalogEntry {
  name: string;
  implementation: Rule;
  ruleId: string;
  title: string;
  family: RuleFamily;
  severity: "error" | "warn";
  fixable: boolean;
  hasSuggestions: boolean;
  description: string;
  docsUrl: string;
  bad: RuleExample[];
  good: RuleExample[];
  placements: readonly RulePlacement[];
  applicability: RuleApplicability;
  evidence: readonly metadata.RuleEvidenceRecord[];
  limitations: string;
  limitationCases: readonly RuleLimitationCase[];
  falsePositives: readonly string[];
  falseNegatives: readonly string[];
  scopeBoundaries: readonly string[];
  overlaps: readonly string[];
  lifecycleAssumptions?: string | undefined;
  limitationPreamble?: string | undefined;
  fixKind: "none" | "safe-fix" | "suggestion";
  optionDescriptor: RuleOptionsDescriptor<object> | undefined;
  options: readonly RuleOptionDoc[];
  lastVerified: string;
}
export type RuleCatalogInput = Omit<
  RuleCatalogEntry,
  | "name"
  | "implementation"
  | "ruleId"
  | "docsUrl"
  | "applicability"
  | "limitations"
  | "falsePositives"
  | "falseNegatives"
  | "scopeBoundaries"
  | "fixKind"
  | "options"
  | "lastVerified"
  | "optionDescriptor"
> &
  metadata.RuleDocMetadata & {
    optionDescriptor: RuleOptionsDescriptor<object> | undefined;
    limitationCases: readonly RuleLimitationCase[];
  };
