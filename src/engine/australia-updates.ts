import type { EngineFeatureId } from "./features.js";

export const AUSTRALIA_ENGINE_UPDATE_EVIDENCE = Object.freeze({
  url: "https://www.servicenow.com/docs/r/api-reference/scripts/updates-javascript-engine.html",
  officialReleaseLabel: "Australia",
  officialUpdatedAt: "2026-03-12",
  reviewedAt: "2026-08-24",
});

export type AustraliaEngineUpdateMode = "all" | "es5" | "es2021";
export type AustraliaEngineUpdateType = "feature" | "fix";

export type AustraliaEngineUpdateDisposition =
  | {
      readonly kind: "diagnostic";
      readonly featureIds: readonly EngineFeatureId[];
      readonly ruleIds: readonly string[];
      readonly rationale: string;
    }
  | {
      readonly kind: "metadata-only";
      readonly featureIds: readonly EngineFeatureId[];
      readonly rationale: string;
    }
  | {
      readonly kind: "pending";
      readonly rationale: string;
    };

export interface AustraliaEngineUpdate {
  readonly id: string;
  readonly pullRequests: readonly number[];
  readonly description: string;
  readonly mode: AustraliaEngineUpdateMode;
  readonly updateType: AustraliaEngineUpdateType;
  readonly disposition: AustraliaEngineUpdateDisposition;
}

/**
 * Complete row-for-row snapshot of ServiceNow's Australia Rhino update table.
 * Pending entries are explicit engineering work, not implied support.
 */
export const AUSTRALIA_ENGINE_UPDATES = [
  {
    id: "rhino-2048-error-iserror",
    pullRequests: [2048],
    description: "Add Error.isError",
    mode: "es2021",
    updateType: "feature",
    disposition: {
      kind: "diagnostic",
      featureIds: ["error-iserror"],
      ruleIds: ["no-unsupported-static-methods"],
      rationale: "The static owner and method availability are modeled release-conservatively.",
    },
  },
  {
    id: "rhino-2029-set-methods",
    pullRequests: [2029],
    description: "Add new Set methods",
    mode: "es2021",
    updateType: "feature",
    disposition: {
      kind: "diagnostic",
      featureIds: ["set-methods"],
      ruleIds: ["no-unsupported-set-methods"],
      rationale: "Stable native Set receivers and Australia-added method names are modeled.",
    },
  },
  {
    id: "rhino-2025-promise-try",
    pullRequests: [2025],
    description: "Add Promise.try",
    mode: "es2021",
    updateType: "feature",
    disposition: {
      kind: "diagnostic",
      featureIds: ["promise-try"],
      ruleIds: ["no-unsupported-static-methods"],
      rationale: "The static owner and method availability are modeled release-conservatively.",
    },
  },
  {
    id: "rhino-1966-typed-array-factories",
    pullRequests: [1966],
    description: "Add TypedArray.from and TypedArray.of",
    mode: "es2021",
    updateType: "feature",
    disposition: {
      kind: "diagnostic",
      featureIds: ["typed-array-factories"],
      ruleIds: ["no-typed-arrays"],
      rationale:
        "Constructor and static-factory availability are tracked as separate capabilities.",
    },
  },
  {
    id: "rhino-1980-promise-withresolvers",
    pullRequests: [1980],
    description: "Add Promise.withResolvers",
    mode: "es2021",
    updateType: "feature",
    disposition: {
      kind: "diagnostic",
      featureIds: ["promise-withresolvers"],
      ruleIds: ["no-unsupported-static-methods"],
      rationale: "The static owner and method availability are modeled release-conservatively.",
    },
  },
  {
    id: "rhino-1905-arraybuffer-detachment",
    pullRequests: [1905],
    description: "Support ArrayBuffer detachment",
    mode: "es2021",
    updateType: "feature",
    disposition: {
      kind: "pending",
      rationale:
        "A useful diagnostic must first prove a detachment source and a later affected buffer, typed-array, or DataView operation without assuming unavailable host APIs.",
    },
  },
  {
    id: "rhino-1896-date-fraction-digits",
    pullRequests: [1896],
    description: "Enhance date string parsing with optional millisecond digits",
    mode: "all",
    updateType: "feature",
    disposition: {
      kind: "diagnostic",
      featureIds: ["date-fraction-digits"],
      ruleIds: ["no-unsupported-date-fraction"],
      rationale:
        "Static valid ISO strings with release-dependent fractional precision are modeled.",
    },
  },
  {
    id: "rhino-1751-1872-symbol-hasinstance",
    pullRequests: [1751, 1872],
    description: "Support Symbol.hasInstance on Function.prototype",
    mode: "es2021",
    updateType: "feature",
    disposition: {
      kind: "pending",
      rationale:
        "The review must separate explicit Function.prototype[Symbol.hasInstance] use from ordinary instanceof behavior and prove Symbol/Function authority.",
    },
  },
  {
    id: "rhino-1870-string-regexp-methods",
    pullRequests: [1870],
    description: "Rework String.prototype.search, replace, replaceAll, and split",
    mode: "es2021",
    updateType: "feature",
    disposition: {
      kind: "pending",
      rationale:
        "The upstream change spans RegExp protocol dispatch and edge-case result semantics; actionable pre-Australia patterns require case-by-case proof.",
    },
  },
  {
    id: "rhino-2073-2107-duplicate-object-keys",
    pullRequests: [2073, 2107],
    description: "Support duplicate keys in object literals",
    mode: "es2021",
    updateType: "fix",
    disposition: {
      kind: "pending",
      rationale:
        "Release-specific parser behavior must be reconciled with Oxlint and ESLint core duplicate-key diagnostics before adding overlapping guidance.",
    },
  },
  {
    id: "rhino-2097-eval-function-result",
    pullRequests: [2097],
    description: "Calling eval of a function returns undefined",
    mode: "es2021",
    updateType: "fix",
    disposition: {
      kind: "pending",
      rationale:
        "A diagnostic needs a static eval source, direct-eval authority, and proof that the release-dependent completion value is observed.",
    },
  },
  {
    id: "rhino-2065-template-literal-conversion",
    pullRequests: [2065],
    description: "Correct template literal to string conversion",
    mode: "es2021",
    updateType: "fix",
    disposition: {
      kind: "pending",
      rationale:
        "Object-to-primitive conversion can execute user code; a rule requires narrow provenance and side-effect proof to avoid speculative diagnostics.",
    },
  },
  {
    id: "rhino-2060-compiled-strict-mode",
    pullRequests: [2060],
    description: "Don't propagate strict mode when compiling scripts",
    mode: "es5",
    updateType: "fix",
    disposition: {
      kind: "pending",
      rationale:
        "The affected dynamic compilation entrypoints and observable strictness dependency must be proven before source-level guidance is safe.",
    },
  },
  {
    id: "rhino-1979-bigint-narrowing",
    pullRequests: [1979],
    description: "Support BigInt.asUintN and BigInt.asIntN",
    mode: "es2021",
    updateType: "fix",
    disposition: {
      kind: "diagnostic",
      featureIds: ["bigint-narrowing"],
      ruleIds: ["no-incorrect-bigint-asuintn"],
      rationale:
        "Literal negative asUintN inputs with provably different legacy results are modeled.",
    },
  },
  {
    id: "rhino-1860-function-call-apply-thisarg",
    pullRequests: [1860],
    description: "Correct this in apply and call",
    mode: "es2021",
    updateType: "fix",
    disposition: {
      kind: "metadata-only",
      featureIds: ["function-call-apply-thisarg"],
      rationale:
        "Legacy behavior depends on strictness and Rhino's interpreted-versus-compiled path, which source analysis cannot select reliably.",
    },
  },
  {
    id: "rhino-1982-array-from-thisarg",
    pullRequests: [1982],
    description: "Correct this in Array.from",
    mode: "es2021",
    updateType: "fix",
    disposition: {
      kind: "diagnostic",
      featureIds: ["array-from-thisarg"],
      ruleIds: ["no-incorrect-array-from-thisarg"],
      rationale: "Stable native calls with syntax-proven mapper semantics are modeled.",
    },
  },
  {
    id: "rhino-1945-require-this",
    pullRequests: [1945],
    description: "Correct this in require",
    mode: "es2021",
    updateType: "fix",
    disposition: {
      kind: "pending",
      rationale:
        "A rule needs reliable identification of ServiceNow module source and a proven observable top-level this dependency.",
    },
  },
  {
    id: "rhino-1774-method-constructors",
    pullRequests: [1774],
    description: "Don't allow methods to be used as constructors",
    mode: "es2021",
    updateType: "fix",
    disposition: {
      kind: "diagnostic",
      featureIds: ["object-method-construction"],
      ruleIds: ["no-object-method-constructor"],
      rationale:
        "Stable shorthand object-method construction is modeled without assuming class behavior.",
    },
  },
  {
    id: "rhino-1806-block-function-hoisting",
    pullRequests: [1806],
    description: "Fix hoisting behavior",
    mode: "all",
    updateType: "fix",
    disposition: {
      kind: "diagnostic",
      featureIds: ["block-function-hoisting"],
      ruleIds: ["no-unhoisted-block-function-use"],
      rationale: "Stable reachable reads before nested block declarations are modeled.",
    },
  },
] as const satisfies readonly AustraliaEngineUpdate[];
